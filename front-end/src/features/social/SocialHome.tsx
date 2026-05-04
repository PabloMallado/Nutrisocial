import { PostCard } from './components/PostCard'
import type { FeedTab, SocialPost, SocialUser } from './types'
import './social.css'

type SocialHomeProps = {
  feedTab: FeedTab
  posts: SocialPost[]
  usersById: Record<string, SocialUser>
  onOpenProfile: (userId: string) => void
}

export function SocialHome({ feedTab, posts, usersById, onOpenProfile }: SocialHomeProps) {
  return (
    <section className="social-home">
      <section className="social-intro-card">
        <p className="eyebrow">Inicio social</p>
        <h2>{feedTab === 'para-ti' ? 'Feed Para ti' : 'Feed Siguiendo'}</h2>
        <p>
          {feedTab === 'para-ti'
            ? 'Mostrando todas las publicaciones mock de los perfiles disponibles.'
            : 'Mostrando publicaciones de los perfiles que sigues desde estado local.'}
        </p>
      </section>

      <section className="social-feed-stack">
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
              onOpenProfile={onOpenProfile}
            />
          ))
        )}
      </section>
    </section>
  )
}
