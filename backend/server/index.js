import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDbConnection, pool } from './db.js'
import { findNearbyStoresForProduct } from './services/storeProductSearchService.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDistPath = path.resolve(__dirname, '../../dist')

const app = express()
const port = Number(process.env.PORT || process.env.API_PORT || 4000)
const allowedDifficulties = new Set(['Facil', 'Media', 'Alta'])
const passwordHashIterations = 100000
const passwordHashKeyLength = 64
const passwordHashDigest = 'sha512'

app.use(cors())
app.use(express.json())

function safeError(error) {
  return error instanceof Error ? error.message : 'Unknown database error'
}

function normalizeSlug(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseNullableCoordinate(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, passwordHashIterations, passwordHashKeyLength, passwordHashDigest)
    .toString('hex')

  return `${salt}:${hash}`
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) return false

  const [salt, expectedHash] = storedHash.split(':')
  const actualHash = hashPassword(password, salt).split(':')[1]

  if (actualHash.length !== expectedHash.length) return false
  return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'))
}

function authUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    avatar_url: user.avatar_url,
  }
}

async function resolveIngredientsWithTotals(conn, ingredients) {
  const ingredientRows = []
  let caloriesTotal = 0
  let proteinTotal = 0
  let carbsTotal = 0
  let fatTotal = 0

  for (const item of ingredients) {
    const productId = Number(item?.product_id)
    const quantity = numberOr(item?.quantity, 1)
    const unit = typeof item?.unit === 'string' && item.unit ? item.unit : 'unidad'

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error('Cada ingrediente debe tener product_id valido')
    }

    const [productRows] = await conn.execute(
      'SELECT id, calories, protein, carbs, fat, reference_amount FROM products WHERE id = ? LIMIT 1',
      [productId],
    )

    if (!productRows.length) {
      throw new Error(`Producto ${productId} no encontrado`)
    }

    const product = productRows[0]
    const refAmount = Math.max(0.0001, numberOr(product.reference_amount, 100))
    const factor = Math.max(0, quantity) / refAmount

    caloriesTotal += numberOr(product.calories, 0) * factor
    proteinTotal += numberOr(product.protein, 0) * factor
    carbsTotal += numberOr(product.carbs, 0) * factor
    fatTotal += numberOr(product.fat, 0) * factor

    ingredientRows.push({ productId, quantity: Math.max(0, quantity), unit })
  }

  return { ingredientRows, caloriesTotal, proteinTotal, carbsTotal, fatTotal }
}

