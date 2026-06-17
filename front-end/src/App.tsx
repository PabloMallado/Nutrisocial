import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { SocialAccountPage } from './features/social/SocialAccountPage'
import { SocialHome } from './features/social/SocialHome'
import { SocialProfilePage } from './features/social/SocialProfilePage'
import { SocialSidebar } from './features/social/SocialSidebar'
import { RecipeHealthPanel } from './features/social/components/RecipeHealthPanel'
import { useSocialState } from './features/social/use-social-state'
import { apiRequest } from './services/http'
import type { AccountSection, FeedTab, SocialPost, SocialRecipe, SocialRecipeIngredient, SocialUser } from './features/social/types'


type User = { id: string; name: string; handle: string; bio: string; avatarUrl: string | null }
type Store = { id: string; name: string; description: string; address: string; city: string; logo: string; accent: string; image: string | null; productCount: number }
type Product = { id: string; name: string; category: string; brand: string; storeId: string; referenceAmount: number; referenceUnit: string; image: string | null; price: number; stock: number; calories: number; protein: number; carbs: number; fat: number }
type RecipeIngredient = { productId: string; name: string; amount: string }
type Recipe = { id: string; userId: string; storeId: string | null; title: string; description: string; steps: string; image: string | null; servings: number; prepTime: number; difficulty: string; caloriesTotal: number; proteinTotal: number; carbsTotal: number; fatTotal: number; createdAt: string; ingredients: RecipeIngredient[] }
type ProductFolder = { id: string; name: string; productIds: string[]; image: string | null }
type ProductFolderPrompt = { productIds: string[]; title: string }
type RecipeForm = { title: string; description: string; steps: string; userId: string; storeId: string; difficulty: string; servings: string; prepTime: string; imageUrl: string; ingredients: Array<{ productId: string; quantity: string; unit: string }> }
type RecipeIngredientDetail = { product_id: number; name: string; brand: string; category: string; image_url: string | null; calories: number; protein: number | string; carbs: number | string; fat: number | string; reference_amount: number | string; reference_unit: string; quantity: number | string; unit: string }
type RecipeDetail = { id: number; user_id: number; store_id: string | null; title: string; description: string | null; steps: string | null; image_url: string | null; servings: number; prep_time: number; difficulty: string; ingredients: RecipeIngredientDetail[] }
type CreateRecipeResponse = { ok: boolean; id: number | string }
type ApiBootstrap = {
  users: Array<{ id: number; name: string; handle: string; bio: string | null; avatar_url: string | null }>
  stores: Array<{ id: string; name: string; description: string | null; address: string | null; city: string; logo: string; accent: string; image_url: string | null; products_count: number | string }>
  products: Array<{ id: number; name: string; category: string; brand: string; store_id: string; reference_amount: number | string; reference_unit: string; image_url: string | null; price: number | string; stock: number; calories: number; protein: number | string; carbs: number | string; fat: number | string }>
  recipes: Array<{ id: number; user_id: number; store_id: string | null; title: string; description: string | null; steps: string | null; image_url: string | null; servings: number; prep_time: number; difficulty: string; calories_total: number | string; protein_total: number | string; carbs_total: number | string; fat_total: number | string; created_at: string; ingredients?: Array<{ product_id: number | string; name: string; quantity: number | string; unit: string | null }> }>
}
type AuthUser = { id: number; name: string; handle: string; avatar_url: string | null }
type AuthResponse = { ok: boolean; user: AuthUser }
type DeleteDialog = { type: 'recipe'; id: string; label: string }
type ProductImagePreview = { src: string; alt: string }
type ThemeMode = 'light' | 'dark'
type AuthMode = 'login' | 'register'
type IngredientStep = 'select' | 'amount'
type ProductSortOption = 'recent' | 'name' | 'protein' | 'calories'
type RecipeTab = 'mine' | 'saved'
type ProductTab = 'catalog' | 'list'
type ExternalProductPreview = { code: string; existing_id: number | null; id?: number; name: string; brand: string; category: string; store: string; image_url: string | null; calories: number; protein: number; carbs: number; fat: number; reference_amount: number; reference_unit: string; status?: 'imported' | 'updated' }
type OpenFoodFactsSearchResponse = { ok: boolean; query: string; products: ExternalProductPreview[] }
type OpenFoodFactsImportOneResponse = { ok: boolean; product: ExternalProductPreview & { id: number; status: 'imported' | 'updated' } }
type MainSection = 'inicio' | 'productos' | 'tiendas' | 'recetas' | 'perfil' | 'cuenta'
type AppPreferences = {
  activeSection: Exclude<MainSection, 'perfil'>
  accountSection: AccountSection
  feedTab: FeedTab
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
const limonShowcaseRecipeTitles = new Set([
  'Bowl mediterraneo de quinoa y parmesano',
  'Tostadas integrales con crema suave y ketchup especiado',
  'Pasta con tomate, parmesano y toque crujiente',
  'Vaso rosa proteico con hielo',
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
  const rawValue = window.localStorage.getItem('nutrisocial-auth-user') ?? window.sessionStorage.getItem('nutrisocial-auth-user')
  if (!rawValue) return null
  try {
    const user = JSON.parse(rawValue) as AuthUser
    window.localStorage.setItem('nutrisocial-auth-user', JSON.stringify(user))
    window.sessionStorage.removeItem('nutrisocial-auth-user')
    return user
  } catch {
    window.localStorage.removeItem('nutrisocial-auth-user')
    window.sessionStorage.removeItem('nutrisocial-auth-user')
    return null
  }
}

const storeAuthUser = (user: AuthUser | null) => {
  if (!user) {
    window.localStorage.removeItem('nutrisocial-auth-user')
    window.sessionStorage.removeItem('nutrisocial-auth-user')
    return
  }
  window.localStorage.setItem('nutrisocial-auth-user', JSON.stringify(user))
  window.sessionStorage.removeItem('nutrisocial-auth-user')
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
const productFoldersStorageKey = 'nutrisocial-product-folders'
const savedRecipesStorageKey = 'nutrisocial-saved-recipe-ids'
const publishedRecipesStorageKey = 'nutrisocial-published-recipe-ids'
const appPreferencesStorageKey = 'nutrisocial-app-preferences'
const productsPerPage = 20
const folderPickerProductsPerPage = 10
const defaultAppPreferences: AppPreferences = {
  activeSection: 'inicio',
  accountSection: 'overview',
  feedTab: 'para-ti',
  productSearchTerm: '',
  productSort: 'recent',
  productStoreFilter: 'all',
  checkedProductIds: [],
}
const persistedMainSections = new Set<AppPreferences['activeSection']>(['inicio', 'productos', 'tiendas', 'recetas', 'cuenta'])
const userStorageKey = (baseKey: string, userId?: string | number | null) => (
  userId ? `${baseKey}:user-${userId}` : baseKey
)

const readSavedProductIds = (userId?: string | number | null) => {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const rawValue = window.localStorage.getItem(userStorageKey(savedProductsStorageKey, userId))
    const parsed = rawValue ? JSON.parse(rawValue) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set<string>()
  }
}

const storeSavedProductIds = (ids: Set<string>, userId?: string | number | null) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(userStorageKey(savedProductsStorageKey, userId), JSON.stringify([...ids]))
}

const readProductFolders = (userId?: string | number | null): ProductFolder[] => {
  if (typeof window === 'undefined') return []
  try {
    const rawValue = window.localStorage.getItem(userStorageKey(productFoldersStorageKey, userId))
    const parsed = rawValue ? JSON.parse(rawValue) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((folder) => ({
        id: String(folder?.id ?? ''),
        name: String(folder?.name ?? '').trim(),
        productIds: Array.isArray(folder?.productIds) ? folder.productIds.map(String) : [],
        image: typeof folder?.image === 'string' && folder.image.trim() ? folder.image.trim() : null,
      }))
      .filter((folder) => folder.id && folder.name)
  } catch {
    return []
  }
}

const storeProductFolders = (folders: ProductFolder[], userId?: string | number | null) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(userStorageKey(productFoldersStorageKey, userId), JSON.stringify(folders))
}

