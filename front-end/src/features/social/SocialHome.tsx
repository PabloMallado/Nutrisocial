import { PostCard } from './components/PostCard'
import type { FeedTab, SocialComment, SocialPost, SocialUser } from './types'
import './social.css'

type SocialHomeProps = {
  feedTab: FeedTab
  posts: SocialPost[]
  commentsByPostId: Record<string, SocialComment[]>
  likeCountsByPostId: Record<string, number>
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  savedRecipeIds: Set<string>
  likedPostIds: Set<string>
  onOpenProfile: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
  onToggleLike: (postId: string) => void
  onToggleSaveRecipe: (recipeId: string) => void
  onAddIngredientsToList: (ingredients: SocialPost['recipe']['ingredients']) => void
}

export function SocialHome({
  feedTab,
  posts,
  commentsByPostId,
  likeCountsByPostId,
  currentUser,
  usersById,
  savedRecipeIds,
  likedPostIds,
  onOpenProfile,
  onAddComment,
  onToggleLike,
  onToggleSaveRecipe,
  onAddIngredientsToList,
}: SocialHomeProps) {
  return (
    <section className="social-home">
      <section className="social-feed-stack">
        <header className="social-feed-header">
          <p className="eyebrow">Inicio social</p>
          <h2>{feedTab === 'para-ti' ? 'Feed Para ti' : 'Feed Siguiendo'}</h2>
          <p>
            {feedTab === 'para-ti'
              ? 'Publicaciones con receta completa, macros e hilo de dudas para descubrir ideas de la comunidad.'
              : 'Aqui solo ves recetas y conversaciones de los perfiles que ya sigues.'}
          </p>
        </header>

        {posts.length === 0 ? (
          <article className="social-empty-card">
            <h3>{feedTab === 'para-ti' ? 'Aun no hay recetas publicadas' : 'No hay publicaciones en Siguiendo'}</h3>
            <p>
              {feedTab === 'para-ti'
                ? 'Cuando creeis recetas desde la aplicacion, apareceran aqui.'
                : 'Sigue perfiles reales para ver aqui su actividad.'}
            </p>
          </article>
        ) : (
          posts.map((post) => {
            const author = usersById[post.authorId]
            if (!author) return null

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
          })
        )}
      </section>
    </section>
  )
}
