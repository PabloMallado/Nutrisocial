export type LocationPermissionState = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported' | 'error'

export interface UserLocation {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp: number
}

export interface ProductSuggestion {
  id: number
  name: string
  brand: string
  category: string
  reference_amount: number
  reference_unit: string
}

export interface StoreListingInfo {
  price: number | null
  currency: string
  availability_status: 'unknown' | 'in_stock' | 'low_stock' | 'out_of_stock'
  offer_text: string | null
  store_product_url: string | null
  last_checked_at: string | null
  source_provider: string | null
}

export interface ProductSummary {
  id: number
  name: string
  brand: string
  category: string
  reference_amount: number
  reference_unit: string
}

export interface NearbyStoreResult {
  id: string
  name: string
  address: string | null
  city: string
  latitude: number
  longitude: number
  distance_km: number
  product: ProductSummary
  listing: StoreListingInfo
}

export interface NearbyStoresResponse {
  product: ProductSummary | null
  stores: NearbyStoreResult[]
  radiusKm: number
}

