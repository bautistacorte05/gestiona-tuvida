export interface Exercise {
  name: string
  groups: string[]
  equipment: string
}

export const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'] as const

export const GROUP_EMOJI: Record<string, string> = {
  Pecho: '💪',
  Espalda: '🔙',
  Piernas: '🦵',
  Hombros: '🤸',
  Brazos: '💪',
  Core: '🧘',
}

export const DEFAULT_EXERCISES: Exercise[] = [
  { name: 'Press de banca', groups: ['Pecho'], equipment: 'Barra' },
  { name: 'Press con mancuernas', groups: ['Pecho'], equipment: 'Mancuernas' },
  { name: 'Press inclinado', groups: ['Pecho'], equipment: 'Mancuernas' },
  { name: 'Aperturas', groups: ['Pecho'], equipment: 'Mancuernas' },
  { name: 'Fondos en paralelas', groups: ['Pecho', 'Brazos'], equipment: 'Peso corporal' },
  { name: 'Crossover', groups: ['Pecho'], equipment: 'Cable' },
  { name: 'Pullover', groups: ['Pecho', 'Espalda'], equipment: 'Mancuernas' },

  { name: 'Dominadas', groups: ['Espalda', 'Brazos'], equipment: 'Peso corporal' },
  { name: 'Remo con barra', groups: ['Espalda'], equipment: 'Barra' },
  { name: 'Remo con mancuerna', groups: ['Espalda'], equipment: 'Mancuernas' },
  { name: 'Jalón al pecho', groups: ['Espalda'], equipment: 'Máquina' },
  { name: 'Peso muerto', groups: ['Espalda', 'Piernas'], equipment: 'Barra' },
  { name: 'Remo en máquina', groups: ['Espalda'], equipment: 'Máquina' },

  { name: 'Sentadilla', groups: ['Piernas'], equipment: 'Barra' },
  { name: 'Prensa de piernas', groups: ['Piernas'], equipment: 'Máquina' },
  { name: 'Extensión de cuádriceps', groups: ['Piernas'], equipment: 'Máquina' },
  { name: 'Curl femoral', groups: ['Piernas'], equipment: 'Máquina' },
  { name: 'Zancadas', groups: ['Piernas'], equipment: 'Mancuernas' },
  { name: 'Peso muerto rumano', groups: ['Piernas'], equipment: 'Barra' },
  { name: 'Elevación de gemelos', groups: ['Piernas'], equipment: 'Máquina' },
  { name: 'Hip thrust', groups: ['Piernas'], equipment: 'Barra' },
  { name: 'Sentadilla búlgara', groups: ['Piernas'], equipment: 'Mancuernas' },

  { name: 'Press militar', groups: ['Hombros'], equipment: 'Barra' },
  { name: 'Press de hombros', groups: ['Hombros'], equipment: 'Mancuernas' },
  { name: 'Elevaciones laterales', groups: ['Hombros'], equipment: 'Mancuernas' },
  { name: 'Elevaciones frontales', groups: ['Hombros'], equipment: 'Mancuernas' },
  { name: 'Pájaros', groups: ['Hombros'], equipment: 'Mancuernas' },
  { name: 'Face pull', groups: ['Hombros'], equipment: 'Cable' },

  { name: 'Curl con barra', groups: ['Brazos'], equipment: 'Barra' },
  { name: 'Curl con mancuernas', groups: ['Brazos'], equipment: 'Mancuernas' },
  { name: 'Curl martillo', groups: ['Brazos'], equipment: 'Mancuernas' },
  { name: 'Tríceps en polea', groups: ['Brazos'], equipment: 'Cable' },
  { name: 'Press francés', groups: ['Brazos'], equipment: 'Barra' },
  { name: 'Extensión de tríceps', groups: ['Brazos'], equipment: 'Mancuernas' },
  { name: 'Fondos en banco', groups: ['Brazos'], equipment: 'Peso corporal' },

  { name: 'Plancha', groups: ['Core'], equipment: 'Peso corporal' },
  { name: 'Abdominales', groups: ['Core'], equipment: 'Peso corporal' },
  { name: 'Russian twist', groups: ['Core'], equipment: 'Peso corporal' },
  { name: 'Elevación de piernas', groups: ['Core'], equipment: 'Peso corporal' },
]

export function allExercises(custom: Exercise[] | undefined): Exercise[] {
  if (!custom?.length) return DEFAULT_EXERCISES
  const names = new Set(DEFAULT_EXERCISES.map((e) => e.name))
  return [...DEFAULT_EXERCISES, ...custom.filter((e) => !names.has(e.name))]
}

export function exercisesByGroup(list: Exercise[]): [string, Exercise[]][] {
  return MUSCLE_GROUPS.map((g) => [g, list.filter((ex) => ex.groups[0] === g)])
}

export function searchExercises(list: Exercise[], query: string): Exercise[] {
  const q = query.toLowerCase().trim()
  if (!q) return list
  return list.filter((ex) => ex.name.toLowerCase().includes(q))
}
