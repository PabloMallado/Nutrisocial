import { PostCard } from './components/PostCard'
import type { AccountSection, SocialComment, SocialPost, SocialUser } from './types'

type SocialAccountPageProps = {
  currentUser: SocialUser
  accountSection: AccountSection
  savedPosts: SocialPost[]
  commentsByPostId: Record<string, SocialComment[]>
  usersById: Record<string, SocialUser>
  onOpenProfile: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
  onSelectAccountSection: (section: AccountSection) => void
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

export function SocialAccountPage({
  currentUser,
  accountSection,
  savedPosts,
  commentsByPostId,
  usersById,
  onOpenProfile,
  onAddComment,
  onSelectAccountSection,
}: SocialAccountPageProps) {
  const activeMeta = sectionMeta[accountSection]

  return (
    <section className="social-account-page">
      <header className="social-account-page-header">
        <div className="social-account-page-top">
          <img
            className="social-avatar social-avatar-xl"
            src={currentUser.avatarUrl}
            alt={`Avatar de ${currentUser.displayName}`}
          />
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
                    onOpenProfile={onOpenProfile}
                    onAddComment={onAddComment}
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
              <span>Editar perfil</span>
            </article>
            <article className="social-account-setting-card">
              <strong>Privacidad</strong>
              <p>Decide quien puede ver tus recetas y escribirte.</p>
              <span>Gestionar privacidad</span>
            </article>
            <article className="social-account-setting-card">
              <strong>Notificaciones</strong>
              <p>Controla avisos de comentarios, seguidores y recetas nuevas.</p>
              <span>Configurar avisos</span>
            </article>
          </div>
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
                <p>Modo claro y estilo visual del espacio social.</p>
              </div>
              <span>Personalizar</span>
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
    </section>
  )
}
