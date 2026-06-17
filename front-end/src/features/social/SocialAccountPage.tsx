import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { PostCard } from './components/PostCard'
import type { AccountSection, SocialComment, SocialPost, SocialUser } from './types'

type SocialAccountPageProps = {
  currentUser: SocialUser
  accountSection: AccountSection
  savedPosts: SocialPost[]
  commentsByPostId: Record<string, SocialComment[]>
  likeCountsByPostId: Record<string, number>
  usersById: Record<string, SocialUser>
  savedRecipeIds: Set<string>
  likedPostIds: Set<string>
  isDarkMode: boolean
  onOpenProfile: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
  onToggleLike: (postId: string) => void
  onToggleSaveRecipe: (recipeId: string) => void
  onAddIngredientsToList: (ingredients: SocialPost['recipe']['ingredients']) => void
  onSelectAccountSection: (section: AccountSection) => void
  onToggleDarkMode: (enabled: boolean) => void
  onChangeAvatar: (avatarUrl: string) => void
}

const sectionMeta: Record<AccountSection, { title: string; description: string }> = {
  overview: {
    title: 'Mi espacio',
    description: 'Accede a tu perfil, revisa tu actividad social y entra a los apartados clave de la cuenta.',
  },
  saved: {
    title: 'Publicaciones guardadas',
    description: 'Aqui tienes recetas e ideas que has marcado para volver a ver con calma.',
  },
  settings: {
    title: 'Ajustes',
    description: 'Controla privacidad, notificaciones y la informacion visible en tu perfil.',
  },
  preferences: {
    title: 'Configuracion',
    description: 'Administra idioma, apariencia y preferencias generales de la experiencia.',
  },
}

const accountNav: Array<{ id: AccountSection; label: string }> = [
  { id: 'overview', label: 'Mi espacio' },
  { id: 'saved', label: 'Guardadas' },
  { id: 'settings', label: 'Ajustes' },
  { id: 'preferences', label: 'Configuracion' },
]

type SettingsModal = 'profile' | 'privacy' | 'notifications' | null

