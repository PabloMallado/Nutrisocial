import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { LocationPanel } from './components/LocationPanel'
import { ProductSearchPanel } from './components/ProductSearchPanel'
import { StoreResultsPanel } from './components/StoreResultsPanel'
import { SocialAccountPage } from './features/social/SocialAccountPage'
import { SocialHome } from './features/social/SocialHome'
import { SocialProfilePage } from './features/social/SocialProfilePage'
import { SocialSidebar } from './features/social/SocialSidebar'
import { useSocialState } from './features/social/use-social-state'
import { useUserLocation } from './hooks/use-user-location'
import { apiRequest } from './services/http'
import { getNearbyStores, searchProducts } from './services/location-shopping-api'
import type { AccountSection, FeedTab, SocialUser } from './features/social/types'
import type { NearbyStoreResult, ProductSuggestion } from './types/location-shopping'


type User = { id: string; name: string; handle: string }
type Store = { id: string; name: string; description: string; address: string; city: string; logo: string; accent: string; image: string | null }
type Product = { id: string; name: string; category: string; brand: string; storeId: string; referenceAmount: number; referenceUnit: string; image: string | null; price: number; stock: number; calories: number; protein: number; carbs: number; fat: number }
type Recipe = { id: string; userId: string; storeId: string | null; title: string; description: string; steps: string; image: string | null; servings: number; prepTime: number; difficulty: string; caloriesTotal: number; proteinTotal: number; carbsTotal: number; fatTotal: number }
type RecipeForm = { title: string; description: string; steps: string; userId: string; storeId: string; difficulty: string; servings: string; prepTime: string; imageUrl: string; ingredients: Array<{ productId: string; quantity: string; unit: string }> }
type RecipeIngredientDetail = { product_id: number; name: string; brand: string; category: string; image_url: string | null; calories: number; protein: number | string; carbs: number | string; fat: number | string; reference_amount: number | string; reference_unit: string; quantity: number | string; unit: string }
type RecipeDetail = { id: number; user_id: number; store_id: string | null; title: string; description: string | null; steps: string | null; image_url: string | null; servings: number; prep_time: number; difficulty: string; ingredients: RecipeIngredientDetail[] }
type ApiBootstrap = {
  users: Array<{ id: number; name: string; handle: string }>
  stores: Array<{ id: string; name: string; description: string | null; address: string | null; city: string; logo: string; accent: string; image_url: string | null }>
  products: Array<{ id: number; name: string; category: string; brand: string; store_id: string; reference_amount: number | string; reference_unit: string; image_url: string | null; price: number | string; stock: number; calories: number; protein: number | string; carbs: number | string; fat: number | string }>
  recipes: Array<{ id: number; user_id: number; store_id: string | null; title: string; description: string | null; steps: string | null; image_url: string | null; servings: number; prep_time: number; difficulty: string; calories_total: number | string; protein_total: number | string; carbs_total: number | string; fat_total: number | string }>
}
type AuthUser = { id: number; name: string; handle: string; avatar_url: string | null }
type AuthResponse = { ok: boolean; user: AuthUser }
type DeleteDialog = { type: 'recipe'; id: string; label: string }
type ProductImagePreview = { src: string; alt: string }
type ThemeMode = 'light' | 'dark'
type AuthMode = 'login' | 'register'
type IngredientStep = 'select' | 'amount'
type ProductSortOption = 'recent' | 'name' | 'protein' | 'calories'
type ExternalProductPreview = { code: string; existing_id: number | null; id?: number; name: string; brand: string; category: string; store: string; image_url: string | null; calories: number; protein: number; carbs: number; fat: number; reference_amount: number; reference_unit: string; status?: 'imported' | 'updated' }
type OpenFoodFactsSearchResponse = { ok: boolean; query: string; products: ExternalProductPreview[] }
type OpenFoodFactsImportOneResponse = { ok: boolean; product: ExternalProductPreview & { id: number; status: 'imported' | 'updated' } }
type MainSection = 'inicio' | 'productos' | 'tiendas' | 'recetas' | 'perfil' | 'cuenta' | 'tiendas-cercanas'
type AppPreferences = {
  activeSection: Exclude<MainSection, 'perfil'>
  accountSection: AccountSection
  feedTab: FeedTab
  radiusKm: number
  prioritizeAvailable: boolean
  productSearchTerm: string
  productSort: ProductSortOption
  productStoreFilter: string
  checkedProductIds: string[]
}
const allowedStoreTokens = [
  'alcampo',
  'al campo',
  'aldi',
  'carrefour',
  'carrefour express',
  'consum',
  'coviran',
  'dia',
  'el dia',
  'eroski',
  'eroki',
  'lidl',
  'mercadona',
]
const hiddenStoreNames = new Set([
  'open food facts',
  'spar',
  'tesco',
  'sulet 365',
  'sole365',
  'monoprix',
  'monopix',
  "gadis",
  "gaddy's",
  'gaddys',
  'esclad',
  'esclat',
  'co-op',
  'coop',
  'lampu',
  'conad',
  'carrefour.fr',
  'ahorramas',
  'ahorra mas',
  'hacendado mercadona',
  'zendado mercadona',
])

const blankRecipeForm = (userId = ''): RecipeForm => ({ title: '', description: '', steps: '', userId, storeId: '', difficulty: 'Media', servings: '1', prepTime: '0', imageUrl: '', ingredients: [] })
const fetchJson = <T,>(path: string) => apiRequest<T>(path)
const postJson = (path: string, body: unknown) => apiRequest(path, { method: 'POST', body: JSON.stringify(body) })
const deleteJson = (path: string) => apiRequest(path, { method: 'DELETE' })
const n = (value: string, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
const readStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem('nutrisocial-theme') === 'dark' ? 'dark' : 'light'
}

const readStoredAuthUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null
  window.localStorage.removeItem('nutrisocial-auth-user')
  const rawValue = window.sessionStorage.getItem('nutrisocial-auth-user')
  if (!rawValue) return null
  try {
    return JSON.parse(rawValue) as AuthUser
  } catch {
    window.sessionStorage.removeItem('nutrisocial-auth-user')
    return null
  }
}

const storeAuthUser = (user: AuthUser | null) => {
  if (!user) {
    window.sessionStorage.removeItem('nutrisocial-auth-user')
    return
  }
  window.sessionStorage.setItem('nutrisocial-auth-user', JSON.stringify(user))
}

const readRememberedUsername = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('nutrisocial-remembered-username') ?? ''
}

const storeRememberedUsername = (username: string | null) => {
  if (!username) {
    window.localStorage.removeItem('nutrisocial-remembered-username')
    return
  }
  window.localStorage.setItem('nutrisocial-remembered-username', username)
}

const savedProductsStorageKey = 'nutrisocial-saved-product-ids'
const appPreferencesStorageKey = 'nutrisocial-app-preferences'
const defaultAppPreferences: AppPreferences = {
  activeSection: 'inicio',
  accountSection: 'overview',
  feedTab: 'para-ti',
  radiusKm: 10,
  prioritizeAvailable: false,
  productSearchTerm: '',
  productSort: 'recent',
  productStoreFilter: 'all',
  checkedProductIds: [],
}

const readSavedProductIds = () => {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const rawValue = window.localStorage.getItem(savedProductsStorageKey)
    const parsed = rawValue ? JSON.parse(rawValue) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set<string>()
  }
}

const storeSavedProductIds = (ids: Set<string>) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(savedProductsStorageKey, JSON.stringify([...ids]))
}

const readAppPreferences = (): AppPreferences => {
  if (typeof window === 'undefined') return defaultAppPreferences
  try {
    const rawValue = window.localStorage.getItem(appPreferencesStorageKey)
    if (!rawValue) return defaultAppPreferences
    const parsed = JSON.parse(rawValue) as Partial<AppPreferences>
    const nextSection = parsed.activeSection ?? defaultAppPreferences.activeSection

    return {
      activeSection: nextSection,
      accountSection: parsed.accountSection ?? defaultAppPreferences.accountSection,
      feedTab: parsed.feedTab ?? defaultAppPreferences.feedTab,
      radiusKm: typeof parsed.radiusKm === 'number' ? Math.min(50, Math.max(1, parsed.radiusKm)) : defaultAppPreferences.radiusKm,
      prioritizeAvailable: Boolean(parsed.prioritizeAvailable),
      productSearchTerm: parsed.productSearchTerm ?? defaultAppPreferences.productSearchTerm,
      productSort: parsed.productSort ?? defaultAppPreferences.productSort,
      productStoreFilter: parsed.productStoreFilter ?? defaultAppPreferences.productStoreFilter,
      checkedProductIds: Array.isArray(parsed.checkedProductIds) ? parsed.checkedProductIds.map(String) : defaultAppPreferences.checkedProductIds,
    }
  } catch {
    return defaultAppPreferences
  }
}

