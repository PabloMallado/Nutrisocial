import { FollowButton } from './FollowButton'
import { FriendRequestButton } from './FriendRequestButton'
import type { SocialUser } from '../types'

type UserCardProps = {
  user: SocialUser
  isFollowing: boolean
  hasRequest: boolean
  onOpenProfile: (userId: string) => void
  onFollow: (userId: string) => void
  onSendFriendRequest: (userId: string) => void
}

export function UserCard({
  user,
  isFollowing,
  hasRequest,
  onOpenProfile,
  onFollow,
  onSendFriendRequest,
}: UserCardProps) {
  return (
    <article className="social-user-card">
      <button type="button" className="social-user-card-head" onClick={() => onOpenProfile(user.id)}>
        <img className="social-avatar" src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} />
        <div>
          <strong>{user.displayName}</strong>
          <p>@{user.username}</p>
          <small>{user.bio}</small>
        </div>
      </button>

      <div className="social-user-card-actions">
        <FollowButton isFollowing={isFollowing} onClick={() => onFollow(user.id)} />
        <FriendRequestButton
          hasRequest={hasRequest}
          onClick={() => onSendFriendRequest(user.id)}
        />
      </div>
    </article>
  )
}