async function ensureSchema() {
  const migrations = [
    { table: 'stores', column: 'description', definition: 'TEXT NULL', after: 'name' },
    { table: 'stores', column: 'address', definition: 'VARCHAR(255) NULL', after: 'description' },
    { table: 'stores', column: 'latitude', definition: 'DECIMAL(10, 7) NULL', after: 'address' },
    { table: 'stores', column: 'longitude', definition: 'DECIMAL(10, 7) NULL', after: 'latitude' },
    { table: 'stores', column: 'image_url', definition: 'VARCHAR(500) NULL', after: 'accent' },
    { table: 'users', column: 'password_hash', definition: 'VARCHAR(255) NULL', after: 'email' },
    { table: 'products', column: 'reference_amount', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 100.00', after: 'store_id' },
    { table: 'products', column: 'reference_unit', definition: "VARCHAR(30) NOT NULL DEFAULT 'g'", after: 'reference_amount' },
    { table: 'recipes', column: 'steps', definition: 'TEXT NULL', after: 'description' },
    { table: 'recipes', column: 'calories_total', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'difficulty' },
    { table: 'recipes', column: 'protein_total', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'calories_total' },
    { table: 'recipes', column: 'carbs_total', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'protein_total' },
    { table: 'recipes', column: 'fat_total', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'carbs_total' },
  ]

  for (const migration of migrations) {
    const [columns] = await pool.query(`SHOW COLUMNS FROM \`${migration.table}\` LIKE ?`, [migration.column])
    if (columns.length > 0) continue

    await pool.query(
      `ALTER TABLE \`${migration.table}\` ADD COLUMN \`${migration.column}\` ${migration.definition} AFTER \`${migration.after}\``,
    )
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS product_store_listings (
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
    )`,
  )

  await pool.query(
    `INSERT INTO product_store_listings
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
      updated_at = CURRENT_TIMESTAMP`,
  )
}

app.get('/api/health', async (_req, res) => {
  try {
    await checkDbConnection()
    const [[usersCount]] = await pool.query('SELECT COUNT(*) AS total FROM users')
    const [[recipesCount]] = await pool.query('SELECT COUNT(*) AS total FROM recipes')
    const [[productsCount]] = await pool.query('SELECT COUNT(*) AS total FROM products')

    res.json({
      ok: true,
      db: 'connected',
      metrics: {
        users: usersCount.total,
        recipes: recipesCount.total,
        products: productsCount.total,
      },
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      db: 'disconnected',
      error: safeError(error),
    })
  }
})

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const handle = normalizeSlug(req.body?.username ?? req.body?.handle ?? '')
  const password = String(req.body?.password ?? '')
  const confirmPassword = String(req.body?.confirm_password ?? req.body?.confirmPassword ?? '')

  if (!name || !handle || !password) {
    return res.status(400).json({ message: 'Nombre, usuario y contraseña son obligatorios' })
  }

  if (handle.length < 3) {
    return res.status(400).json({ message: 'El usuario debe tener al menos 3 caracteres' })
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden' })
  }

  try {
    const email = `${handle}@nutrisocial.local`
    const passwordHash = hashPassword(password)

    const [result] = await pool.execute(
      'INSERT INTO users (name, handle, email, password_hash, avatar_url, verified) VALUES (?, ?, ?, ?, ?, 0)',
      [name, handle, email, passwordHash, null],
    )

    res.status(201).json({
      ok: true,
      user: authUserResponse({ id: result.insertId, name, handle, avatar_url: null }),
    })
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ese usuario ya existe' })
    }

    res.status(500).json({
      message: 'No se pudo crear la cuenta',
      error: safeError(error),
    })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const handle = normalizeSlug(req.body?.username ?? req.body?.handle ?? '')
  const password = String(req.body?.password ?? '')

  if (!handle || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' })
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, name, handle, avatar_url, password_hash FROM users WHERE handle = ? LIMIT 1',
      [handle],
    )
    const user = rows[0]

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
    }

    res.json({ ok: true, user: authUserResponse(user) })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo iniciar sesión',
      error: safeError(error),
    })
  }
})

app.get('/api/stores', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        s.id, s.name, s.description, s.address, s.city, s.latitude, s.longitude, s.logo, s.accent, s.image_url,
        COUNT(p.id) AS products_count
      FROM stores s
      LEFT JOIN products p ON p.store_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC`,
    )
    res.json(rows)
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron cargar las tiendas',
      error: safeError(error),
    })
  }
})

