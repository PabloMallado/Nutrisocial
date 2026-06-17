import { PostCard } from './components/PostCard'
import { FollowButton } from './components/FollowButton'
import { FriendRequestButton } from './components/FriendRequestButton'
import type { SocialComment, SocialPost, SocialUser } from './types'

type SocialProfilePageProps = {
  user: SocialUser
  posts: SocialPost[]
  commentsByPostId: Record<string, SocialComment[]>
  likeCountsByPostId: Record<string, number>
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  savedRecipeIds: Set<string>
  likedPostIds: Set<string>
  isFollowing: boolean
  hasRequest: boolean
  onOpenProfile: (userId: string) => void
  onFollowUser: (userId: string) => void
  onSendFriendRequest: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
  onToggleLike: (postId: string) => void
  onToggleSaveRecipe: (recipeId: string) => void
  onAddIngredientsToList: (ingredients: SocialPost['recipe']['ingredients']) => void
}

export function SocialProfilePage({
  user,
  posts,
  commentsByPostId,
  likeCountsByPostId,
  currentUser,
  usersById,
  savedRecipeIds,
  likedPostIds,
  isFollowing,
  hasRequest,
  onOpenProfile,
  onFollowUser,
  onSendFriendRequest,
  onAddComment,
  onToggleLike,
  onToggleSaveRecipe,
  onAddIngredientsToList,
}: SocialProfilePageProps) {
  const isOwnProfile = user.id === currentUser.id

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
          {!isOwnProfile ? (
            <div className="social-profile-actions">
              <FollowButton isFollowing={isFollowing} onClick={() => onFollowUser(user.id)} />
              <FriendRequestButton
                hasRequest={hasRequest}
                onClick={() => onSendFriendRequest(user.id)}
              />
            </div>
          ) : null}
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
              isSaved={savedRecipeIds.has(post.id.replace(/^recipe-/, ''))}
              isLiked={likedPostIds.has(post.id)}
              likesCount={likeCountsByPostId[post.id] ?? 0}
              onOpenProfile={onOpenProfile}
              onAddComment={onAddComment}
              onToggleLike={onToggleLike}
              onToggleSaveRecipe={() => onToggleSaveRecipe(post.id.replace(/^recipe-/, ''))}
              onAddIngredientsToList={onAddIngredientsToList}
            />
          ))}
        </div>
      </section>
    </section>
  )
}
