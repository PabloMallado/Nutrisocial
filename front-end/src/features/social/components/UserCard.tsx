import { FollowButton } from './FollowButton'
import type { SocialUser } from '../types'

type UserCardProps = {
  user: SocialUser
  isFollowing: boolean
  onOpenProfile: (userId: string) => void
  onFollow: (userId: string) => void
}

export function UserCard({
  user,
  isFollowing,
  onOpenProfile,
  onFollow,
}: UserCardProps) {
  return (
    <article className="social-user-card">
      <button type="button" className="social-user-card-head" onClick={() => onOpenProfile(user.id)}>
        <img className="social-avatar" src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} />
        <div className="social-user-card-copy">
          <strong>{user.displayName}</strong>
          <p>@{user.username}</p>
        </div>
      </button>

      <div className="social-user-card-actions">
        <FollowButton isFollowing={isFollowing} onClick={() => onFollow(user.id)} />
      </div>
    </article>
  )
}