app.post('/api/stores', async (req, res) => {
  const {
    id,
    name,
    description = null,
    address = null,
    city,
    latitude = null,
    longitude = null,
    logo = 'ST',
    accent = '#3b82f6',
    image_url = null,
  } = req.body ?? {}

  if (!name || !city) {
    return res.status(400).json({ message: 'name y city son obligatorios' })
  }

  const baseId = normalizeSlug(id || name)
  if (!baseId) {
    return res.status(400).json({ message: 'No se pudo generar un id valido para la tienda' })
  }

  const lat = parseNullableCoordinate(latitude)
  const lng = parseNullableCoordinate(longitude)
  if (lat !== null && (lat < -90 || lat > 90)) {
    return res.status(400).json({ message: 'latitude fuera de rango' })
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    return res.status(400).json({ message: 'longitude fuera de rango' })
  }

  try {
    let candidateId = baseId
    let suffix = 1

    while (true) {
      const [exists] = await pool.execute('SELECT id FROM stores WHERE id = ? LIMIT 1', [candidateId])
      if (!exists.length) break
      suffix += 1
      candidateId = `${baseId}-${suffix}`
    }

    await pool.execute(
      `INSERT INTO stores
        (id, name, description, address, city, latitude, longitude, logo, accent, image_url, products_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [candidateId, name, description, address, city, lat, lng, logo, accent, image_url],
    )

    res.status(201).json({ ok: true, id: candidateId })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo crear la tienda',
      error: safeError(error),
    })
  }
})

app.put('/api/stores/:id', async (req, res) => {
  const storeId = String(req.params.id ?? '').trim()
  const {
    name,
    description = null,
    address = null,
    city,
    latitude = null,
    longitude = null,
    logo = 'ST',
    accent = '#3b82f6',
    image_url = null,
  } = req.body ?? {}

  if (!storeId) {
    return res.status(400).json({ message: 'id de tienda invalido' })
  }

  if (!name || !city) {
    return res.status(400).json({ message: 'name y city son obligatorios' })
  }

  const lat = parseNullableCoordinate(latitude)
  const lng = parseNullableCoordinate(longitude)
  if (lat !== null && (lat < -90 || lat > 90)) {
    return res.status(400).json({ message: 'latitude fuera de rango' })
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    return res.status(400).json({ message: 'longitude fuera de rango' })
  }

  try {
    const [result] = await pool.execute(
      `UPDATE stores
       SET name = ?, description = ?, address = ?, city = ?, latitude = ?, longitude = ?, logo = ?, accent = ?, image_url = ?
       WHERE id = ?`,
      [name, description, address, city, lat, lng, logo, accent, image_url, storeId],
    )

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Tienda no encontrada' })
    }

    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo actualizar la tienda',
      error: safeError(error),
    })
  }
})

app.delete('/api/stores/:id', async (req, res) => {
  const storeId = String(req.params.id ?? '').trim()
  if (!storeId) {
    return res.status(400).json({ message: 'id de tienda invalido' })
  }

  try {
    const [[store]] = await pool.execute('SELECT id FROM stores WHERE id = ? LIMIT 1', [storeId])
    if (!store) {
      return res.status(404).json({ message: 'Tienda no encontrada' })
    }

    const [[productsCount]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM products WHERE store_id = ?',
      [storeId],
    )
    if (numberOr(productsCount.total, 0) > 0) {
      return res.status(409).json({
        message: 'No se puede eliminar la tienda porque tiene productos asociados. Borra o mueve esos productos primero.',
      })
    }

    await pool.execute('DELETE FROM stores WHERE id = ?', [storeId])
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo eliminar la tienda',
      error: safeError(error),
    })
  }
})

app.get('/api/markets', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        s.id, s.name, s.description, s.address, s.city, s.latitude, s.longitude, s.logo, s.accent, s.image_url,
        COUNT(p.id) AS products_count
      FROM stores s
      LEFT JOIN products p ON p.store_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC`,
    )
    res.json(rows)
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron cargar los mercados',
      error: safeError(error),
    })
  }
})

