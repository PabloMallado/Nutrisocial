import type { LocationPermissionState } from '../types/location-shopping'

interface LocationPanelProps {
  permission: LocationPermissionState
  label: string
  errorMessage: string | null
  onRequestLocation: () => void
}

export function LocationPanel(props: LocationPanelProps) {
  const { permission, label, errorMessage, onRequestLocation } = props

  return (
    <section className="panel card-surface">
      <div className="panel-headline">
        <p className="eyebrow">Tu posicion</p>
        <h2>Geolocalizacion activa</h2>
      </div>

      <p className="muted">Usamos tu ubicacion actual solo para calcular tiendas cercanas en esta sesion.</p>

      <div className="status-pill-row">
        <span className={`status-pill status-${permission}`}>{permissionLabel(permission)}</span>
        <button className="primary-btn" onClick={onRequestLocation} type="button" disabled={permission === 'loading'}>
          {permission === 'loading' ? 'Obteniendo ubicacion...' : 'Usar mi ubicacion actual'}
        </button>
      </div>

      <p className="location-caption">{label}</p>
      {errorMessage ? <p className="warning-text">{errorMessage}</p> : null}
    </section>
  )
}

function permissionLabel(permission: LocationPermissionState): string {
  switch (permission) {
    case 'granted':
      return 'Permiso concedido'
    case 'denied':
      return 'Permiso denegado'
    case 'loading':
      return 'Solicitando permiso'
    case 'unsupported':
      return 'No compatible'
    case 'error':
      return 'Error de geolocalizacion'
    default:
      return 'Pendiente'
  }
}

