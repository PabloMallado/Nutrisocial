import { PostCard } from './components/PostCard'
import { FollowButton } from './components/FollowButton'
import { FriendRequestButton } from './components/FriendRequestButton'
import type { SocialComment, SocialPost, SocialUser } from './types'

type SocialProfilePageProps = {
  user: SocialUser
  posts: SocialPost[]
  commentsByPostId: Record<string, SocialComment[]>
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  isFollowing: boolean
  hasRequest: boolean
  onOpenProfile: (userId: string) => void
  onFollowUser: (userId: string) => void
  onSendFriendRequest: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
}

export function SocialProfilePage({
  user,
  posts,
  commentsByPostId,
  currentUser,
  usersById,
  isFollowing,
  hasRequest,
  onOpenProfile,
  onFollowUser,
  onSendFriendRequest,
  onAddComment,
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
        <div className="social-feed-stack">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={user}
              comments={commentsByPostId[post.id] ?? []}
              currentUser={currentUser}
              usersById={usersById}
              onOpenProfile={onOpenProfile}
              onAddComment={onAddComment}
            />
          ))}
        </div>
      </section>
    </section>
  )
}