app.post('/api/markets', async (req, res) => {
  const {
    id,
    name,
    description = null,
    address = null,
    city,
    latitude = null,
    longitude = null,
    logo = 'MK',
    accent = '#3b82f6',
    image_url = null,
  } = req.body ?? {}

  if (!name || !city) {
    return res.status(400).json({ message: 'name y city son obligatorios' })
  }

  const baseId = normalizeSlug(id || name)
  if (!baseId) {
    return res.status(400).json({ message: 'No se pudo generar un id valido para la tienda' })
  }

  const lat = parseNullableCoordinate(latitude)
  const lng = parseNullableCoordinate(longitude)
  if (lat !== null && (lat < -90 || lat > 90)) {
    return res.status(400).json({ message: 'latitude fuera de rango' })
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    return res.status(400).json({ message: 'longitude fuera de rango' })
  }

  try {
    let candidateId = baseId
    let suffix = 1

    while (true) {
      const [exists] = await pool.execute('SELECT id FROM stores WHERE id = ? LIMIT 1', [candidateId])
      if (!exists.length) break
      suffix += 1
      candidateId = `${baseId}-${suffix}`
    }

    await pool.execute(
      `INSERT INTO stores
        (id, name, description, address, city, latitude, longitude, logo, accent, image_url, products_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [candidateId, name, description, address, city, lat, lng, logo, accent, image_url],
    )

    res.status(201).json({ ok: true, id: candidateId })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo crear el mercado',
      error: safeError(error),
    })
  }
})

app.get('/api/users', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, handle, email, city, bio, avatar_url, verified, created_at FROM users ORDER BY created_at DESC',
    )
    res.json(rows)
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron cargar los usuarios',
      error: safeError(error),
    })
  }
})

app.post('/api/users', async (req, res) => {
  const { name, handle, email, city = null, bio = null, avatar_url = null, verified = false } = req.body ?? {}

  if (!name || !handle || !email) {
    return res.status(400).json({ message: 'name, handle y email son obligatorios' })
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO users (name, handle, email, city, bio, avatar_url, verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, handle, email, city, bio, avatar_url, verified ? 1 : 0],
    )
    res.status(201).json({ ok: true, id: result.insertId })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo crear el usuario',
      error: safeError(error),
    })
  }
})

app.get('/api/products', async (req, res) => {
  const { storeId } = req.query
  const hasStoreFilter = typeof storeId === 'string' && storeId.trim().length > 0
  const sql = hasStoreFilter
    ? 'SELECT id, name, category, brand, store_id, reference_amount, reference_unit, image_url, price, stock, calories, protein, carbs, fat FROM products WHERE store_id = ? ORDER BY created_at DESC'
    : 'SELECT id, name, category, brand, store_id, reference_amount, reference_unit, image_url, price, stock, calories, protein, carbs, fat FROM products ORDER BY created_at DESC'

  try {
    const [rows] = hasStoreFilter ? await pool.execute(sql, [storeId]) : await pool.query(sql)
    res.json(rows)
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron cargar los productos',
      error: safeError(error),
    })
  }
})

app.get('/api/products/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)

  if (!q) {
    return res.json([])
  }

  try {
    const like = `%${q}%`
    const [rows] = await pool.execute(
      `SELECT
        p.id,
        p.name,
        p.brand,
        p.category,
        p.reference_amount,
        p.reference_unit
      FROM products p
      WHERE p.name LIKE ? OR p.brand LIKE ? OR p.category LIKE ?
      ORDER BY p.name ASC
      LIMIT ?`,
      [like, like, like, limit],
    )
    res.json(rows)
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron buscar productos',
      error: safeError(error),
    })
  }
})

app.get('/api/products/:id/nearby-stores', async (req, res) => {
  const productId = Number(req.params.id)
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const radiusKm = Number(req.query.radiusKm)

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: 'id de producto invalido' })
  }

  if (![lat, lng].every(Number.isFinite)) {
    return res.status(400).json({ message: 'lat y lng son obligatorios' })
  }

  try {
    const result = await findNearbyStoresForProduct(pool, {
      productId,
      lat,
      lng,
      radiusKm,
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo cargar la busqueda cercana',
      error: safeError(error),
    })
  }
})

app.post('/api/products', async (req, res) => {
  const {
    name,
    category,
    brand,
    store_id,
    reference_amount = 100,
    reference_unit = 'g',
    image_url = null,
    price = 0,
    stock = 0,
    calories = 0,
    protein = 0,
    carbs = 0,
    fat = 0,
  } = req.body ?? {}

  if (!name || !category || !brand || !store_id) {
    return res.status(400).json({ message: 'name, category, brand y store_id son obligatorios' })
  }

  if (numberOr(reference_amount, 0) <= 0) {
    return res.status(400).json({ message: 'reference_amount debe ser mayor que 0' })
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO products
        (name, category, brand, store_id, reference_amount, reference_unit, image_url, price, stock, calories, protein, carbs, fat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        category,
        brand,
        store_id,
        numberOr(reference_amount, 100),
        reference_unit || 'g',
        image_url,
        numberOr(price, 0),
        Math.max(0, Math.floor(numberOr(stock, 0))),
        Math.max(0, Math.floor(numberOr(calories, 0))),
        numberOr(protein, 0),
        numberOr(carbs, 0),
        numberOr(fat, 0),
      ],
    )
    res.status(201).json({ ok: true, id: result.insertId })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo crear el producto',
      error: safeError(error),
    })
  }
})

app.put('/api/products/:id', async (req, res) => {
  const productId = Number(req.params.id)
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: 'id de producto invalido' })
  }

  const {
    name,
    category,
    brand,
    store_id,
    reference_amount = 100,
    reference_unit = 'g',
    image_url = null,
    price = 0,
    stock = 0,
    calories = 0,
    protein = 0,
    carbs = 0,
    fat = 0,
  } = req.body ?? {}

  if (!name || !category || !brand || !store_id) {
    return res.status(400).json({ message: 'name, category, brand y store_id son obligatorios' })
  }

  if (numberOr(reference_amount, 0) <= 0) {
    return res.status(400).json({ message: 'reference_amount debe ser mayor que 0' })
  }

  try {
    const [result] = await pool.execute(
      `UPDATE products
       SET name = ?, category = ?, brand = ?, store_id = ?, reference_amount = ?, reference_unit = ?, image_url = ?,
           price = ?, stock = ?, calories = ?, protein = ?, carbs = ?, fat = ?
       WHERE id = ?`,
      [
        name,
        category,
        brand,
        store_id,
        numberOr(reference_amount, 100),
        reference_unit || 'g',
        image_url,
        numberOr(price, 0),
        Math.max(0, Math.floor(numberOr(stock, 0))),
        Math.max(0, Math.floor(numberOr(calories, 0))),
        numberOr(protein, 0),
        numberOr(carbs, 0),
        numberOr(fat, 0),
        productId,
      ],
    )

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Producto no encontrado' })
    }

    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo actualizar el producto',
      error: safeError(error),
    })
  }
})

app.delete('/api/products/:id', async (req, res) => {
  const productId = Number(req.params.id)
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: 'id de producto invalido' })
  }

  try {
    const [[product]] = await pool.execute('SELECT id FROM products WHERE id = ? LIMIT 1', [productId])
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' })
    }

    const [[recipesCount]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM recipe_ingredients WHERE product_id = ?',
      [productId],
    )
    if (numberOr(recipesCount.total, 0) > 0) {
      return res.status(409).json({
        message: 'No se puede eliminar el producto porque esta en recetas. Quita primero ese ingrediente de las recetas.',
      })
    }

    await pool.execute('DELETE FROM products WHERE id = ?', [productId])
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo eliminar el producto',
      error: safeError(error),
    })
  }
})

app.get('/api/recipes', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
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
      ORDER BY r.created_at DESC`,
    )
    res.json(rows)
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron cargar las recetas',
      error: safeError(error),
    })
  }
})

