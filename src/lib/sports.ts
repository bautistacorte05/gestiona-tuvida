export interface SportField {
  key: string
  label: string
  type: 'number' | 'text'
  unit?: string
}

export interface SportDiscipline {
  id: string
  name: string
  emoji: string
  sessionTypes: string[]
  fields: SportField[]
}

export const SPORT_DISCIPLINES: SportDiscipline[] = [
  {
    id: 'futbol',
    name: 'Fútbol',
    emoji: '⚽',
    sessionTypes: ['Técnico', 'Táctico', 'Físico', 'Partido amistoso', 'Partido oficial'],
    fields: [
      { key: 'goles', label: 'Goles', type: 'number' },
      { key: 'asistencias', label: 'Asistencias', type: 'number' },
    ],
  },
  {
    id: 'hockey',
    name: 'Hockey',
    emoji: '🏑',
    sessionTypes: ['Técnico', 'Táctico', 'Físico', 'Partido'],
    fields: [
      { key: 'goles', label: 'Goles', type: 'number' },
    ],
  },
  {
    id: 'voley',
    name: 'Vóley',
    emoji: '🏐',
    sessionTypes: ['Saque', 'Recepción', 'Armado', 'Remate', 'Bloqueo', 'Completo', 'Partido'],
    fields: [],
  },
  {
    id: 'tenis',
    name: 'Tenis',
    emoji: '🎾',
    sessionTypes: ['Peloteo', 'Saque', 'Volea', 'Físico', 'Partido'],
    fields: [
      { key: 'setsGanados', label: 'Sets ganados', type: 'number' },
      { key: 'setsPerdidos', label: 'Sets perdidos', type: 'number' },
    ],
  },
  {
    id: 'basquet',
    name: 'Básquet',
    emoji: '🏀',
    sessionTypes: ['Tiro', 'Dribling', 'Defensa', 'Físico', 'Partido'],
    fields: [
      { key: 'puntos', label: 'Puntos', type: 'number' },
    ],
  },
  {
    id: 'boxeo',
    name: 'Boxeo',
    emoji: '🥊',
    sessionTypes: ['Bolsa', 'Sombra', 'Sparring', 'Técnica', 'Físico'],
    fields: [
      { key: 'rounds', label: 'Rounds', type: 'number' },
    ],
  },
  {
    id: 'taekwondo',
    name: 'Taekwondo',
    emoji: '🥋',
    sessionTypes: ['Formas (poomsae)', 'Sparring', 'Patadas', 'Físico'],
    fields: [],
  },
  {
    id: 'mma',
    name: 'MMA',
    emoji: '🤼',
    sessionTypes: ['Striking', 'Grappling', 'Wrestling', 'Sparring', 'Físico'],
    fields: [
      { key: 'rounds', label: 'Rounds', type: 'number' },
    ],
  },
  {
    id: 'running',
    name: 'Running',
    emoji: '🏃',
    sessionTypes: ['Suave', 'Tempo', 'Intervalos', 'Largo', 'Recuperación', 'Carrera'],
    fields: [
      { key: 'distancia', label: 'Distancia', type: 'number', unit: 'km' },
      { key: 'tiempo', label: 'Tiempo', type: 'text', unit: 'mm:ss' },
    ],
  },
  {
    id: 'natacion',
    name: 'Natación',
    emoji: '🏊',
    sessionTypes: ['Libre', 'Espalda', 'Pecho', 'Mariposa', 'Mixto'],
    fields: [
      { key: 'distancia', label: 'Distancia', type: 'number', unit: 'm' },
      { key: 'tiempo', label: 'Tiempo', type: 'text', unit: 'mm:ss' },
    ],
  },
  {
    id: 'ciclismo',
    name: 'Ciclismo',
    emoji: '🚴',
    sessionTypes: ['Ruta', 'Montaña', 'Rodillo'],
    fields: [
      { key: 'distancia', label: 'Distancia', type: 'number', unit: 'km' },
      { key: 'desnivel', label: 'Desnivel', type: 'number', unit: 'm' },
    ],
  },
  {
    id: 'rugby',
    name: 'Rugby',
    emoji: '🏉',
    sessionTypes: ['Técnico', 'Táctico', 'Físico', 'Partido'],
    fields: [
      { key: 'tries', label: 'Tries', type: 'number' },
    ],
  },
]

export function findDiscipline(id: string): SportDiscipline | undefined {
  return SPORT_DISCIPLINES.find((d) => d.id === id)
}

// ——— Estadísticas por disciplina ———

export interface SportPoint { date: string; value: number }

export interface SportSummary {
  sessions: number
  minutes: number
  avgIntensity: number | null
  totals: { label: string; value: number; unit?: string }[]
  bestPace: string | null
  metricLabel: string
  metricUnit: string
  series: SportPoint[]
}

function parseTime(t: unknown): number {
  const m = /^(\d+):(\d{1,2})$/.exec(String(t ?? '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

function fmtPace(secPerUnit: number, unit: string) {
  const s = Math.round(secPerUnit)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /${unit}`
}

// Resumen de una disciplina. `fields` son los campos propios; `sessions` ya vienen filtradas por disciplina.
export function sportSummary(
  sessions: { date: string; values: Record<string, unknown> }[],
  fields: SportField[],
  discId: string,
): SportSummary {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const num = (v: unknown) => Number(v) || 0
  const minutes = sorted.reduce((s, e) => s + num(e.values.minutos), 0)
  const rated = sorted.filter((e) => num(e.values.intensidad) > 0)
  const avgIntensity = rated.length ? rated.reduce((s, e) => s + num(e.values.intensidad), 0) / rated.length : null

  const numeric = fields.filter((f) => f.type === 'number')
  const totals = numeric
    .map((f) => ({ label: f.label, unit: f.unit, value: sorted.reduce((s, e) => s + num(e.values[f.key]), 0) }))
    .filter((t) => t.value > 0)

  let bestPace: string | null = null
  const distField = fields.find((f) => f.key === 'distancia')
  if (distField && fields.some((f) => f.key === 'tiempo')) {
    const perUnit = discId === 'natacion' ? 100 : 1
    let best = Infinity
    for (const e of sorted) {
      const sec = parseTime(e.values.tiempo)
      const dist = num(e.values.distancia)
      if (sec > 0 && dist > 0) best = Math.min(best, (sec / dist) * perUnit)
    }
    if (best < Infinity) bestPace = fmtPace(best, discId === 'natacion' ? '100 m' : 'km')
  }

  const main = numeric.find((f) => f.key === 'distancia') ?? numeric[0]
  const key = main?.key ?? 'minutos'
  const series = sorted
    .map((e) => ({ date: e.date, value: num(e.values[key]) }))
    .filter((p) => p.value > 0)
    .slice(-10)

  return {
    sessions: sorted.length,
    minutes,
    avgIntensity,
    totals,
    bestPace,
    metricLabel: main?.label ?? 'Minutos',
    metricUnit: main?.unit ?? 'min',
    series,
  }
}
