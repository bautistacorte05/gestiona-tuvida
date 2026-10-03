// Ritual de la mañana: los pasos y las palabras guía. Config pura (sin React).
// Los `id` se guardan en los datos (RitualDay.steps, UserProfile.ritualPasos): no cambiarlos.

export type RitualStepId = 'agua' | 'agradecer' | 'palabra' | 'importante'

export interface RitualStep {
  id: RitualStepId
  /** Título de la tarjeta del paso. */
  title: string
  /** Aclaración chiquita debajo del título. */
  hint: string
  /** Ícono para el resumen y la lista de "Cambiar los pasos". */
  icon: string
}

export const RITUAL_STEPS: RitualStep[] = [
  { id: 'agua', title: 'Tomá un vaso de agua', hint: 'Antes del café 💧', icon: '💧' },
  { id: 'agradecer', title: 'Agradecé 3 cosas', hint: 'Chiquitas también valen', icon: '🙏' },
  { id: 'palabra', title: 'Tu palabra guía de hoy', hint: 'Te la recuerdo arriba de Hoy', icon: '🧭' },
  { id: 'importante', title: 'Lo más importante de hoy', hint: 'Se agrega primera en tus tareas', icon: '⭐' },
]

/** Palabras guía para elegir con un toque (además, "Otra" deja escribir una propia). */
export const RITUAL_WORDS = ['Foco', 'Calma', 'Paciencia', 'Coraje', 'Alegría', 'Orden']

/** Cuántas cosas se pueden agradecer. */
export const GRATITUDE_COUNT = 3

/** Ejemplos (placeholders) de cada renglón de "Agradecé 3 cosas". */
export const GRATITUDE_PLACEHOLDERS = ['Ej: dormí bien', 'Ej: el mate de la mañana', 'Una más…']

/** Lo que tarda, aproximadamente (se muestra arriba y en el cartel de Hoy). */
export const RITUAL_MINUTES = 3

/** Desde esta hora, si no se hizo el ritual, el cartel de Hoy deja de insistir. */
export const RITUAL_PROMPT_UNTIL_HOUR = 15
