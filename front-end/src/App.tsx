import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { LocationPanel } from './components/LocationPanel'
import { ProductSearchPanel } from './components/ProductSearchPanel'
import { StoreResultsPanel } from './components/StoreResultsPanel'
import { SocialHome } from './features/social/SocialHome'
import { SocialProfilePage } from './features/social/SocialProfilePage'
import { SocialSidebar } from './features/social/SocialSidebar'
import { useSocialState } from './features/social/use-social-state'
import { useUserLocation } from './hooks/use-user-location'
import { API_BASE_URL, apiRequest } from './services/http'
import { getNearbyStores, searchProducts } from './services/location-shopping-api'
import type { FeedTab } from './features/social/types'
import type { NearbyStoreResult, ProductSuggestion } from './types/location-shopping'


type User = { id: string; name: string; handle: string }
type Store = { id: string; name: string; description: string; address: string; city: string; logo: string; accent: string; image: string | null }
type Product = { id: string; name: string; category: string; brand: string; storeId: string; referenceAmount: number; referenceUnit: string; image: string | null; price: number; stock: number; calories: number; protein: number; carbs: number; fat: number }
type Recipe = { id: string; userId: string; storeId: string | null; title: string; description: string; steps: string; image: string | null; servings: number; prepTime: number; difficulty: string; caloriesTotal: number; proteinTotal: number; carbsTotal: number; fatTotal: number }
type ProductForm = { name: string; category: string; brand: string; storeId: string; referenceAmount: string; referenceUnit: string; calories: string; protein: string; carbs: string; fat: string; price: string; stock: string; imageUrl: string }
type StoreForm = { name: string; city: string; description: string; address: string; logo: string; accent: string; imageUrl: string }
type RecipeForm = { title: string; description: string; steps: string; userId: string; storeId: string; difficulty: string; servings: string; prepTime: string; imageUrl: string; ingredients: Array<{ productId: string; quantity: string; unit: string }> }
type RecipeIngredientDetail = { product_id: number; name: string; brand: string; category: string; calories: number; protein: number | string; carbs: number | string; fat: number | string; reference_amount: number | string; reference_unit: string; quantity: number | string; unit: string }
type RecipeDetail = { id: number; user_id: number; store_id: string | null; title: string; description: string | null; steps: string | null; image_url: string | null; servings: number; prep_time: number; difficulty: string; ingredients: RecipeIngredientDetail[] }
type ApiBootstrap = {
  users: Array<{ id: number; name: string; handle: string }>
  stores: Array<{ id: string; name: string; description: string | null; address: string | null; city: string; logo: string; accent: string; image_url: string | null }>
  products: Array<{ id: number; name: string; category: string; brand: string; store_id: string; reference_amount: number | string; reference_unit: string; image_url: string | null; price: number | string; stock: number; calories: number; protein: number | string; carbs: number | string; fat: number | string }>
  recipes: Array<{ id: number; user_id: number; store_id: string | null; title: string; description: string | null; steps: string | null; image_url: string | null; servings: number; prep_time: number; difficulty: string; calories_total: number | string; protein_total: number | string; carbs_total: number | string; fat_total: number | string }>
}
type ApiHealth = {
  ok: boolean
  service: string
  db: string
  metrics?: { users: number; recipes: number; products: number }
}
type DeleteDialog = { type: 'product' | 'store' | 'recipe'; id: string; label: string }
type ShoppingPlanResponse = {
  recipes: Array<{ id: number; title: string; store_id: string | null; calories_total: number; protein_total: number; carbs_total: number; fat_total: number }>
  items: Array<{ product_id: number; name: string; brand: string; category: string; quantity: number; unit: string; estimated_cost: number; recipes: string[]; store_id: string | null }>
  stores: Array<{ store_id: string; store_name: string; store_city: string | null; items: number; estimated_cost: number }>
  summary: { calories: number; protein: number; carbs: number; fat: number; estimated_cost: number }
}
const blankProductForm: ProductForm = { name: '', category: '', brand: '', storeId: '', referenceAmount: '100', referenceUnit: 'g', calories: '0', protein: '0', carbs: '0', fat: '0', price: '0', stock: '0', imageUrl: '' }
const blankStoreForm: StoreForm = { name: '', city: '', description: '', address: '', logo: 'ST', accent: '#3b82f6', imageUrl: '' }
const blankRecipeForm = (users: User[], stores: Store[]): RecipeForm => ({ title: '', description: '', steps: '', userId: users[0]?.id || '', storeId: stores[0]?.id || '', difficulty: 'Media', servings: '1', prepTime: '0', imageUrl: '', ingredients: [{ productId: '', quantity: '1', unit: 'g' }] })
const fetchJson = <T,>(path: string) => apiRequest<T>(path)
const postJson = (path: string, body: unknown) => apiRequest(path, { method: 'POST', body: JSON.stringify(body) })
const putJson = (path: string, body: unknown) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body) })
const deleteJson = (path: string) => apiRequest(path, { method: 'DELETE' })
const n = (value: string, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
function App() {
  const navigate = useNavigate()
  const locationRoute = useLocation()
  const { permission, location, locationLabel, errorMessage: locationError, requestLocation } = useUserLocation()

  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductSuggestion | null>(null)
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [radiusKm, setRadiusKm] = useState(10)
  const [nearbyStores, setNearbyStores] = useState<NearbyStoreResult[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [prioritizeAvailable, setPrioritizeAvailable] = useState(false)
  const [activeSection, setActiveSection] = useState<
    'inicio' | 'productos' | 'tiendas' | 'recetas' | 'perfil' | 'tiendas-cercanas'
  >('inicio')
  const [feedTab, setFeedTab] = useState<FeedTab>('para-ti')
  const [users, setUsers] = useState<User[]>([])
  const [storesCrud, setStoresCrud] = useState<Store[]>([])
  const [productsCrud, setProductsCrud] = useState<Product[]>([])
  const [recipesCrud, setRecipesCrud] = useState<Recipe[]>([])
  const [crudMessage, setCrudMessage] = useState<string | null>(null)
  const [shoppingPlanRecipeIds, setShoppingPlanRecipeIds] = useState<string[]>([])
  const [shoppingPlanLoading, setShoppingPlanLoading] = useState(false)
  const [shoppingPlanData, setShoppingPlanData] = useState<ShoppingPlanResponse | null>(null)
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null)
  const [apiHealthLoading, setApiHealthLoading] = useState(true)
  const [apiHealthError, setApiHealthError] = useState<string | null>(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null)
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(blankProductForm)
  const [storeForm, setStoreForm] = useState<StoreForm>(blankStoreForm)
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(blankRecipeForm([], []))
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog | null>(null)
  const {
    currentUser: socialCurrentUser,
    usersById: socialUsersById,
    followingUsers,
    followingSet,
    requestSet,
    followUser,
    sendFriendRequest,
    getFeedPosts,
    getUserPosts,
  } = useSocialState()

  const refreshApiHealth = useCallback(async () => {
    setApiHealthLoading(true)
    try {
      const health = await fetchJson<ApiHealth>('/api/health')
      setApiHealth(health)
      setApiHealthError(null)
    } catch (error) {
      setApiHealth(null)
      setApiHealthError(error instanceof Error ? error.message : 'No se pudo comprobar la API')
    } finally {
      setApiHealthLoading(false)
    }
  }, [])

  const loadCrudData = useCallback(async () => {
    const data = await fetchJson<ApiBootstrap>('/api/bootstrap')
    setUsers(data.users.map((u) => ({ id: String(u.id), name: u.name, handle: u.handle })))
    setStoresCrud(data.stores.map((s) => ({ id: s.id, name: s.name, description: s.description ?? '', address: s.address ?? '', city: s.city, logo: s.logo, accent: s.accent, image: s.image_url })))
    setProductsCrud(data.products.map((p) => ({ id: String(p.id), name: p.name, category: p.category, brand: p.brand, storeId: p.store_id, referenceAmount: Number(p.reference_amount ?? 100), referenceUnit: p.reference_unit || 'g', image: p.image_url, price: Number(p.price ?? 0), stock: Number(p.stock ?? 0), calories: Number(p.calories ?? 0), protein: Number(p.protein ?? 0), carbs: Number(p.carbs ?? 0), fat: Number(p.fat ?? 0) })))
    setRecipesCrud(data.recipes.map((r) => ({ id: String(r.id), userId: String(r.user_id), storeId: r.store_id, title: r.title, description: r.description ?? '', steps: r.steps ?? '', image: r.image_url, servings: Number(r.servings ?? 1), prepTime: Number(r.prep_time ?? 0), difficulty: r.difficulty, caloriesTotal: Number(r.calories_total ?? 0), proteinTotal: Number(r.protein_total ?? 0), carbsTotal: Number(r.carbs_total ?? 0), fatTotal: Number(r.fat_total ?? 0) })))
  }, [])

  useEffect(() => {
    refreshApiHealth().catch(() => undefined)
    loadCrudData().catch((err) => setCrudMessage((err as Error).message))
  }, [loadCrudData, refreshApiHealth])

  useEffect(() => {
    setProductForm((p) => ({ ...p, storeId: p.storeId || storesCrud[0]?.id || '' }))
    setRecipeForm((p) => ({ ...p, userId: p.userId || users[0]?.id || '', storeId: p.storeId || storesCrud[0]?.id || '' }))
  }, [storesCrud, users])

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

  const storeById = useMemo(() => new Map(storesCrud.map((s) => [s.id, s])), [storesCrud])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  function resetProductEditor() {
    setEditingProductId(null)
    setProductForm((p) => ({ ...blankProductForm, storeId: p.storeId || storesCrud[0]?.id || '' }))
  }

  function resetStoreEditor() {
    setEditingStoreId(null)
    setStoreForm(blankStoreForm)
  }

  function resetRecipeEditor() {
    setEditingRecipeId(null)
    setRecipeForm(blankRecipeForm(users, storesCrud))
  }

  function closeProductForm() {
    setShowProductForm(false)
    resetProductEditor()
  }

  function closeStoreForm() {
    setShowStoreForm(false)
    resetStoreEditor()
  }

  function closeRecipeForm() {
    setShowRecipeForm(false)
    resetRecipeEditor()
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id)
    setShowProductForm(true)
    setProductForm({
      name: product.name,
      category: product.category,
      brand: product.brand,
      storeId: product.storeId,
      referenceAmount: String(product.referenceAmount),
      referenceUnit: product.referenceUnit,
      calories: String(product.calories),
      protein: String(product.protein),
      carbs: String(product.carbs),
      fat: String(product.fat),
      price: String(product.price),
      stock: String(product.stock),
      imageUrl: product.image ?? '',
    })
  }

  function startEditStore(store: Store) {
    setEditingStoreId(store.id)
    setShowStoreForm(true)
    setStoreForm({
      name: store.name,
      city: store.city,
      description: store.description,
      address: store.address,
      logo: store.logo,
      accent: store.accent,
      imageUrl: store.image ?? '',
    })
  }

  async function startEditRecipe(recipeId: string) {
    try {
      const detail = await fetchJson<RecipeDetail>(`/api/recipes/${recipeId}`)
      setEditingRecipeId(String(detail.id))
      setShowRecipeForm(true)
      setRecipeForm({
        title: detail.title,
        description: detail.description ?? '',
        steps: detail.steps ?? '',
        userId: String(detail.user_id),
        storeId: detail.store_id ?? '',
        difficulty: detail.difficulty,
        servings: String(detail.servings ?? 1),
        prepTime: String(detail.prep_time ?? 0),
        imageUrl: detail.image_url ?? '',
        ingredients: detail.ingredients.length > 0
          ? detail.ingredients.map((ing) => ({ productId: String(ing.product_id), quantity: String(ing.quantity), unit: ing.unit || 'g' }))
          : [{ productId: '', quantity: '1', unit: 'g' }],
      })
    } catch (err) {
      setCrudMessage((err as Error).message)
    }
  }

  async function submitProduct(e: FormEvent) {
    e.preventDefault()
    const payload = {
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      brand: productForm.brand.trim(),
      store_id: productForm.storeId,
      reference_amount: n(productForm.referenceAmount, 100),
      reference_unit: productForm.referenceUnit || 'g',
      calories: Math.max(0, Math.floor(n(productForm.calories))),
      protein: Math.max(0, n(productForm.protein)),
      carbs: Math.max(0, n(productForm.carbs)),
      fat: Math.max(0, n(productForm.fat)),
      price: Math.max(0, n(productForm.price)),
      stock: Math.max(0, Math.floor(n(productForm.stock))),
      image_url: productForm.imageUrl.trim() || null,
    }
    try {
      if (editingProductId) await putJson(`/api/products/${editingProductId}`, payload)
      else await postJson('/api/products', payload)
      setCrudMessage(editingProductId ? 'Producto actualizado.' : 'Producto añadido.')
      await loadCrudData()
      setShowProductForm(false)
      resetProductEditor()
    } catch (err) {
      setCrudMessage((err as Error).message)
    }
  }

  async function submitStore(e: FormEvent) {
    e.preventDefault()
    const payload = {
      name: storeForm.name.trim(),
      city: storeForm.city.trim(),
      description: storeForm.description.trim() || null,
      address: storeForm.address.trim() || null,
      logo: storeForm.logo.trim().slice(0, 2).toUpperCase() || 'ST',
      accent: storeForm.accent,
      image_url: storeForm.imageUrl.trim() || null,
    }
    try {
      if (editingStoreId) await putJson(`/api/stores/${editingStoreId}`, payload)
      else await postJson('/api/stores', payload)
      setCrudMessage(editingStoreId ? 'Tienda actualizada.' : 'Tienda añadida.')
      await loadCrudData()
      setShowStoreForm(false)
      resetStoreEditor()
    } catch (err) {
      setCrudMessage((err as Error).message)
    }
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
      store_id: recipeForm.storeId || null,
      title: recipeForm.title.trim(),
      description: recipeForm.description.trim() || null,
      steps: recipeForm.steps.trim(),
      image_url: recipeForm.imageUrl.trim() || null,
      servings: Math.max(1, Math.floor(n(recipeForm.servings, 1))),
      prep_time: Math.max(0, Math.floor(n(recipeForm.prepTime))),
      difficulty: recipeForm.difficulty,
      ingredients,
    }
    try {
      if (editingRecipeId) await putJson(`/api/recipes/${editingRecipeId}`, payload)
      else await postJson('/api/recipes', payload)
      setCrudMessage(editingRecipeId ? 'Receta actualizada.' : 'Receta añadida.')
      await loadCrudData()
      setShowRecipeForm(false)
      resetRecipeEditor()
    } catch (err) {
      setCrudMessage((err as Error).message)
    }
  }

  async function removeProduct(product: Product) {
    setDeleteDialog({ type: 'product', id: product.id, label: product.name })
  }

  async function removeStore(store: Store) {
    setDeleteDialog({ type: 'store', id: store.id, label: store.name })
  }

  async function removeRecipe(recipe: Recipe) {
    setDeleteDialog({ type: 'recipe', id: recipe.id, label: recipe.title })
  }

  async function confirmDelete() {
    if (!deleteDialog) return
    try {
      if (deleteDialog.type === 'product') {
        await deleteJson(`/api/products/${deleteDialog.id}`)
        setCrudMessage('Producto eliminado.')
      } else if (deleteDialog.type === 'store') {
        await deleteJson(`/api/stores/${deleteDialog.id}`)
        setCrudMessage('Tienda eliminada.')
      } else {
        await deleteJson(`/api/recipes/${deleteDialog.id}`)
        setCrudMessage('Receta eliminada.')
      }
      await loadCrudData()
    } catch (err) {
      setCrudMessage((err as Error).message)
    } finally {
      setDeleteDialog(null)
    }
  }

  const profileMatch = locationRoute.pathname.match(/^\/perfil\/([^/]+)$/)
  const profileUserId = profileMatch ? decodeURIComponent(profileMatch[1]) : null
  const isProfileRoute = profileUserId !== null
  const apiStatusTone = apiHealthError ? 'status-error' : apiHealthLoading ? 'status-loading' : 'status-granted'
  const apiStatusLabel = apiHealthError
    ? `API sin conexion: ${apiHealthError}`
    : apiHealthLoading
      ? 'Comprobando API...'
      : `API lista en ${API_BASE_URL}`
  const feedPosts = useMemo(() => getFeedPosts(feedTab), [feedTab, getFeedPosts])
  const profileUser = profileUserId ? socialUsersById[profileUserId] ?? null : null
  const selectedRecipes = useMemo(
    () => shoppingPlanRecipeIds.map((id) => recipesCrud.find((recipe) => recipe.id === id)).filter((recipe): recipe is Recipe => Boolean(recipe)),
    [recipesCrud, shoppingPlanRecipeIds],
  )
  const profilePosts = useMemo(
    () => (profileUserId ? getUserPosts(profileUserId) : []),
    [getUserPosts, profileUserId],
  )

  useEffect(() => {
    if (isProfileRoute && activeSection !== 'perfil') {
      setActiveSection('perfil')
      return
    }
    if (!isProfileRoute && activeSection === 'perfil') {
      setActiveSection('inicio')
    }
  }, [activeSection, isProfileRoute])

  useEffect(() => {
    setShoppingPlanRecipeIds((current) => current.filter((id) => recipesCrud.some((recipe) => recipe.id === id)))
  }, [recipesCrud])

  useEffect(() => {
    if (shoppingPlanRecipeIds.length === 0) {
      setShoppingPlanData(null)
      setShoppingPlanLoading(false)
      return
    }

    let cancelled = false
    setShoppingPlanLoading(true)

    postJson('/api/shopping-plan/preview', {
      recipe_ids: shoppingPlanRecipeIds.map((recipeId) => Number(recipeId)),
    })
      .then((data) => {
        if (cancelled) return
        setShoppingPlanData(data as ShoppingPlanResponse)
      })
      .catch((error) => {
        if (!cancelled) {
          setShoppingPlanData(null)
          setCrudMessage(error instanceof Error ? error.message : 'No se pudo preparar la lista de compra')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setShoppingPlanLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [shoppingPlanRecipeIds])

  const openSocialProfile = useCallback((userId: string) => {
    setActiveSection('perfil')
    navigate(`/perfil/${userId}`)
  }, [navigate])

  const toggleRecipeInShoppingPlan = useCallback((recipeId: string) => {
    setShoppingPlanRecipeIds((current) => (
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId]
    ))
  }, [])

  const handleSectionSelect = useCallback((section: typeof activeSection) => {
    if (section === 'perfil') {
      setActiveSection('perfil')
      navigate(`/perfil/${socialCurrentUser.id}`)
      return
    }

    setActiveSection(section)
    if (locationRoute.pathname !== '/') {
      navigate('/')
    }
  }, [locationRoute.pathname, navigate, socialCurrentUser.id])

  const headerDescription = isProfileRoute
    ? 'Perfil de usuario en vista independiente'
    : activeSection === 'inicio'
      ? (feedTab === 'para-ti'
          ? 'Feed social general con publicaciones de todos los perfiles mock'
          : 'Publicaciones solo de perfiles que sigues en estado local')
      : activeSection === 'tiendas-cercanas'
        ? 'Flujo de compra por proximidad en tiempo real'
        : `${labelForSection(activeSection)} en la estructura principal`

  return (
    <div className="app-shell">
      <aside className="left-sidebar card-surface">
        <div className="brand-block">
          <div className="brand-mark">NS</div>
          <strong>NutriSocial</strong>
        </div>

        <nav className="side-nav" aria-label="Secciones principales">
          {[
            { id: 'inicio', label: 'Inicio' },
            { id: 'productos', label: 'Productos' },
            { id: 'tiendas', label: 'Tiendas' },
            { id: 'recetas', label: 'Recetas' },
            { id: 'perfil', label: 'Perfil' },
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
          <div className="api-status-card">
            <div>
              <p className="eyebrow">Estado del sistema</p>
              <p className={`status-pill ${apiStatusTone}`}>{apiStatusLabel}</p>
            </div>
            <div className="api-status-actions">
              {apiHealth?.metrics ? (
                <p className="muted api-status-metrics">
                  {apiHealth.metrics.users} usuarios · {apiHealth.metrics.products} productos · {apiHealth.metrics.recipes} recetas
                </p>
              ) : null}
              <button type="button" className="ghost-btn" onClick={() => void refreshApiHealth()}>
                Reintentar
              </button>
            </div>
          </div>
        </header>
        {crudMessage && <section className="panel card-surface"><p className="muted">{crudMessage}</p></section>}

        {isProfileRoute ? (
          profileUser ? (
            <SocialProfilePage
              user={profileUser}
              posts={profilePosts}
              isFollowing={followingSet.has(profileUser.id)}
              hasRequest={requestSet.has(profileUser.id)}
              onFollowUser={followUser}
              onSendFriendRequest={sendFriendRequest}
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
            usersById={socialUsersById}
            onOpenProfile={openSocialProfile}
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
              onTogglePrioritizeAvailable={() => setPrioritizeAvailable((value) => !value)}
            />
          </>
        ) : activeSection === 'productos' ? (
          <section className="panel card-surface">
            <div className="panel-headline">
              <p className="eyebrow">Productos</p>
              <h2>Gestion de productos</h2>
            </div>
            <button type="button" className="primary-btn" onClick={() => { if (showProductForm) { closeProductForm() } else { setShowProductForm(true) } }}>
              {showProductForm ? 'Cerrar formulario' : 'Añadir producto'}
            </button>
            {showProductForm && !editingProductId && (
              <form className="crud-form" onSubmit={submitProduct}>
                <input placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} required />
                <input placeholder="Categoria" value={productForm.category} onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))} required />
                <input placeholder="Marca" value={productForm.brand} onChange={(e) => setProductForm((p) => ({ ...p, brand: e.target.value }))} required />
                <select value={productForm.storeId} onChange={(e) => setProductForm((p) => ({ ...p, storeId: e.target.value }))} required><option value="">Tienda</option>{storesCrud.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <input type="number" min="0.01" step="0.01" placeholder="Cantidad ref" value={productForm.referenceAmount} onChange={(e) => setProductForm((p) => ({ ...p, referenceAmount: e.target.value }))} required />
                <input placeholder="Unidad" value={productForm.referenceUnit} onChange={(e) => setProductForm((p) => ({ ...p, referenceUnit: e.target.value }))} required />
                <input type="number" min="0" placeholder="Kcal" value={productForm.calories} onChange={(e) => setProductForm((p) => ({ ...p, calories: e.target.value }))} required />
                <input type="number" min="0" step="0.01" placeholder="Proteinas" value={productForm.protein} onChange={(e) => setProductForm((p) => ({ ...p, protein: e.target.value }))} required />
                <input type="number" min="0" step="0.01" placeholder="Carbos" value={productForm.carbs} onChange={(e) => setProductForm((p) => ({ ...p, carbs: e.target.value }))} required />
                <input type="number" min="0" step="0.01" placeholder="Grasas" value={productForm.fat} onChange={(e) => setProductForm((p) => ({ ...p, fat: e.target.value }))} required />
                <input type="number" min="0" step="0.01" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} />
                <input type="number" min="0" placeholder="Stock" value={productForm.stock} onChange={(e) => setProductForm((p) => ({ ...p, stock: e.target.value }))} />
                <input className="span-2" placeholder="Imagen URL" value={productForm.imageUrl} onChange={(e) => setProductForm((p) => ({ ...p, imageUrl: e.target.value }))} />
                <div className="crud-actions span-2">
                  {editingProductId && (
                    <>
                      <button type="button" className="danger-btn" onClick={() => { const current = productsCrud.find((x) => x.id === editingProductId); if (current) void removeProduct(current) }}>Eliminar</button>
                      <button type="button" className="ghost-btn" onClick={closeProductForm}>Cancelar</button>
                    </>
                  )}
                  <button type="submit" className="primary-btn">{editingProductId ? 'Actualizar' : 'Guardar'}</button>
                </div>
              </form>
            )}
            {showProductForm && editingProductId && (
              <div className="edit-sheet" role="dialog" aria-modal="false" aria-labelledby="product-edit-title">
                <div className="edit-sheet-header">
                  <div>
                    <p className="eyebrow">Editar</p>
                    <h3 id="product-edit-title">Producto</h3>
                  </div>
                  <button type="button" className="edit-sheet-close" onClick={closeProductForm} aria-label="Cerrar editor de producto">
                    ×
                  </button>
                </div>
                <form className="crud-form" onSubmit={submitProduct}>
                  <input placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} required />
                  <input placeholder="Categoria" value={productForm.category} onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))} required />
                  <input placeholder="Marca" value={productForm.brand} onChange={(e) => setProductForm((p) => ({ ...p, brand: e.target.value }))} required />
                  <select value={productForm.storeId} onChange={(e) => setProductForm((p) => ({ ...p, storeId: e.target.value }))} required><option value="">Tienda</option>{storesCrud.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <input type="number" min="0.01" step="0.01" placeholder="Cantidad ref" value={productForm.referenceAmount} onChange={(e) => setProductForm((p) => ({ ...p, referenceAmount: e.target.value }))} required />
                  <input placeholder="Unidad" value={productForm.referenceUnit} onChange={(e) => setProductForm((p) => ({ ...p, referenceUnit: e.target.value }))} required />
                  <input type="number" min="0" placeholder="Kcal" value={productForm.calories} onChange={(e) => setProductForm((p) => ({ ...p, calories: e.target.value }))} required />
                  <input type="number" min="0" step="0.01" placeholder="Proteinas" value={productForm.protein} onChange={(e) => setProductForm((p) => ({ ...p, protein: e.target.value }))} required />
                  <input type="number" min="0" step="0.01" placeholder="Carbos" value={productForm.carbs} onChange={(e) => setProductForm((p) => ({ ...p, carbs: e.target.value }))} required />
                  <input type="number" min="0" step="0.01" placeholder="Grasas" value={productForm.fat} onChange={(e) => setProductForm((p) => ({ ...p, fat: e.target.value }))} required />
                  <input type="number" min="0" step="0.01" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} />
                  <input type="number" min="0" placeholder="Stock" value={productForm.stock} onChange={(e) => setProductForm((p) => ({ ...p, stock: e.target.value }))} />
                  <input className="span-2" placeholder="Imagen URL" value={productForm.imageUrl} onChange={(e) => setProductForm((p) => ({ ...p, imageUrl: e.target.value }))} />
                  <div className="crud-actions span-2">
                    <button type="button" className="danger-btn" onClick={() => { const current = productsCrud.find((x) => x.id === editingProductId); if (current) void removeProduct(current) }}>Eliminar</button>
                    <button type="button" className="ghost-btn" onClick={closeProductForm}>Cancelar</button>
                    <button type="submit" className="primary-btn">Actualizar</button>
                  </div>
                </form>
              </div>
            )}
            <div className="crud-list">
              {productsCrud.map((p) => (
                <article key={p.id} className="crud-item">
                  <div>
                    <strong>{p.name}</strong>
                    <p className="muted">{p.brand} · {storeById.get(p.storeId)?.name ?? 'Sin tienda'}</p>
                  </div>
                  <div className="crud-actions">
                    <button type="button" className="ghost-btn" onClick={() => startEditProduct(p)}>Editar</button>
                    <button type="button" className="danger-btn" onClick={() => void removeProduct(p)}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeSection === 'tiendas' ? (
          <section className="panel card-surface">
            <div className="panel-headline">
              <p className="eyebrow">Tiendas</p>
              <h2>Gestion de tiendas</h2>
            </div>
            <button type="button" className="primary-btn" onClick={() => { if (showStoreForm) { closeStoreForm() } else { setShowStoreForm(true) } }}>
              {showStoreForm ? 'Cerrar formulario' : 'Añadir tienda'}
            </button>
            {showStoreForm && !editingStoreId && (
              <form className="crud-form" onSubmit={submitStore}>
                <input placeholder="Nombre" value={storeForm.name} onChange={(e) => setStoreForm((p) => ({ ...p, name: e.target.value }))} required />
                <input placeholder="Ciudad" value={storeForm.city} onChange={(e) => setStoreForm((p) => ({ ...p, city: e.target.value }))} required />
                <input placeholder="Logo" value={storeForm.logo} maxLength={2} onChange={(e) => setStoreForm((p) => ({ ...p, logo: e.target.value }))} />
                <input type="color" value={storeForm.accent} onChange={(e) => setStoreForm((p) => ({ ...p, accent: e.target.value }))} />
                <input className="span-2" placeholder="Descripcion" value={storeForm.description} onChange={(e) => setStoreForm((p) => ({ ...p, description: e.target.value }))} />
                <input className="span-2" placeholder="Direccion" value={storeForm.address} onChange={(e) => setStoreForm((p) => ({ ...p, address: e.target.value }))} />
                <input className="span-2" placeholder="Imagen URL" value={storeForm.imageUrl} onChange={(e) => setStoreForm((p) => ({ ...p, imageUrl: e.target.value }))} />
                <div className="crud-actions span-2">
                  {editingStoreId && (
                    <>
                      <button type="button" className="danger-btn" onClick={() => { const current = storesCrud.find((x) => x.id === editingStoreId); if (current) void removeStore(current) }}>Eliminar</button>
                      <button type="button" className="ghost-btn" onClick={closeStoreForm}>Cancelar</button>
                    </>
                  )}
                  <button type="submit" className="primary-btn">{editingStoreId ? 'Actualizar' : 'Guardar'}</button>
                </div>
              </form>
            )}
            {showStoreForm && editingStoreId && (
              <div className="edit-sheet" role="dialog" aria-modal="false" aria-labelledby="store-edit-title">
                <div className="edit-sheet-header">
                  <div>
                    <p className="eyebrow">Editar</p>
                    <h3 id="store-edit-title">Tienda</h3>
                  </div>
                  <button type="button" className="edit-sheet-close" onClick={closeStoreForm} aria-label="Cerrar editor de tienda">
                    ×
                  </button>
                </div>
                <form className="crud-form" onSubmit={submitStore}>
                  <input placeholder="Nombre" value={storeForm.name} onChange={(e) => setStoreForm((p) => ({ ...p, name: e.target.value }))} required />
                  <input placeholder="Ciudad" value={storeForm.city} onChange={(e) => setStoreForm((p) => ({ ...p, city: e.target.value }))} required />
                  <input placeholder="Logo" value={storeForm.logo} maxLength={2} onChange={(e) => setStoreForm((p) => ({ ...p, logo: e.target.value }))} />
                  <input type="color" value={storeForm.accent} onChange={(e) => setStoreForm((p) => ({ ...p, accent: e.target.value }))} />
                  <input className="span-2" placeholder="Descripcion" value={storeForm.description} onChange={(e) => setStoreForm((p) => ({ ...p, description: e.target.value }))} />
                  <input className="span-2" placeholder="Direccion" value={storeForm.address} onChange={(e) => setStoreForm((p) => ({ ...p, address: e.target.value }))} />
                  <input className="span-2" placeholder="Imagen URL" value={storeForm.imageUrl} onChange={(e) => setStoreForm((p) => ({ ...p, imageUrl: e.target.value }))} />
                  <div className="crud-actions span-2">
                    <button type="button" className="danger-btn" onClick={() => { const current = storesCrud.find((x) => x.id === editingStoreId); if (current) void removeStore(current) }}>Eliminar</button>
                    <button type="button" className="ghost-btn" onClick={closeStoreForm}>Cancelar</button>
                    <button type="submit" className="primary-btn">Actualizar</button>
                  </div>
                </form>
              </div>
            )}
            <div className="crud-list">
              {storesCrud.map((s) => (
                <article key={s.id} className="crud-item">
                  <div>
                    <strong>{s.name}</strong>
                    <p className="muted">{s.city}</p>
                  </div>
                  <div className="crud-actions">
                    <button type="button" className="ghost-btn" onClick={() => startEditStore(s)}>Editar</button>
                    <button type="button" className="danger-btn" onClick={() => void removeStore(s)}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeSection === 'recetas' ? (
          <section className="panel card-surface">
            <div className="panel-headline">
              <p className="eyebrow">Recetas</p>
              <h2>Gestion de recetas</h2>
            </div>
            <div className="crud-actions">
              <button type="button" className="ghost-btn" onClick={() => setShoppingPlanRecipeIds([])} disabled={shoppingPlanRecipeIds.length === 0}>
                Vaciar lista
              </button>
              <button type="button" className="primary-btn" onClick={() => { if (showRecipeForm) { closeRecipeForm() } else { setShowRecipeForm(true) } }}>
                {showRecipeForm ? 'Cerrar formulario' : 'Añadir receta'}
              </button>
            </div>
            <section className="shopping-plan-panel">
              <div className="shopping-plan-header">
                <div>
                  <p className="eyebrow">Planificador</p>
                  <h3>Lista de compra inteligente</h3>
                </div>
                <span className="status-pill">{selectedRecipes.length} recetas seleccionadas</span>
              </div>
              {shoppingPlanLoading ? <p className="muted">Preparando ingredientes y resumen...</p> : null}
              {selectedRecipes.length === 0 ? (
                <p className="muted">Marca recetas para agrupar ingredientes, estimar coste y ver en qué tiendas te encaja mejor comprar.</p>
              ) : (
                <>
                  <div className="shopping-plan-metrics">
                    <article className="shopping-metric-card">
                      <strong>{shoppingPlanData?.items.length ?? 0}</strong>
                      <span>ingredientes unificados</span>
                    </article>
                    <article className="shopping-metric-card">
                      <strong>{(shoppingPlanData?.summary.estimated_cost ?? 0).toFixed(2)} EUR</strong>
                      <span>coste estimado</span>
                    </article>
                    <article className="shopping-metric-card">
                      <strong>{(shoppingPlanData?.summary.calories ?? 0).toFixed(0)} kcal</strong>
                      <span>energia total</span>
                    </article>
                    <article className="shopping-metric-card">
                      <strong>{(shoppingPlanData?.summary.protein ?? 0).toFixed(1)} g</strong>
                      <span>proteina acumulada</span>
                    </article>
                  </div>
                  <div className="shopping-plan-grid">
                    <div className="shopping-plan-column">
                      <h4>Ingredientes a comprar</h4>
                      <div className="shopping-ingredient-list">
                        {shoppingPlanData?.items.map((item) => (
                          <article key={`${item.product_id}-${item.unit}`} className="shopping-ingredient-card">
                            <div className="shopping-ingredient-top">
                              <strong>{item.name}</strong>
                              <span>{item.quantity.toFixed(2)} {item.unit}</span>
                            </div>
                            <p className="muted">{item.brand || item.category}</p>
                            <p className="muted">Recetas: {item.recipes.join(', ')}</p>
                            <p className="shopping-price">{item.estimated_cost > 0 ? `${item.estimated_cost.toFixed(2)} EUR aprox.` : 'Sin precio estimado'}</p>
                          </article>
                        )) ?? null}
                      </div>
                    </div>
                    <div className="shopping-plan-column">
                      <h4>Tiendas sugeridas</h4>
                      <div className="shopping-store-list">
                        {shoppingPlanData && shoppingPlanData.stores.length > 0 ? shoppingPlanData.stores.map((store) => (
                          <article key={store.store_id} className="shopping-store-card">
                            <div className="shopping-ingredient-top">
                              <strong>{store.store_name || (storeById.get(store.store_id)?.name ?? 'Tienda')}</strong>
                              <span>{store.items} productos</span>
                            </div>
                            <p className="muted">{store.store_city || (storeById.get(store.store_id)?.city ?? 'Ubicacion pendiente')}</p>
                            <p className="shopping-price">{store.estimated_cost.toFixed(2)} EUR estimados en esta tienda</p>
                          </article>
                        )) : <p className="muted">No hay suficientes productos asociados a tiendas para sugerirte una compra agrupada.</p>}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
            {showRecipeForm && !editingRecipeId && (
              <form className="crud-form" onSubmit={submitRecipe}>
                <input placeholder="Titulo" value={recipeForm.title} onChange={(e) => setRecipeForm((p) => ({ ...p, title: e.target.value }))} required />
                <select value={recipeForm.userId} onChange={(e) => setRecipeForm((p) => ({ ...p, userId: e.target.value }))} required><option value="">Creador</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                <select value={recipeForm.storeId} onChange={(e) => setRecipeForm((p) => ({ ...p, storeId: e.target.value }))}><option value="">Sin tienda</option>{storesCrud.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={recipeForm.difficulty} onChange={(e) => setRecipeForm((p) => ({ ...p, difficulty: e.target.value }))}><option value="Facil">Facil</option><option value="Media">Media</option><option value="Alta">Alta</option></select>
                <input type="number" min="1" placeholder="Porciones" value={recipeForm.servings} onChange={(e) => setRecipeForm((p) => ({ ...p, servings: e.target.value }))} required />
                <input type="number" min="0" placeholder="Prep min" value={recipeForm.prepTime} onChange={(e) => setRecipeForm((p) => ({ ...p, prepTime: e.target.value }))} required />
                <input className="span-2" placeholder="Descripcion" value={recipeForm.description} onChange={(e) => setRecipeForm((p) => ({ ...p, description: e.target.value }))} />
                <input className="span-2" placeholder="Elaboracion" value={recipeForm.steps} onChange={(e) => setRecipeForm((p) => ({ ...p, steps: e.target.value }))} required />
                <input className="span-2" placeholder="Imagen URL" value={recipeForm.imageUrl} onChange={(e) => setRecipeForm((p) => ({ ...p, imageUrl: e.target.value }))} />
                <div className="span-2 crud-list">
                  {recipeForm.ingredients.map((ing, idx) => (
                    <div key={`ing-${idx}`} className="crud-form">
                      <select value={ing.productId} onChange={(e) => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.map((x, i) => i === idx ? { ...x, productId: e.target.value } : x) }))} required>
                        <option value="">Producto</option>
                        {productsCrud.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" min="0.01" step="0.01" value={ing.quantity} onChange={(e) => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x) }))} required />
                      <input value={ing.unit} onChange={(e) => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x) }))} required />
                      <button type="button" className="ghost-btn" onClick={() => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.length === 1 ? p.ingredients : p.ingredients.filter((_, i) => i !== idx) }))}>Quitar</button>
                    </div>
                  ))}
                  <button type="button" className="ghost-btn" onClick={() => setRecipeForm((p) => ({ ...p, ingredients: [...p.ingredients, { productId: '', quantity: '1', unit: 'g' }] }))}>Añadir ingrediente</button>
                </div>
                <div className="crud-actions span-2">
                  {editingRecipeId && (
                    <>
                      <button type="button" className="danger-btn" onClick={() => { const current = recipesCrud.find((x) => x.id === editingRecipeId); if (current) void removeRecipe(current) }}>Eliminar</button>
                      <button type="button" className="ghost-btn" onClick={closeRecipeForm}>Cancelar</button>
                    </>
                  )}
                  <button type="submit" className="primary-btn">{editingRecipeId ? 'Actualizar' : 'Guardar'}</button>
                </div>
              </form>
            )}
            {showRecipeForm && editingRecipeId && (
              <div className="edit-sheet edit-sheet-wide" role="dialog" aria-modal="false" aria-labelledby="recipe-edit-title">
                <div className="edit-sheet-header">
                  <div>
                    <p className="eyebrow">Editar</p>
                    <h3 id="recipe-edit-title">Receta</h3>
                  </div>
                  <button type="button" className="edit-sheet-close" onClick={closeRecipeForm} aria-label="Cerrar editor de receta">
                    ×
                  </button>
                </div>
                <form className="crud-form" onSubmit={submitRecipe}>
                  <input placeholder="Titulo" value={recipeForm.title} onChange={(e) => setRecipeForm((p) => ({ ...p, title: e.target.value }))} required />
                  <select value={recipeForm.userId} onChange={(e) => setRecipeForm((p) => ({ ...p, userId: e.target.value }))} required><option value="">Creador</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                  <select value={recipeForm.storeId} onChange={(e) => setRecipeForm((p) => ({ ...p, storeId: e.target.value }))}><option value="">Sin tienda</option>{storesCrud.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <select value={recipeForm.difficulty} onChange={(e) => setRecipeForm((p) => ({ ...p, difficulty: e.target.value }))}><option value="Facil">Facil</option><option value="Media">Media</option><option value="Alta">Alta</option></select>
                  <input type="number" min="1" placeholder="Porciones" value={recipeForm.servings} onChange={(e) => setRecipeForm((p) => ({ ...p, servings: e.target.value }))} required />
                  <input type="number" min="0" placeholder="Prep min" value={recipeForm.prepTime} onChange={(e) => setRecipeForm((p) => ({ ...p, prepTime: e.target.value }))} required />
                  <input className="span-2" placeholder="Descripcion" value={recipeForm.description} onChange={(e) => setRecipeForm((p) => ({ ...p, description: e.target.value }))} />
                  <input className="span-2" placeholder="Elaboracion" value={recipeForm.steps} onChange={(e) => setRecipeForm((p) => ({ ...p, steps: e.target.value }))} required />
                  <input className="span-2" placeholder="Imagen URL" value={recipeForm.imageUrl} onChange={(e) => setRecipeForm((p) => ({ ...p, imageUrl: e.target.value }))} />
                  <div className="span-2 crud-list">
                    {recipeForm.ingredients.map((ing, idx) => (
                      <div key={`recipe-edit-ing-${idx}`} className="crud-form">
                        <select value={ing.productId} onChange={(e) => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.map((x, i) => i === idx ? { ...x, productId: e.target.value } : x) }))} required>
                          <option value="">Producto</option>
                          {productsCrud.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="number" min="0.01" step="0.01" value={ing.quantity} onChange={(e) => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x) }))} required />
                        <input value={ing.unit} onChange={(e) => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x) }))} required />
                        <button type="button" className="ghost-btn" onClick={() => setRecipeForm((p) => ({ ...p, ingredients: p.ingredients.length === 1 ? p.ingredients : p.ingredients.filter((_, i) => i !== idx) }))}>Quitar</button>
                      </div>
                    ))}
                    <button type="button" className="ghost-btn" onClick={() => setRecipeForm((p) => ({ ...p, ingredients: [...p.ingredients, { productId: '', quantity: '1', unit: 'g' }] }))}>Añadir ingrediente</button>
                  </div>
                  <div className="crud-actions span-2">
                    <button type="button" className="danger-btn" onClick={() => { const current = recipesCrud.find((x) => x.id === editingRecipeId); if (current) void removeRecipe(current) }}>Eliminar</button>
                    <button type="button" className="ghost-btn" onClick={closeRecipeForm}>Cancelar</button>
                    <button type="submit" className="primary-btn">Actualizar</button>
                  </div>
                </form>
              </div>
            )}
            <div className="crud-list">
              {recipesCrud.map((r) => (
                <article key={r.id} className="crud-item">
                  <div>
                    <strong>{r.title}</strong>
                    <p className="muted">{userById.get(r.userId)?.name ?? 'Sin autor'} · {storeById.get(r.storeId ?? '')?.name ?? 'Sin tienda'}</p>
                  </div>
                  <div className="crud-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => toggleRecipeInShoppingPlan(r.id)}
                    >
                      {shoppingPlanRecipeIds.includes(r.id) ? 'Quitar de compra' : 'Añadir a compra'}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => void startEditRecipe(r.id)}>Editar</button>
                    <button type="button" className="danger-btn" onClick={() => void removeRecipe(r)}>Eliminar</button>
                  </div>
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
          currentUser={socialCurrentUser}
          usersById={socialUsersById}
          followingUsers={followingUsers}
          followingSet={followingSet}
          requestSet={requestSet}
          onOpenProfile={openSocialProfile}
          onFollowUser={followUser}
          onSendFriendRequest={sendFriendRequest}
        />
      </aside>

      {deleteDialog && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeleteDialog(null)}>
          <div className="confirm-modal card-surface" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar eliminacion</h3>
            <p>
              {deleteDialog.type === 'store'
                ? `¿Seguro que quieres eliminar la tienda "${deleteDialog.label}"?`
                : deleteDialog.type === 'product'
                  ? `¿Seguro que quieres eliminar el producto "${deleteDialog.label}"?`
                  : `¿Seguro que quieres eliminar la receta "${deleteDialog.label}"?`}
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

function labelForSection(section: 'inicio' | 'productos' | 'tiendas' | 'recetas' | 'perfil' | 'tiendas-cercanas'): string {
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
    default:
      return 'Tiendas cercanas'
  }
}

export default App
