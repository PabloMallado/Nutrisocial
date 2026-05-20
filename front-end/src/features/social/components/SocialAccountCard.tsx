import { useEffect, useRef, useState } from 'react'
import type { AccountSection, SocialUser } from '../types'

type SocialAccountCardProps = {
  currentUser: SocialUser
  onOpenAccountSection: (section: AccountSection) => void
  onLogout: () => void
}

const accountLinks: Array<{ id: AccountSection; label: string; description: string }> = [
  { id: 'overview', label: 'Mi espacio', description: 'Resumen de tu actividad y acceso rapido.' },
  { id: 'saved', label: 'Guardadas', description: 'Recetas y publicaciones que quieres revisar luego.' },
  { id: 'settings', label: 'Ajustes', description: 'Perfil, privacidad y notificaciones.' },
  { id: 'preferences', label: 'Configuracion', description: 'Preferencias generales de la app y la cuenta.' },
]

export function SocialAccountCard({
  currentUser,
  onOpenAccountSection,
  onLogout,
}: SocialAccountCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function handleOpenAccount(section: AccountSection) {
    setIsOpen(false)
    onOpenAccountSection(section)
  }

  return (
    <section className={`social-account-card ${isOpen ? 'is-open' : ''}`} ref={menuRef}>
      <button
        type="button"
        className="social-account-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <img
          className="social-avatar"
          src={currentUser.avatarUrl}
          alt={`Avatar de ${currentUser.displayName}`}
        />
        <div className="social-account-trigger-copy">
          <strong>{currentUser.displayName}</strong>
          <p>@{currentUser.username}</p>
        </div>
      </button>

      {isOpen ? (
        <div className="social-account-menu" role="menu" aria-label="Menu de cuenta">
          <div className="social-account-links">
            {accountLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                className="social-account-link"
                onClick={() => handleOpenAccount(link.id)}
                role="menuitem"
              >
                <strong>{link.label}</strong>
              </button>
            ))}
            <button
              type="button"
              className="social-account-link social-account-logout"
              onClick={() => {
                setIsOpen(false)
                onLogout()
              }}
              role="menuitem"
            >
              <strong>Cerrar sesión</strong>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
