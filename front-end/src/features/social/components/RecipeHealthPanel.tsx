import { analyzeRecipeHealth } from '../nutrition-analysis'
import type { SocialRecipe } from '../types'

type RecipeHealthPanelProps = {
  recipe: SocialRecipe
  sourceId: string
}

const negativeTagPattern = /alta|baja|pesada|excesiva|poca|poco|descompensada|calorica|azucar|grasa/i

export function RecipeHealthPanel({ recipe, sourceId }: RecipeHealthPanelProps) {
  const healthAnalysis = analyzeRecipeHealth(recipe)
  const positiveTags = healthAnalysis.tags.filter((tag) => !negativeTagPattern.test(tag))
  const negativeTags = healthAnalysis.tags.filter((tag) => negativeTagPattern.test(tag))

  return (
    <section className="social-health-panel" aria-label="Analisis nutricional de la receta">
      <div className="social-health-score">
        <strong>{healthAnalysis.score}</strong>
        <span>/100</span>
      </div>

      <div className="social-health-copy">
        <div className="social-health-head">
          <div>
            <p className="social-post-kicker">Nivel de salud</p>
            <h5>{healthAnalysis.level}</h5>
          </div>
          <div className="social-health-tags">
            {positiveTags.map((tag) => (
              <span key={`${sourceId}-${tag}`}>{tag}</span>
            ))}
            {negativeTags.map((tag) => (
              <span className="is-warning" key={`${sourceId}-${tag}`}>{tag}</span>
            ))}
          </div>
        </div>

        <p>{healthAnalysis.summary}</p>
      </div>

      <div className={`social-purpose-card is-${healthAnalysis.goal.id}`}>
        <span>{healthAnalysis.goal.label}</span>
        <strong>{healthAnalysis.goal.title}</strong>
        <p>{healthAnalysis.goal.summary}</p>
      </div>

      <div className="social-health-columns">
        {healthAnalysis.highlights.length > 0 ? (
          <div>
            <h6>Puntos fuertes</h6>
            <ul>
              {healthAnalysis.highlights.map((highlight) => (
                <li key={`${sourceId}-${highlight}`}>{highlight}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {healthAnalysis.warnings.length > 0 ? (
          <div className="is-warning">
            <h6>A tener en cuenta</h6>
            <ul>
              {healthAnalysis.warnings.map((warning) => (
                <li key={`${sourceId}-${warning}`}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {healthAnalysis.suggestions.length > 0 ? (
          <div>
            <h6>Como mejorarla</h6>
            <ul>
              {healthAnalysis.suggestions.map((suggestion) => (
                <li key={`${sourceId}-${suggestion}`}>{suggestion}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
