import type { SocialUser } from '../types'

type FollowingListProps = {
  currentUserName: string
  followingUsers: SocialUser[]
  onOpenProfile: (userId: string) => void
}

export function FollowingList({
  currentUserName,
  followingUsers,
  onOpenProfile,
}: FollowingListProps) {
  return (
    <section className="social-following-card">
      <header>
        <h3>Siguiendo</h3>
        <p>Lista derivada de las acciones de @{currentUserName}</p>
      </header>

      {followingUsers.length === 0 ? (
        <p className="social-empty-text">
          Aun no sigues a nadie. Empieza desde el feed o un perfil.
        </p>
      ) : (
        <ul className="social-following-list">
          {followingUsers.map((user) => (
            <li key={user.id}>
              <button type="button" onClick={() => onOpenProfile(user.id)}>
                <img src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} />
                <div>
                  <strong>{user.displayName}</strong>
                  <span>@{user.username}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
