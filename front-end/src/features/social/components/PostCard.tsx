import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { RecipeHealthPanel } from './RecipeHealthPanel'
import { getRecipeNutritionGoal } from '../nutrition-analysis'
import { formatRelativeDate } from '../time'
import { apiRequest } from '../../../services/http'
import type { SocialComment, SocialPost, SocialRecipeIngredient, SocialUser } from '../types'

type RecipeDetailResponse = {
  prep_time: number
  servings: number
  difficulty: string
  calories_total: number | string
  protein_total: number | string
  carbs_total: number | string
  fat_total: number | string
  ingredients: Array<{
    product_id: number | string
    name: string
    quantity: number | string
    unit: string | null
  }>
}

type PostCardProps = {
  post: SocialPost
  author: SocialUser
  comments: SocialComment[]
  currentUser: SocialUser
  usersById: Record<string, SocialUser>
  isSaved: boolean
  isLiked: boolean
  likesCount: number
  onOpenProfile: (userId: string) => void
  onAddComment: (postId: string, message: string) => void
  onToggleLike: (postId: string) => void
  onToggleSaveRecipe: () => void
  onAddIngredientsToList: (ingredients: SocialRecipeIngredient[]) => void
}

export function PostCard({
  post,
  author,
  comments,
  currentUser,
  usersById,
  isSaved,
  isLiked,
  likesCount,
  onOpenProfile,
  onAddComment,
  onToggleLike,
  onToggleSaveRecipe,
  onAddIngredientsToList,
}: PostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showHealthAnalysis, setShowHealthAnalysis] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetailResponse | null>(null)
  const [recipeDetailError, setRecipeDetailError] = useState<string | null>(null)
  const visibleLikesCount = post.likesCount + likesCount
  const isOwnPost = author.id === currentUser.id
  const recipeId = post.id.replace(/^recipe-/, '')
  const displayedRecipe = recipeDetail
    ? {
        ...post.recipe,
        difficulty: recipeDetail.difficulty,
        prepTimeMinutes: Number(recipeDetail.prep_time ?? post.recipe.prepTimeMinutes),
        servings: Number(recipeDetail.servings ?? post.recipe.servings),
        calories: Math.round(Number(recipeDetail.calories_total ?? post.recipe.calories)),
        protein: Number(Number(recipeDetail.protein_total ?? post.recipe.protein).toFixed(1)),
        carbs: Number(Number(recipeDetail.carbs_total ?? post.recipe.carbs).toFixed(1)),
        fat: Number(Number(recipeDetail.fat_total ?? post.recipe.fat).toFixed(1)),
        ingredients: recipeDetail.ingredients.map((ingredient) => ({
          productId: String(ingredient.product_id),
          name: ingredient.name,
          amount: `${Number(ingredient.quantity ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${ingredient.unit || 'unidad'}`,
        })),
      }
    : post.recipe
  const ingredientProductIds = displayedRecipe.ingredients
    .map((ingredient) => ingredient.productId)
    .filter((productId): productId is string => Boolean(productId))
  const nutritionGoal = getRecipeNutritionGoal(displayedRecipe)

  useEffect(() => {
    if (!isExpanded || post.recipe.ingredients.length > 0 || recipeDetail || recipeDetailError) {
      return
    }

    let isCancelled = false
    apiRequest<RecipeDetailResponse>(`/api/recipes/${recipeId}`)
      .then((detail) => {
        if (!isCancelled) {
          setRecipeDetail(detail)
        }
      })
      .catch((error: Error) => {
        if (!isCancelled) {
          setRecipeDetailError(error.message)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isExpanded, post.recipe.ingredients.length, recipeDetail, recipeDetailError, recipeId])

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

        <div className="social-post-top-actions">
          {!isOwnPost ? (
            <button
            type="button"
            className={`social-save-btn ${isSaved ? 'is-saved' : ''}`}
            aria-label={isSaved ? 'Quitar receta guardada' : 'Guardar receta'}
            title={isSaved ? 'Quitar receta guardada' : 'Guardar receta'}
            onClick={onToggleSaveRecipe}
          >
            <span aria-hidden="true">{isSaved ? '★' : '☆'}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="social-expand-btn"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? 'Ocultar detalle' : 'Abrir publicación'}
          </button>
        </div>
      </div>

      <div className="social-post-media-wrap">
        <img className="social-post-media" src={post.imageUrl} alt={post.caption} loading="lazy" />
      </div>

      <div className="social-post-body">
        <div className="social-post-copy">
          <p className="social-post-kicker">Receta compartida</p>
          <h3>{post.title}</h3>
          <p>{post.caption}</p>
          <span className={`social-purpose-pill is-${nutritionGoal.id}`}>{nutritionGoal.label}</span>
        </div>

        <div className="social-post-meta">
          <span>{formatRelativeDate(post.createdAt)}</span>
          <span>{visibleLikesCount} me gusta</span>
          <span>{comments.length} comentarios</span>
          <span>{displayedRecipe.calories} kcal</span>
        </div>
      </div>

      <div className="social-post-actions">
        <button
          type="button"
          className={isLiked ? 'is-liked' : ''}
          aria-pressed={isLiked}
          onClick={() => onToggleLike(post.id)}
        >
          {isLiked ? 'Te gusta' : 'Me gusta'}
        </button>
        <button type="button" onClick={() => setIsExpanded(true)}>Comentar</button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(true)
            setShowHealthAnalysis((current) => !current)
          }}
        >
          {showHealthAnalysis ? 'Ocultar salud' : 'Comprobar salud'}
        </button>
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
                <h4>{displayedRecipe.title}</h4>
                <p className="social-recipe-subtitle">
                  {displayedRecipe.description}
                </p>
              </div>
              <span className="social-recipe-pill">{displayedRecipe.difficulty}</span>
            </div>

            <div className="social-recipe-stats">
              <article>
                <strong>{displayedRecipe.servings}</strong>
                <span>raciones</span>
              </article>
              <article>
                <strong>{displayedRecipe.prepTimeMinutes} min</strong>
                <span>preparación</span>
              </article>
              <article>
                <strong>{displayedRecipe.protein} g</strong>
                <span>proteína</span>
              </article>
              <article>
                <strong>{displayedRecipe.carbs} g</strong>
                <span>carbohidratos</span>
              </article>
              <article>
                <strong>{displayedRecipe.fat} g</strong>
                <span>grasas</span>
              </article>
            </div>

            {showHealthAnalysis ? (
              <RecipeHealthPanel recipe={displayedRecipe} sourceId={post.id} />
            ) : null}

            <div className="social-recipe-grid">
              <div className="social-recipe-block">
                <h5>Ingredientes</h5>
                <ul className="social-recipe-list">
                  {displayedRecipe.ingredients.map((ingredient) => (
                    <li key={`${post.id}-${ingredient.name}`}>
                      <span>{ingredient.name}</span>
                      <strong>{ingredient.amount}</strong>
                    </li>
                  ))}
                </ul>
                {displayedRecipe.ingredients.length === 0 ? (
                  <p className="social-recipe-empty-text">
                    {recipeDetailError ?? 'Cargando ingredientes...'}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="social-recipe-add-products"
                  onClick={() => onAddIngredientsToList(displayedRecipe.ingredients)}
                  disabled={ingredientProductIds.length === 0}
                >
                  Añadir productos
                </button>
              </div>

              <div className="social-recipe-block">
                <h5>Preparación</h5>
                <ol className="social-recipe-steps">
                  {displayedRecipe.steps.map((step) => (
                    <li key={`${post.id}-${step}`}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="social-comments-panel">
            <div className="social-comments-head">
              <div>
                <p className="social-post-kicker">Conversación</p>
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
                  <p>Todavía no hay preguntas en esta publicación. Puedes abrir la conversación.</p>
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