app.get('/api/recipes/:id', async (req, res) => {
  const recipeId = Number(req.params.id)
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return res.status(400).json({ message: 'id de receta invalido' })
  }

  try {
    const [recipes] = await pool.execute(
      `SELECT
        r.id, r.title, r.description, r.steps, r.image_url, r.servings, r.prep_time, r.difficulty,
        r.calories_total, r.protein_total, r.carbs_total, r.fat_total, r.created_at,
        u.id AS user_id, u.name AS user_name, u.handle AS user_handle,
        s.id AS store_id, s.name AS store_name
      FROM recipes r
      INNER JOIN users u ON u.id = r.user_id
      LEFT JOIN stores s ON s.id = r.store_id
      WHERE r.id = ?`,
      [recipeId],
    )

    if (!recipes.length) {
      return res.status(404).json({ message: 'Receta no encontrada' })
    }

    const [ingredients] = await pool.execute(
      `SELECT
        p.id AS product_id, p.name, p.brand, p.category,
        p.calories, p.protein, p.carbs, p.fat, p.reference_amount, p.reference_unit,
        ri.quantity, ri.unit
      FROM recipe_ingredients ri
      INNER JOIN products p ON p.id = ri.product_id
      WHERE ri.recipe_id = ?`,
      [recipeId],
    )

    res.json({ ...recipes[0], ingredients })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo cargar la receta',
      error: safeError(error),
    })
  }
})

