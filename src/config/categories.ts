// Configuración central de categorías y subcategorías.
// Para agregar una categoría nueva alcanza con sumar un objeto a CATEGORIES.

/** 'time' = hora "HH:MM" (se muestra tal cual y nunca se suma). */
export type FieldType = 'number' | 'text' | 'select' | 'date' | 'time'
export type Aggregate = 'sum' | 'avg'

export interface Field {
  key: string
  label: string
  type: FieldType
  unit?: string
  options?: string[]
  required?: boolean
  /** Cómo se resume este campo en la vista mensual (solo campos numéricos). */
  aggregate?: Aggregate
  /** Formatear como dinero. */
  money?: boolean
  /** Si la moneda no es siempre pesos, el key de un campo select (ej: 'moneda') que dice cuál usar. */
  currencyFrom?: string
  /** Permite marcar más de una opción a la vez (ej: un gasto que es Supermercado y Almacén). */
  multi?: boolean
  /** Campo de fecha (ej: próxima dosis): si es futura y la más cercana, se destaca arriba de la pantalla. */
  reminder?: boolean
}

export interface Subcategory {
  id: string
  name: string
  icon: string
  fields: Field[]
  /** Permite cargar productos con cantidad y precio (y comparar precios). */
  itemized?: boolean
  /** Movimientos de ahorro en más de una moneda: usa su propio resumen (ver SavingsInsights). */
  savings?: boolean
  /** No aparece en los menús (la pantalla sigue existiendo; se llega desde otra, ej. Paseos → En vivo). */
  hidden?: boolean
  /** Permite ver los registros por día, semana o mes (en vez de solo por mes). */
  periods?: boolean
  /** Botón en la pantalla que lleva a otra subcategoría de la misma categoría (ej. Paseos → En vivo). */
  link?: { label: string; subId: string }
  /** Pantalla propia en vez del formulario genérico (ver [subId].tsx). Las `*-sheet` son la hoja de toda la categoría. */
  custom?:
    | 'finance-home'
    | 'daily-goals'
    | 'long-goals'
    | 'pet-profile'
    | 'pet-lost'
    | 'pet-training'
    | 'pet-walk-live'
    | 'training-sheet'
    | 'work-sheet'
    | 'football-sheet'
    | 'reading-sheet'
    | 'wellbeing-sheet'
    | 'projects-sheet'
    | 'ritual'
    | 'week-planner'
    | 'notes'
    | 'life-wheel'
}

export interface Category {
  id: string
  name: string
  icon: string
  /** Color de acento (clase de Tailwind sin prefijo, ej: "emerald"). */
  color: string
  /** Aparece como fila de la grilla de hábitos de Hoy (con tilde por día). */
  daily?: boolean
  /** Color en los gráficos de tiempo (paleta validada para daltonismo sobre fondo oscuro). */
  chart?: string
  /**
   * Categoría con hoja propia: en el menú es una sola entrada (sin desplegar secciones) que lleva
   * directo a esta subcategoría. Las demás secciones van `hidden` (sus datos siguen ahí; la hoja los muestra).
   */
  landing?: string
  subcategories: Subcategory[]
}

const minutos: Field = { key: 'minutos', label: 'Duración', type: 'number', unit: 'min', aggregate: 'sum' }

