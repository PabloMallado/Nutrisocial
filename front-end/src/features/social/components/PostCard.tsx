import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatRelativeDate } from '../time'
import type { SocialComment, SocialPost, SocialUser } from '../types'

type PostCardProps = {
  post: SocialPost
  author: SocialUser
  comments: SocialComment[]
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  onOpenProfile: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
}

export function PostCard({
  post,
  author,
  comments,
  currentUser,
  usersById,
  onOpenProfile,
  onAddComment,
}: PostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [draftComment, setDraftComment] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draftComment.trim().length === 0) {
      return
    }

    onAddComment(post.id, draftComment)
    setDraftComment('')
    setIsExpanded(true)
  }

  return (
    <article className={`social-post-card ${isExpanded ? 'is-expanded' : ''}`}>
      <div className="social-post-topline">
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

        <button
          type="button"
          className="social-expand-btn"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? 'Ocultar detalle' : 'Abrir publicacion'}
        </button>
      </div>

      <div className="social-post-media-wrap">
        <img className="social-post-media" src={post.imageUrl} alt={post.caption} loading="lazy" />
      </div>

      <div className="social-post-body">
        <div className="social-post-copy">
          <p className="social-post-kicker">Receta compartida</p>
          <h3>{post.title}</h3>
          <p>{post.caption}</p>
        </div>

        <div className="social-post-meta">
          <span>{formatRelativeDate(post.createdAt)}</span>
          <span>{post.likesCount} me gusta</span>
          <span>{comments.length} comentarios</span>
          <span>{post.recipe.calories} kcal</span>
        </div>
      </div>

      <div className="social-post-actions">
        <button type="button">Me gusta</button>
        <button type="button" onClick={() => setIsExpanded(true)}>Comentar</button>
        <button type="button" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Cerrar hilo' : 'Ver receta'}
        </button>
      </div>

      {isExpanded ? (
        <div className="social-post-detail">
          <section className="social-recipe-panel">
            <div className="social-recipe-head">
              <div>
                <p className="social-post-kicker">Ficha de receta</p>
                <h4>{post.recipe.title}</h4>
                <p className="social-recipe-subtitle">
                  {post.recipe.description}
                </p>
              </div>
              <span className="social-recipe-pill">{post.recipe.difficulty}</span>
            </div>

            <div className="social-recipe-stats">
              <article>
                <strong>{post.recipe.servings}</strong>
                <span>raciones</span>
              </article>
              <article>
                <strong>{post.recipe.prepTimeMinutes} min</strong>
                <span>preparacion</span>
              </article>
              <article>
                <strong>{post.recipe.protein} g</strong>
                <span>proteina</span>
              </article>
              <article>
                <strong>{post.recipe.carbs} g</strong>
                <span>carbohidratos</span>
              </article>
              <article>
                <strong>{post.recipe.fat} g</strong>
                <span>grasas</span>
              </article>
            </div>

            <div className="social-recipe-grid">
              <div className="social-recipe-block">
                <h5>Ingredientes</h5>
                <ul className="social-recipe-list">
                  {post.recipe.ingredients.map((ingredient) => (
                    <li key={`${post.id}-${ingredient.name}`}>
                      <span>{ingredient.name}</span>
                      <strong>{ingredient.amount}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="social-recipe-block">
                <h5>Preparacion</h5>
                <ol className="social-recipe-steps">
                  {post.recipe.steps.map((step) => (
                    <li key={`${post.id}-${step}`}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="social-comments-panel">
            <div className="social-comments-head">
              <div>
                <p className="social-post-kicker">Conversacion</p>
                <h4>Preguntas y comentarios</h4>
                <p className="social-comments-subtitle">
                  Resuelve dudas sobre ingredientes, tiempos o posibles cambios en la receta.
                </p>
              </div>
              <span className="social-comments-count">{comments.length}</span>
            </div>

            <form className="social-comment-form" onSubmit={handleSubmit}>
              <img
                className="social-avatar"
                src={currentUser.avatarUrl}
                alt={`Avatar de ${currentUser.displayName}`}
              />
              <div className="social-comment-form-body">
                <textarea
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  placeholder="Pregunta por ingredientes, tiempos o deja tu comentario..."
                  rows={3}
                />
                <div className="social-comment-form-actions">
                  <span>Se publica en el hilo de esta receta.</span>
                  <button type="submit">Publicar</button>
                </div>
              </div>
            </form>

            <div className="social-comment-list">
              {comments.length === 0 ? (
                <article className="social-comment-card is-empty">
                  <p>Todavia no hay preguntas en esta publicacion. Puedes abrir la conversacion.</p>
                </article>
              ) : null}

              {comments.map((comment) => {
                const commentAuthor = usersById[comment.authorId]
                if (!commentAuthor) {
                  return null
                }

                return (
                  <article key={comment.id} className="social-comment-card">
                    <div className="social-comment-head">
                      <button
                        type="button"
                        className="social-author-row"
                        onClick={() => onOpenProfile(comment.authorId)}
                      >
                        <img
                          className="social-avatar"
                          src={commentAuthor.avatarUrl}
                          alt={`Avatar de ${commentAuthor.displayName}`}
                        />
                        <div>
                          <strong>{commentAuthor.displayName}</strong>
                          <p>@{commentAuthor.username} - {formatRelativeDate(comment.createdAt)}</p>
                        </div>
                      </button>
                    </div>
                    <p>{comment.message}</p>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}
    </article>
  )
}
