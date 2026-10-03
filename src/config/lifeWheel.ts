// Rueda de la vida: las áreas que se puntúan del 1 al 10 cada mes. Config pura (sin React).
// Los `id` se guardan en los datos (LifeWheelMonth.scores): no cambiarlos. El orden es el de la
// rueda, empezando arriba y siguiendo como las agujas del reloj.

export interface LifeArea {
  id: string
  icon: string
  name: string
}

export const LIFE_AREAS: LifeArea[] = [
  { id: 'salud', icon: '💪', name: 'Salud' },
  { id: 'trabajo', icon: '💼', name: 'Trabajo' },
  { id: 'plata', icon: '💰', name: 'Plata' },
  { id: 'familia', icon: '🏠', name: 'Familia' },
  { id: 'amigos', icon: '🤝', name: 'Amigos' },
  { id: 'pareja', icon: '❤️', name: 'Pareja' },
  { id: 'diversion', icon: '🎉', name: 'Diversión' },
  { id: 'crecimiento', icon: '🌱', name: 'Crecimiento' },
]

export const LIFE_SCORE_MIN = 1
export const LIFE_SCORE_MAX = 10

/** Anillos de referencia del gráfico. */
export const LIFE_WHEEL_RINGS = [2, 4, 6, 8, 10]