const storeAppPreferences = (preferences: AppPreferences) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(appPreferencesStorageKey, JSON.stringify(preferences))
}

const authUserToSocialUser = (authUser: AuthUser | null, fallbackUser: SocialUser): SocialUser => {
  if (!authUser) return fallbackUser
  return {
    ...fallbackUser,
    id: `auth-${authUser.id}`,
    displayName: authUser.name,
    username: authUser.handle,
    avatarUrl: authUser.avatar_url || fallbackUser.avatarUrl,
  }
}

const normalizeDisplayStoreName = (name: string) => {
  const normalized = name.trim().toLowerCase()
  if (normalized.includes('mercadona')) return 'Mercadona'
  return name
}

const normalizeStoreToken = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const shouldShowStore = (store: Store) => {
  const normalizedName = normalizeStoreToken(store.name.trim())
  const normalizedId = normalizeStoreToken(store.id)
  const allowed = allowedStoreTokens.some((token) => normalizedName.includes(token) || normalizedId.includes(token))
  return store.id !== 'open-food-facts' && allowed && !hiddenStoreNames.has(normalizedName)
}

const shouldShowProduct = (product: Product, store: Store | undefined) => Boolean(product.name) && (store ? shouldShowStore(store) || store.id === 'open-food-facts' : false)

const productStoreLabel = (store: Store | undefined) => {
  if (!store || !shouldShowStore(store)) return 'Catálogo base'
  return normalizeDisplayStoreName(store.name)
}

const storeLogoUrl = (store: Store) => {
  const name = normalizeStoreToken(`${normalizeDisplayStoreName(store.name)} ${store.id}`)
  const domains: Array<[string, string]> = [
    ['mercadona', 'mercadona.es'],
    ['carrefour', 'carrefour.es'],
    ['alcampo', 'alcampo.es'],
    ['lidl', 'lidl.es'],
    ['dia', 'dia.es'],
    ['consum', 'consum.es'],
    ['eroski', 'eroski.es'],
    ['aldi', 'aldi.es'],
    ['coviran', 'coviran.es'],
  ]
  const match = domains.find(([token]) => name.includes(token))
  return match ? `https://www.google.com/s2/favicons?domain=${match[1]}&sz=64` : null
}

const calculateProductMacros = (product: Product, grams: number) => {
  const factor = Math.max(0, grams) / Math.max(1, product.referenceAmount || 100)
  return {
    calories: product.calories * factor,
    protein: product.protein * factor,
    carbs: product.carbs * factor,
    fat: product.fat * factor,
  }
}