app.post('/api/recipes', async (req, res) => {
  const {
    user_id,
    store_id = null,
    title,
    description = null,
    steps = null,
    image_url = null,
    servings = 1,
    prep_time = 0,
    difficulty = 'Media',
    ingredients = [],
  } = req.body ?? {}

  if (!user_id || !title) {
    return res.status(400).json({ message: 'user_id y title son obligatorios' })
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ message: 'ingredients debe tener al menos un elemento' })
  }

  if (!allowedDifficulties.has(difficulty)) {
    return res.status(400).json({ message: "difficulty debe ser 'Facil', 'Media' o 'Alta'" })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const { ingredientRows, caloriesTotal, proteinTotal, carbsTotal, fatTotal } = await resolveIngredientsWithTotals(conn, ingredients)

    const [recipeInsert] = await conn.execute(
      `INSERT INTO recipes
        (user_id, store_id, title, description, steps, image_url, servings, prep_time, difficulty, calories_total, protein_total, carbs_total, fat_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        store_id,
        title,
        description,
        steps,
        image_url,
        Math.max(1, Math.floor(numberOr(servings, 1))),
        Math.max(0, Math.floor(numberOr(prep_time, 0))),
        difficulty,
        caloriesTotal,
        proteinTotal,
        carbsTotal,
        fatTotal,
      ],
    )

    const recipeId = recipeInsert.insertId

    for (const item of ingredientRows) {
      await conn.execute(
        'INSERT INTO recipe_ingredients (recipe_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)',
        [recipeId, item.productId, item.quantity, item.unit],
      )
    }

    await conn.commit()
    res.status(201).json({ ok: true, id: recipeId })
  } catch (error) {
    await conn.rollback()
    res.status(500).json({
      message: 'No se pudo crear la receta',
      error: safeError(error),
    })
  } finally {
    conn.release()
  }
})

app.put('/api/recipes/:id', async (req, res) => {
  const recipeId = Number(req.params.id)
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return res.status(400).json({ message: 'id de receta invalido' })
  }

  const {
    user_id,
    store_id = null,
    title,
    description = null,
    steps = null,
    image_url = null,
    servings = 1,
    prep_time = 0,
    difficulty = 'Media',
    ingredients = [],
  } = req.body ?? {}

  if (!user_id || !title) {
    return res.status(400).json({ message: 'user_id y title son obligatorios' })
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ message: 'ingredients debe tener al menos un elemento' })
  }

  if (!allowedDifficulties.has(difficulty)) {
    return res.status(400).json({ message: "difficulty debe ser 'Facil', 'Media' o 'Alta'" })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [existingRecipe] = await conn.execute('SELECT id FROM recipes WHERE id = ? LIMIT 1', [recipeId])
    if (!existingRecipe.length) {
      await conn.rollback()
      return res.status(404).json({ message: 'Receta no encontrada' })
    }

    const { ingredientRows, caloriesTotal, proteinTotal, carbsTotal, fatTotal } = await resolveIngredientsWithTotals(conn, ingredients)

    await conn.execute(
      `UPDATE recipes
       SET user_id = ?, store_id = ?, title = ?, description = ?, steps = ?, image_url = ?, servings = ?, prep_time = ?,
           difficulty = ?, calories_total = ?, protein_total = ?, carbs_total = ?, fat_total = ?
       WHERE id = ?`,
      [
        user_id,
        store_id,
        title,
        description,
        steps,
        image_url,
        Math.max(1, Math.floor(numberOr(servings, 1))),
        Math.max(0, Math.floor(numberOr(prep_time, 0))),
        difficulty,
        caloriesTotal,
        proteinTotal,
        carbsTotal,
        fatTotal,
        recipeId,
      ],
    )

    await conn.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId])

    for (const item of ingredientRows) {
      await conn.execute(
        'INSERT INTO recipe_ingredients (recipe_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)',
        [recipeId, item.productId, item.quantity, item.unit],
      )
    }

    await conn.commit()
    res.json({ ok: true })
  } catch (error) {
    await conn.rollback()
    res.status(500).json({
      message: 'No se pudo actualizar la receta',
      error: safeError(error),
    })
  } finally {
    conn.release()
  }
})

app.delete('/api/recipes/:id', async (req, res) => {
  const recipeId = Number(req.params.id)
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return res.status(400).json({ message: 'id de receta invalido' })
  }

  try {
    const [result] = await pool.execute('DELETE FROM recipes WHERE id = ?', [recipeId])
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Receta no encontrada' })
    }
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo eliminar la receta',
      error: safeError(error),
    })
  }
})

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, handle, email, city, bio, avatar_url, verified FROM users ORDER BY created_at DESC')
    const [stores] = await pool.query(
      `SELECT
        s.id, s.name, s.description, s.address, s.city, s.latitude, s.longitude, s.logo, s.accent, s.image_url,
        COUNT(p.id) AS products_count
      FROM stores s
      LEFT JOIN products p ON p.store_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC`,
    )
    const [products] = await pool.query(
      `SELECT
        id, name, category, brand, store_id, reference_amount, reference_unit, image_url,
        price, stock, calories, protein, carbs, fat
      FROM products
      ORDER BY created_at DESC`,
    )
    const [recipes] = await pool.query(
      `SELECT
        id, user_id, store_id, title, description, steps, image_url, servings, prep_time, difficulty,
        calories_total, protein_total, carbs_total, fat_total, created_at
      FROM recipes
      ORDER BY created_at DESC`,
    )

    res.json({ users, stores, products, recipes })
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo cargar el bootstrap',
      error: safeError(error),
    })
  }
})

app.use(express.static(clientDistPath))

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next()
  }

  res.sendFile(path.join(clientDistPath, 'index.html'))
})

const start = async () => {
  try {
    await checkDbConnection()
    await ensureSchema()
    app.listen(port, () => {
      console.log(`API MySQL lista en http://localhost:${port}`)
    })
  } catch (error) {
    console.error('No se pudo iniciar la API:', safeError(error))
    process.exit(1)
  }
}

start()
