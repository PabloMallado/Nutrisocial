# NutriSocial

Aplicacion para gestionar tiendas, productos, recetas y una parte social de recetas compartidas.

## Estructura

- `front-end/`: aplicacion React + Vite.
  - `front-end/src/`: codigo React/TypeScript.
  - `front-end/public/`: assets publicos.
  - `front-end/index.html`: entrada HTML de Vite.
- `backend/`: API y base de datos.
  - `backend/api/`: API actual en Python/FastAPI conectada a MySQL.
  - `backend/server/`: version anterior en Node/Express, conservada como referencia.
  - `backend/db/init.sql`: esquema y datos iniciales.
- Raiz del proyecto: configuracion compartida, scripts de npm, Docker, TypeScript, ESLint y variables `.env`.

> Nota: el backend actual esta hecho en Python/FastAPI. Mantiene los mismos endpoints que usaba el frontend.

## Requisitos

- Node.js 20+
- Python 3.11+
- Docker Desktop, si quieres levantar MySQL en contenedor
- MySQL 8+, si prefieres usar una base de datos local sin Docker

## Configuracion rapida

1. Copia variables de entorno:

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Ajusta `.env`:

```env
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=nutrisocial
API_PORT=4000
VITE_API_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

3. Instala dependencias de Node si no las tienes:

```bash
npm install
```

4. Instala dependencias de Python:

```bash
python -m pip install -r requirements.txt
```

En Windows, si `python` no existe, prueba:

```powershell
py -m pip install -r requirements.txt
```

5. Levanta MySQL con Docker:

```bash
npm run db:up
```

El `docker-compose.yml` usa `backend/db/init.sql` para crear tablas y datos iniciales la primera vez que se crea el volumen.

6. Levanta la API:

```bash
npm run dev:api
```

API por defecto: `http://localhost:4000`.

7. Levanta el front-end:

```bash
npm run dev
```

Vite servira la aplicacion React desde `front-end/`.

La interfaz mostrara una tarjeta de estado de API al arrancar para confirmar si el backend y la base de datos estan accesibles.

## Scripts utiles

- `npm run dev`: arranca el front-end.
- `npm run dev:api`: arranca la API.
- `npm run dev:desktop`: arranca API, frontend y Electron para modo escritorio.
- `npm run db:up`: arranca MySQL con Docker.
- `npm run db:down`: para los contenedores.
- `npm run db:logs`: muestra logs de MySQL.
- `npm run build`: compila TypeScript y genera build de Vite.
- `npm run build:desktop`: genera la build web y empaqueta la app de Electron.
- `npm run start:desktop`: abre Electron usando la build ya generada en `dist/`.
- `npm run lint`: ejecuta ESLint.

## Modo escritorio con Electron

La integracion de Electron vive en `electron/` y usa:

- `electron/main.mjs`: ventana principal y carga de la app.
- `electron/preload.mjs`: bridge seguro al renderer.
- `electron/dev-runner.mjs`: lanzador de desarrollo.

En desarrollo, `npm run dev:desktop`:

1. Comprueba si la API en `http://127.0.0.1:4000` ya esta viva.
2. Si no, la arranca con `uvicorn`.
3. Comprueba si Vite en `http://127.0.0.1:5173` ya esta vivo.
4. Si no, arranca el frontend.
5. Abre la app en Electron.

En Electron, el frontend usa `HashRouter` para que la navegacion funcione bien desde la build local empaquetada.

## Endpoints actuales

- `GET /api/health`
- `GET /api/users` y `POST /api/users`
- `GET /api/stores`, `POST /api/stores`, `PUT /api/stores/:id`, `DELETE /api/stores/:id`
- `GET /api/markets` y `POST /api/markets` (alias de tiendas)
- `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
- `GET /api/products/search?q=...`
- `GET /api/products/:id/nearby-stores?lat=..&lng=..&radiusKm=..`
- `GET /api/recipes`, `GET /api/recipes/:id`, `POST /api/recipes`, `PUT /api/recipes/:id`, `DELETE /api/recipes/:id`
- `GET /api/bootstrap`

## Idea funcional

El nucleo de la aplicacion deberia ser:

- Usuarios con perfil.
- Tiendas espanolas como Mercadona, Lidl, Aldi, Alcampo, Carrefour, Dia, etc.
- Productos relacionados con tiendas.
- Recetas formadas por productos y cantidades.
- Calculo de macronutrientes proporcional a la cantidad usada.
- Recetas privadas para el usuario o publicas en el tablon social.

Para productos reales, conviene integrar una fuente externa como Open Food Facts para nombres, marcas, imagenes, ingredientes y valores nutricionales. Los datos propios de tienda/precio/disponibilidad probablemente tendran que guardarse en tu base de datos o enriquecerse con Open Prices cuando encaje.