function App() {
  const preferences = useMemo(readAppPreferences, [])
  const navigate = useNavigate()
  const locationRoute = useLocation()
  const { permission, location, locationLabel, errorMessage: locationError, requestLocation } = useUserLocation()

  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductSuggestion | null>(null)
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [radiusKm, setRadiusKm] = useState(preferences.radiusKm)
  const [nearbyStores, setNearbyStores] = useState<NearbyStoreResult[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [prioritizeAvailable, setPrioritizeAvailable] = useState(preferences.prioritizeAvailable)
  const [activeSection, setActiveSection] = useState<MainSection>(preferences.activeSection)
  const [accountSection, setAccountSection] = useState<AccountSection>(preferences.accountSection)
  const [feedTab, setFeedTab] = useState<FeedTab>(preferences.feedTab)
  const [users, setUsers] = useState<User[]>([])
  const [storesCrud, setStoresCrud] = useState<Store[]>([])
  const [productsCrud, setProductsCrud] = useState<Product[]>([])
  const [brokenProductImageIds, setBrokenProductImageIds] = useState<Set<string>>(() => new Set())
  const [productImagePreview, setProductImagePreview] = useState<ProductImagePreview | null>(null)
  const [recipesCrud, setRecipesCrud] = useState<Recipe[]>([])
  const [crudMessage, setCrudMessage] = useState<string | null>(null)
  const [productSearchModalOpen, setProductSearchModalOpen] = useState(false)
  const [externalImportQuery, setExternalImportQuery] = useState('')
  const [externalImportLoading, setExternalImportLoading] = useState(false)
  const [externalImportSummary, setExternalImportSummary] = useState<string | null>(null)
  const [externalImportResults, setExternalImportResults] = useState<ExternalProductPreview[]>([])
  const [addingExternalProductCode, setAddingExternalProductCode] = useState<string | null>(null)
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(() => readSavedProductIds())
  const [checkedProductIds, setCheckedProductIds] = useState<Set<string>>(() => new Set(preferences.checkedProductIds))
  const [productSearchTerm, setProductSearchTerm] = useState(preferences.productSearchTerm)
  const [productSort, setProductSort] = useState<ProductSortOption>(preferences.productSort)
  const [productStoreFilter, setProductStoreFilter] = useState(preferences.productStoreFilter)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(blankRecipeForm())
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false)
  const [ingredientStep, setIngredientStep] = useState<IngredientStep>('select')
  const [ingredientProductId, setIngredientProductId] = useState('')
  const [ingredientGrams, setIngredientGrams] = useState('100')
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientStoreFilters, setIngredientStoreFilters] = useState<string[]>([])
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<RecipeDetail | null>(null)
  const [recipeDetailLoading, setRecipeDetailLoading] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredTheme)
  const [authUser, setAuthUser] = useState<AuthUser | null>(readStoredAuthUser)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authName, setAuthName] = useState('')
  const [authUsername, setAuthUsername] = useState(readRememberedUsername)
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authRememberUsername, setAuthRememberUsername] = useState(() => readRememberedUsername().length > 0)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const {
    currentUser: socialCurrentUser,
    usersById: socialUsersById,
    commentsByPostId,
    followingUsers,
    followingSet,
    requestSet,
    followUser,
    sendFriendRequest,
    addComment,
    getFeedPosts,
    getUserPosts,
  } = useSocialState()

  const loadCrudData = useCallback(async () => {
    const data = await fetchJson<ApiBootstrap>('/api/bootstrap')
    setUsers(data.users.map((u) => ({ id: String(u.id), name: u.name, handle: u.handle })))
    setStoresCrud(data.stores.map((s) => ({ id: s.id, name: s.name, description: s.description ?? '', address: s.address ?? '', city: s.city, logo: s.logo, accent: s.accent, image: s.image_url })))
    setProductsCrud(data.products.map((p) => ({ id: String(p.id), name: p.name, category: p.category, brand: p.brand, storeId: p.store_id, referenceAmount: Number(p.reference_amount ?? 100), referenceUnit: p.reference_unit || 'g', image: p.image_url, price: Number(p.price ?? 0), stock: Number(p.stock ?? 0), calories: Number(p.calories ?? 0), protein: Number(p.protein ?? 0), carbs: Number(p.carbs ?? 0), fat: Number(p.fat ?? 0) })))
    setRecipesCrud(data.recipes.map((r) => ({ id: String(r.id), userId: String(r.user_id), storeId: r.store_id, title: r.title, description: r.description ?? '', steps: r.steps ?? '', image: r.image_url, servings: Number(r.servings ?? 1), prepTime: Number(r.prep_time ?? 0), difficulty: r.difficulty, caloriesTotal: Number(r.calories_total ?? 0), proteinTotal: Number(r.protein_total ?? 0), carbsTotal: Number(r.carbs_total ?? 0), fatTotal: Number(r.fat_total ?? 0) })))
  }, [])

  useEffect(() => {
    loadCrudData().catch((err) => setCrudMessage((err as Error).message))
  }, [loadCrudData])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    window.localStorage.setItem('nutrisocial-theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    storeAuthUser(authUser)
  }, [authUser])

  useEffect(() => {
    const nextActiveSection = activeSection === 'perfil' ? 'inicio' : activeSection
    storeAppPreferences({
      activeSection: nextActiveSection,
      accountSection,
      feedTab,
      radiusKm,
      prioritizeAvailable,
      productSearchTerm,
      productSort,
      productStoreFilter,
      checkedProductIds: [...checkedProductIds],
    })
  }, [accountSection, activeSection, checkedProductIds, feedTab, prioritizeAvailable, productSearchTerm, productSort, productStoreFilter, radiusKm])

  useEffect(() => {
    setRecipeForm((p) => ({ ...p, userId: p.userId || (authUser ? String(authUser.id) : users[0]?.id || '') }))
  }, [authUser, users])

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setSuggestions([])
      setSearchLoading(false)
      setSearchError(null)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearchLoading(true)
      setSearchError(null)

      searchProducts(normalized, controller.signal)
        .then((items) => {
          setSuggestions(items)
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setSearchError(error instanceof Error ? error.message : 'No se pudieron cargar productos')
          setSuggestions([])
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearchLoading(false)
          }
        })
    }, 280)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  function handleSelectProduct(product: ProductSuggestion) {
    setSelectedProduct(product)
    setQuery(product.name)
    setSuggestions([])
  }

  function handleQueryChange(nextValue: string) {
    setQuery(nextValue)
    if (!selectedProduct || nextValue.trim() === selectedProduct.name) return
    setSelectedProduct(null)
  }

  async function handleSearchNearbyStores() {
    setHasSearched(true)

    if (!selectedProduct) {
      setNearbyStores([])
      setNearbyError('Selecciona un producto de la base de datos antes de buscar tiendas.')
      return
    }

    if (!location) {
      setNearbyStores([])
      setNearbyError('Necesitas activar tu ubicacion para calcular tiendas cercanas.')
      return
    }

    setNearbyLoading(true)
    setNearbyError(null)

    try {
      const response = await getNearbyStores({
        productId: selectedProduct.id,
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm,
      })

      setNearbyStores(response.stores)

      if (!response.product) {
        setNearbyError('El producto seleccionado ya no existe en base de datos.')
        return
      }

      if (response.stores.length === 0) {
        setNearbyError(null)
      }
    } catch (error) {
      setNearbyStores([])
      setNearbyError(error instanceof Error ? error.message : 'No se pudieron cargar tiendas cercanas')
    } finally {
      setNearbyLoading(false)
    }
  }

  const visibleStores = useMemo(() => {
    const items = [...nearbyStores]
    if (!prioritizeAvailable) {
      return items.sort((a, b) => a.distance_km - b.distance_km)
    }

    const weight: Record<NearbyStoreResult['listing']['availability_status'], number> = {
      in_stock: 0,
      low_stock: 1,
      unknown: 2,
      out_of_stock: 3,
    }

    return items.sort((a, b) => {
      const availabilityDiff = weight[a.listing.availability_status] - weight[b.listing.availability_status]
      if (availabilityDiff !== 0) return availabilityDiff
      return a.distance_km - b.distance_km
    })
  }, [nearbyStores, prioritizeAvailable])
  const nearbySummary = useMemo(() => {
    if (visibleStores.length === 0) return null
    const cheapestStore = visibleStores
      .filter((store) => store.listing.price !== null)
      .sort((a, b) => Number(a.listing.price) - Number(b.listing.price))[0] ?? null
    const bestAvailability = visibleStores.find((store) => store.listing.availability_status === 'in_stock')
      ?? visibleStores.find((store) => store.listing.availability_status === 'low_stock')
      ?? visibleStores[0]

    return {
      total: visibleStores.length,
      closestDistanceKm: visibleStores[0]?.distance_km ?? 0,
      cheapestStore,
      bestAvailability,
    }
  }, [visibleStores])

  const storeById = useMemo(() => new Map(storesCrud.map((s) => [s.id, s])), [storesCrud])
  const productById = useMemo(() => new Map(productsCrud.map((product) => [product.id, product])), [productsCrud])
  const visibleStoresCrud = useMemo(() => storesCrud.filter(shouldShowStore), [storesCrud])
  const visibleProductsCrud = useMemo(
    () => productsCrud.filter((product) => shouldShowProduct(product, storeById.get(product.storeId)) && !brokenProductImageIds.has(product.id)),
    [brokenProductImageIds, productsCrud, storeById],
  )
  const productStoreOptions = useMemo(
    () => visibleStoresCrud.filter((store) => visibleProductsCrud.some((product) => product.storeId === store.id)),
    [visibleProductsCrud, visibleStoresCrud],
  )
  const productSearchToken = useMemo(() => normalizeStoreToken(productSearchTerm), [productSearchTerm])
  const matchesProductFilters = useCallback((product: Product) => {
    if (productStoreFilter !== 'all' && product.storeId !== productStoreFilter) return false
    if (!productSearchToken) return true
    const store = storeById.get(product.storeId)
    const haystack = normalizeStoreToken(`${product.name} ${product.brand} ${product.category} ${store?.name ?? ''}`)
    return haystack.includes(productSearchToken)
  }, [productSearchToken, productStoreFilter, storeById])
  const sortedVisibleProducts = useMemo(() => {
    const items = visibleProductsCrud.filter(matchesProductFilters)
    const sorted = [...items]

    switch (productSort) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'))
      case 'protein':
        return sorted.sort((a, b) => b.protein - a.protein || a.name.localeCompare(b.name, 'es'))
      case 'calories':
        return sorted.sort((a, b) => a.calories - b.calories || a.name.localeCompare(b.name, 'es'))
      default:
        return sorted
    }
  }, [matchesProductFilters, productSort, visibleProductsCrud])
  const savedProducts = useMemo(
    () => sortedVisibleProducts.filter((product) => savedProductIds.has(product.id)),
    [savedProductIds, sortedVisibleProducts],
  )
  const discoveryProducts = useMemo(() => {
    const candidates = sortedVisibleProducts.filter((product) => !savedProductIds.has(product.id))
    if (productSort === 'recent') return [...candidates].sort(() => Math.random() - 0.5).slice(0, 8)
    return candidates.slice(0, 8)
  }, [productSort, savedProductIds, sortedVisibleProducts])
  const checkedSavedProducts = useMemo(
    () => savedProducts.filter((product) => checkedProductIds.has(product.id)),
    [checkedProductIds, savedProducts],
  )
  const savedProductsTotalCalories = useMemo(
    () => savedProducts.reduce((total, product) => total + product.calories, 0),
    [savedProducts],
  )
  const savedProductsCoveredStores = useMemo(
    () => new Set(savedProducts.map((product) => product.storeId)).size,
    [savedProducts],
  )
  const ingredientStores = useMemo(
    () => visibleStoresCrud.filter((store) => productsCrud.some((product) => product.storeId === store.id)),
    [productsCrud, visibleStoresCrud],
  )
  const filteredIngredientProducts = useMemo(() => {
    const search = normalizeStoreToken(ingredientSearch)
    return productsCrud.filter((product) => {
      if (!shouldShowProduct(product, storeById.get(product.storeId)) || brokenProductImageIds.has(product.id)) return false
      if (ingredientStoreFilters.length > 0 && !ingredientStoreFilters.includes(product.storeId)) return false
      if (!search) return true
      const store = storeById.get(product.storeId)
      const haystack = normalizeStoreToken(`${product.name} ${product.brand} ${product.category} ${store?.name ?? ''}`)
      return haystack.includes(search)
    })
  }, [brokenProductImageIds, ingredientSearch, ingredientStoreFilters, productsCrud, storeById])
  const selectedIngredientProduct = ingredientProductId ? productById.get(ingredientProductId) ?? null : null
  const selectedIngredientMacroPreview = selectedIngredientProduct
    ? calculateProductMacros(selectedIngredientProduct, n(ingredientGrams))
    : { calories: 0, protein: 0, carbs: 0, fat: 0 }

  useEffect(() => {
    if (!ingredientProductId) return
    if (filteredIngredientProducts.some((product) => product.id === ingredientProductId)) return
    setIngredientProductId('')
  }, [filteredIngredientProducts, ingredientProductId])

  function resetRecipeEditor() {
    setRecipeForm(blankRecipeForm(authUser ? String(authUser.id) : users[0]?.id || ''))
    setIngredientPickerOpen(false)
    setIngredientStep('select')
    setIngredientProductId('')
    setIngredientGrams('100')
    setIngredientSearch('')
    setIngredientStoreFilters([])
  }

  function closeRecipeForm() {
    setShowRecipeForm(false)
    resetRecipeEditor()
  }

  function openRecipeForm() {
    setShowRecipeForm(true)
    setRecipeForm(blankRecipeForm(authUser ? String(authUser.id) : users[0]?.id || ''))
    setIngredientPickerOpen(false)
    setIngredientStep('select')
    setIngredientProductId('')
    setIngredientGrams('100')
    setIngredientSearch('')
    setIngredientStoreFilters([])
    setCrudMessage(null)
  }

  function openIngredientPicker() {
    setIngredientPickerOpen(true)
    setIngredientStep('select')
    setIngredientProductId('')
    setIngredientGrams('100')
  }

  function closeIngredientPicker() {
    setIngredientPickerOpen(false)
    setIngredientStep('select')
    setIngredientProductId('')
    setIngredientGrams('100')
  }

  function toggleIngredientStoreFilter(storeId: string) {
    setIngredientStoreFilters((current) => (
      current.includes(storeId)
        ? current.filter((id) => id !== storeId)
        : [...current, storeId]
    ))
  }

  function handleRecipeImageFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRecipeForm((current) => ({ ...current, imageUrl: String(reader.result ?? '') }))
    }
    reader.readAsDataURL(file)
  }

  function addIngredientToRecipe() {
    if (!selectedIngredientProduct || n(ingredientGrams) <= 0) return
    setRecipeForm((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        { productId: selectedIngredientProduct.id, quantity: String(n(ingredientGrams)), unit: 'g' },
      ],
    }))
    setIngredientProductId('')
    setIngredientGrams('100')
    setIngredientStep('select')
    setIngredientPickerOpen(false)
  }

  function removeIngredientFromRecipe(index: number) {
    setRecipeForm((current) => ({
      ...current,
      ingredients: current.ingredients.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  async function submitRecipe(e: FormEvent) {
    e.preventDefault()
    const ingredients = recipeForm.ingredients
      .map((i) => ({ product_id: Number(i.productId), quantity: n(i.quantity), unit: i.unit || 'g' }))
      .filter((i) => i.product_id > 0 && i.quantity > 0)
    if (ingredients.length === 0) {
      setCrudMessage('Agrega al menos un ingrediente valido.')
      return
    }
    const payload = {
      user_id: Number(recipeForm.userId),
      store_id: null,
      title: recipeForm.title.trim(),
      description: recipeForm.description.trim() || null,
      steps: recipeForm.steps.trim(),
      image_url: recipeForm.imageUrl.trim() || null,
      servings: 1,
      prep_time: 0,
      difficulty: 'Media',
      ingredients,
    }
    try {
      await postJson('/api/recipes', payload)
      setCrudMessage('Receta creada.')
      await loadCrudData()
      setShowRecipeForm(false)
      resetRecipeEditor()
    } catch (err) {
      setCrudMessage((err as Error).message)
    }
  }

  async function openRecipeDetail(recipeId: string) {
    setRecipeDetailLoading(true)
    try {
      const detail = await fetchJson<RecipeDetail>(`/api/recipes/${recipeId}`)
      setSelectedRecipeDetail(detail)
    } catch (err) {
      setCrudMessage((err as Error).message)
    } finally {
      setRecipeDetailLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteDialog) return
    try {
      await deleteJson(`/api/recipes/${deleteDialog.id}`)
      setCrudMessage('Receta eliminada.')
      await loadCrudData()
    } catch (err) {
      setCrudMessage((err as Error).message)
    } finally {
      setDeleteDialog(null)
    }
  }

  function saveProductId(productId: string) {
    setSavedProductIds((current) => {
      const next = new Set(current)
      next.add(productId)
      storeSavedProductIds(next)
      return next
    })
  }

  function removeSavedProductId(productId: string) {
    setSavedProductIds((current) => {
      const next = new Set(current)
      next.delete(productId)
      storeSavedProductIds(next)
      return next
    })
    setCheckedProductIds((current) => {
      const next = new Set(current)
      next.delete(productId)
      return next
    })
  }

  function toggleCheckedProductId(productId: string) {
    setCheckedProductIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  function clearCheckedProducts() {
    setCheckedProductIds((current) => {
      const next = new Set(current)
      savedProducts.forEach((product) => next.delete(product.id))
      return next
    })
  }

  async function copySavedProductsSummary() {
    if (savedProducts.length === 0) {
      setCrudMessage('Añade productos a tu lista antes de exportarla.')
      return
    }

    const lines = [
      'Lista de compra NutriSocial',
      ...savedProducts.map((product) => {
        const store = productStoreLabel(storeById.get(product.storeId))
        const checkedLabel = checkedProductIds.has(product.id) ? ' [comprado]' : ''
        return `- ${product.name} · ${product.brand || 'Sin marca'} · ${store}${checkedLabel}`
      }),
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCrudMessage('Lista de compra copiada al portapapeles.')
    } catch {
      setCrudMessage('No se pudo copiar la lista al portapapeles.')
    }
  }

  async function syncOpenFoodFactsProducts() {
    const query = externalImportQuery.trim()
    if (!query) {
      setExternalImportSummary('Escribe un producto para buscar.')
      setExternalImportResults([])
      return
    }
    setExternalImportLoading(true)
    setExternalImportSummary(null)
    setExternalImportResults([])
    try {
      const result = await postJson('/api/open-food-facts/search', {
        query,
        page_size: 30,
      }) as OpenFoodFactsSearchResponse
      setExternalImportSummary(result.products.length > 0 ? `${result.products.length} productos encontrados. Pulsa Añadir solo en los que quieras guardar.` : 'No se encontraron productos compatibles.')
      setExternalImportResults(result.products ?? [])
    } catch (err) {
      setExternalImportSummary(null)
      setExternalImportResults([])
      setCrudMessage((err as Error).message)
    } finally {
      setExternalImportLoading(false)
    }
  }

  async function addExternalProduct(product: ExternalProductPreview) {
    if (product.existing_id) {
      saveProductId(String(product.existing_id))
      setExternalImportSummary(`${product.name} añadido a tus productos.`)
      return
    }

    const query = externalImportQuery.trim()
    if (!query) return

    setAddingExternalProductCode(product.code)
    try {
      const result = await postJson('/api/open-food-facts/import-one', {
        query,
        code: product.code,
      }) as OpenFoodFactsImportOneResponse
      saveProductId(String(result.product.id))
      setExternalImportResults((current) =>
        current.map((item) =>
          item.code === product.code
            ? { ...item, id: result.product.id, existing_id: result.product.id, status: result.product.status }
            : item,
        ),
      )
      setExternalImportSummary(`${result.product.name} añadido a tus productos.`)
      await loadCrudData()
    } catch (err) {
      setCrudMessage((err as Error).message)
    } finally {
      setAddingExternalProductCode(null)
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthMessage(null)

    try {
      const payload = authMode === 'login'
        ? { username: authUsername, password: authPassword }
        : {
            name: authName,
            username: authUsername,
            password: authPassword,
            confirm_password: authConfirmPassword,
          }
      const response = await postJson(
        authMode === 'login' ? '/api/auth/login' : '/api/auth/register',
        payload,
      ) as AuthResponse
      if (authRememberUsername) {
        storeRememberedUsername(response.user.handle)
        setAuthUsername(response.user.handle)
      } else {
        storeRememberedUsername(null)
        setAuthUsername('')
      }
      setAuthUser(response.user)
      setAuthPassword('')
      setAuthConfirmPassword('')
      setAuthMessage(null)
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión')
    } finally {
      setAuthLoading(false)
    }
  }

  function switchAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode)
    setAuthMessage(null)
    setAuthPassword('')
    setAuthConfirmPassword('')
  }

  function logout() {
    setAuthUser(null)
    setAuthPassword('')
    setAuthConfirmPassword('')
    setAuthUsername(authRememberUsername ? readRememberedUsername() : '')
    setAuthMessage(null)
    setAuthMode('login')
  }

  const profileMatch = locationRoute.pathname.match(/^\/perfil\/([^/]+)$/)
  const profileUserId = profileMatch ? decodeURIComponent(profileMatch[1]) : null
  const isProfileRoute = profileUserId !== null
  const feedPosts = useMemo(() => getFeedPosts(feedTab), [feedTab, getFeedPosts])
  const profilePosts = useMemo(
    () => (profileUserId ? getUserPosts(profileUserId) : []),
    [getUserPosts, profileUserId],
  )
  const savedPosts = useMemo(() => {
    const allFeedPosts = getFeedPosts('para-ti')
    return allFeedPosts.filter((post) => ['post-lucia-1', 'post-andrea-1', 'post-marcos-1'].includes(post.id))
  }, [getFeedPosts])
  const effectiveCurrentUser = useMemo(
    () => authUserToSocialUser(authUser, socialCurrentUser),
    [authUser, socialCurrentUser],
  )
  const effectiveUsersById = useMemo(
    () => ({ ...socialUsersById, [effectiveCurrentUser.id]: effectiveCurrentUser }),
    [effectiveCurrentUser, socialUsersById],
  )
  const profileUser = profileUserId ? effectiveUsersById[profileUserId] ?? null : null

  useEffect(() => {
    if (isProfileRoute && activeSection !== 'perfil') {
      setActiveSection('perfil')
      return
    }
    if (!isProfileRoute && activeSection === 'perfil') {
      setActiveSection('inicio')
    }
  }, [activeSection, isProfileRoute])

  const openSocialProfile = useCallback((userId: string) => {
    setActiveSection('perfil')
    navigate(`/perfil/${userId}`)
  }, [navigate])

  const handleSectionSelect = useCallback((section: typeof activeSection) => {
    if (section === 'perfil') {
      setActiveSection('perfil')
      navigate(`/perfil/${effectiveCurrentUser.id}`)
      return
    }

    if (section === 'cuenta') {
      setActiveSection('cuenta')
      setAccountSection('overview')
      if (locationRoute.pathname !== '/') {
        navigate('/')
      }
      return
    }

    setActiveSection(section)
    if (locationRoute.pathname !== '/') {
      navigate('/')
    }
  }, [effectiveCurrentUser.id, locationRoute.pathname, navigate])

  const openAccountSection = useCallback((section: AccountSection) => {
    setActiveSection('cuenta')
    setAccountSection(section)
    if (locationRoute.pathname !== '/') {
      navigate('/')
    }
  }, [locationRoute.pathname, navigate])

  const headerDescription = isProfileRoute
    ? 'Perfil de usuario en vista independiente'
    : activeSection === 'inicio'
      ? (feedTab === 'para-ti'
          ? 'Feed social general con publicaciones de todos los perfiles mock'
          : 'Publicaciones solo de perfiles que sigues en estado local')
      : activeSection === 'tiendas-cercanas'
        ? 'Flujo de compra por proximidad en tiempo real'
        : activeSection === 'cuenta'
          ? 'Zona personal para gestionar tu perfil y preferencias'
        : `${labelForSection(activeSection)} en la estructura principal`

  const renderProductCard = (p: Product, action: 'add' | 'remove') => {
    const storeLabel = productStoreLabel(storeById.get(p.storeId))
    const imageFallback = <div className="product-photo-empty">{p.name.slice(0, 1).toUpperCase()}</div>
    const isChecked = checkedProductIds.has(p.id)

    return (
      <article key={p.id} className={`product-card ${action === 'remove' ? 'saved-product-card' : ''} ${isChecked ? 'is-checked' : ''}`}>
        <div className="catalog-thumb">
          {p.image ? (
            <button
              type="button"
              className="product-image-button"
              aria-label={`Ver imagen grande de ${p.name}`}
              onClick={() => setProductImagePreview({ src: p.image as string, alt: p.name })}
            >
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                onError={() => {
                  setBrokenProductImageIds((current) => {
                    const next = new Set(current)
                    next.add(p.id)
                    return next
                  })
                }}
              />
            </button>
          ) : imageFallback}
        </div>

        <div className="catalog-copy">
          <div className="product-title-block">
            <strong>{p.name}</strong>
            <p className="product-meta">
              <span>{p.brand || 'Sin marca'}</span>
              <span>{storeLabel}</span>
            </p>
            <p className="product-category">{p.category || 'Producto de alimentación'}</p>
          </div>

          <div className="nutrition-grid" aria-label={`Valores nutricionales de ${p.name}`}>
            <span><strong>{p.calories}</strong><small>kcal</small></span>
            <span><strong>{p.protein.toFixed(1)}</strong><small>prot.</small></span>
            <span><strong>{p.carbs.toFixed(1)}</strong><small>hidr.</small></span>
            <span><strong>{p.fat.toFixed(1)}</strong><small>grasas</small></span>
          </div>
        </div>

        <div className="product-card-footer">
          <span>Por {p.referenceAmount} {p.referenceUnit}</span>
          {action === 'add' ? (
            <button type="button" className="secondary-btn" onClick={() => saveProductId(p.id)}>
              Añadir
            </button>
          ) : (
            <>
              <button type="button" className={`ghost-btn ${isChecked ? 'checked-btn' : ''}`} onClick={() => toggleCheckedProductId(p.id)}>
                {isChecked ? 'Comprado' : 'Marcar'}
              </button>
              <button type="button" className="ghost-btn" onClick={() => removeSavedProductId(p.id)}>
                Quitar
              </button>
            </>
          )}
        </div>
      </article>
    )
  }

  if (!authUser) {
    return (
      <AuthScreen
        mode={authMode}
        name={authName}
        username={authUsername}
        password={authPassword}
        confirmPassword={authConfirmPassword}
        rememberUsername={authRememberUsername}
        message={authMessage}
        loading={authLoading}
        themeMode={themeMode}
        onSubmit={submitAuth}
        onModeChange={switchAuthMode}
        onNameChange={setAuthName}
        onUsernameChange={setAuthUsername}
        onPasswordChange={setAuthPassword}
        onConfirmPasswordChange={setAuthConfirmPassword}
        onRememberUsernameChange={setAuthRememberUsername}
      />
    )
  }

  return (
    <div className="app-shell" data-theme={themeMode}>
      <aside className="left-sidebar card-surface">
        <div className="brand-block">
          <img className="brand-mark" src="/app-logo.png" alt="NutriSocial" />
          <strong>NutriSocial</strong>
        </div>

        <nav className="side-nav" aria-label="Secciones principales">
          {[
            { id: 'inicio', label: 'Inicio' },
            { id: 'productos', label: 'Productos' },
            { id: 'tiendas', label: 'Tiendas' },
            { id: 'recetas', label: 'Recetas' },
            { id: 'perfil', label: 'Perfil' },
            { id: 'cuenta', label: 'Mi cuenta' },
            { id: 'tiendas-cercanas', label: 'Tiendas cercanas' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`side-nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => handleSectionSelect(item.id as typeof activeSection)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-feed">
        <header className="feed-header card-surface">
          {!isProfileRoute && activeSection === 'inicio' && (
            <div className="feed-tabs">
              <button
                type="button"
                className={`feed-tab ${feedTab === 'para-ti' ? 'active' : ''}`}
                onClick={() => setFeedTab('para-ti')}
              >
                Para ti
              </button>
              <button
                type="button"
                className={`feed-tab ${feedTab === 'siguiendo' ? 'active' : ''}`}
                onClick={() => setFeedTab('siguiendo')}
              >
                Siguiendo
              </button>
            </div>
          )}
          <p className="muted">{headerDescription}</p>
        </header>
        {crudMessage && <section className="panel card-surface"><p className="muted">{crudMessage}</p></section>}

        {isProfileRoute ? (
          profileUser ? (
            <SocialProfilePage
              user={profileUser}
              posts={profilePosts}
              commentsByPostId={commentsByPostId}
              currentUser={effectiveCurrentUser}
              usersById={effectiveUsersById}
              isFollowing={followingSet.has(profileUser.id)}
              hasRequest={requestSet.has(profileUser.id)}
              onOpenProfile={openSocialProfile}
              onFollowUser={followUser}
              onSendFriendRequest={sendFriendRequest}
              onAddComment={addComment}
            />
          ) : (
            <section className="panel card-surface">
              <div className="panel-headline">
                <p className="eyebrow">Perfil</p>
                <h2>Usuario no encontrado</h2>
              </div>
              <p className="muted">No existe un perfil para la ruta solicitada.</p>
            </section>
          )
        ) : activeSection === 'inicio' ? (
          <SocialHome
            feedTab={feedTab}
            posts={feedPosts}
            commentsByPostId={commentsByPostId}
            currentUser={effectiveCurrentUser}
          usersById={effectiveUsersById}
            onOpenProfile={openSocialProfile}
            onAddComment={addComment}
          />
        ) : activeSection === 'cuenta' ? (
          <SocialAccountPage
            currentUser={effectiveCurrentUser}
            accountSection={accountSection}
            savedPosts={savedPosts}
            commentsByPostId={commentsByPostId}
            usersById={effectiveUsersById}
            isDarkMode={themeMode === 'dark'}
            onOpenProfile={openSocialProfile}
            onAddComment={addComment}
            onSelectAccountSection={openAccountSection}
            onToggleDarkMode={(enabled) => setThemeMode(enabled ? 'dark' : 'light')}
          />
        ) : activeSection === 'tiendas-cercanas' ? (
          <>
            <section className="composer card-surface">
              <LocationPanel
                permission={permission}
                label={locationLabel}
                errorMessage={locationError}
                onRequestLocation={requestLocation}
              />

              <ProductSearchPanel
                query={query}
                selectedProduct={selectedProduct}
                suggestions={suggestions}
                loading={searchLoading}
                errorMessage={searchError}
                onQueryChange={handleQueryChange}
                onSelect={handleSelectProduct}
              />

              <section className="action-bar card-surface">
                <div className="range-block">
                  <label htmlFor="radius">Radio de busqueda: <strong>{radiusKm} km</strong></label>
                  <input
                    id="radius"
                    type="range"
                    min={1}
                    max={50}
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(Number(event.target.value))}
                  />
                </div>

                <button className="primary-btn" type="button" onClick={handleSearchNearbyStores} disabled={nearbyLoading}>
                  {nearbyLoading ? 'Buscando tiendas...' : 'Buscar tiendas cercanas'}
                </button>
              </section>
            </section>

            <StoreResultsPanel
              loading={nearbyLoading}
              errorMessage={nearbyError}
              stores={visibleStores}
              radiusKm={radiusKm}
              hasSearched={hasSearched}
              prioritizeAvailable={prioritizeAvailable}
              summary={nearbySummary}
              onTogglePrioritizeAvailable={() => setPrioritizeAvailable((value) => !value)}
            />
          </>
        ) : activeSection === 'productos' ? (
          <section className="panel card-surface product-panel">
            <div className="recipes-toolbar product-toolbar">
              <div className="panel-headline">
                <p className="eyebrow">Productos</p>
                <h2>Tus productos guardados</h2>
              </div>
              <button type="button" className="primary-btn" onClick={() => setProductSearchModalOpen(true)}>
                Buscar y añadir
              </button>
            </div>

            <div className="product-section-stack">
              <section className="shopping-plan-panel product-utility-panel">
                <div className="shopping-plan-header">
                  <div>
                    <p className="eyebrow">Lista de compra</p>
                    <h3>Gestiona y reutiliza tus productos guardados</h3>
                  </div>
                  <div className="crud-actions">
                    <button type="button" className="ghost-btn" onClick={clearCheckedProducts} disabled={checkedSavedProducts.length === 0}>
                      Limpiar marcados
                    </button>
                    <button type="button" className="secondary-btn" onClick={() => void copySavedProductsSummary()}>
                      Copiar lista
                    </button>
                  </div>
                </div>

                <div className="shopping-plan-metrics">
                  <article className="shopping-metric-card">
                    <strong>{savedProducts.length}</strong>
                    <span>productos visibles</span>
                  </article>
                  <article className="shopping-metric-card">
                    <strong>{checkedSavedProducts.length}</strong>
                    <span>marcados como comprados</span>
                  </article>
                  <article className="shopping-metric-card">
                    <strong>{savedProductsCoveredStores}</strong>
                    <span>tiendas implicadas</span>
                  </article>
                  <article className="shopping-metric-card">
                    <strong>{savedProductsTotalCalories.toFixed(0)}</strong>
                    <span>kcal por referencia</span>
                  </article>
                </div>

                <div className="product-filter-grid">
                  <label className="product-filter-field">
                    Buscar en tu catálogo
                    <input
                      type="search"
                      value={productSearchTerm}
                      onChange={(event) => setProductSearchTerm(event.target.value)}
                      placeholder="Leche, avena, atún, proteína..."
                    />
                  </label>

                  <label className="product-filter-field">
                    Filtrar por tienda
                    <select value={productStoreFilter} onChange={(event) => setProductStoreFilter(event.target.value)}>
                      <option value="all">Todas las tiendas</option>
                      {productStoreOptions.map((store) => (
                        <option key={store.id} value={store.id}>{normalizeDisplayStoreName(store.name)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="product-filter-field">
                    Ordenar por
                    <select value={productSort} onChange={(event) => setProductSort(event.target.value as ProductSortOption)}>
                      <option value="recent">Descubrimiento</option>
                      <option value="name">Nombre</option>
                      <option value="protein">Más proteína</option>
                      <option value="calories">Menos calorías</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="product-discovery-panel">
                <div className="section-inline-head">
                  <div>
                    <h3>Descubre productos de la base de datos</h3>
                    <p className="muted">Una muestra útil según tus filtros. Añade solo los que quieras conservar.</p>
                  </div>
                </div>
                {discoveryProducts.length === 0 ? (
                  <article className="recipe-empty">
                    <h3>No hay productos disponibles con esos filtros</h3>
                    <p>Ajusta la búsqueda, la tienda o el criterio de ordenación.</p>
                  </article>
                ) : (
                  <div className="product-card-grid">
                    {discoveryProducts.map((p) => renderProductCard(p, 'add'))}
                  </div>
                )}
              </section>

              <section className="product-discovery-panel">
                <div className="section-inline-head">
                  <div>
                    <h3>Mi lista</h3>
                    <p className="muted">Aquí se quedan los productos que marques como favoritos.</p>
                  </div>
                </div>
                {savedProducts.length === 0 ? (
                  <article className="recipe-empty">
                    <h3>{savedProductIds.size === 0 ? 'Aún no has añadido productos' : 'No hay productos visibles con los filtros actuales'}</h3>
                    <p>{savedProductIds.size === 0 ? 'Usa la búsqueda o la muestra aleatoria para crear tu lista.' : 'Prueba a limpiar la búsqueda o cambiar la tienda seleccionada.'}</p>
                  </article>
                ) : (
                  <div className="product-card-grid saved-product-grid">
                    {savedProducts.map((p) => renderProductCard(p, 'remove'))}
                  </div>
                )}
              </section>
            </div>
          </section>
        ) : activeSection === 'tiendas' ? (
          <section className="panel card-surface">
            <div className="panel-headline">
              <p className="eyebrow">Tiendas</p>
              <h2>Tiendas detectadas</h2>
            </div>
            <div className="crud-list">
              {visibleStoresCrud.map((s) => {
                const logoUrl = storeLogoUrl(s)

                return (
                  <article key={s.id} className="crud-item">
                    {logoUrl ? (
                      <div className="store-mark">
                        <img className="store-logo-img" src={logoUrl} alt={`Logo de ${normalizeDisplayStoreName(s.name)}`} loading="lazy" />
                      </div>
                    ) : null}
                    <div>
                      <strong>{normalizeDisplayStoreName(s.name)}</strong>
                      <p className="muted">{productsCrud.filter((product) => product.storeId === s.id).length} productos como tienda principal</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : activeSection === 'recetas' ? (
          <section className="panel card-surface">
            <div className="recipes-toolbar">
              <div className="panel-headline">
                <p className="eyebrow">Recetas</p>
                <h2>Gestión de recetas</h2>
              </div>
              <button type="button" className="primary-btn" onClick={openRecipeForm}>
                Crear receta
              </button>
            </div>

            <div className="recipe-list">
              {recipesCrud.length === 0 ? (
                <article className="recipe-empty">
                  <h3>Aún no hay ninguna receta creada</h3>
                </article>
              ) : recipesCrud.map((recipe) => (
                <article key={recipe.id} className="recipe-list-card">
                  {recipe.image ? <img src={recipe.image} alt={recipe.title} /> : <div className="recipe-image-placeholder" />}
                  <button type="button" className="recipe-list-body" onClick={() => void openRecipeDetail(recipe.id)}>
                    <strong>{recipe.title}</strong>
                    <p>{recipe.description || 'Sin descripción'}</p>
                    <div className="recipe-macro-row">
                      <span>{recipe.caloriesTotal.toFixed(0)} kcal</span>
                      <span>{recipe.proteinTotal.toFixed(1)} g proteínas</span>
                      <span>{recipe.carbsTotal.toFixed(1)} g hidratos</span>
                      <span>{recipe.fatTotal.toFixed(1)} g grasas</span>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="panel card-surface">
            <div className="panel-headline">
              <p className="eyebrow">Seccion</p>
              <h2>{labelForSection(activeSection)}</h2>
            </div>
            <p className="muted">Selecciona Productos, Tiendas o Recetas para usar Añadir, Editar y Eliminar.</p>
          </section>
        )}
      </main>

      <aside className="right-rail">
        <SocialSidebar
          currentUser={effectiveCurrentUser}
            usersById={effectiveUsersById}
          followingUsers={followingUsers}
          followingSet={followingSet}
          onOpenProfile={openSocialProfile}
          onOpenAccountSection={openAccountSection}
          onFollowUser={followUser}
          onLogout={logout}
        />
      </aside>

      {showRecipeForm && (
        <div className="modal-backdrop" role="presentation" onClick={closeRecipeForm}>
          <section className="recipe-modal card-surface" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="recipe-modal-header">
              <div>
                <p className="eyebrow">Nueva receta</p>
                <h2 id="recipe-modal-title">Crear receta</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={closeRecipeForm}>×</button>
            </div>

            <form className="recipe-create-form" onSubmit={submitRecipe}>
              <div className="recipe-form-grid">
                <label className="recipe-field">
                  Título de la receta
                  <input
                    value={recipeForm.title}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Tostada de jamón cocido"
                    required
                  />
                </label>
                <label className="recipe-field">
                  Descripción
                  <textarea
                    value={recipeForm.description}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Una descripción corta para reconocer la receta."
                    rows={3}
                  />
                </label>
                <label className="recipe-field recipe-file-field">
                  Imagen de la receta
                  <input type="file" accept="image/*" onChange={(event) => handleRecipeImageFile(event.target.files?.[0] ?? null)} />
                </label>
                {recipeForm.imageUrl ? (
                  <img className="recipe-image-preview" src={recipeForm.imageUrl} alt="Vista previa de la receta" />
                ) : null}
              </div>

              <section className="recipe-builder" aria-label="Ingredientes de la receta">
                <div className="recipe-builder-head">
                  <div>
                    <h3>Ingredientes</h3>
                  </div>
                  <button type="button" className="secondary-btn" onClick={openIngredientPicker}>
                    Añadir ingrediente
                  </button>
                </div>

                {recipeForm.ingredients.length > 0 ? (
                  <div className="ingredient-list">
                    {recipeForm.ingredients.map((ingredient, index) => {
                      const product = productById.get(ingredient.productId)
                      const macros = product ? calculateProductMacros(product, n(ingredient.quantity)) : null

                      return (
                        <article key={`${ingredient.productId}-${index}`} className="ingredient-card">
                          {product?.image ? <img src={product.image} alt={product.name} /> : <div className="recipe-image-placeholder" />}
                          <div>
                            <strong>{product?.name ?? 'Producto eliminado'}</strong>
                            <span>{n(ingredient.quantity)} g</span>
                            {macros ? (
                              <p>{macros.calories.toFixed(0)} kcal · {macros.protein.toFixed(1)} P · {macros.carbs.toFixed(1)} H · {macros.fat.toFixed(1)} G</p>
                            ) : null}
                          </div>
                          <button type="button" className="ghost-btn compact-btn" onClick={() => removeIngredientFromRecipe(index)}>
                            Quitar
                          </button>
                        </article>
                      )
                    })}
                  </div>
                ) : null}

                {ingredientPickerOpen ? (
                <div className="ingredient-wizard">
                  <div className="ingredient-stepper" aria-label="Paso de ingrediente">
                    <span className={ingredientStep === 'select' ? 'is-active' : ''}>Producto</span>
                    <span className={ingredientStep === 'amount' ? 'is-active' : ''}>Cantidad</span>
                  </div>

                  {ingredientStep === 'select' ? (
                    <>
                      <div className="ingredient-filter-panel">
                        <input
                          aria-label="Buscar producto para receta"
                          value={ingredientSearch}
                          onChange={(event) => setIngredientSearch(event.target.value)}
                          placeholder="Buscar producto"
                        />
                        <div className="ingredient-store-strip" aria-label="Filtrar por tienda">
                          {ingredientStores.map((store) => {
                            const logoUrl = storeLogoUrl(store)
                            const selected = ingredientStoreFilters.includes(store.id)

                            return (
                              <button
                                type="button"
                                key={store.id}
                                className={`ingredient-store-chip ${selected ? 'is-selected' : ''}`}
                                onClick={() => toggleIngredientStoreFilter(store.id)}
                              >
                                {logoUrl ? <img src={logoUrl} alt="" /> : <span>{store.logo}</span>}
                                {normalizeDisplayStoreName(store.name)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="ingredient-product-list">
                        {filteredIngredientProducts.map((product) => (
                          <button
                            type="button"
                            key={product.id}
                            className={`ingredient-product-option ${ingredientProductId === product.id ? 'is-selected' : ''}`}
                            onClick={() => setIngredientProductId(product.id)}
                          >
                            {product.image && !brokenProductImageIds.has(product.id) ? (
                              <img src={product.image} alt={product.name} onError={() => setBrokenProductImageIds((current) => new Set(current).add(product.id))} />
                            ) : (
                              <span className="product-photo-empty" aria-hidden="true" />
                            )}
                            <span>
                              <strong>{product.name}</strong>
                              <small>{product.brand || storeById.get(product.storeId)?.name || 'Producto'}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                      {filteredIngredientProducts.length === 0 ? <p className="muted">No hay productos con esos filtros.</p> : null}
                      <div className="recipe-modal-actions split-actions">
                        <button type="button" className="ghost-btn" onClick={closeIngredientPicker}>
                          Cancelar
                        </button>
                        <button type="button" className="secondary-btn" disabled={!ingredientProductId} onClick={() => setIngredientStep('amount')}>
                          Siguiente
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="ingredient-amount-panel">
                      {selectedIngredientProduct ? (
                        <article className="ingredient-selected-card">
                          {selectedIngredientProduct.image ? <img src={selectedIngredientProduct.image} alt={selectedIngredientProduct.name} /> : <div className="recipe-image-placeholder" />}
                          <div>
                            <strong>{selectedIngredientProduct.name}</strong>
                            <p>{selectedIngredientProduct.brand || storeById.get(selectedIngredientProduct.storeId)?.name || 'Producto seleccionado'}</p>
                          </div>
                        </article>
                      ) : null}

                      <label className="recipe-field">
                        Gramos utilizados
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={ingredientGrams}
                          onChange={(event) => setIngredientGrams(event.target.value)}
                        />
                      </label>

                      <div className="macro-preview">
                        <span>{selectedIngredientMacroPreview.calories.toFixed(0)} kcal</span>
                        <span>{selectedIngredientMacroPreview.protein.toFixed(1)} g proteínas</span>
                        <span>{selectedIngredientMacroPreview.carbs.toFixed(1)} g hidratos</span>
                        <span>{selectedIngredientMacroPreview.fat.toFixed(1)} g grasas</span>
                      </div>

                      <div className="recipe-modal-actions split-actions">
                        <button type="button" className="ghost-btn" onClick={() => setIngredientStep('select')}>Volver</button>
                        <button type="button" className="secondary-btn" disabled={!selectedIngredientProduct || n(ingredientGrams) <= 0} onClick={addIngredientToRecipe}>
                          Agregar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                ) : null}
              </section>

              {recipeForm.ingredients.length > 0 ? (
                <label className="recipe-field">
                  Elaboración
                  <textarea
                    value={recipeForm.steps}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, steps: event.target.value }))}
                    placeholder="Describe los pasos para preparar la receta."
                    rows={5}
                  />
                </label>
              ) : null}

              <div className="recipe-modal-actions">
                <button type="button" className="ghost-btn" onClick={closeRecipeForm}>Cancelar</button>
                <button type="submit" className="primary-btn">Crear receta</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {(selectedRecipeDetail || recipeDetailLoading) && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedRecipeDetail(null)}>
          <section className="recipe-modal recipe-detail-modal card-surface" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {recipeDetailLoading ? (
              <p className="muted">Cargando receta...</p>
            ) : selectedRecipeDetail ? (
              <>
                <div className="recipe-modal-header">
                  <div>
                    <p className="eyebrow">Receta</p>
                    <h2>{selectedRecipeDetail.title}</h2>
                  </div>
                  <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setSelectedRecipeDetail(null)}>×</button>
                </div>
                <div className="recipe-detail-hero">
                  {selectedRecipeDetail.image_url ? <img src={selectedRecipeDetail.image_url} alt={selectedRecipeDetail.title} /> : <div className="recipe-image-placeholder" />}
                  <div>
                    <p>{selectedRecipeDetail.description || 'Sin descripción'}</p>
                    <div className="recipe-macro-row">
                      <span>{recipesCrud.find((recipe) => recipe.id === String(selectedRecipeDetail.id))?.caloriesTotal.toFixed(0) ?? '0'} kcal</span>
                      <span>{recipesCrud.find((recipe) => recipe.id === String(selectedRecipeDetail.id))?.proteinTotal.toFixed(1) ?? '0.0'} g proteínas</span>
                      <span>{recipesCrud.find((recipe) => recipe.id === String(selectedRecipeDetail.id))?.carbsTotal.toFixed(1) ?? '0.0'} g hidratos</span>
                      <span>{recipesCrud.find((recipe) => recipe.id === String(selectedRecipeDetail.id))?.fatTotal.toFixed(1) ?? '0.0'} g grasas</span>
                    </div>
                  </div>
                </div>
                {selectedRecipeDetail.steps ? (
                  <section className="recipe-detail-section">
                    <h3>Elaboración</h3>
                    <p>{selectedRecipeDetail.steps}</p>
                  </section>
                ) : null}
                <section className="recipe-detail-section">
                  <h3>Productos utilizados</h3>
                  <div className="ingredient-list">
                    {selectedRecipeDetail.ingredients.map((ingredient) => (
                      <article key={ingredient.product_id} className="ingredient-card">
                        {ingredient.image_url ? <img src={ingredient.image_url} alt={ingredient.name} /> : <div className="recipe-image-placeholder" />}
                        <div>
                          <strong>{ingredient.name}</strong>
                          <span>{n(String(ingredient.quantity))} {ingredient.unit}</span>
                          <p>{ingredient.brand || ingredient.category}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </section>
        </div>
      )}

      {productSearchModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setProductSearchModalOpen(false)}>
          <section className="product-search-modal card-surface" role="dialog" aria-modal="true" aria-labelledby="product-search-title" onClick={(e) => e.stopPropagation()}>
            <div className="recipe-modal-header">
              <div>
                <p className="eyebrow">Base de datos externa</p>
                <h2 id="product-search-title">Buscar productos para añadir</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setProductSearchModalOpen(false)}>×</button>
            </div>
            <div className="external-sync-actions">
              <input
                aria-label="Buscar productos en bases de datos externas"
                placeholder="Yogur, pan, jamón cocido..."
                value={externalImportQuery}
                onChange={(event) => setExternalImportQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void syncOpenFoodFactsProducts()
                }}
              />
              <button type="button" className="primary-btn" onClick={() => void syncOpenFoodFactsProducts()} disabled={externalImportLoading}>
                {externalImportLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {externalImportSummary ? <p className="status-pill status-granted">{externalImportSummary}</p> : null}
            {externalImportResults.length > 0 ? (
              <div className="external-result-list">
                {externalImportResults.map((product) => (
                  <article key={product.code} className="external-result-card">
                    {product.image_url ? <img src={product.image_url} alt={product.name} /> : <div className="recipe-image-placeholder" />}
                    <div>
                      <strong>{product.name}</strong>
                      <p>{product.brand} · {product.category} · {product.store}</p>
                      <div className="nutrition-grid compact" aria-label={`Valores nutricionales de ${product.name}`}>
                        <span><strong>{product.calories}</strong> kcal</span>
                        <span><strong>{Number(product.protein).toFixed(1)}</strong> g proteínas</span>
                        <span><strong>{Number(product.carbs).toFixed(1)}</strong> g hidratos</span>
                        <span><strong>{Number(product.fat).toFixed(1)}</strong> g grasas</span>
                      </div>
                      <p>Por {product.reference_amount} {product.reference_unit}</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => void addExternalProduct(product)}
                      disabled={Boolean(product.existing_id && savedProductIds.has(String(product.existing_id))) || addingExternalProductCode === product.code}
                    >
                      {addingExternalProductCode === product.code
                        ? 'Añadiendo...'
                        : product.existing_id && savedProductIds.has(String(product.existing_id))
                          ? 'Añadido'
                          : 'Añadir'}
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      )}

      {productImagePreview && (
        <div className="modal-backdrop product-image-backdrop" role="presentation" onClick={() => setProductImagePreview(null)}>
          <section className="product-image-modal" role="dialog" aria-modal="true" aria-label={productImagePreview.alt} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="icon-btn product-image-close" aria-label="Cerrar imagen" onClick={() => setProductImagePreview(null)}>×</button>
            <img src={productImagePreview.src} alt={productImagePreview.alt} />
          </section>
        </div>
      )}

      {deleteDialog && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeleteDialog(null)}>
          <div className="confirm-modal card-surface" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar eliminacion</h3>
            <p>
              {`¿Seguro que quieres eliminar la receta "${deleteDialog.label}"?`}
            </p>
            <div className="crud-actions">
              <button type="button" className="ghost-btn" onClick={() => setDeleteDialog(null)}>Cancelar</button>
              <button type="button" className="danger-btn" onClick={() => void confirmDelete()}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type AuthScreenProps = {
  mode: AuthMode
  name: string
  username: string
  password: string
  confirmPassword: string
  rememberUsername: boolean
  message: string | null
  loading: boolean
  themeMode: ThemeMode
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onModeChange: (mode: AuthMode) => void
  onNameChange: (value: string) => void
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onRememberUsernameChange: (value: boolean) => void
}

function AuthScreen({
  mode,
  name,
  username,
  password,
  confirmPassword,
  rememberUsername,
  message,
  loading,
  themeMode,
  onSubmit,
  onModeChange,
  onNameChange,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onRememberUsernameChange,
}: AuthScreenProps) {
  const isRegister = mode === 'register'

  return (
    <main className="auth-shell" data-theme={themeMode}>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <img className="brand-mark" src="/app-logo.png" alt="NutriSocial" />
          <div>
            <p className="eyebrow">NutriSocial</p>
            <h1 id="auth-title">{isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {isRegister ? (
            <label>
              Nombre del perfil
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Fernando RM"
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label>
            Nombre de usuario
            <input
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="fernandorm"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
          </label>

          {isRegister ? (
            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}

          {message ? <p className="auth-message">{message}</p> : null}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Un momento...' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <label className="auth-remember">
          <input
            type="checkbox"
            checked={rememberUsername}
            onChange={(event) => onRememberUsernameChange(event.target.checked)}
          />
          <span>Guardar nombre de usuario</span>
        </label>

        <button
          type="button"
          className="auth-switch"
          onClick={() => onModeChange(isRegister ? 'login' : 'register')}
        >
          {isRegister ? 'Ya tengo cuenta' : 'No tengo cuenta, crear cuenta'}
        </button>
      </section>
    </main>
  )
}

function labelForSection(section: 'inicio' | 'productos' | 'tiendas' | 'recetas' | 'perfil' | 'cuenta' | 'tiendas-cercanas'): string {
  switch (section) {
    case 'inicio':
      return 'Inicio'
    case 'productos':
      return 'Productos'
    case 'tiendas':
      return 'Tiendas'
    case 'recetas':
      return 'Recetas'
    case 'perfil':
      return 'Perfil'
    case 'cuenta':
      return 'Mi cuenta'
    default:
      return 'Tiendas cercanas'
  }
}

export default App