export const CATEGORIES: Category[] = [
  {
    id: 'ritual',
    name: 'Ritual',
    icon: '🌅',
    color: 'amber',
    landing: 'manana',
    subcategories: [{ id: 'manana', name: 'Ritual de la mañana', icon: '🌅', fields: [], custom: 'ritual' }],
  },
  {
    id: 'semana',
    name: 'Mi semana',
    icon: '🗓️',
    color: 'sky',
    landing: 'plan',
    subcategories: [{ id: 'plan', name: 'Mi semana', icon: '🗓️', fields: [], custom: 'week-planner' }],
  },
  {
    id: 'finanzas',
    name: 'Finanzas',
    icon: '💰',
    color: 'emerald',
    subcategories: [
      { id: 'balance', name: 'Balance', icon: '📊', fields: [], custom: 'finance-home' },
      {
        id: 'gastos',
        name: 'Gastos',
        icon: '💸',
        itemized: true,
        fields: [
          {
            key: 'rubro',
            label: 'Categoría',
            type: 'select',
            multi: true,
            options: ['Supermercado', 'Verdulería', 'Carnicería', 'Almacén', 'Farmacia', 'Combustible', 'Transporte', 'Servicios', 'Salidas', 'Ropa', 'Hogar', 'Salud', 'Mascota', 'Otros'],
            required: true,
          },
          { key: 'lugar', label: 'Lugar / comercio', type: 'text' },
          { key: 'monto', label: 'Total', type: 'number', unit: '$', money: true, required: true, aggregate: 'sum' },
          { key: 'detalle', label: 'Nota', type: 'text' },
        ],
      },
      {
        id: 'ingresos',
        name: 'Ingresos',
        icon: '💵',
        periods: true,
        fields: [
          { key: 'monto', label: 'Monto', type: 'number', unit: '$', money: true, required: true, aggregate: 'sum' },
          { key: 'fuente', label: 'Fuente', type: 'select', multi: true, options: ['Sueldo', 'Extra', 'Venta', 'Regalo', 'Otros'] },
          { key: 'detalle', label: 'Detalle', type: 'text' },
        ],
      },
      {
        id: 'ahorros',
        name: 'Ahorros',
        icon: '🐖',
        savings: true,
        fields: [
          { key: 'tipo', label: 'Tipo', type: 'select', options: ['Aporte', 'Retiro'], required: true },
          { key: 'moneda', label: 'Moneda', type: 'select', options: ['ARS', 'USD'], required: true },
          { key: 'monto', label: 'Monto', type: 'number', money: true, currencyFrom: 'moneda', required: true, aggregate: 'sum' },
          { key: 'detalle', label: 'Nota', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'entrenamiento',
    daily: true,
    chart: '#d95926',
    name: 'Entrenamiento',
    icon: '🏋️',
    color: 'orange',
    landing: 'gimnasio',
    subcategories: [
      {
        id: 'gimnasio',
        name: 'Gimnasio',
        icon: '💪',
        custom: 'training-sheet',
        fields: [
          { key: 'grupo', label: 'Grupo muscular', type: 'select', multi: true, options: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Full body'], required: true },
          { ...minutos, required: true },
          { key: 'intensidad', label: 'Intensidad (1-5)', type: 'number', aggregate: 'avg' },
        ],
      },
    ],
  },
  {
    id: 'trabajo',
    daily: true,
    chart: '#199e70',
    name: 'Trabajo',
    icon: '💼',
    color: 'teal',
    landing: 'jornada',
    subcategories: [
      {
        id: 'jornada',
        name: 'Jornada',
        icon: '🕘',
        custom: 'work-sheet',
        fields: [
          { key: 'horas', label: 'Horas', type: 'number', unit: 'h', required: true, aggregate: 'sum' },
          { key: 'modalidad', label: 'Modalidad', type: 'select', options: ['Oficina', 'Remoto', 'Híbrido'] },
          { key: 'nota', label: 'Nota', type: 'text' },
        ],
      },
      {
        id: 'tareas',
        name: 'Tareas',
        icon: '✅',
        hidden: true,
        fields: [
          { key: 'tarea', label: 'Tarea', type: 'text', required: true },
          { key: 'estado', label: 'Estado', type: 'select', options: ['Pendiente', 'En curso', 'Hecha'], required: true },
          { key: 'prioridad', label: 'Prioridad', type: 'select', options: ['Alta', 'Media', 'Baja'] },
        ],
      },
    ],
  },
  {
    id: 'comida',
    daily: true,
    chart: '#c98500',
    name: 'Comida',
    icon: '🍽️',
    color: 'amber',
    subcategories: [
      {
        id: 'comidas',
        name: 'Comidas',
        icon: '🥗',
        fields: [
          { key: 'momento', label: 'Momento', type: 'select', options: ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snack'], required: true },
          { key: 'que', label: '¿Qué comiste?', type: 'text', required: true },
          { key: 'calorias', label: 'Calorías', type: 'number', unit: 'kcal', aggregate: 'sum' },
          { key: 'saludable', label: '¿Saludable?', type: 'select', options: ['Sí', 'Más o menos', 'No'] },
        ],
      },
      {
        id: 'agua',
        name: 'Agua',
        icon: '💧',
        fields: [{ key: 'vasos', label: 'Vasos', type: 'number', required: true, aggregate: 'sum' }],
      },
    ],
  },
  {
    id: 'futbol',
    name: 'Fútbol',
    icon: '⚽',
    color: 'lime',
    landing: 'partidos',
    subcategories: [
      {
        id: 'partidos',
        name: 'Partidos',
        icon: '🥅',
        custom: 'football-sheet',
        fields: [
          { key: 'formato', label: 'Formato', type: 'select', options: ['Fútbol 5', 'Fútbol 7', 'Fútbol 8', 'Fútbol 11'], required: true },
          { key: 'resultado', label: 'Resultado', type: 'select', options: ['Ganado', 'Empatado', 'Perdido'], required: true },
          { key: 'goles', label: 'Goles', type: 'number', aggregate: 'sum' },
          { key: 'asistencias', label: 'Asistencias', type: 'number', aggregate: 'sum' },
          minutos,
        ],
      },
    ],
  },
  {
    id: 'lectura',
    daily: true,
    chart: '#3987e5',
    name: 'Lectura',
    icon: '📚',
    color: 'sky',
    landing: 'libros',
    subcategories: [
      {
        id: 'libros',
        name: 'Libros',
        icon: '📕',
        custom: 'reading-sheet',
        fields: [
          { key: 'titulo', label: 'Título', type: 'text', required: true },
          { key: 'autor', label: 'Autor', type: 'text' },
          { key: 'estado', label: 'Estado', type: 'select', options: ['Pendiente', 'Leyendo', 'Terminado', 'Abandonado'], required: true },
          { key: 'puntaje', label: 'Puntaje (1-5)', type: 'number', aggregate: 'avg' },
          { key: 'paginasTotales', label: 'Páginas del libro', type: 'number' },
        ],
      },
      {
        id: 'sesiones',
        name: 'Sesiones',
        icon: '📖',
        hidden: true,
        fields: [
          { key: 'libro', label: 'Libro', type: 'text', required: true },
          { key: 'paginas', label: 'Páginas', type: 'number', aggregate: 'sum' },
          minutos,
        ],
      },
    ],
  },
  {
    id: 'mascota',
    daily: true,
    chart: '#d55181',
    name: 'Mascota',
    icon: '🐾',
    color: 'pink',
    subcategories: [
      { id: 'perfil', name: 'Perfil / DNI', icon: '🪪', fields: [], custom: 'pet-profile' },
      {
        id: 'paseos',
        name: 'Paseos',
        icon: '🦮',
        link: { label: '🛰️ En vivo', subId: 'paseo-vivo' },
        fields: [{ ...minutos, required: true }, { key: 'km', label: 'Distancia', type: 'number', unit: 'km', aggregate: 'sum' }],
      },
      { id: 'paseo-vivo', name: 'Paseo en vivo', icon: '🛰️', fields: [], custom: 'pet-walk-live', hidden: true },
      {
        id: 'alimento',
        name: 'Alimentación',
        icon: '🦴',
        fields: [
          { key: 'tipo', label: 'Tipo', type: 'select', multi: true, options: ['Balanceado', 'Casero', 'Premio', 'Otro'], required: true },
          { key: 'gramos', label: 'Cantidad', type: 'number', unit: 'g', aggregate: 'sum' },
        ],
      },
      {
        id: 'salud',
        name: 'Salud / Veterinario',
        icon: '🩺',
        fields: [
          { key: 'motivo', label: 'Motivo', type: 'select', multi: true, options: ['Control', 'Vacuna', 'Desparasitación', 'Baño', 'Enfermedad', 'Otro'], required: true },
          { key: 'nombre', label: 'Vacuna / medicamento', type: 'text' },
          { key: 'proximaDosis', label: 'Próxima dosis', type: 'date', reminder: true },
          { key: 'costo', label: 'Costo', type: 'number', unit: '$', money: true, aggregate: 'sum' },
          { key: 'detalle', label: 'Detalle', type: 'text' },
        ],
      },
      { id: 'entrenamiento', name: 'Entrenamiento', icon: '🎓', fields: [], custom: 'pet-training' },
      { id: 'perdido', name: 'Modo perdido', icon: '🚨', fields: [], custom: 'pet-lost' },
    ],
  },
  {
    id: 'bienestar',
    name: 'Bienestar',
    icon: '🧘',
    color: 'rose',
    landing: 'sueno',
    subcategories: [
      {
        id: 'sueno',
        name: 'Sueño',
        icon: '😴',
        custom: 'wellbeing-sheet',
        fields: [
          { key: 'horas', label: 'Horas', type: 'number', unit: 'h', required: true, aggregate: 'avg' },
          { key: 'calidad', label: 'Calidad', type: 'select', options: ['Muy buena', 'Buena', 'Regular', 'Mala'] },
          { key: 'acostarse', label: 'Me acosté', type: 'time' },
          { key: 'levantarse', label: 'Me levanté', type: 'time' },
        ],
      },
      {
        id: 'animo',
        name: 'Ánimo',
        icon: '🙂',
        hidden: true,
        fields: [
          { key: 'nivel', label: 'Nivel (1-5)', type: 'number', required: true, aggregate: 'avg' },
          { key: 'nota', label: 'Nota', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'metas',
    name: 'Metas',
    icon: '🎯',
    color: 'violet',
    subcategories: [
      { id: 'diarias', name: 'Diarias', icon: '☑️', fields: [], custom: 'daily-goals' },
      { id: 'largoplazo', name: 'Largo plazo', icon: '🏁', fields: [], custom: 'long-goals' },
      { id: 'rueda', name: 'Rueda de la vida', icon: '🎡', fields: [], custom: 'life-wheel' },
    ],
  },
  {
    id: 'proyectos',
    name: 'Proyectos',
    icon: '🗂️',
    color: 'indigo',
    landing: 'proyectos',
    subcategories: [
      {
        id: 'proyectos',
        name: 'Proyectos',
        icon: '🗂️',
        custom: 'projects-sheet',
        fields: [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'plazo', label: 'Plazo', type: 'select', options: ['Corto plazo', 'Largo plazo'], required: true },
          { key: 'estado', label: 'Estado', type: 'select', options: ['Pendiente', 'En curso', 'Pausado', 'Terminado'], required: true },
          { key: 'fechaLimite', label: 'Fecha límite', type: 'date', reminder: true },
          { key: 'nota', label: 'Nota', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'notas',
    name: 'Anotaciones',
    icon: '📝',
    color: 'teal',
    landing: 'todas',
    subcategories: [{ id: 'todas', name: 'Anotaciones', icon: '📝', fields: [], custom: 'notes' }],
  },
]

// Orden de las filas en la grilla de hábitos de Hoy.
const DAILY_ORDER = ['entrenamiento', 'lectura', 'trabajo', 'mascota', 'comida']
// Orden fijo en los gráficos apilados (el validado de la paleta).
export const CHART_ORDER = ['lectura', 'entrenamiento', 'trabajo', 'comida', 'mascota']
export const DAILY_CATEGORIES = CATEGORIES.filter((c) => c.daily).sort((a, b) => DAILY_ORDER.indexOf(a.id) - DAILY_ORDER.indexOf(b.id))

export interface ExternalMoneyField {
  category: Category
  sub: Subcategory
  field: Field
}

/**
 * Campos de dinero que existen FUERA de Finanzas (ej: "Costo" en Mascota → Salud).
 * Se usan para descontarlos del saldo de Finanzas sin tener que duplicar la carga:
 * cargás el gasto una sola vez, en la categoría que corresponde.
 */
export const EXTERNAL_MONEY_FIELDS: ExternalMoneyField[] = CATEGORIES.filter((c) => c.id !== 'finanzas').flatMap((category) =>
  category.subcategories.flatMap((sub) => sub.fields.filter((field) => field.money).map((field) => ({ category, sub, field }))),
)

export function findSub(categoryId: string, subId: string) {
  const category = CATEGORIES.find((c) => c.id === categoryId)
  const sub = category?.subcategories.find((s) => s.id === subId)
  return category && sub ? { category, sub } : undefined
}

// Tailwind necesita ver las clases completas para generarlas.
export const COLOR_CLASSES: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', bar: 'bg-emerald-500' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40', bar: 'bg-orange-500' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', bar: 'bg-amber-500' },
  lime: { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/40', bar: 'bg-lime-500' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/40', bar: 'bg-sky-500' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/40', bar: 'bg-violet-500' },
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/40', bar: 'bg-teal-500' },
  pink: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/40', bar: 'bg-pink-500' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/40', bar: 'bg-rose-500' },
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/40', bar: 'bg-indigo-500' },
}