export function SocialAccountPage({
  currentUser,
  accountSection,
  savedPosts,
  commentsByPostId,
  likeCountsByPostId,
  usersById,
  savedRecipeIds,
  likedPostIds,
  isDarkMode,
  onOpenProfile,
  onAddComment,
  onToggleLike,
  onToggleSaveRecipe,
  onAddIngredientsToList,
  onSelectAccountSection,
  onToggleDarkMode,
  onChangeAvatar,
}: SocialAccountPageProps) {
  const activeMeta = sectionMeta[accountSection]
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [settingsModal, setSettingsModal] = useState<SettingsModal>(null)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [profileDraft, setProfileDraft] = useState({
    displayName: currentUser.displayName,
    username: currentUser.username,
    bio: currentUser.bio,
  })
  const [privacyDraft, setPrivacyDraft] = useState({
    publicRecipes: true,
    allowMessages: false,
    showActivity: true,
  })
  const [notificationDraft, setNotificationDraft] = useState({
    comments: true,
    followers: true,
    recipes: false,
  })

  function openSettingsModal(modal: Exclude<SettingsModal, null>) {
    setSettingsMessage(null)
    setSettingsModal(modal)
  }

  function closeSettingsModal() {
    setSettingsModal(null)
  }

  function saveSettings(message: string) {
    setSettingsMessage(message)
    setSettingsModal(null)
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChangeAvatar(reader.result)
        setSettingsMessage('Foto de perfil actualizada para esta sesion.')
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <section className="social-account-page">
      <header className="social-account-page-header">
        <div className="social-account-page-top">
          <div className="social-account-avatar-editor">
            <button
              type="button"
              className="social-avatar-edit-button"
              aria-label="Cambiar foto de perfil"
              onClick={() => avatarInputRef.current?.click()}
            >
              <img
                className="social-avatar social-avatar-xl"
                src={currentUser.avatarUrl}
                alt={`Avatar de ${currentUser.displayName}`}
              />
              <span className="social-avatar-edit-overlay" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M4 20h4.7L19.9 8.8a2.2 2.2 0 0 0 0-3.1l-1.6-1.6a2.2 2.2 0 0 0-3.1 0L4 15.3V20Zm2-2v-1.9l8.7-8.7 1.9 1.9L7.9 18H6Zm10-12 1-1a.3.3 0 0 1 .4 0L19 6.6a.3.3 0 0 1 0 .4l-1 1L16 6Z" />
                </svg>
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="social-avatar-file-input"
              aria-label="Seleccionar nueva foto de perfil"
              tabIndex={-1}
              onChange={handleAvatarFileChange}
            />
          </div>
          <div className="social-account-page-copy">
            <p className="social-post-kicker">Centro de cuenta</p>
            <h2>{currentUser.displayName}</h2>
            <p className="social-profile-username">@{currentUser.username}</p>
            <p>{activeMeta.description}</p>
          </div>
        </div>

        <div className="social-account-page-nav" role="tablist" aria-label="Apartados de cuenta">
          {accountNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`social-account-page-tab ${accountSection === item.id ? 'is-active' : ''}`}
              onClick={() => onSelectAccountSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {accountSection === 'overview' ? (
        <div className="social-account-overview-grid">
          <section className="social-account-panel">
            <h3>Atajos</h3>
            <div className="social-account-shortcuts">
              <button type="button" className="social-account-shortcut" onClick={() => onOpenProfile(currentUser.id)}>
                <strong>Ver mi perfil</strong>
                <span>Abre tu vista publica dentro del feed social.</span>
              </button>
              <button type="button" className="social-account-shortcut" onClick={() => onSelectAccountSection('saved')}>
                <strong>Ir a guardadas</strong>
                <span>Recupera recetas que quieres cocinar luego.</span>
              </button>
              <button type="button" className="social-account-shortcut" onClick={() => onSelectAccountSection('settings')}>
                <strong>Editar ajustes</strong>
                <span>Controla perfil, privacidad y notificaciones.</span>
              </button>
            </div>
          </section>

          <section className="social-account-panel">
            <h3>Resumen rapido</h3>
            <div className="social-account-summary">
              <article>
                <strong>{savedPosts.length}</strong>
                <span>guardadas</span>
              </article>
              <article>
                <strong>{currentUser.followersCount}</strong>
                <span>seguidores</span>
              </article>
              <article>
                <strong>{currentUser.followingCount}</strong>
                <span>siguiendo</span>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      {accountSection === 'saved' ? (
        <section className="social-account-section">
          <div className="social-account-section-head">
            <h3>{activeMeta.title}</h3>
            <p>{activeMeta.description}</p>
          </div>

          {savedPosts.length === 0 ? (
            <article className="social-empty-card">
              <h3>Aun no hay publicaciones guardadas</h3>
              <p>Cuando marques recetas interesantes, apareceran aqui.</p>
            </article>
          ) : (
            <div className="social-feed-stack">
              {savedPosts.map((post) => {
                const author = usersById[post.authorId]
                if (!author) {
                  return null
                }

                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    author={author}
                    comments={commentsByPostId[post.id] ?? []}
                    currentUser={currentUser}
                    usersById={usersById}
                    isSaved={savedRecipeIds.has(post.id.replace(/^recipe-/, ''))}
                    isLiked={likedPostIds.has(post.id)}
                    likesCount={likeCountsByPostId[post.id] ?? 0}
                    onOpenProfile={onOpenProfile}
                    onAddComment={onAddComment}
                    onToggleLike={onToggleLike}
                    onToggleSaveRecipe={() => onToggleSaveRecipe(post.id.replace(/^recipe-/, ''))}
                    onAddIngredientsToList={onAddIngredientsToList}
                  />
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {accountSection === 'settings' ? (
        <section className="social-account-section">
          <div className="social-account-section-head">
            <h3>{activeMeta.title}</h3>
            <p>{activeMeta.description}</p>
          </div>

          <div className="social-account-settings-grid">
            <article className="social-account-setting-card">
              <strong>Perfil publico</strong>
              <p>Nombre, foto y bio visibles para la comunidad.</p>
              <button type="button" onClick={() => openSettingsModal('profile')}>Editar perfil</button>
            </article>
            <article className="social-account-setting-card">
              <strong>Privacidad</strong>
              <p>Decide quien puede ver tus recetas y escribirte.</p>
              <button type="button" onClick={() => openSettingsModal('privacy')}>Gestionar privacidad</button>
            </article>
            <article className="social-account-setting-card">
              <strong>Notificaciones</strong>
              <p>Controla avisos de comentarios, seguidores y recetas nuevas.</p>
              <button type="button" onClick={() => openSettingsModal('notifications')}>Configurar avisos</button>
            </article>
          </div>
          {settingsMessage ? <p className="social-settings-message">{settingsMessage}</p> : null}
        </section>
      ) : null}

      {accountSection === 'preferences' ? (
        <section className="social-account-section">
          <div className="social-account-section-head">
            <h3>{activeMeta.title}</h3>
            <p>{activeMeta.description}</p>
          </div>

          <div className="social-account-preferences">
            <article className="social-account-preference-row">
              <div>
                <strong>Apariencia</strong>
                <p>{isDarkMode ? 'Modo oscuro activo en toda la aplicacion.' : 'Modo claro activo en toda la aplicacion.'}</p>
              </div>
              <label className="theme-switch">
                <input
                  type="checkbox"
                  checked={isDarkMode}
                  onChange={(event) => onToggleDarkMode(event.target.checked)}
                  aria-label="Activar modo oscuro"
                />
                <span className="theme-switch-track" aria-hidden="true">
                  <span className="theme-switch-thumb" />
                </span>
                <span className="theme-switch-label">{isDarkMode ? 'Oscuro' : 'Claro'}</span>
              </label>
            </article>
            <article className="social-account-preference-row">
              <div>
                <strong>Idioma y formato</strong>
                <p>Fechas, unidades y textos segun tus preferencias.</p>
              </div>
              <span>Editar</span>
            </article>
            <article className="social-account-preference-row">
              <div>
                <strong>Cuenta y seguridad</strong>
                <p>Accesos, sesiones y opciones generales de la cuenta.</p>
              </div>
              <span>Revisar</span>
            </article>
          </div>
        </section>
      ) : null}

      {settingsModal ? (
        <div className="social-settings-modal-backdrop" role="presentation" onClick={closeSettingsModal}>
          <section
            className="social-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="social-settings-modal-head">
              <div>
                <p className="social-post-kicker">Ajustes</p>
                <h3 id="settings-modal-title">
                  {settingsModal === 'profile'
                    ? 'Editar perfil publico'
                    : settingsModal === 'privacy'
                      ? 'Gestionar privacidad'
                      : 'Configurar avisos'}
                </h3>
              </div>
              <button type="button" className="social-settings-modal-close" aria-label="Cerrar" onClick={closeSettingsModal}>×</button>
            </div>

            {settingsModal === 'profile' ? (
              <form className="social-settings-form" onSubmit={(event) => {
                event.preventDefault()
                saveSettings('Cambios de perfil guardados para esta sesion.')
              }}>
                <label>
                  Nombre visible
                  <input value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))} />
                </label>
                <label>
                  Usuario
                  <input value={profileDraft.username} onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))} />
                </label>
                <label>
                  Bio
                  <textarea rows={4} value={profileDraft.bio} onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))} />
                </label>
                <div className="social-settings-modal-actions">
                  <button type="button" onClick={closeSettingsModal}>Cancelar</button>
                  <button type="submit">Guardar</button>
                </div>
              </form>
            ) : null}

            {settingsModal === 'privacy' ? (
              <form className="social-settings-form" onSubmit={(event) => {
                event.preventDefault()
                saveSettings('Preferencias de privacidad actualizadas.')
              }}>
                <label className="social-settings-toggle">
                  <span>
                    <strong>Recetas publicas</strong>
                    <small>Permite que otros perfiles vean tus recetas guardadas.</small>
                  </span>
                  <input type="checkbox" checked={privacyDraft.publicRecipes} onChange={(event) => setPrivacyDraft((current) => ({ ...current, publicRecipes: event.target.checked }))} />
                </label>
                <label className="social-settings-toggle">
                  <span>
                    <strong>Mensajes directos</strong>
                    <small>Autoriza que otros usuarios puedan escribirte.</small>
                  </span>
                  <input type="checkbox" checked={privacyDraft.allowMessages} onChange={(event) => setPrivacyDraft((current) => ({ ...current, allowMessages: event.target.checked }))} />
                </label>
                <label className="social-settings-toggle">
                  <span>
                    <strong>Mostrar actividad</strong>
                    <small>Enseña comentarios y recetas guardadas recientes.</small>
                  </span>
                  <input type="checkbox" checked={privacyDraft.showActivity} onChange={(event) => setPrivacyDraft((current) => ({ ...current, showActivity: event.target.checked }))} />
                </label>
                <div className="social-settings-modal-actions">
                  <button type="button" onClick={closeSettingsModal}>Cancelar</button>
                  <button type="submit">Guardar</button>
                </div>
              </form>
            ) : null}

            {settingsModal === 'notifications' ? (
              <form className="social-settings-form" onSubmit={(event) => {
                event.preventDefault()
                saveSettings('Avisos configurados correctamente.')
              }}>
                <label className="social-settings-toggle">
                  <span>
                    <strong>Comentarios</strong>
                    <small>Avisar cuando alguien comente una receta.</small>
                  </span>
                  <input type="checkbox" checked={notificationDraft.comments} onChange={(event) => setNotificationDraft((current) => ({ ...current, comments: event.target.checked }))} />
                </label>
                <label className="social-settings-toggle">
                  <span>
                    <strong>Seguidores</strong>
                    <small>Avisar cuando un perfil empiece a seguirte.</small>
                  </span>
                  <input type="checkbox" checked={notificationDraft.followers} onChange={(event) => setNotificationDraft((current) => ({ ...current, followers: event.target.checked }))} />
                </label>
                <label className="social-settings-toggle">
                  <span>
                    <strong>Recetas nuevas</strong>
                    <small>Recibir avisos de recetas publicadas en el feed.</small>
                  </span>
                  <input type="checkbox" checked={notificationDraft.recipes} onChange={(event) => setNotificationDraft((current) => ({ ...current, recipes: event.target.checked }))} />
                </label>
                <div className="social-settings-modal-actions">
                  <button type="button" onClick={closeSettingsModal}>Cancelar</button>
                  <button type="submit">Guardar</button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  )
}
