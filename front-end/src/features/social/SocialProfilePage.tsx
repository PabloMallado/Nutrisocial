import { FollowButton } from './components/FollowButton'
import { FriendRequestButton } from './components/FriendRequestButton'
import type { SocialPost, SocialUser } from './types'

type SocialProfilePageProps = {
  user: SocialUser
  posts: SocialPost[]
  isFollowing: boolean
  hasRequest: boolean
  onFollowUser: (userId: string) => void
  onSendFriendRequest: (userId: string) => void
}

export function SocialProfilePage({
  user,
  posts,
  isFollowing,
  hasRequest,
  onFollowUser,
  onSendFriendRequest,
}: SocialProfilePageProps) {
  return (
    <section className="social-profile-page">
      <header className="social-profile-page-header">
        <img className="social-avatar social-avatar-xl" src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} />
        <div className="social-profile-page-copy">
          <h2>{user.displayName}</h2>
          <p className="social-profile-username">@{user.username}</p>
          <p>{user.bio}</p>
          <div className="social-counters">
            <div>
              <strong>{posts.length}</strong>
              <span>Publicaciones</span>
            </div>
            <div>
              <strong>{user.followersCount}</strong>
              <span>Seguidores</span>
            </div>
            <div>
              <strong>{user.followingCount}</strong>
              <span>Siguiendo</span>
            </div>
          </div>
          <div className="social-profile-actions">
            <FollowButton isFollowing={isFollowing} onClick={() => onFollowUser(user.id)} />
            <FriendRequestButton
              hasRequest={hasRequest}
              onClick={() => onSendFriendRequest(user.id)}
            />
          </div>
        </div>
      </header>

      <section className="social-profile-page-posts">
        <h3>Publicaciones</h3>
        <div className="social-profile-posts-grid">
          {posts.map((post) => (
            <article key={post.id} className="social-profile-post-card">
              <img src={post.imageUrl} alt={post.caption} loading="lazy" />
              <p>{post.caption}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
