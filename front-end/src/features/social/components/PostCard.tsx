import { formatRelativeDate } from '../time'
import type { SocialPost, SocialUser } from '../types'

type PostCardProps = {
  post: SocialPost
  author: SocialUser
  onOpenProfile: (userId: string) => void
}

export function PostCard({ post, author, onOpenProfile }: PostCardProps) {
  return (
    <article className="social-post-card">
      <button
        type="button"
        className="social-author-row"
        onClick={() => onOpenProfile(author.id)}
      >
        <img className="social-avatar" src={author.avatarUrl} alt={`Avatar de ${author.displayName}`} />
        <div>
          <strong>{author.displayName}</strong>
          <p>@{author.username}</p>
        </div>
      </button>

      <div className="social-post-media-wrap">
        <img className="social-post-media" src={post.imageUrl} alt={post.caption} loading="lazy" />
      </div>

      <div className="social-post-body">
        <p>{post.caption}</p>
        <div className="social-post-meta">
          <span>{formatRelativeDate(post.createdAt)}</span>
          <span>{post.likesCount} me gusta</span>
          <span>{post.interactionsCount} interacciones</span>
        </div>
      </div>

      <div className="social-post-actions" aria-hidden>
        <button type="button">Me gusta</button>
        <button type="button">Comentar</button>
        <button type="button">Guardar</button>
      </div>
    </article>
  )
}
