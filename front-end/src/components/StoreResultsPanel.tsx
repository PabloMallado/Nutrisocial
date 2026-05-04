import type { NearbyStoreResult } from '../types/location-shopping'

interface StoreResultsPanelProps {
  loading: boolean
  errorMessage: string | null
  stores: NearbyStoreResult[]
  radiusKm: number
  hasSearched: boolean
  prioritizeAvailable: boolean
  onTogglePrioritizeAvailable: () => void
}

export function StoreResultsPanel(props: StoreResultsPanelProps) {
  const { loading, errorMessage, stores, radiusKm, hasSearched, prioritizeAvailable, onTogglePrioritizeAvailable } = props

  return (
    <section className="panel card-surface">
      <div className="results-head">
        <div>
          <p className="eyebrow">Tiendas cercanas</p>
          <h2>Resultado para tu producto</h2>
        </div>
        <button type="button" className="ghost-btn" onClick={onTogglePrioritizeAvailable}>
          {prioritizeAvailable ? 'Prioridad: disponibilidad' : 'Prioridad: cercania'}
        </button>
      </div>

      <p className="muted">Radio activo: {radiusKm} km.</p>

      {loading ? <p className="muted">Buscando tiendas cercanas...</p> : null}
      {errorMessage ? <p className="warning-text">{errorMessage}</p> : null}

      {!loading && hasSearched && stores.length === 0 ? (
        <p className="muted">No hay tiendas cercanas con ese producto para el radio actual.</p>
      ) : null}

      {stores.length > 0 ? (
        <div className="store-grid">
          {stores.map((store) => (
            <article key={`${store.id}-${store.product.id}`} className="store-card">
              <div className="store-title-row">
                <h3>{store.name}</h3>
                <strong>{store.distance_km.toFixed(1)} km</strong>
              </div>

              <p>{store.address ?? 'Direccion no disponible'}</p>
              <p className="muted">{store.city}</p>

              <div className="tags-row">
                <span className={`tag tag-${store.listing.availability_status}`}>{availabilityLabel(store.listing.availability_status)}</span>
                {store.listing.price !== null ? <span className="tag">{store.listing.price.toFixed(2)} {store.listing.currency}</span> : null}
                {store.listing.offer_text ? <span className="tag">{store.listing.offer_text}</span> : null}
              </div>

              {store.listing.last_checked_at ? (
                <small className="muted">Actualizado: {new Date(store.listing.last_checked_at).toLocaleString('es-ES')}</small>
              ) : null}

              {store.listing.store_product_url ? (
                <a className="text-link" href={store.listing.store_product_url} target="_blank" rel="noreferrer">
                  Ver ficha de tienda
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function availabilityLabel(status: NearbyStoreResult['listing']['availability_status']): string {
  switch (status) {
    case 'in_stock':
      return 'Disponible'
    case 'low_stock':
      return 'Ultimas unidades'
    case 'out_of_stock':
      return 'Sin stock'
    default:
      return 'Sin confirmar'
  }
}