const readSavedRecipeIds = (userId?: string | number | null) => {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const rawValue = window.localStorage.getItem(userStorageKey(savedRecipesStorageKey, userId))
    const parsed = rawValue ? JSON.parse(rawValue) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set<string>()
  }
}

const storeSavedRecipeIds = (ids: Set<string>, userId?: string | number | null) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(userStorageKey(savedRecipesStorageKey, userId), JSON.stringify([...ids]))
}

const readPublishedRecipeIds = () => {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const rawValue = window.localStorage.getItem(publishedRecipesStorageKey)
    const parsed = rawValue ? JSON.parse(rawValue) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set<string>()
  }
}

const storePublishedRecipeIds = (ids: Set<string>) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(publishedRecipesStorageKey, JSON.stringify([...ids]))
}

const readAppPreferences = (): AppPreferences => {
  if (typeof window === 'undefined') return defaultAppPreferences
  try {
    const rawValue = window.localStorage.getItem(appPreferencesStorageKey)
    if (!rawValue) return defaultAppPreferences
    const parsed = JSON.parse(rawValue) as Partial<AppPreferences>
    const nextSection = parsed.activeSection && persistedMainSections.has(parsed.activeSection)
      ? parsed.activeSection
      : defaultAppPreferences.activeSection

    return {
      activeSection: nextSection,
      accountSection: parsed.accountSection ?? defaultAppPreferences.accountSection,
      feedTab: parsed.feedTab ?? defaultAppPreferences.feedTab,
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

const socialUserId = (userId: string | number) => `user-${userId}`
const defaultAvatarUrl = '/app-logo.png'
const initialAvatarUrl = (value: string) => {
  const initial = [...value.trim()].find((char) => /[a-z0-9]/i.test(char))?.toUpperCase() || 'U'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#0d8b83"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="76" font-weight="700" fill="white">${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const userToSocialUser = (user: User): SocialUser => ({
  id: socialUserId(user.id),
  username: user.handle,
  displayName: user.name,
  avatarUrl: user.avatarUrl || initialAvatarUrl(user.handle || user.name),
  bio: user.bio || 'Perfil de NutriSocial.',
  followersCount: 0,
  followingCount: 0,
  relationshipWithMe: {
    followStatus: 'not_following',
    friendshipStatus: 'none',
  },
})

const authUserToSocialUser = (authUser: AuthUser): SocialUser => {
  return {
    id: socialUserId(authUser.id),
    displayName: authUser.name,
    username: authUser.handle,
    avatarUrl: authUser.avatar_url || initialAvatarUrl(authUser.handle || authUser.name),
    bio: 'Perfil de NutriSocial.',
    followersCount: 0,
    followingCount: 0,
    relationshipWithMe: {
      followStatus: 'following',
      friendshipStatus: 'friends',
    },
  }
}

const recipeToSocialPost = (recipe: Recipe): SocialPost => ({
  id: `recipe-${recipe.id}`,
  authorId: socialUserId(recipe.userId),
  imageUrl: recipe.image || defaultAvatarUrl,
  title: recipe.title,
  caption: recipe.description || 'Receta publicada en NutriSocial.',
  createdAt: recipe.createdAt,
  likesCount: 0,
  interactionsCount: 0,
  recipe: {
    title: recipe.title,
    description: recipe.description || 'Sin descripcion',
    difficulty: recipe.difficulty,
    prepTimeMinutes: recipe.prepTime,
    servings: recipe.servings,
    calories: Math.round(recipe.caloriesTotal),
    protein: Number(recipe.proteinTotal.toFixed(1)),
    carbs: Number(recipe.carbsTotal.toFixed(1)),
    fat: Number(recipe.fatTotal.toFixed(1)),
    ingredients: recipe.ingredients.map((ingredient) => ({
      productId: ingredient.productId,
      name: ingredient.name,
      amount: ingredient.amount,
    })),
    steps: recipe.steps
      ? recipe.steps.split(/\r?\n/).map((step) => step.replace(/^\d+[\s.)-]+/, '').trim()).filter(Boolean)
      : ['Sin pasos detallados.'],
  },
})

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
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(() => new Set())
  const [productFolders, setProductFolders] = useState<ProductFolder[]>([])
  const [activeProductFolderId, setActiveProductFolderId] = useState('all')
  const [newProductFolderName, setNewProductFolderName] = useState('')
  const [newProductFolderImage, setNewProductFolderImage] = useState('')
  const [productFolderEditorOpen, setProductFolderEditorOpen] = useState(false)
  const [editedProductFolderName, setEditedProductFolderName] = useState('')
  const [editedProductFolderImage, setEditedProductFolderImage] = useState('')
  const [folderProductSearch, setFolderProductSearch] = useState('')
  const [folderProductPage, setFolderProductPage] = useState(1)
  const [productFolderPrompt, setProductFolderPrompt] = useState<ProductFolderPrompt | null>(null)
  const [promptProductFolderName, setPromptProductFolderName] = useState('')
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(() => new Set())
  const [publishedRecipeIds, setPublishedRecipeIds] = useState<Set<string>>(() => readPublishedRecipeIds())
  const [checkedProductIds, setCheckedProductIds] = useState<Set<string>>(() => new Set(preferences.checkedProductIds))
  const [productSearchTerm, setProductSearchTerm] = useState(preferences.productSearchTerm)
  const [productSort, setProductSort] = useState<ProductSortOption>(preferences.productSort)
  const [productStoreFilter, setProductStoreFilter] = useState(preferences.productStoreFilter)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [productTab, setProductTab] = useState<ProductTab>('catalog')
  const [productPage, setProductPage] = useState(1)
  const [recipeTab, setRecipeTab] = useState<RecipeTab>('mine')
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(blankRecipeForm())
  const [recipeImageName, setRecipeImageName] = useState('')
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false)
  const [ingredientStep, setIngredientStep] = useState<IngredientStep>('select')
  const [ingredientProductId, setIngredientProductId] = useState('')
  const [ingredientGrams, setIngredientGrams] = useState('100')
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientStoreFilters, setIngredientStoreFilters] = useState<string[]>([])
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<RecipeDetail | null>(null)
  const [recipeDetailLoading, setRecipeDetailLoading] = useState(false)
  const [showRecipeDetailHealth, setShowRecipeDetailHealth] = useState(false)
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
  const storageUserId = authUser ? String(authUser.id) : null
  const effectiveCurrentUser = useMemo(
    () => authUserToSocialUser(authUser ?? { id: 0, name: 'Usuario', handle: 'usuario', avatar_url: null }),
    [authUser],
  )
  const effectiveUsersById = useMemo(() => {
    const nextUsers = users.reduce<Record<string, SocialUser>>((acc, user) => {
      const socialUser = userToSocialUser(user)
      acc[socialUser.id] = socialUser
      return acc
    }, {})

    nextUsers[effectiveCurrentUser.id] = {
      ...(nextUsers[effectiveCurrentUser.id] ?? effectiveCurrentUser),
      ...effectiveCurrentUser,
    }

    return nextUsers
  }, [effectiveCurrentUser, users])
  const socialPosts = useMemo(
    () => recipesCrud.filter((recipe) => publishedRecipeIds.has(recipe.id)).map(recipeToSocialPost),
    [publishedRecipeIds, recipesCrud],
  )
  const {
    commentsByPostId,
    likeCountsByPostId,
    followingUsers,
    followingSet,
    requestSet,
    likedPostSet,
    followUser,
    sendFriendRequest,
    addComment,
    toggleLike,
  } = useSocialState(effectiveCurrentUser.id, effectiveUsersById)

  const loadCrudData = useCallback(async () => {
    const data = await fetchJson<ApiBootstrap>('/api/bootstrap')
    setUsers(data.users.map((u) => ({ id: String(u.id), name: u.name, handle: u.handle, bio: u.bio ?? '', avatarUrl: u.avatar_url })))
    setStoresCrud(data.stores.map((s) => ({ id: s.id, name: s.name, description: s.description ?? '', address: s.address ?? '', city: s.city, logo: s.logo, accent: s.accent, image: s.image_url, productCount: Number(s.products_count ?? 0) })))
    setProductsCrud(data.products.map((p) => ({ id: String(p.id), name: p.name, category: p.category, brand: p.brand, storeId: p.store_id, referenceAmount: Number(p.reference_amount ?? 100), referenceUnit: p.reference_unit || 'g', image: p.image_url, price: Number(p.price ?? 0), stock: Number(p.stock ?? 0), calories: Number(p.calories ?? 0), protein: Number(p.protein ?? 0), carbs: Number(p.carbs ?? 0), fat: Number(p.fat ?? 0) })))
    setRecipesCrud(data.recipes.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      storeId: r.store_id,
      title: r.title,
      description: r.description ?? '',
      steps: r.steps ?? '',
      image: r.image_url,
      servings: Number(r.servings ?? 1),
      prepTime: Number(r.prep_time ?? 0),
      difficulty: r.difficulty,
      caloriesTotal: Number(r.calories_total ?? 0),
      proteinTotal: Number(r.protein_total ?? 0),
      carbsTotal: Number(r.carbs_total ?? 0),
      fatTotal: Number(r.fat_total ?? 0),
      createdAt: r.created_at,
      ingredients: (r.ingredients ?? []).map((ingredient) => ({
        productId: String(ingredient.product_id),
        name: ingredient.name,
        amount: `${Number(ingredient.quantity ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${ingredient.unit || 'unidad'}`,
      })),
    })))
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
    setSavedProductIds(storageUserId ? readSavedProductIds(storageUserId) : new Set<string>())
    setProductFolders(storageUserId ? readProductFolders(storageUserId) : [])
    setSavedRecipeIds(storageUserId ? readSavedRecipeIds(storageUserId) : new Set<string>())
    setCheckedProductIds(new Set())
    setActiveProductFolderId('all')
    setProductFolderPrompt(null)
    setProductFolderEditorOpen(false)
  }, [storageUserId])

  useEffect(() => {
    const nextActiveSection = activeSection === 'perfil' ? 'inicio' : activeSection
    storeAppPreferences({
      activeSection: nextActiveSection,
      accountSection,
      feedTab,
      productSearchTerm,
      productSort,
      productStoreFilter,
      checkedProductIds: [...checkedProductIds],
    })
  }, [accountSection, activeSection, checkedProductIds, feedTab, productSearchTerm, productSort, productStoreFilter])

  useEffect(() => {
    const limonShowcaseIds = recipesCrud
      .filter((recipe) => recipe.userId === '4' && limonShowcaseRecipeTitles.has(recipe.title))
      .map((recipe) => recipe.id)

    if (limonShowcaseIds.length === 0) return

    setPublishedRecipeIds((current) => {
      const next = new Set(current)
      let changed = false
      limonShowcaseIds.forEach((recipeId) => {
        if (!next.has(recipeId)) {
          next.add(recipeId)
          changed = true
        }
      })
      if (!changed) return current
      storePublishedRecipeIds(next)
      return next
    })
  }, [recipesCrud])

  useEffect(() => {
    setRecipeForm((p) => ({ ...p, userId: p.userId || (authUser ? String(authUser.id) : users[0]?.id || '') }))
  }, [authUser, users])

  useEffect(() => {
    setProductPage(1)
  }, [productSearchTerm, productSort, productStoreFilter])

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
  const activeProductFolder = useMemo(
    () => productFolders.find((folder) => folder.id === activeProductFolderId) ?? null,
    [activeProductFolderId, productFolders],
  )
  const activeFolderProductIds = useMemo(
    () => new Set(activeProductFolder?.productIds ?? []),
    [activeProductFolder],
  )
  const visibleSavedProducts = useMemo(
    () => savedProducts,
    [savedProducts],
  )
  const folderProductOptions = useMemo(
    () => activeProductFolder
      ? sortedVisibleProducts.filter((product) => !activeFolderProductIds.has(product.id))
      : [],
    [activeFolderProductIds, activeProductFolder, sortedVisibleProducts],
  )
  const folderProductSearchToken = useMemo(() => normalizeStoreToken(folderProductSearch), [folderProductSearch])
  const filteredFolderProductOptions = useMemo(
    () => folderProductOptions.filter((product) => {
      if (!folderProductSearchToken) return true
      const store = storeById.get(product.storeId)
      const haystack = normalizeStoreToken(`${product.name} ${product.brand} ${product.category} ${store?.name ?? ''}`)
      return haystack.includes(folderProductSearchToken)
    }),
    [folderProductOptions, folderProductSearchToken, storeById],
  )
  const folderProductPageCount = Math.max(1, Math.ceil(filteredFolderProductOptions.length / folderPickerProductsPerPage))
  const paginatedFolderProductOptions = useMemo(() => {
    const startIndex = (folderProductPage - 1) * folderPickerProductsPerPage
    return filteredFolderProductOptions.slice(startIndex, startIndex + folderPickerProductsPerPage)
  }, [filteredFolderProductOptions, folderProductPage])
  const folderProductPageStart = filteredFolderProductOptions.length === 0 ? 0 : (folderProductPage - 1) * folderPickerProductsPerPage + 1
  const folderProductPageEnd = Math.min(folderProductPage * folderPickerProductsPerPage, filteredFolderProductOptions.length)
  const discoveryProducts = sortedVisibleProducts
  const productPageCount = Math.max(1, Math.ceil(discoveryProducts.length / productsPerPage))
  const paginatedDiscoveryProducts = useMemo(() => {
    const startIndex = (productPage - 1) * productsPerPage
    return discoveryProducts.slice(startIndex, startIndex + productsPerPage)
  }, [discoveryProducts, productPage])
  const productPageStart = discoveryProducts.length === 0 ? 0 : (productPage - 1) * productsPerPage + 1
  const productPageEnd = Math.min(productPage * productsPerPage, discoveryProducts.length)
  useEffect(() => {
    setProductPage((current) => Math.min(current, productPageCount))
  }, [productPageCount])

  useEffect(() => {
    setFolderProductPage(1)
  }, [folderProductSearch, activeProductFolderId, productFolderEditorOpen])

  useEffect(() => {
    setFolderProductPage((current) => Math.min(current, folderProductPageCount))
  }, [folderProductPageCount])
  const checkedSavedProducts = useMemo(
    () => savedProducts.filter((product) => checkedProductIds.has(product.id)),
    [checkedProductIds, savedProducts],
  )
  const checkedSavedProductIds = useMemo(
    () => new Set([...checkedProductIds].filter((productId) => savedProductIds.has(productId))),
    [checkedProductIds, savedProductIds],
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
  const selectedRecipeSummary = useMemo(
    () => recipesCrud.find((recipe) => recipe.id === String(selectedRecipeDetail?.id)),
    [recipesCrud, selectedRecipeDetail],
  )
  const selectedRecipeSocialRecipe = useMemo<SocialRecipe | null>(() => {
    if (!selectedRecipeDetail) return null

    return {
      title: selectedRecipeDetail.title,
      description: selectedRecipeDetail.description || 'Sin descripcion',
      difficulty: selectedRecipeDetail.difficulty,
      prepTimeMinutes: selectedRecipeDetail.prep_time,
      servings: selectedRecipeDetail.servings,
      calories: Math.round(selectedRecipeSummary?.caloriesTotal ?? 0),
      protein: Number((selectedRecipeSummary?.proteinTotal ?? 0).toFixed(1)),
      carbs: Number((selectedRecipeSummary?.carbsTotal ?? 0).toFixed(1)),
      fat: Number((selectedRecipeSummary?.fatTotal ?? 0).toFixed(1)),
      ingredients: selectedRecipeDetail.ingredients.map((ingredient) => ({
        name: ingredient.name,
        amount: `${n(String(ingredient.quantity))} ${ingredient.unit}`,
      })),
      steps: selectedRecipeDetail.steps
        ? selectedRecipeDetail.steps.split(/\r?\n/).map((step) => step.trim()).filter(Boolean)
        : ['Sin pasos detallados.'],
    }
  }, [selectedRecipeDetail, selectedRecipeSummary])

  useEffect(() => {
    if (!ingredientProductId) return
    if (filteredIngredientProducts.some((product) => product.id === ingredientProductId)) return
    setIngredientProductId('')
  }, [filteredIngredientProducts, ingredientProductId])

  function resetRecipeEditor() {
    setRecipeForm(blankRecipeForm(authUser ? String(authUser.id) : users[0]?.id || ''))
    setRecipeImageName('')
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
    setRecipeImageName('')
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
    setRecipeImageName(file.name)
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
      await postJson('/api/recipes', payload) as CreateRecipeResponse
      setCrudMessage('Receta creada en Mis recetas.')
      await loadCrudData()
      setShowRecipeForm(false)
      resetRecipeEditor()
    } catch (err) {
      setCrudMessage((err as Error).message)
    }
  }

  async function openRecipeDetail(recipeId: string) {
    setRecipeDetailLoading(true)
    setShowRecipeDetailHealth(false)
    try {
      const detail = await fetchJson<RecipeDetail>(`/api/recipes/${recipeId}`)
      setSelectedRecipeDetail(detail)
    } catch (err) {
      setCrudMessage((err as Error).message)
    } finally {
      setRecipeDetailLoading(false)
    }
  }

  function closeRecipeDetail() {
    setSelectedRecipeDetail(null)
    setShowRecipeDetailHealth(false)
  }

  async function openRecipeDetailWithHealth(recipeId: string) {
    await openRecipeDetail(recipeId)
    setShowRecipeDetailHealth(true)
  }

  async function confirmDelete() {
    if (!deleteDialog) return
    try {
      await deleteJson(`/api/recipes/${deleteDialog.id}`)
      setCrudMessage('Receta eliminada.')
      setSavedRecipeIds((current) => {
        const next = new Set(current)
        next.delete(deleteDialog.id)
        storeSavedRecipeIds(next, storageUserId)
        return next
      })
      setPublishedRecipeIds((current) => {
        const next = new Set(current)
        next.delete(deleteDialog.id)
        storePublishedRecipeIds(next)
        return next
      })
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
      storeSavedProductIds(next, storageUserId)
      return next
    })
    const product = productById.get(productId)
    setProductFolderPrompt({
      productIds: [productId],
      title: product?.name ? `Producto añadido: ${product.name}` : 'Producto añadido',
    })
  }

  function assignProductsToFolder(folderId: string, productIds: string[]) {
    setProductFolders((current) => {
      const next = current.map((folder) => {
        if (folder.id !== folderId) return folder
        const mergedIds = new Set(folder.productIds)
        productIds.forEach((productId) => mergedIds.add(productId))
        return { ...folder, productIds: [...mergedIds] }
      })
      storeProductFolders(next, storageUserId)
      return next
    })
    setActiveProductFolderId(folderId)
    setProductFolderPrompt(null)
    setPromptProductFolderName('')
  }

  function createPromptProductFolder() {
    if (!productFolderPrompt) return
    const name = promptProductFolderName.trim()
    if (!name) return

    const folder: ProductFolder = {
      id: `folder-${Date.now()}`,
      name,
      productIds: [...new Set(productFolderPrompt.productIds)],
      image: null,
    }
    setProductFolders((current) => {
      const next = [...current, folder]
      storeProductFolders(next, storageUserId)
      return next
    })
    setActiveProductFolderId(folder.id)
    setProductFolderPrompt(null)
    setPromptProductFolderName('')
  }

  function leaveProductsInGeneralList() {
    setProductFolderPrompt(null)
    setPromptProductFolderName('')
  }

  function createProductFolder() {
    const name = newProductFolderName.trim()
    if (!name) return

    const folder: ProductFolder = {
      id: `folder-${Date.now()}`,
      name,
      image: newProductFolderImage.trim() || null,
      productIds: [],
    }
    setProductFolders((current) => {
      const next = [...current, folder]
      storeProductFolders(next, storageUserId)
      return next
    })
    setActiveProductFolderId(folder.id)
    setNewProductFolderName('')
    setNewProductFolderImage('')
  }

  function readProductFolderImage(event: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setter(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function openProductFolderEditor(folder: ProductFolder) {
    setActiveProductFolderId(folder.id)
    setEditedProductFolderName(folder.name)
    setEditedProductFolderImage(folder.image ?? '')
    setFolderProductSearch('')
    setProductFolderEditorOpen(true)
  }

  function closeProductFolderEditor() {
    setProductFolderEditorOpen(false)
    setFolderProductSearch('')
  }

  function saveActiveProductFolderDetails() {
    if (!activeProductFolder) return
    const name = editedProductFolderName.trim()
    if (!name) return
    const image = editedProductFolderImage.trim() || null

    setProductFolders((current) => {
      const next = current.map((folder) => (
        folder.id === activeProductFolder.id
          ? { ...folder, name, image }
          : folder
      ))
      storeProductFolders(next, storageUserId)
      return next
    })
  }

  function addProductToActiveFolder(productId: string) {
    if (!activeProductFolder) return
    setSavedProductIds((current) => {
      if (current.has(productId)) return current
      const next = new Set(current)
      next.add(productId)
      storeSavedProductIds(next, storageUserId)
      return next
    })
    setProductFolders((current) => {
      const next = current.map((folder) => {
        if (folder.id !== activeProductFolder.id || folder.productIds.includes(productId)) return folder
        return { ...folder, productIds: [...folder.productIds, productId] }
      })
      storeProductFolders(next, storageUserId)
      return next
    })
    setFolderProductSearch('')
  }

  function removeProductFromActiveFolder(productId: string) {
    if (!activeProductFolder) return
    setProductFolders((current) => {
      const next = current.map((folder) => (
        folder.id === activeProductFolder.id
          ? { ...folder, productIds: folder.productIds.filter((id) => id !== productId) }
          : folder
      ))
      storeProductFolders(next, storageUserId)
      return next
    })
  }

  function deleteActiveProductFolder() {
    if (!activeProductFolder) return
    deleteProductFolder(activeProductFolder.id)
  }

  function deleteProductFolder(folderId: string) {
    setProductFolders((current) => {
      const next = current.filter((folder) => folder.id !== folderId)
      storeProductFolders(next, storageUserId)
      return next
    })
    setActiveProductFolderId('all')
    setProductFolderEditorOpen(false)
  }

  function addRecipeIngredientsToProductList(ingredients: SocialRecipeIngredient[]) {
    const productIds = [...new Set(ingredients
      .map((ingredient) => ingredient.productId)
      .filter((productId): productId is string => Boolean(productId)))]
    if (productIds.length === 0) return

    setSavedProductIds((current) => {
      const next = new Set(current)
      productIds.forEach((productId) => next.add(productId))
      storeSavedProductIds(next, storageUserId)
      return next
    })
    setCrudMessage(`${productIds.length} producto${productIds.length === 1 ? '' : 's'} añadido${productIds.length === 1 ? '' : 's'} a Mi lista.`)
    setProductFolderPrompt({
      productIds,
      title: `${productIds.length} producto${productIds.length === 1 ? '' : 's'} de la receta añadido${productIds.length === 1 ? '' : 's'}`,
    })
  }

  function removeSavedProductId(productId: string) {
    setSavedProductIds((current) => {
      const next = new Set(current)
      next.delete(productId)
      storeSavedProductIds(next, storageUserId)
      return next
    })
    setCheckedProductIds((current) => {
      const next = new Set(current)
      next.delete(productId)
      return next
    })
    setProductFolders((current) => {
      const next = current.map((folder) => ({
        ...folder,
        productIds: folder.productIds.filter((id) => id !== productId),
      }))
      storeProductFolders(next, storageUserId)
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
    const productIdsToRemove = checkedSavedProductIds.size > 0
      ? checkedSavedProductIds
      : new Set(savedProducts.map((product) => product.id))

    if (productIdsToRemove.size === 0) return

    setSavedProductIds((current) => {
      const next = new Set(current)
      productIdsToRemove.forEach((productId) => next.delete(productId))
      storeSavedProductIds(next, storageUserId)
      return next
    })
    setCheckedProductIds((current) => {
      const next = new Set(current)
      productIdsToRemove.forEach((productId) => next.delete(productId))
      return next
    })
  }

  function productFolderCover(folder: ProductFolder) {
    if (folder.image) return folder.image
    return folder.productIds
      .map((productId) => productById.get(productId)?.image ?? null)
      .find((image): image is string => Boolean(image)) ?? null
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
  const visibleActiveSection: MainSection = isProfileRoute
    ? 'perfil'
    : activeSection === 'perfil'
      ? 'inicio'
      : activeSection
  const feedPosts = useMemo(
    () => feedTab === 'para-ti'
      ? socialPosts
      : socialPosts.filter((post) => followingSet.has(post.authorId)),
    [feedTab, followingSet, socialPosts],
  )
  const profilePosts = useMemo(
    () => (profileUserId ? socialPosts.filter((post) => post.authorId === profileUserId) : []),
    [profileUserId, socialPosts],
  )
  const savedPosts = useMemo(
    () => socialPosts.filter((post) => post.authorId !== effectiveCurrentUser.id && savedRecipeIds.has(post.id.replace(/^recipe-/, ''))),
    [effectiveCurrentUser.id, savedRecipeIds, socialPosts],
  )
  const myRecipes = useMemo(
    () => recipesCrud.filter((recipe) => socialUserId(recipe.userId) === effectiveCurrentUser.id),
    [effectiveCurrentUser.id, recipesCrud],
  )
  const favoriteRecipes = useMemo(
    () => recipesCrud.filter((recipe) => savedRecipeIds.has(recipe.id) && socialUserId(recipe.userId) !== effectiveCurrentUser.id),
    [effectiveCurrentUser.id, recipesCrud, savedRecipeIds],
  )
  const profileUser = profileUserId ? effectiveUsersById[profileUserId] ?? null : null

  function toggleSavedRecipe(recipeId: string) {
    const recipe = recipesCrud.find((item) => item.id === recipeId)
    if (recipe && socialUserId(recipe.userId) === effectiveCurrentUser.id) {
      return
    }

    setSavedRecipeIds((current) => {
      const next = new Set(current)
      if (next.has(recipeId)) next.delete(recipeId)
      else next.add(recipeId)
      storeSavedRecipeIds(next, storageUserId)
      return next
    })
  }

  const updateProfileAvatar = useCallback((avatarUrl: string) => {
    setAuthUser((current) => current ? { ...current, avatar_url: avatarUrl } : current)
    setUsers((current) =>
      current.map((user) => authUser && user.id === String(authUser.id) ? { ...user, avatarUrl } : user),
    )
  }, [authUser])

  function publishRecipe(recipeId: string) {
    const recipe = recipesCrud.find((item) => item.id === recipeId)
    if (!recipe || socialUserId(recipe.userId) !== effectiveCurrentUser.id) return

    setPublishedRecipeIds((current) => {
      if (current.has(recipeId)) return current
      const next = new Set(current)
      next.add(recipeId)
      storePublishedRecipeIds(next)
      return next
    })
    setCrudMessage('Receta publicada en el feed.')
  }

  function unpublishRecipe(recipeId: string) {
    const recipe = recipesCrud.find((item) => item.id === recipeId)
    if (!recipe || socialUserId(recipe.userId) !== effectiveCurrentUser.id) return

    setPublishedRecipeIds((current) => {
      if (!current.has(recipeId)) return current
      const next = new Set(current)
      next.delete(recipeId)
      storePublishedRecipeIds(next)
      return next
    })
    setCrudMessage('Receta retirada del feed.')
  }

  const openSocialProfile = useCallback((userId: string) => {
    const profilePath = `/perfil/${userId}`
    setActiveSection('perfil')
    if (locationRoute.pathname !== profilePath) {
      navigate(profilePath)
    }
  }, [locationRoute.pathname, navigate])

  const handleSectionSelect = useCallback((section: typeof activeSection) => {
    if (section === 'perfil') {
      const profilePath = `/perfil/${effectiveCurrentUser.id}`
      setActiveSection('perfil')
      if (locationRoute.pathname !== profilePath) {
        navigate(profilePath)
      }
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
      : visibleActiveSection === 'inicio'
        ? (feedTab === 'para-ti'
            ? 'Feed social general con publicaciones de perfiles creados'
            : 'Publicaciones solo de perfiles que sigues en estado local')
        : visibleActiveSection === 'cuenta'
          ? 'Zona personal para gestionar tu perfil y preferencias'
        : `${labelForSection(visibleActiveSection)} en la estructura principal`

  const renderProductCard = (p: Product, mode: 'catalog' | 'list') => {
    const storeLabel = productStoreLabel(storeById.get(p.storeId))
    const imageFallback = <div className="product-photo-empty">{p.name.slice(0, 1).toUpperCase()}</div>
    const isChecked = checkedProductIds.has(p.id)
    const isSaved = savedProductIds.has(p.id)
    const showListActions = mode === 'list' || isSaved

    return (
      <article key={p.id} className={`product-card ${showListActions ? 'saved-product-card' : ''} ${isChecked ? 'is-checked' : ''}`}>
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
          {!showListActions ? (
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
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`side-nav-item ${visibleActiveSection === item.id ? 'active' : ''}`}
              onClick={() => handleSectionSelect(item.id as typeof activeSection)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-feed">
        <header className="feed-header card-surface">
          {!isProfileRoute && visibleActiveSection === 'inicio' && (
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
              likeCountsByPostId={likeCountsByPostId}
              currentUser={effectiveCurrentUser}
              usersById={effectiveUsersById}
              savedRecipeIds={savedRecipeIds}
              likedPostIds={likedPostSet}
              isFollowing={followingSet.has(profileUser.id)}
              hasRequest={requestSet.has(profileUser.id)}
              onOpenProfile={openSocialProfile}
              onFollowUser={followUser}
              onSendFriendRequest={sendFriendRequest}
              onAddComment={addComment}
              onToggleLike={toggleLike}
              onToggleSaveRecipe={toggleSavedRecipe}
              onAddIngredientsToList={addRecipeIngredientsToProductList}
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
        ) : visibleActiveSection === 'inicio' ? (
          <SocialHome
            feedTab={feedTab}
            posts={feedPosts}
            commentsByPostId={commentsByPostId}
            likeCountsByPostId={likeCountsByPostId}
            currentUser={effectiveCurrentUser}
            usersById={effectiveUsersById}
            savedRecipeIds={savedRecipeIds}
            likedPostIds={likedPostSet}
            onOpenProfile={openSocialProfile}
            onAddComment={addComment}
            onToggleLike={toggleLike}
            onToggleSaveRecipe={toggleSavedRecipe}
            onAddIngredientsToList={addRecipeIngredientsToProductList}
          />
        ) : visibleActiveSection === 'cuenta' ? (
          <SocialAccountPage
            currentUser={effectiveCurrentUser}
            accountSection={accountSection}
            savedPosts={savedPosts}
            commentsByPostId={commentsByPostId}
            likeCountsByPostId={likeCountsByPostId}
            usersById={effectiveUsersById}
            savedRecipeIds={savedRecipeIds}
            likedPostIds={likedPostSet}
            isDarkMode={themeMode === 'dark'}
            onOpenProfile={openSocialProfile}
            onAddComment={addComment}
            onToggleLike={toggleLike}
            onToggleSaveRecipe={toggleSavedRecipe}
            onAddIngredientsToList={addRecipeIngredientsToProductList}
            onSelectAccountSection={openAccountSection}
            onToggleDarkMode={(enabled) => setThemeMode(enabled ? 'dark' : 'light')}
            onChangeAvatar={updateProfileAvatar}
          />
        ) : visibleActiveSection === 'productos' ? (
          <section className="panel card-surface product-panel">
            <div className="recipes-toolbar product-toolbar">
              <div className="panel-headline">
                <p className="eyebrow">Productos</p>
                <h2>Gestión de productos</h2>
              </div>
              <button type="button" className="primary-btn" onClick={() => setProductSearchModalOpen(true)}>
                Buscar y añadir
              </button>
            </div>

            <div className="recipe-tabs product-tabs" role="tablist" aria-label="Apartados de productos">
              <button
                type="button"
                role="tab"
                aria-selected={productTab === 'catalog'}
                className={productTab === 'catalog' ? 'is-active' : ''}
                onClick={() => setProductTab('catalog')}
              >
                Productos
                <span>{discoveryProducts.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={productTab === 'list'}
                className={productTab === 'list' ? 'is-active' : ''}
                onClick={() => setProductTab('list')}
              >
                Mi lista
                <span>{savedProducts.length}</span>
              </button>
            </div>

            <div className="product-section-stack">
              <section className="shopping-plan-panel product-utility-panel">
                <div className="shopping-plan-header">
                  <div>
                    <p className="eyebrow">{productTab === 'catalog' ? 'Catálogo' : 'Lista de compra'}</p>
                    <h3>{productTab === 'catalog' ? 'Explora productos de la base de datos' : 'Gestiona y reutiliza tus productos guardados'}</h3>
                  </div>
                  {productTab === 'list' ? (
                    <div className="crud-actions">
                      <button type="button" className="ghost-btn" onClick={clearCheckedProducts} disabled={visibleSavedProducts.length === 0}>
                        {checkedSavedProductIds.size > 0 ? 'Limpiar marcados' : 'Vaciar lista'}
                      </button>
                    </div>
                  ) : null}
                </div>

                {productTab === 'list' ? (
                  <div className="shopping-plan-metrics">
                    <article className="shopping-metric-card">
                      <strong>{visibleSavedProducts.length}</strong>
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
                ) : null}

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

              {productTab === 'catalog' ? (
                <section className="product-discovery-panel" role="tabpanel">
                  <div className="section-inline-head">
                    <div>
                      <h3>Productos</h3>
                      <p className="muted">Descubre productos de la base de datos. Si ya están en tu lista, puedes marcarlos o quitarlos desde aquí.</p>
                    </div>
                    <p className="product-page-range">
                      {discoveryProducts.length === 0
                        ? '0 productos'
                        : `${productPageStart}-${productPageEnd} de ${discoveryProducts.length}`}
                    </p>
                  </div>
                  {discoveryProducts.length === 0 ? (
                    <article className="recipe-empty">
                      <h3>No hay productos disponibles con esos filtros</h3>
                      <p>Ajusta la búsqueda, la tienda o el criterio de ordenación.</p>
                    </article>
                  ) : (
                    <>
                      <div className="product-card-grid">
                        {paginatedDiscoveryProducts.map((p) => renderProductCard(p, 'catalog'))}
                      </div>
                      <div className="product-pagination" aria-label="Paginación de productos">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setProductPage((current) => Math.max(1, current - 1))}
                          disabled={productPage === 1}
                        >
                          Anterior
                        </button>
                        <span>Página {productPage} de {productPageCount}</span>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setProductPage((current) => Math.min(productPageCount, current + 1))}
                          disabled={productPage === productPageCount}
                        >
                          Siguiente
                        </button>
                      </div>
                    </>
                  )}
                </section>
              ) : (
                <section className="product-discovery-panel" role="tabpanel">
                  <div className="section-inline-head">
                    <div>
                      <h3>Mi lista</h3>
                      <p className="muted">Aquí se quedan los productos que marques como favoritos.</p>
                    </div>
                  </div>

                  {visibleSavedProducts.length === 0 ? (
                    <article className="recipe-empty">
                      <h3>Aún no has añadido productos</h3>
                      <p>Añade productos desde la pestaña Productos o desde los ingredientes de una receta.</p>
                    </article>
                  ) : (
                    <div className="product-card-grid saved-product-grid">
                      {visibleSavedProducts.map((p) => renderProductCard(p, 'list'))}
                    </div>
                  )}

                  <section className="product-folder-panel product-lists-panel" aria-label="Listas guardadas">
                    <div className="product-folder-head product-lists-head">
                      <div>
                        <h4>Listas</h4>
                        <p>Crea listas con portada propia y decide qué productos van dentro.</p>
                      </div>
                    </div>

                    <div className="product-folder-simple-grid">
                      <label className="product-folder-field">
                        Título de la lista
                        <input
                          value={newProductFolderName}
                          onChange={(event) => setNewProductFolderName(event.target.value)}
                          placeholder="Ej. Tostadas, Cena lunes..."
                          aria-label="Nombre de nueva lista"
                        />
                      </label>

                      <div className="product-folder-field">
                        <span>Foto de portada</span>
                        <div className="product-folder-create-row">
                          <label className={`image-picker-control ${newProductFolderImage ? 'has-image' : ''}`}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => readProductFolderImage(event, setNewProductFolderImage)}
                              aria-label="Imagen de nueva lista"
                            />
                            {newProductFolderImage ? (
                              <img src={newProductFolderImage} alt="" aria-hidden="true" />
                            ) : (
                              <span className="image-picker-icon" aria-hidden="true">+</span>
                            )}
                            <span className="image-picker-copy">
                              <strong>{newProductFolderImage ? 'Foto seleccionada' : 'Elegir foto'}</strong>
                              <small>{newProductFolderImage ? 'Pulsa para cambiarla' : 'Desde tu PC o móvil'}</small>
                            </span>
                          </label>
                          <button type="button" className="secondary-btn" onClick={createProductFolder}>
                            Crear
                          </button>
                        </div>
                      </div>
                    </div>

                    {productFolders.length === 0 ? (
                      <article className="recipe-empty">
                        <h3>Aún no tienes listas creadas</h3>
                        <p>Crea una lista para preparar compras, recetas o menús concretos.</p>
                      </article>
                    ) : (
                      <div className="product-list-card-grid">
                        {productFolders.map((folder) => {
                          const cover = productFolderCover(folder)

                          return (
                            <article key={folder.id} className="product-list-card">
                              <div className="product-list-cover">
                                {cover ? (
                                  <img src={cover} alt={`Portada de ${folder.name}`} loading="lazy" />
                                ) : (
                                  <span aria-hidden="true">{folder.name.slice(0, 1).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="product-list-copy">
                                <strong>{folder.name}</strong>
                                <p>{folder.productIds.length} producto{folder.productIds.length === 1 ? '' : 's'}</p>
                              </div>
                              <div className="product-list-actions">
                                <button type="button" className="secondary-btn" onClick={() => openProductFolderEditor(folder)}>
                                  Editar
                                </button>
                                <button type="button" className="ghost-btn" onClick={() => deleteProductFolder(folder.id)}>
                                  Eliminar
                                </button>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </section>
              )}
            </div>
          </section>
        ) : visibleActiveSection === 'tiendas' ? (
          <section className="panel card-surface">
            <div className="recipes-toolbar">
              <div className="panel-headline">
                <p className="eyebrow">Tiendas</p>
                <h2>Tiendas detectadas</h2>
              </div>
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
                      <p className="muted">{s.productCount} productos detectados</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : visibleActiveSection === 'recetas' ? (
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

            <div className="recipe-tabs" role="tablist" aria-label="Tipo de recetas">
              <button
                type="button"
                role="tab"
                aria-selected={recipeTab === 'mine'}
                className={recipeTab === 'mine' ? 'is-active' : ''}
                onClick={() => setRecipeTab('mine')}
              >
                Mis recetas
                <span>{myRecipes.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={recipeTab === 'saved'}
                className={recipeTab === 'saved' ? 'is-active' : ''}
                onClick={() => setRecipeTab('saved')}
              >
                Guardadas
                <span>{favoriteRecipes.length}</span>
              </button>
            </div>

            {recipeTab === 'mine' ? (
              <section className="recipe-section" role="tabpanel">
                <div className="section-inline-head">
                  <div>
                    <h3>Mis recetas</h3>
                    <p className="muted">Recetas creadas por el usuario actual. Solo estas se pueden publicar o retirar del feed.</p>
                  </div>
                </div>

                <div className="recipe-list">
                  {myRecipes.length === 0 ? (
                    <article className="recipe-empty">
                      <h3>Aún no has creado ninguna receta</h3>
                      <p>Crea una receta para verla aquí y decidir si quieres publicarla.</p>
                    </article>
                  ) : myRecipes.map((recipe) => (
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
                      <div className="recipe-list-actions">
                        {publishedRecipeIds.has(recipe.id) ? (
                          <button type="button" className="secondary-btn" onClick={() => unpublishRecipe(recipe.id)}>
                            Quitar del feed
                          </button>
                        ) : (
                          <button type="button" className="primary-btn" onClick={() => publishRecipe(recipe.id)}>
                            Publicar en feed
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="recipe-section" role="tabpanel">
                <div className="section-inline-head">
                  <div>
                    <h3>Guardadas</h3>
                    <p className="muted">Recetas que has marcado como favoritas desde el feed.</p>
                  </div>
                </div>

                <div className="recipe-list">
                  {favoriteRecipes.length === 0 ? (
                    <article className="recipe-empty">
                      <h3>Aún no has guardado ninguna receta</h3>
                      <p>Marca una receta como favorita desde el feed para verla aquí.</p>
                    </article>
                  ) : favoriteRecipes.map((recipe) => (
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
                      <div className="recipe-list-actions">
                        <button type="button" className="secondary-btn" onClick={() => void openRecipeDetailWithHealth(recipe.id)}>
                          Comprobar salud
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        ) : (
          <section className="panel card-surface">
            <div className="panel-headline">
              <p className="eyebrow">Seccion</p>
              <h2>{labelForSection(visibleActiveSection)}</h2>
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
                  <span className="recipe-upload-control">
                    <input type="file" accept="image/*" onChange={(event) => handleRecipeImageFile(event.target.files?.[0] ?? null)} />
                    <span className="recipe-upload-icon" aria-hidden="true">+</span>
                    <span className="recipe-upload-copy">
                      <span>Subir imagen</span>
                      <small>{recipeImageName || 'PNG, JPG o WEBP'}</small>
                    </span>
                  </span>
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
        <div className="modal-backdrop" role="presentation" onClick={closeRecipeDetail}>
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
                  <button type="button" className="icon-btn" aria-label="Cerrar" onClick={closeRecipeDetail}>×</button>
                </div>
                <div className="recipe-detail-hero">
                  {selectedRecipeDetail.image_url ? <img src={selectedRecipeDetail.image_url} alt={selectedRecipeDetail.title} /> : <div className="recipe-image-placeholder" />}
                  <div>
                    <p>{selectedRecipeDetail.description || 'Sin descripción'}</p>
                    <div className="recipe-macro-row">
                      <span>{selectedRecipeSummary?.caloriesTotal.toFixed(0) ?? '0'} kcal</span>
                      <span>{selectedRecipeSummary?.proteinTotal.toFixed(1) ?? '0.0'} g proteínas</span>
                      <span>{selectedRecipeSummary?.carbsTotal.toFixed(1) ?? '0.0'} g hidratos</span>
                      <span>{selectedRecipeSummary?.fatTotal.toFixed(1) ?? '0.0'} g grasas</span>
                    </div>
                    <div className="recipe-detail-actions">
                      <button type="button" className="secondary-btn" onClick={() => setShowRecipeDetailHealth((current) => !current)}>
                        {showRecipeDetailHealth ? 'Ocultar salud' : 'Comprobar salud'}
                      </button>
                    </div>
                  </div>
                </div>
                {showRecipeDetailHealth && selectedRecipeSocialRecipe ? (
                  <RecipeHealthPanel recipe={selectedRecipeSocialRecipe} sourceId={`recipe-detail-${selectedRecipeDetail.id}`} />
                ) : null}
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

      {productFolderEditorOpen && activeProductFolder ? (
        <div className="modal-backdrop" role="presentation" onClick={closeProductFolderEditor}>
          <section
            className="product-folder-modal product-folder-editor-modal card-surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-folder-editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="recipe-modal-header">
              <div>
                <p className="eyebrow">Lista</p>
                <h2 id="product-folder-editor-title">Editar {activeProductFolder.name}</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={closeProductFolderEditor}>×</button>
            </div>

            <div className="product-folder-edit-grid">
              <div className="product-list-cover product-list-cover-large">
                {editedProductFolderImage || productFolderCover(activeProductFolder) ? (
                  <img src={editedProductFolderImage || (productFolderCover(activeProductFolder) as string)} alt={`Portada de ${activeProductFolder.name}`} />
                ) : (
                  <span aria-hidden="true">{activeProductFolder.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="product-folder-edit-fields">
                <label className="product-folder-field">
                  Nombre de la lista
                  <input
                    value={editedProductFolderName}
                    onChange={(event) => setEditedProductFolderName(event.target.value)}
                    placeholder="Nombre de la lista"
                  />
                </label>
                <div className="product-folder-field">
                  <span>Foto de portada</span>
                  <label className={`image-picker-control ${editedProductFolderImage ? 'has-image' : ''}`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => readProductFolderImage(event, setEditedProductFolderImage)}
                      aria-label="Cambiar imagen de la lista"
                    />
                    {editedProductFolderImage ? (
                      <img src={editedProductFolderImage} alt="" aria-hidden="true" />
                    ) : (
                      <span className="image-picker-icon" aria-hidden="true">+</span>
                    )}
                    <span className="image-picker-copy">
                      <strong>{editedProductFolderImage ? 'Foto seleccionada' : 'Elegir foto'}</strong>
                      <small>{editedProductFolderImage ? 'Pulsa para cambiarla' : 'Desde tu PC o móvil'}</small>
                    </span>
                  </label>
                </div>
                <button type="button" className="secondary-btn" onClick={saveActiveProductFolderDetails}>
                  Guardar cambios
                </button>
              </div>
            </div>

            <section className="product-folder-editor-section">
              <div className="section-inline-head">
                <div>
                  <h3>Productos de la lista</h3>
                  <p className="muted">{activeProductFolder.productIds.length} producto{activeProductFolder.productIds.length === 1 ? '' : 's'} guardado{activeProductFolder.productIds.length === 1 ? '' : 's'} aquí.</p>
                </div>
              </div>
              {activeProductFolder.productIds.length === 0 ? (
                <article className="recipe-empty">
                  <h3>Esta lista está vacía</h3>
                  <p>Añade productos desde el buscador inferior.</p>
                </article>
              ) : (
                <div className="folder-product-picker-list">
                  {activeProductFolder.productIds.map((productId) => {
                    const product = productById.get(productId)
                    if (!product) return null

                    return (
                      <div key={productId} className="folder-product-picker-item product-folder-current-product">
                        {product.image && !brokenProductImageIds.has(product.id) ? (
                          <img src={product.image} alt={product.name} />
                        ) : (
                          <span className="product-photo-empty" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>
                        )}
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.brand || 'Sin marca'} · {productStoreLabel(storeById.get(product.storeId))}</small>
                        </span>
                        <button type="button" className="ghost-btn" onClick={() => removeProductFromActiveFolder(product.id)}>
                          Eliminar
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="product-folder-editor-section">
              <label className="product-folder-field">
                Añadir productos
                <input
                  type="search"
                  value={folderProductSearch}
                  onChange={(event) => setFolderProductSearch(event.target.value)}
                  placeholder="Buscar por nombre, marca o tienda"
                />
              </label>

              <p className="product-page-range">
                {filteredFolderProductOptions.length === 0
                  ? '0 productos'
                  : `${folderProductPageStart}-${folderProductPageEnd} de ${filteredFolderProductOptions.length}`}
              </p>

              <div className="folder-product-picker-list">
                {filteredFolderProductOptions.length === 0 ? (
                  <article className="recipe-empty">
                    <h3>No hay productos para añadir</h3>
                    <p>{folderProductOptions.length === 0 ? 'Todos los productos disponibles ya están en esta lista.' : 'Prueba con otra búsqueda.'}</p>
                  </article>
                ) : paginatedFolderProductOptions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="folder-product-picker-item"
                    onClick={() => addProductToActiveFolder(product.id)}
                  >
                    {product.image && !brokenProductImageIds.has(product.id) ? (
                      <img src={product.image} alt={product.name} />
                    ) : (
                      <span className="product-photo-empty" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>
                    )}
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.brand || 'Sin marca'} · {productStoreLabel(storeById.get(product.storeId))}</small>
                    </span>
                    <em>Añadir</em>
                  </button>
                ))}
              </div>

              {filteredFolderProductOptions.length > folderPickerProductsPerPage ? (
                <div className="product-pagination" aria-label="Paginación de productos para lista">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setFolderProductPage((current) => Math.max(1, current - 1))}
                    disabled={folderProductPage === 1}
                  >
                    Anterior
                  </button>
                  <span>Página {folderProductPage} de {folderProductPageCount}</span>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setFolderProductPage((current) => Math.min(folderProductPageCount, current + 1))}
                    disabled={folderProductPage === folderProductPageCount}
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}
            </section>

            <div className="product-folder-modal-actions">
              <button type="button" className="ghost-btn" onClick={deleteActiveProductFolder}>
                Eliminar lista
              </button>
              <button type="button" className="secondary-btn" onClick={closeProductFolderEditor}>
                Cerrar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {productFolderPrompt ? (
        <div className="modal-backdrop" role="presentation" onClick={leaveProductsInGeneralList}>
          <section
            className="product-folder-modal card-surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-folder-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="recipe-modal-header">
              <div>
                <p className="eyebrow">Mi lista</p>
                <h2 id="product-folder-modal-title">{productFolderPrompt.title}</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={leaveProductsInGeneralList}>×</button>
            </div>

            <p className="muted">¿Quieres guardarlo en una lista concreta o dejarlo solo en la lista general?</p>

            <div className="product-folder-modal-products">
              {productFolderPrompt.productIds.map((productId) => {
                const product = productById.get(productId)
                return (
                  <span key={productId}>{product?.name ?? `Producto ${productId}`}</span>
                )
              })}
            </div>

            {productFolders.length > 0 ? (
              <div className="product-folder-modal-grid">
                {productFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="product-folder-choice"
                    onClick={() => assignProductsToFolder(folder.id, productFolderPrompt.productIds)}
                  >
                    <strong>{folder.name}</strong>
                    <span>{folder.productIds.length} productos</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Aún no tienes listas creadas.</p>
            )}

            <div className="product-folder-modal-create">
              <input
                value={promptProductFolderName}
                onChange={(event) => setPromptProductFolderName(event.target.value)}
                placeholder="Crear lista nueva"
                aria-label="Crear lista nueva para estos productos"
              />
              <button type="button" className="secondary-btn" onClick={createPromptProductFolder}>
                Crear y guardar
              </button>
            </div>

            <div className="product-folder-modal-actions">
              <button type="button" className="ghost-btn" onClick={leaveProductsInGeneralList}>
                Dejar en Mi lista
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
                placeholder="Añade un nombre para su perfil"
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
                placeholder="Añada un nombre de usuario"
                autoComplete="username"
                required
              />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              placeholder="Añada una contraseña"
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
                placeholder="Confirme su contraseña"
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

function labelForSection(section: MainSection): string {
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
  }
}

export default App
