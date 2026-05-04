import type { ProductSuggestion } from '../types/location-shopping'

interface ProductSearchPanelProps {
  query: string
  selectedProduct: ProductSuggestion | null
  suggestions: ProductSuggestion[]
  loading: boolean
  errorMessage: string | null
  onQueryChange: (value: string) => void
  onSelect: (product: ProductSuggestion) => void
}

export function ProductSearchPanel(props: ProductSearchPanelProps) {
  const { query, selectedProduct, suggestions, loading, errorMessage, onQueryChange, onSelect } = props

  return (
    <section className="panel card-surface">
      <div className="panel-headline">
        <p className="eyebrow">Producto</p>
        <h2>Busca un producto real de tu base de datos</h2>
      </div>

      <div className="search-box">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Ej. yogur natural, tomate frito, pechuga de pollo..."
        />
      </div>

      {loading ? <p className="muted">Buscando productos...</p> : null}
      {errorMessage ? <p className="warning-text">{errorMessage}</p> : null}

      {query.trim().length >= 2 && !loading && suggestions.length === 0 ? (
        <p className="muted">No hay coincidencias para ese texto.</p>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="suggestion-list">
          {suggestions.map((item) => (
            <button key={item.id} type="button" className="suggestion-item" onClick={() => onSelect(item)}>
              <span>{item.name}</span>
              <small>{item.brand} · {item.category}</small>
            </button>
          ))}
        </div>
      ) : null}

      {selectedProduct ? (
        <div className="selected-product">
          <strong>{selectedProduct.name}</strong>
          <p>{selectedProduct.brand} · {selectedProduct.category} · {selectedProduct.reference_amount}{selectedProduct.reference_unit}</p>
        </div>
      ) : null}
    </section>
  )
}

