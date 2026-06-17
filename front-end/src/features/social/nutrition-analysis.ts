import type { SocialRecipe } from './types'

export type RecipeHealthAnalysis = {
  score: number
  level: string
  summary: string
  tags: string[]
  highlights: string[]
  warnings: string[]
  suggestions: string[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getMacroPercentages(recipe: SocialRecipe) {
  const proteinCalories = recipe.protein * 4
  const carbCalories = recipe.carbs * 4
  const fatCalories = recipe.fat * 9
  const macroCalories = proteinCalories + carbCalories + fatCalories
  const baseCalories = macroCalories > 0 ? macroCalories : recipe.calories

  return {
    protein: baseCalories > 0 ? Math.round((proteinCalories / baseCalories) * 100) : 0,
    carbs: baseCalories > 0 ? Math.round((carbCalories / baseCalories) * 100) : 0,
    fat: baseCalories > 0 ? Math.round((fatCalories / baseCalories) * 100) : 0,
  }
}

export function analyzeRecipeHealth(recipe: SocialRecipe): RecipeHealthAnalysis {
  const macroPercentages = getMacroPercentages(recipe)
  const tags: string[] = []
  const highlights: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  let score = 70

  if (recipe.protein >= 30) {
    score += 12
    tags.push('Alta en proteina')
    highlights.push(`Muy buen aporte proteico: ${recipe.protein} g, interesante para saciedad y recuperacion muscular.`)
  } else if (recipe.protein >= 18) {
    score += 7
    tags.push('Buena proteina')
    highlights.push(`Buen nivel de proteina: ${recipe.protein} g, suficiente para una comida completa.`)
  } else {
    score -= 8
    tags.push('Baja en proteina')
    suggestions.push('Podria mejorar anadiendo huevo, yogur griego, legumbres, tofu, pescado, pollo o queso fresco.')
  }

  if (recipe.carbs >= 45) {
    score += 8
    tags.push('Rendimiento deportivo')
    highlights.push(`Tiene ${recipe.carbs} g de carbohidratos, util para entrenamientos, recuperacion o dias activos.`)
  } else if (recipe.carbs < 20 && recipe.calories < 450) {
    tags.push('Ligera en carbohidratos')
    suggestions.push('Si la tomas antes o despues de entrenar, anade arroz, patata, avena, fruta o pan integral.')
  }

  if (recipe.fat >= 30 || macroPercentages.fat >= 45) {
    score -= 16
    tags.push('Grasa alta')
    tags.push('Puede resultar pesada')
    warnings.push(`La grasa es alta (${recipe.fat} g, aprox. ${macroPercentages.fat}% de la energia), asi que puede ser mas indigesta si se toma antes de entrenar o por la noche.`)
    suggestions.push('Para hacerla mas ligera, reduce aceite, aguacate, frutos secos, quesos grasos o salsas.')
  } else if (recipe.fat >= 18) {
    score -= 4
    highlights.push(`Tiene una cantidad moderada de grasa (${recipe.fat} g), bien si procede de aceite de oliva, semillas, pescado azul o aguacate.`)
  } else {
    score += 4
    tags.push('Ligera')
  }

  if (recipe.calories > 650) {
    score -= 12
    tags.push('Muy calorica')
    warnings.push(`Es una receta energetica (${recipe.calories} kcal). Puede encajar como comida principal, pero quiza sea excesiva como cena ligera.`)
  } else if (recipe.calories >= 350 && recipe.calories <= 600) {
    score += 6
    highlights.push(`Calorias equilibradas para una comida principal: ${recipe.calories} kcal.`)
  } else if (recipe.calories < 300) {
    warnings.push(`Es baja en calorias (${recipe.calories} kcal). Puede quedarse corta si necesitas una comida completa.`)
  }

  if (macroPercentages.protein >= 20 && macroPercentages.carbs >= 30 && macroPercentages.fat <= 35) {
    score += 8
    tags.push('Bien equilibrada')
    highlights.push('El reparto entre proteina, carbohidratos y grasas esta bastante compensado.')
  }

  if (recipe.ingredients.some((ingredient) => /verdura|brocoli|pepino|canonigos|tomate|fruta|judias|pimiento/i.test(ingredient.name))) {
    score += 5
    tags.push('Con vegetales')
    highlights.push('Incluye vegetales o fruta, buena senal para fibra, micronutrientes y saciedad.')
  } else {
    tags.push('Poca fibra')
    suggestions.push('Anadir verdura o fruta ayudaria a mejorar fibra, volumen y micronutrientes.')
  }

  const finalScore = clamp(score, 0, 100)
  const level =
    finalScore >= 85 ? 'Muy saludable' :
    finalScore >= 70 ? 'Bastante saludable' :
    finalScore >= 50 ? 'Mejorable' :
    'Poco equilibrada'

  const summary =
    finalScore >= 85 ? 'Receta muy completa: buen perfil de macros y buena eleccion para una comida cuidada.' :
    finalScore >= 70 ? 'Receta bastante bien planteada, con algun detalle ajustable segun tu objetivo.' :
    finalScore >= 50 ? 'Tiene puntos positivos, pero conviene ajustar cantidades o acompanamientos.' :
    'Es una receta que puede encajar puntualmente, aunque nutricionalmente queda descompensada.'

  return {
    score: finalScore,
    level,
    summary,
    tags: Array.from(new Set(tags)),
    highlights,
    warnings,
    suggestions,
  }
}
