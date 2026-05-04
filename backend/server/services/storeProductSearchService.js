import { haversineDistanceKm } from '../utils/geo.js'
import { getNearbyStoreCandidates } from './externalStoreProvider.js'

export async function findNearbyStoresForProduct(pool, input) {
  const productId = Number(input?.productId)
  const userLat = Number(input?.lat)
  const userLng = Number(input?.lng)
  const radiusKm = Number(input?.radiusKm)
  const limit = Number(input?.limit)

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('productId invalido')
  }

  if (![userLat, userLng].every(Number.isFinite)) {
    throw new Error('lat y lng son obligatorios')
  }

  const normalizedRadius = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 25
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 40

  const [productRows] = await pool.execute(
    `SELECT id, name, brand, category, reference_amount, reference_unit
     FROM products
     WHERE id = ?
     LIMIT 1`,
    [productId],
  )

  if (!productRows.length) {
    return { product: null, stores: [], radiusKm: normalizedRadius }
  }

  const [rows] = await pool.execute(
    `SELECT
      s.id AS store_id,
      s.name AS store_name,
      s.address AS store_address,
      s.city AS store_city,
      s.latitude AS store_latitude,
      s.longitude AS store_longitude,
      psl.price,
      psl.currency,
      psl.availability_status,
      psl.offer_text,
      psl.store_product_url,
      psl.last_checked_at,
      psl.source_provider,
      p.id AS product_id,
      p.name AS product_name,
      p.brand AS product_brand,
      p.category AS product_category,
      p.reference_amount,
      p.reference_unit
    FROM product_store_listings psl
    INNER JOIN stores s ON s.id = psl.store_id
    INNER JOIN products p ON p.id = psl.product_id
    WHERE psl.product_id = ?
      AND s.latitude IS NOT NULL
      AND s.longitude IS NOT NULL
    LIMIT ?`,
    [productId, normalizedLimit],
  )

  const stores = rows
    .map((row) => {
      const distanceKm = haversineDistanceKm(
        { lat: userLat, lng: userLng },
        { lat: Number(row.store_latitude), lng: Number(row.store_longitude) },
      )

      if (!Number.isFinite(distanceKm)) return null
      if (distanceKm > normalizedRadius) return null

      return {
        id: row.store_id,
        name: row.store_name,
        address: row.store_address,
        city: row.store_city,
        latitude: Number(row.store_latitude),
        longitude: Number(row.store_longitude),
        distance_km: Number(distanceKm.toFixed(2)),
        product: {
          id: row.product_id,
          name: row.product_name,
          brand: row.product_brand,
          category: row.product_category,
          reference_amount: Number(row.reference_amount),
          reference_unit: row.reference_unit,
        },
        listing: {
          price: row.price == null ? null : Number(row.price),
          currency: row.currency,
          availability_status: row.availability_status,
          offer_text: row.offer_text,
          store_product_url: row.store_product_url,
          last_checked_at: row.last_checked_at,
          source_provider: row.source_provider,
        },
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.distance_km - b.distance_km)

  // External providers can enrich nearby-store discovery without touching controllers/UI.
  const externalCandidates = await getNearbyStoreCandidates({
    productId,
    lat: userLat,
    lng: userLng,
    radiusKm: normalizedRadius,
  })

  const mergedStores = [...stores, ...externalCandidates]
    .filter((item) => item && Number.isFinite(Number(item.distance_km)))
    .sort((a, b) => Number(a.distance_km) - Number(b.distance_km))

  return {
    product: {
      id: productRows[0].id,
      name: productRows[0].name,
      brand: productRows[0].brand,
      category: productRows[0].category,
      reference_amount: Number(productRows[0].reference_amount),
      reference_unit: productRows[0].reference_unit,
    },
    stores: mergedStores,
    radiusKm: normalizedRadius,
  }
}

