import os
import re
import unicodedata
from typing import Any

from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .db import check_db_connection, get_connection
from .geo import haversine_distance_km

load_dotenv()

app = FastAPI(title="NutriSocial API")
allowed_difficulties = {"Facil", "Media", "Alta"}


def parse_allowed_origins() -> list[str]:
    raw_value = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    origins = [item.strip() for item in raw_value.split(",") if item.strip()]
    return origins or ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)})


@app.exception_handler(Exception)
def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"message": "Error interno del servidor", "error": safe_error(exc)})


def safe_error(error: Exception) -> str:
    return str(error) or "Unknown database error"


def normalize_slug(text: Any) -> str:
    value = str(text or "").strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-")


def number_or(value: Any, fallback: float = 0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed


def int_or(value: Any, fallback: int = 0) -> int:
    return int(number_or(value, fallback))


def parse_nullable_coordinate(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def validate_coordinate_range(lat: float | None, lng: float | None) -> None:
    if lat is not None and not -90 <= lat <= 90:
        raise HTTPException(status_code=400, detail={"message": "latitude fuera de rango"})
    if lng is not None and not -180 <= lng <= 180:
        raise HTTPException(status_code=400, detail={"message": "longitude fuera de rango"})


def ensure_record_exists(table: str, field: str, value: Any, message: str) -> None:
    if value in (None, ""):
        return
    row = query_one(f"SELECT {field} FROM {table} WHERE {field} = %s LIMIT 1", (value,))
    if not row:
        raise HTTPException(status_code=400, detail={"message": message})


def query_all(sql: str, params: tuple = ()) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()


def query_one(sql: str, params: tuple = ()) -> dict | None:
    rows = query_all(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple = ()) -> int:
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.lastrowid or cursor.rowcount


def ensure_schema() -> None:
    migrations = [
        ("stores", "description", "TEXT NULL", "name"),
        ("stores", "address", "VARCHAR(255) NULL", "description"),
        ("stores", "latitude", "DECIMAL(10, 7) NULL", "address"),
        ("stores", "longitude", "DECIMAL(10, 7) NULL", "latitude"),
        ("stores", "image_url", "VARCHAR(500) NULL", "accent"),
        ("products", "reference_amount", "DECIMAL(10, 2) NOT NULL DEFAULT 100.00", "store_id"),
        ("products", "reference_unit", "VARCHAR(30) NOT NULL DEFAULT 'g'", "reference_amount"),
        ("recipes", "steps", "TEXT NULL", "description"),
        ("recipes", "calories_total", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00", "difficulty"),
        ("recipes", "protein_total", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00", "calories_total"),
        ("recipes", "carbs_total", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00", "protein_total"),
        ("recipes", "fat_total", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00", "carbs_total"),
    ]

    with get_connection() as conn:
        with conn.cursor() as cursor:
            for table, column, definition, after in migrations:
                cursor.execute(f"SHOW COLUMNS FROM `{table}` LIKE %s", (column,))
                if cursor.fetchone():
                    continue
                cursor.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition} AFTER `{after}`")

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS product_store_listings (
                  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                  product_id BIGINT UNSIGNED NOT NULL,
                  store_id VARCHAR(50) NOT NULL,
                  price DECIMAL(10, 2) NULL,
                  currency CHAR(3) NOT NULL DEFAULT 'EUR',
                  availability_status ENUM('unknown', 'in_stock', 'low_stock', 'out_of_stock') NOT NULL DEFAULT 'unknown',
                  offer_text VARCHAR(255) NULL,
                  store_product_url VARCHAR(500) NULL,
                  last_checked_at DATETIME NULL,
                  source_provider VARCHAR(120) NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT fk_psl_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
                  CONSTRAINT fk_psl_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE ON UPDATE CASCADE,
                  UNIQUE KEY uq_psl_product_store (product_id, store_id),
                  INDEX idx_psl_store (store_id),
                  INDEX idx_psl_status (availability_status)
                )
                """
            )
            cursor.execute(
                """
                INSERT INTO product_store_listings
                  (product_id, store_id, price, availability_status, source_provider, last_checked_at)
                SELECT
                  p.id,
                  p.store_id,
                  p.price,
                  CASE WHEN p.stock > 0 THEN 'in_stock' ELSE 'out_of_stock' END,
                  'internal_seed',
                  NOW()
                FROM products p
                WHERE p.store_id IS NOT NULL
                ON DUPLICATE KEY UPDATE
                  price = VALUES(price),
                  availability_status = VALUES(availability_status),
                  updated_at = CURRENT_TIMESTAMP
                """
            )


@app.on_event("startup")
def startup() -> None:
    check_db_connection()
    ensure_schema()


@app.get("/api/health")
def health() -> dict:
    try:
        check_db_connection()
        users_count = query_one("SELECT COUNT(*) AS total FROM users")["total"]
        recipes_count = query_one("SELECT COUNT(*) AS total FROM recipes")["total"]
        products_count = query_one("SELECT COUNT(*) AS total FROM products")["total"]
        return {
            "ok": True,
            "service": app.title,
            "db": "connected",
            "metrics": {
                "users": users_count,
                "recipes": recipes_count,
                "products": products_count,
            },
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={"ok": False, "db": "disconnected", "error": safe_error(error)},
        ) from error


def stores_query() -> str:
    return """
      SELECT
        s.id, s.name, s.description, s.address, s.city, s.latitude, s.longitude, s.logo, s.accent, s.image_url,
        COUNT(p.id) AS products_count
      FROM stores s
      LEFT JOIN products p ON p.store_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC
    """


@app.get("/api/stores")
def get_stores() -> list[dict]:
    return query_all(stores_query())


@app.get("/api/markets")
def get_markets() -> list[dict]:
    return query_all(stores_query())


def create_store(payload: dict, default_logo: str, error_label: str) -> dict:
    name = payload.get("name")
    city = payload.get("city")
    if not name or not city:
        raise HTTPException(status_code=400, detail={"message": "name y city son obligatorios"})

    base_id = normalize_slug(payload.get("id") or name)
    if not base_id:
        raise HTTPException(status_code=400, detail={"message": "No se pudo generar un id valido para la tienda"})

    lat = parse_nullable_coordinate(payload.get("latitude"))
    lng = parse_nullable_coordinate(payload.get("longitude"))
    validate_coordinate_range(lat, lng)

    try:
        candidate_id = base_id
        suffix = 1
        while query_one("SELECT id FROM stores WHERE id = %s LIMIT 1", (candidate_id,)):
            suffix += 1
            candidate_id = f"{base_id}-{suffix}"

        execute(
            """
            INSERT INTO stores
              (id, name, description, address, city, latitude, longitude, logo, accent, image_url, products_count)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
            """,
            (
                candidate_id,
                name,
                payload.get("description"),
                payload.get("address"),
                city,
                lat,
                lng,
                payload.get("logo") or default_logo,
                payload.get("accent") or "#3b82f6",
                payload.get("image_url"),
            ),
        )
        return {"ok": True, "id": candidate_id}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail={"message": f"No se pudo crear {error_label}", "error": safe_error(error)})


@app.post("/api/stores", status_code=201)
def post_store(payload: dict | None = Body(default=None)) -> dict:
    return create_store(payload or {}, "ST", "la tienda")


@app.post("/api/markets", status_code=201)
def post_market(payload: dict | None = Body(default=None)) -> dict:
    return create_store(payload or {}, "MK", "el mercado")


@app.put("/api/stores/{store_id}")
def put_store(store_id: str, payload: dict | None = Body(default=None)) -> dict:
    payload = payload or {}
    if not store_id.strip():
        raise HTTPException(status_code=400, detail={"message": "id de tienda invalido"})
    if not payload.get("name") or not payload.get("city"):
        raise HTTPException(status_code=400, detail={"message": "name y city son obligatorios"})

    lat = parse_nullable_coordinate(payload.get("latitude"))
    lng = parse_nullable_coordinate(payload.get("longitude"))
    validate_coordinate_range(lat, lng)

    row_count = execute(
        """
        UPDATE stores
        SET name = %s, description = %s, address = %s, city = %s, latitude = %s, longitude = %s,
            logo = %s, accent = %s, image_url = %s
        WHERE id = %s
        """,
        (
            payload.get("name"),
            payload.get("description"),
            payload.get("address"),
            payload.get("city"),
            lat,
            lng,
            payload.get("logo") or "ST",
            payload.get("accent") or "#3b82f6",
            payload.get("image_url"),
            store_id,
        ),
    )
    if not row_count:
        raise HTTPException(status_code=404, detail={"message": "Tienda no encontrada"})
    return {"ok": True}


@app.delete("/api/stores/{store_id}")
def delete_store(store_id: str) -> dict:
    if not store_id.strip():
        raise HTTPException(status_code=400, detail={"message": "id de tienda invalido"})
    if not query_one("SELECT id FROM stores WHERE id = %s LIMIT 1", (store_id,)):
        raise HTTPException(status_code=404, detail={"message": "Tienda no encontrada"})
    products_count = query_one("SELECT COUNT(*) AS total FROM products WHERE store_id = %s", (store_id,))["total"]
    if int(products_count) > 0:
        raise HTTPException(
            status_code=409,
            detail={"message": "No se puede eliminar la tienda porque tiene productos asociados. Borra o mueve esos productos primero."},
        )
    execute("DELETE FROM stores WHERE id = %s", (store_id,))
    return {"ok": True}


@app.get("/api/users")
def get_users() -> list[dict]:
    return query_all(
        "SELECT id, name, handle, email, city, bio, avatar_url, verified, created_at FROM users ORDER BY created_at DESC"
    )


@app.post("/api/users", status_code=201)
def post_user(payload: dict | None = Body(default=None)) -> dict:
    payload = payload or {}
    if not payload.get("name") or not payload.get("handle") or not payload.get("email"):
        raise HTTPException(status_code=400, detail={"message": "name, handle y email son obligatorios"})
    if "@" not in str(payload.get("email")):
        raise HTTPException(status_code=400, detail={"message": "email invalido"})
    if query_one("SELECT id FROM users WHERE handle = %s LIMIT 1", (payload.get("handle"),)):
        raise HTTPException(status_code=409, detail={"message": "El handle ya existe"})
    if query_one("SELECT id FROM users WHERE email = %s LIMIT 1", (payload.get("email"),)):
        raise HTTPException(status_code=409, detail={"message": "El email ya existe"})
    new_id = execute(
        "INSERT INTO users (name, handle, email, city, bio, avatar_url, verified) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (
            payload.get("name"),
            payload.get("handle"),
            payload.get("email"),
            payload.get("city"),
            payload.get("bio"),
            payload.get("avatar_url"),
            1 if payload.get("verified") else 0,
        ),
    )
    return {"ok": True, "id": new_id}


@app.get("/api/products")
def get_products(storeId: str | None = None) -> list[dict]:
    select_sql = """
      SELECT id, name, category, brand, store_id, reference_amount, reference_unit, image_url,
             price, stock, calories, protein, carbs, fat
      FROM products
    """
    if storeId and storeId.strip():
        return query_all(f"{select_sql} WHERE store_id = %s ORDER BY created_at DESC", (storeId,))
    return query_all(f"{select_sql} ORDER BY created_at DESC")


@app.get("/api/products/search")
def search_products(q: str = "", limit: int = Query(default=20, ge=1, le=50)) -> list[dict]:
    query = q.strip()
    if not query:
        return []
    like = f"%{query}%"
    return query_all(
        """
        SELECT p.id, p.name, p.brand, p.category, p.reference_amount, p.reference_unit
        FROM products p
        WHERE p.name LIKE %s OR p.brand LIKE %s OR p.category LIKE %s
        ORDER BY p.name ASC
        LIMIT %s
        """,
        (like, like, like, limit),
    )


@app.get("/api/products/{product_id}/nearby-stores")
def nearby_stores(product_id: int, lat: float, lng: float, radiusKm: float = 25) -> dict:
    if product_id <= 0:
        raise HTTPException(status_code=400, detail={"message": "id de producto invalido"})
    validate_coordinate_range(lat, lng)
    if radiusKm <= 0 or radiusKm > 100:
        raise HTTPException(status_code=400, detail={"message": "radiusKm debe estar entre 0 y 100"})

    normalized_radius = radiusKm
    product = query_one(
        """
        SELECT id, name, brand, category, reference_amount, reference_unit
        FROM products
        WHERE id = %s
        LIMIT 1
        """,
        (product_id,),
    )
    if not product:
        return {"product": None, "stores": [], "radiusKm": normalized_radius}

    rows = query_all(
        """
        SELECT
          s.id AS store_id, s.name AS store_name, s.address AS store_address, s.city AS store_city,
          s.latitude AS store_latitude, s.longitude AS store_longitude,
          psl.price, psl.currency, psl.availability_status, psl.offer_text, psl.store_product_url,
          psl.last_checked_at, psl.source_provider,
          p.id AS product_id, p.name AS product_name, p.brand AS product_brand, p.category AS product_category,
          p.reference_amount, p.reference_unit
        FROM product_store_listings psl
        INNER JOIN stores s ON s.id = psl.store_id
        INNER JOIN products p ON p.id = psl.product_id
        WHERE psl.product_id = %s
          AND s.latitude IS NOT NULL
          AND s.longitude IS NOT NULL
        LIMIT 40
        """,
        (product_id,),
    )

    stores = []
    for row in rows:
        distance = haversine_distance_km(
            {"lat": lat, "lng": lng},
            {"lat": row["store_latitude"], "lng": row["store_longitude"]},
        )
        if distance is None or distance > normalized_radius:
            continue
        stores.append(
            {
                "id": row["store_id"],
                "name": row["store_name"],
                "address": row["store_address"],
                "city": row["store_city"],
                "latitude": float(row["store_latitude"]),
                "longitude": float(row["store_longitude"]),
                "distance_km": round(distance, 2),
                "product": {
                    "id": row["product_id"],
                    "name": row["product_name"],
                    "brand": row["product_brand"],
                    "category": row["product_category"],
                    "reference_amount": float(row["reference_amount"]),
                    "reference_unit": row["reference_unit"],
                },
                "listing": {
                    "price": None if row["price"] is None else float(row["price"]),
                    "currency": row["currency"],
                    "availability_status": row["availability_status"],
                    "offer_text": row["offer_text"],
                    "store_product_url": row["store_product_url"],
                    "last_checked_at": row["last_checked_at"],
                    "source_provider": row["source_provider"],
                },
            }
        )

    stores.sort(key=lambda item: item["distance_km"])
    return {
        "product": {
            "id": product["id"],
            "name": product["name"],
            "brand": product["brand"],
            "category": product["category"],
            "reference_amount": float(product["reference_amount"]),
            "reference_unit": product["reference_unit"],
        },
        "stores": stores,
        "radiusKm": normalized_radius,
    }


def product_payload_values(payload: dict) -> tuple:
    return (
        payload.get("name"),
        payload.get("category"),
        payload.get("brand"),
        payload.get("store_id"),
        number_or(payload.get("reference_amount"), 100),
        payload.get("reference_unit") or "g",
        payload.get("image_url"),
        number_or(payload.get("price"), 0),
        max(0, int_or(payload.get("stock"), 0)),
        max(0, int_or(payload.get("calories"), 0)),
        number_or(payload.get("protein"), 0),
        number_or(payload.get("carbs"), 0),
        number_or(payload.get("fat"), 0),
    )


def validate_product(payload: dict) -> None:
    if not payload.get("name") or not payload.get("category") or not payload.get("brand") or not payload.get("store_id"):
        raise HTTPException(status_code=400, detail={"message": "name, category, brand y store_id son obligatorios"})
    if number_or(payload.get("reference_amount"), 0) <= 0:
        raise HTTPException(status_code=400, detail={"message": "reference_amount debe ser mayor que 0"})
    ensure_record_exists("stores", "id", payload.get("store_id"), "La tienda indicada no existe")


@app.post("/api/products", status_code=201)
def post_product(payload: dict | None = Body(default=None)) -> dict:
    payload = payload or {}
    validate_product(payload)
    new_id = execute(
        """
        INSERT INTO products
          (name, category, brand, store_id, reference_amount, reference_unit, image_url, price, stock, calories, protein, carbs, fat)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        product_payload_values(payload),
    )
    return {"ok": True, "id": new_id}


@app.put("/api/products/{product_id}")
def put_product(product_id: int, payload: dict | None = Body(default=None)) -> dict:
    payload = payload or {}
    if product_id <= 0:
        raise HTTPException(status_code=400, detail={"message": "id de producto invalido"})
    validate_product(payload)
    row_count = execute(
        """
        UPDATE products
        SET name = %s, category = %s, brand = %s, store_id = %s, reference_amount = %s, reference_unit = %s,
            image_url = %s, price = %s, stock = %s, calories = %s, protein = %s, carbs = %s, fat = %s
        WHERE id = %s
        """,
        (*product_payload_values(payload), product_id),
    )
    if not row_count:
        raise HTTPException(status_code=404, detail={"message": "Producto no encontrado"})
    return {"ok": True}


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int) -> dict:
    if product_id <= 0:
        raise HTTPException(status_code=400, detail={"message": "id de producto invalido"})
    if not query_one("SELECT id FROM products WHERE id = %s LIMIT 1", (product_id,)):
        raise HTTPException(status_code=404, detail={"message": "Producto no encontrado"})
    recipes_count = query_one("SELECT COUNT(*) AS total FROM recipe_ingredients WHERE product_id = %s", (product_id,))["total"]
    if int(recipes_count) > 0:
        raise HTTPException(
            status_code=409,
            detail={"message": "No se puede eliminar el producto porque esta en recetas. Quita primero ese ingrediente de las recetas."},
        )
    execute("DELETE FROM products WHERE id = %s", (product_id,))
    return {"ok": True}


@app.get("/api/recipes")
def get_recipes() -> list[dict]:
    return query_all(
        """
        SELECT
          r.id, r.title, r.description, r.steps, r.image_url, r.servings, r.prep_time, r.difficulty,
          r.calories_total, r.protein_total, r.carbs_total, r.fat_total, r.created_at,
          u.id AS user_id, u.name AS user_name, u.handle AS user_handle,
          s.id AS store_id, s.name AS store_name,
          COUNT(ri.product_id) AS ingredients_count
        FROM recipes r
        INNER JOIN users u ON u.id = r.user_id
        LEFT JOIN stores s ON s.id = r.store_id
        LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        GROUP BY r.id
        ORDER BY r.created_at DESC
        """
    )


@app.get("/api/recipes/{recipe_id}")
def get_recipe(recipe_id: int) -> dict:
    if recipe_id <= 0:
        raise HTTPException(status_code=400, detail={"message": "id de receta invalido"})
    recipe = query_one(
        """
        SELECT
          r.id, r.title, r.description, r.steps, r.image_url, r.servings, r.prep_time, r.difficulty,
          r.calories_total, r.protein_total, r.carbs_total, r.fat_total, r.created_at,
          u.id AS user_id, u.name AS user_name, u.handle AS user_handle,
          s.id AS store_id, s.name AS store_name
        FROM recipes r
        INNER JOIN users u ON u.id = r.user_id
        LEFT JOIN stores s ON s.id = r.store_id
        WHERE r.id = %s
        """,
        (recipe_id,),
    )
    if not recipe:
        raise HTTPException(status_code=404, detail={"message": "Receta no encontrada"})
    recipe["ingredients"] = query_all(
        """
        SELECT
          p.id AS product_id, p.name, p.brand, p.category,
          p.calories, p.protein, p.carbs, p.fat, p.reference_amount, p.reference_unit,
          ri.quantity, ri.unit
        FROM recipe_ingredients ri
        INNER JOIN products p ON p.id = ri.product_id
        WHERE ri.recipe_id = %s
        """,
        (recipe_id,),
    )
    return recipe


def build_shopping_plan(recipe_ids: list[int]) -> dict:
    if len(recipe_ids) == 0:
        return {
            "recipes": [],
            "items": [],
            "stores": [],
            "summary": {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "estimated_cost": 0.0},
        }

    placeholders = ", ".join(["%s"] * len(recipe_ids))
    recipe_rows = query_all(
        f"""
        SELECT id, title, store_id, calories_total, protein_total, carbs_total, fat_total
        FROM recipes
        WHERE id IN ({placeholders})
        ORDER BY created_at DESC
        """,
        tuple(recipe_ids),
    )
    found_ids = {int(row["id"]) for row in recipe_rows}
    missing_ids = [recipe_id for recipe_id in recipe_ids if recipe_id not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail={"message": f"Recetas no encontradas: {', '.join(str(item) for item in missing_ids)}"})

    ingredient_rows = query_all(
        f"""
        SELECT
          r.id AS recipe_id,
          r.title AS recipe_title,
          p.id AS product_id,
          p.name,
          p.brand,
          p.category,
          p.store_id,
          p.price,
          p.reference_amount,
          p.reference_unit,
          ri.quantity,
          ri.unit,
          s.name AS store_name,
          s.city AS store_city
        FROM recipe_ingredients ri
        INNER JOIN recipes r ON r.id = ri.recipe_id
        INNER JOIN products p ON p.id = ri.product_id
        LEFT JOIN stores s ON s.id = p.store_id
        WHERE ri.recipe_id IN ({placeholders})
        ORDER BY p.category ASC, p.name ASC
        """,
        tuple(recipe_ids),
    )

    grouped_items: dict[tuple[int, str], dict] = {}
    grouped_stores: dict[str, dict] = {}
    estimated_cost_total = 0.0

    for row in ingredient_rows:
        product_id = int(row["product_id"])
        unit = row["unit"] or row["reference_unit"] or "g"
        key = (product_id, unit)
        quantity = max(0.0, number_or(row["quantity"], 0))
        reference_amount = max(0.0001, number_or(row["reference_amount"], 100))
        estimated_cost = max(0.0, number_or(row["price"], 0)) * (quantity / reference_amount)
        estimated_cost_total += estimated_cost

        if key not in grouped_items:
            grouped_items[key] = {
                "product_id": product_id,
                "name": row["name"],
                "brand": row["brand"],
                "category": row["category"],
                "quantity": 0.0,
                "unit": unit,
                "estimated_cost": 0.0,
                "recipes": [],
                "store_id": row["store_id"],
            }

        grouped_items[key]["quantity"] += quantity
        grouped_items[key]["estimated_cost"] += estimated_cost
        if row["recipe_title"] not in grouped_items[key]["recipes"]:
            grouped_items[key]["recipes"].append(row["recipe_title"])

        store_id = row["store_id"]
        if store_id:
            if store_id not in grouped_stores:
                grouped_stores[store_id] = {
                    "store_id": store_id,
                    "store_name": row["store_name"],
                    "store_city": row["store_city"],
                    "items": 0,
                    "estimated_cost": 0.0,
                }
            grouped_stores[store_id]["items"] += 1
            grouped_stores[store_id]["estimated_cost"] += estimated_cost

    summary = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "estimated_cost": round(estimated_cost_total, 2)}
    for recipe in recipe_rows:
        summary["calories"] += number_or(recipe["calories_total"], 0)
        summary["protein"] += number_or(recipe["protein_total"], 0)
        summary["carbs"] += number_or(recipe["carbs_total"], 0)
        summary["fat"] += number_or(recipe["fat_total"], 0)

    items = sorted(grouped_items.values(), key=lambda item: (str(item["category"]), str(item["name"])))
    stores = sorted(grouped_stores.values(), key=lambda store: (-int(store["items"]), float(store["estimated_cost"])))
    recipes = [
        {
            "id": int(recipe["id"]),
            "title": recipe["title"],
            "store_id": recipe["store_id"],
            "calories_total": number_or(recipe["calories_total"], 0),
            "protein_total": number_or(recipe["protein_total"], 0),
            "carbs_total": number_or(recipe["carbs_total"], 0),
            "fat_total": number_or(recipe["fat_total"], 0),
        }
        for recipe in recipe_rows
    ]

    return {
        "recipes": recipes,
        "items": [
            {
                **item,
                "quantity": round(number_or(item["quantity"], 0), 2),
                "estimated_cost": round(number_or(item["estimated_cost"], 0), 2),
            }
            for item in items
        ],
        "stores": [
            {
                **store,
                "estimated_cost": round(number_or(store["estimated_cost"], 0), 2),
            }
            for store in stores
        ],
        "summary": {
            "calories": round(summary["calories"], 2),
            "protein": round(summary["protein"], 2),
            "carbs": round(summary["carbs"], 2),
            "fat": round(summary["fat"], 2),
            "estimated_cost": round(summary["estimated_cost"], 2),
        },
    }


@app.post("/api/shopping-plan/preview")
def preview_shopping_plan(payload: dict | None = Body(default=None)) -> dict:
    payload = payload or {}
    recipe_ids = payload.get("recipe_ids")
    if not isinstance(recipe_ids, list):
        raise HTTPException(status_code=400, detail={"message": "recipe_ids debe ser una lista"})

    normalized_ids: list[int] = []
    seen: set[int] = set()
    for value in recipe_ids:
        recipe_id = int_or(value, 0)
        if recipe_id <= 0:
            raise HTTPException(status_code=400, detail={"message": "Todos los recipe_ids deben ser validos"})
        if recipe_id in seen:
            continue
        seen.add(recipe_id)
        normalized_ids.append(recipe_id)

    return build_shopping_plan(normalized_ids)


def resolve_ingredients_with_totals(cursor, ingredients: list[dict]) -> tuple[list[dict], float, float, float, float]:
    ingredient_rows = []
    calories_total = protein_total = carbs_total = fat_total = 0.0

    for item in ingredients:
        product_id = int_or(item.get("product_id"), 0)
        quantity = number_or(item.get("quantity"), 1)
        unit = item.get("unit") or "unidad"
        if product_id <= 0:
            raise ValueError("Cada ingrediente debe tener product_id valido")

        cursor.execute(
            "SELECT id, calories, protein, carbs, fat, reference_amount FROM products WHERE id = %s LIMIT 1",
            (product_id,),
        )
        product = cursor.fetchone()
        if not product:
            raise ValueError(f"Producto {product_id} no encontrado")

        ref_amount = max(0.0001, number_or(product["reference_amount"], 100))
        factor = max(0, quantity) / ref_amount
        calories_total += number_or(product["calories"], 0) * factor
        protein_total += number_or(product["protein"], 0) * factor
        carbs_total += number_or(product["carbs"], 0) * factor
        fat_total += number_or(product["fat"], 0) * factor
        ingredient_rows.append({"product_id": product_id, "quantity": max(0, quantity), "unit": unit})

    return ingredient_rows, calories_total, protein_total, carbs_total, fat_total


def validate_recipe_payload(payload: dict) -> None:
    if not payload.get("user_id") or not payload.get("title"):
        raise HTTPException(status_code=400, detail={"message": "user_id y title son obligatorios"})
    if not isinstance(payload.get("ingredients"), list) or len(payload.get("ingredients")) == 0:
        raise HTTPException(status_code=400, detail={"message": "ingredients debe tener al menos un elemento"})
    if payload.get("difficulty", "Media") not in allowed_difficulties:
        raise HTTPException(status_code=400, detail={"message": "difficulty debe ser 'Facil', 'Media' o 'Alta'"})
    ensure_record_exists("users", "id", payload.get("user_id"), "El usuario indicado no existe")
    ensure_record_exists("stores", "id", payload.get("store_id"), "La tienda indicada no existe")


@app.post("/api/recipes", status_code=201)
def post_recipe(payload: dict | None = Body(default=None)) -> dict:
    payload = payload or {}
    validate_recipe_payload(payload)
    with get_connection(autocommit=False) as conn:
        try:
            with conn.cursor() as cursor:
                ingredient_rows, calories_total, protein_total, carbs_total, fat_total = resolve_ingredients_with_totals(
                    cursor, payload["ingredients"]
                )
                cursor.execute(
                    """
                    INSERT INTO recipes
                      (user_id, store_id, title, description, steps, image_url, servings, prep_time, difficulty,
                       calories_total, protein_total, carbs_total, fat_total)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.get("user_id"),
                        payload.get("store_id"),
                        payload.get("title"),
                        payload.get("description"),
                        payload.get("steps"),
                        payload.get("image_url"),
                        max(1, int_or(payload.get("servings"), 1)),
                        max(0, int_or(payload.get("prep_time"), 0)),
                        payload.get("difficulty", "Media"),
                        calories_total,
                        protein_total,
                        carbs_total,
                        fat_total,
                    ),
                )
                recipe_id = cursor.lastrowid
                for item in ingredient_rows:
                    cursor.execute(
                        "INSERT INTO recipe_ingredients (recipe_id, product_id, quantity, unit) VALUES (%s, %s, %s, %s)",
                        (recipe_id, item["product_id"], item["quantity"], item["unit"]),
                    )
            conn.commit()
            return {"ok": True, "id": recipe_id}
        except Exception as error:
            conn.rollback()
            raise HTTPException(status_code=500, detail={"message": "No se pudo crear la receta", "error": safe_error(error)})


@app.put("/api/recipes/{recipe_id}")
def put_recipe(recipe_id: int, payload: dict | None = Body(default=None)) -> dict:
    payload = payload or {}
    if recipe_id <= 0:
        raise HTTPException(status_code=400, detail={"message": "id de receta invalido"})
    validate_recipe_payload(payload)
    with get_connection(autocommit=False) as conn:
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM recipes WHERE id = %s LIMIT 1", (recipe_id,))
                if not cursor.fetchone():
                    conn.rollback()
                    raise HTTPException(status_code=404, detail={"message": "Receta no encontrada"})

                ingredient_rows, calories_total, protein_total, carbs_total, fat_total = resolve_ingredients_with_totals(
                    cursor, payload["ingredients"]
                )
                cursor.execute(
                    """
                    UPDATE recipes
                    SET user_id = %s, store_id = %s, title = %s, description = %s, steps = %s, image_url = %s,
                        servings = %s, prep_time = %s, difficulty = %s, calories_total = %s,
                        protein_total = %s, carbs_total = %s, fat_total = %s
                    WHERE id = %s
                    """,
                    (
                        payload.get("user_id"),
                        payload.get("store_id"),
                        payload.get("title"),
                        payload.get("description"),
                        payload.get("steps"),
                        payload.get("image_url"),
                        max(1, int_or(payload.get("servings"), 1)),
                        max(0, int_or(payload.get("prep_time"), 0)),
                        payload.get("difficulty", "Media"),
                        calories_total,
                        protein_total,
                        carbs_total,
                        fat_total,
                        recipe_id,
                    ),
                )
                cursor.execute("DELETE FROM recipe_ingredients WHERE recipe_id = %s", (recipe_id,))
                for item in ingredient_rows:
                    cursor.execute(
                        "INSERT INTO recipe_ingredients (recipe_id, product_id, quantity, unit) VALUES (%s, %s, %s, %s)",
                        (recipe_id, item["product_id"], item["quantity"], item["unit"]),
                    )
            conn.commit()
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as error:
            conn.rollback()
            raise HTTPException(status_code=500, detail={"message": "No se pudo actualizar la receta", "error": safe_error(error)})


@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: int) -> dict:
    if recipe_id <= 0:
        raise HTTPException(status_code=400, detail={"message": "id de receta invalido"})
    row_count = execute("DELETE FROM recipes WHERE id = %s", (recipe_id,))
    if not row_count:
        raise HTTPException(status_code=404, detail={"message": "Receta no encontrada"})
    return {"ok": True}


@app.get("/api/bootstrap")
def bootstrap() -> dict:
    users = query_all("SELECT id, name, handle, email, city, bio, avatar_url, verified FROM users ORDER BY created_at DESC")
    stores = query_all(stores_query())
    products = query_all(
        """
        SELECT id, name, category, brand, store_id, reference_amount, reference_unit, image_url,
               price, stock, calories, protein, carbs, fat
        FROM products
        ORDER BY created_at DESC
        """
    )
    recipes = query_all(
        """
        SELECT id, user_id, store_id, title, description, steps, image_url, servings, prep_time, difficulty,
               calories_total, protein_total, carbs_total, fat_total, created_at
        FROM recipes
        ORDER BY created_at DESC
        """
    )
    return {"users": users, "stores": stores, "products": products, "recipes": recipes}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=int(os.getenv("API_PORT", "4000")), reload=True)
