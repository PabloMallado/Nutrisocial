import { PostCard } from './components/PostCard'
import type { FeedTab, SocialComment, SocialPost, SocialUser } from './types'
import './social.css'

type SocialHomeProps = {
  feedTab: FeedTab
  posts: SocialPost[]
  commentsByPostId: Record<string, SocialComment[]>
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  onOpenProfile: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
}

export function SocialHome({
  feedTab,
  posts,
  commentsByPostId,
  currentUser,
  usersById,
  onOpenProfile,
  onAddComment,
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
            <h3>No hay publicaciones en Siguiendo</h3>
            <p>Sigue perfiles para ver aqui su actividad.</p>
          </article>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={usersById[post.authorId]}
              comments={commentsByPostId[post.id] ?? []}
              currentUser={currentUser}
              usersById={usersById}
              onOpenProfile={onOpenProfile}
              onAddComment={onAddComment}
            />
          ))
        )}
      </section>
    </section>
  )
}
