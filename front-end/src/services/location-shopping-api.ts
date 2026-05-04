import type { NearbyStoresResponse, ProductSuggestion } from '../types/location-shopping'
import { apiRequest } from './http'

export async function searchProducts(query: string, signal?: AbortSignal): Promise<ProductSuggestion[]> {
  const q = query.trim()
  if (!q) {
    return []
  }

  const params = new URLSearchParams({ q, limit: '15' })
  return apiRequest<ProductSuggestion[]>(`/api/products/search?${params.toString()}`, { signal })
}

export async function getNearbyStores(input: {
  productId: number
  latitude: number
  longitude: number
  radiusKm: number
  signal?: AbortSignal
}): Promise<NearbyStoresResponse> {
  const params = new URLSearchParams({
    lat: String(input.latitude),
    lng: String(input.longitude),
    radiusKm: String(input.radiusKm),
  })

  return apiRequest<NearbyStoresResponse>(`/api/products/${input.productId}/nearby-stores?${params.toString()}`, {
    signal: input.signal,
  })
}

