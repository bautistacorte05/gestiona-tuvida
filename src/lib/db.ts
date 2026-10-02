import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TrainingCategory } from '../config/training'
import type { Item } from './prices'
import type { AccentId } from './theme'

/** Subcategorías de Mascota cuyos registros pertenecen a una mascota puntual. */
export const PET_OWNED_SUBS = ['paseos', 'alimento', 'salud']

export interface Entry {
  id: string
  categoryId: string
  subId: string
  /** Fecha local en formato YYYY-MM-DD. */
  date: string
  values: Record<string, string | number | string[]>
  /** Detalle de productos (solo subcategorías con itemized). */
  items?: Item[]
  /** Mascota dueña del registro (solo categoryId 'mascota', subcategorías paseos/alimento/salud). */
  petId?: string
  createdAt: number
  updatedAt: number
}

/** Tic diario: "hice esta actividad hoy". */
export interface Check {
  id: string // `${date}|${categoryId}`
  date: string
  categoryId: string
  /** Minutos dedicados ese día (opcional). */
  minutos?: number
}

/** Meta diaria creada por el usuario (Metas → Diarias). El tic se guarda en `checks`, con categoryId = `goal:${id}`. */
export interface DailyGoal {
  id: string
  title: string
  createdAt: number
  archived?: boolean
  /** Cuándo se borró (ms): el Panel de hábitos la sigue mostrando en los días anteriores. */
  archivedAt?: number
}

/** Meta a largo plazo con progreso numérico (Metas → Largo plazo). */
export interface LongGoal {
  id: string
  title: string
  unit: string
  target: number
  current: number
  deadline?: string
  createdAt: number
  updatedAt: number
  archived?: boolean
}

export interface PetProfile {
  id: string
  nombre: string
  raza?: string
  nacimiento?: string
  telefono?: string
  fotoUri?: string
  /** Categoría de adiestramiento elegida (define qué plan de pasos se le sugiere). */
  tipoAdiestramiento?: TrainingCategory
  /** Historial de peso (Perfil/DNI). Antes era la subcategoría "Peso"; lib/migrations.ts trae los registros viejos acá. */
  pesos?: { date: string; kg: number }[]
  createdAt: number
  updatedAt: number
  archived?: boolean
}

export interface PetCommand {
  id: string
  /** Mascota a la que pertenece este comando. */
  petId: string
  nombre: string
  nivel: number
  sesiones: number
  createdAt: number
  updatedAt: number
  archived?: boolean
}

export interface WalkPoint {
  lat: number
  lng: number
  t: number
}

export interface PetWalk {
  id: string
  /** Mascota que hizo este paseo. */
  petId: string
  date: string
  startedAt: number
  endedAt: number
  distanceKm: number
  path: WalkPoint[]
  createdAt: number
}

/** Tarea suelta de un día (Hoy → Plan del día). */
export interface DayTask {
  id: string
  /** YYYY-MM-DD */
  date: string
  title: string
  /** HH:MM (opcional) */
  time?: string
  done?: boolean
  /** Descartada desde "Pendientes de días anteriores": deja de arrastrarse. */
  dismissed?: boolean
  createdAt: number
  updatedAt: number
}

/** Tarea fija que se repite ciertos días. El tilde de cada día va en `checks` con categoryId `task:<id>`. */
export interface FixedTask {
  id: string
  title: string
  time?: string
  /** Días de la semana en que aparece: 0 = domingo … 6 = sábado. */
  weekdays: number[]
  createdAt: number
  updatedAt: number
  /** Desde cuándo dejó de repetirse (ms). Antes de esa fecha sigue apareciendo en los días pasados. */
  archivedAt?: number
}

/** Nombre elegido por el usuario para una categoría (id = 'futbol') o subcategoría (id = 'futbol/partidos'). */
export interface CustomName {
  id: string
  name: string
  updatedAt: number
}

/** Perfil de la persona dueña de la cuenta (Ajustes → Perfil). Es una lista de un solo elemento (id 'me') para sincronizarse como el resto. */
export interface UserProfile {
  id: 'me'
  nombre?: string
  apellido?: string
  /** YYYY-MM-DD */
  nacimiento?: string
  telefono?: string
  ciudad?: string
  /** data URI JPEG liviano, como la foto de la mascota. */
  fotoUri?: string
  /** Color de la app (Ajustes → Apariencia, ver lib/theme.ts). Sin valor = rojo. */
  accent?: AccentId
  /** Meta de horas de trabajo por semana (hoja de Trabajo). Sin valor = 40. */
  metaHorasSemana?: number
  updatedAt: number
}

/** Paso del plan de adiestramiento (config/training.ts) marcado como hecho para una mascota. */
export interface TrainingStepDone {
  id: string // `${petId}|${stepId}`
  petId: string
  stepId: string
  completedAt: number
}

/** Colecciones que se sincronizan con la cuenta (cada una es un array de registros con `id`). */
export const SYNCED_COLLECTIONS = [
  'entries',
  'checks',
  'dailyGoals',
  'longGoals',
  'petProfiles',
  'petCommands',
  'petWalks',
  'trainingProgress',
  'userProfile',
  'dayTasks',
  'fixedTasks',
  'customNames',
] as const
export type SyncedCollection = (typeof SYNCED_COLLECTIONS)[number]

/**
 * Estado de la sincronización (lo maneja lib/sync.ts, no las pantallas).
 * Las claves son `${colección}:${id}`.
 */
export interface SyncMeta {
  /** Cuenta dueña de los datos locales. Sin valor = datos cargados antes de tener login. */
  ownerId?: string
  /** Hora del servidor (tal cual la devuelve, con microsegundos) del último cambio bajado. */
  lastPulledAt?: string
  /** Marca para la que ya se hizo la bajada con margen hacia atrás (ver lib/sync.ts). */
  pullOverlapFor?: string
  /** Colecciones que conocía esta versión en la última bajada (si cambian, se re-baja todo). */
  pulledCollections?: string
  /** Registros con cambios locales todavía no subidos. */
  pending: Record<string, true>
  /** Momento (ms) de la última edición conocida de cada registro: decide qué versión gana. */
  stamps: Record<string, number>
  /** Registros borrados y cuándo, para que el borrado llegue a los otros dispositivos. */
  tombstones: Record<string, number>
}

interface DbState {
  sync: SyncMeta
  entries: Entry[]
  checks: Check[]
  dailyGoals: DailyGoal[]
  longGoals: LongGoal[]
  petProfiles: PetProfile[]
  /** Mascota seleccionada actualmente en la sección Mascota (perfil, paseos, entrenamiento, etc). */
  activePetId?: string
  petCommands: PetCommand[]
  petWalks: PetWalk[]
  trainingProgress: TrainingStepDone[]
  userProfile: UserProfile[]
  dayTasks: DayTask[]
  fixedTasks: FixedTask[]
  customNames: CustomName[]
}

interface DbActions {
  saveEntry: (entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => string
  deleteEntry: (id: string) => void
  toggleCheck: (date: string, categoryId: string) => void
  setMinutes: (date: string, categoryId: string, minutos: number | undefined) => void
  addDailyGoal: (title: string) => string
  archiveDailyGoal: (id: string) => void
  addLongGoal: (data: { title: string; unit: string; target: number; current: number; deadline?: string }) => string
  updateLongGoal: (id: string, patch: Partial<Pick<LongGoal, 'title' | 'unit' | 'target' | 'current' | 'deadline'>>) => void
  archiveLongGoal: (id: string) => void
  addPetProfile: (data: Omit<PetProfile, 'id' | 'createdAt' | 'updatedAt'>) => string
  updatePetProfile: (id: string, data: Partial<Omit<PetProfile, 'id' | 'createdAt' | 'updatedAt'>>) => void
  archivePetProfile: (id: string) => void
  setActivePet: (id: string) => void
  addPetWeight: (petId: string, kg: number, date: string) => void
  addPetCommand: (petId: string, nombre: string) => string
  updatePetCommand: (id: string, patch: Partial<Pick<PetCommand, 'nivel' | 'sesiones'>>) => void
  archivePetCommand: (id: string) => void
  savePetWalk: (walk: Omit<PetWalk, 'id' | 'createdAt'>) => string
  deletePetWalk: (id: string) => void
  toggleTrainingStep: (petId: string, stepId: string) => void
  updateUserProfile: (patch: Partial<Omit<UserProfile, 'id' | 'updatedAt'>>) => void
  addDayTask: (date: string, title: string, time?: string) => void
  updateDayTask: (id: string, patch: Partial<Pick<DayTask, 'date' | 'done' | 'dismissed' | 'title' | 'time'>>) => void
  deleteDayTask: (id: string) => void
  addFixedTask: (title: string, weekdays: number[], time?: string) => void
  archiveFixedTask: (id: string) => void
  /** Nombre vacío = volver al nombre original. */
  setCustomName: (id: string, name: string) => void
  importAll: (json: string) => number
}

const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const useDb = create<DbState & DbActions>()(
  persist(
    (set, get) => ({
      sync: { pending: {}, stamps: {}, tombstones: {} },
      entries: [],
      checks: [],
      dailyGoals: [],
      longGoals: [],
      petProfiles: [],
      activePetId: undefined,
      petCommands: [],
      petWalks: [],
      trainingProgress: [],
      userProfile: [],
      dayTasks: [],
      fixedTasks: [],
      customNames: [],

      saveEntry: (entry) => {
        const now = Date.now()
        if (entry.id) {
          set((s) => ({ entries: s.entries.map((e) => (e.id === entry.id ? { ...e, ...entry, updatedAt: now } : e)) }))
          return entry.id
        }
        const id = uuid()
        set((s) => ({ entries: [...s.entries, { ...entry, id, createdAt: now, updatedAt: now }] }))
        return id
      },

      deleteEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      toggleCheck: (date, categoryId) => {
        const id = `${date}|${categoryId}`
        set((s) => (s.checks.some((c) => c.id === id) ? { checks: s.checks.filter((c) => c.id !== id) } : { checks: [...s.checks, { id, date, categoryId }] }))
      },

      setMinutes: (date, categoryId, minutos) => {
        const id = `${date}|${categoryId}`
        set((s) => {
          const rest = s.checks.filter((c) => c.id !== id)
          return { checks: [...rest, { id, date, categoryId, minutos: minutos || undefined }] }
        })
      },

      addDailyGoal: (title) => {
        const id = uuid()
        set((s) => ({ dailyGoals: [...s.dailyGoals, { id, title: title.trim(), createdAt: Date.now() }] }))
        return id
      },
      archiveDailyGoal: (id) =>
        set((s) => ({ dailyGoals: s.dailyGoals.map((g) => (g.id === id ? { ...g, archived: true, archivedAt: Date.now() } : g)) })),

      addLongGoal: (data) => {
        const id = uuid()
        const now = Date.now()
        set((s) => ({ longGoals: [...s.longGoals, { id, ...data, createdAt: now, updatedAt: now }] }))
        return id
      },
      updateLongGoal: (id, patch) =>
        set((s) => ({ longGoals: s.longGoals.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: Date.now() } : g)) })),
      archiveLongGoal: (id) => set((s) => ({ longGoals: s.longGoals.map((g) => (g.id === id ? { ...g, archived: true } : g)) })),

      addPetProfile: (data) => {
        const id = uuid()
        const now = Date.now()
        set((s) => ({ petProfiles: [...s.petProfiles, { id, ...data, createdAt: now, updatedAt: now }], activePetId: id }))
        return id
      },
      updatePetProfile: (id, data) =>
        set((s) => ({ petProfiles: s.petProfiles.map((p) => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p)) })),
      archivePetProfile: (id) =>
        set((s) => {
          const petProfiles = s.petProfiles.map((p) => (p.id === id ? { ...p, archived: true } : p))
          const activePetId = s.activePetId === id ? petProfiles.find((p) => !p.archived)?.id : s.activePetId
          return { petProfiles, activePetId }
        }),
      setActivePet: (id) => set({ activePetId: id }),
      addPetWeight: (petId, kg, date) =>
        set((s) => ({
          petProfiles: s.petProfiles.map((p) =>
            p.id === petId ? { ...p, pesos: [...(p.pesos ?? []), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)), updatedAt: Date.now() } : p,
          ),
        })),

      addPetCommand: (petId, nombre) => {
        const id = uuid()
        const now = Date.now()
        set((s) => ({ petCommands: [...s.petCommands, { id, petId, nombre: nombre.trim(), nivel: 0, sesiones: 0, createdAt: now, updatedAt: now }] }))
        return id
      },
      updatePetCommand: (id, patch) =>
        set((s) => ({ petCommands: s.petCommands.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)) })),
      archivePetCommand: (id) => set((s) => ({ petCommands: s.petCommands.map((c) => (c.id === id ? { ...c, archived: true } : c)) })),

      savePetWalk: (walk) => {
        const id = uuid()
        set((s) => ({ petWalks: [...s.petWalks, { ...walk, id, createdAt: Date.now() }] }))
        const minutos = Math.max(1, Math.round((walk.endedAt - walk.startedAt) / 60000))
        get().saveEntry({ categoryId: 'mascota', subId: 'paseos', date: walk.date, values: { minutos, km: Math.round(walk.distanceKm * 100) / 100 }, petId: walk.petId })
        return id
      },
      deletePetWalk: (id) => set((s) => ({ petWalks: s.petWalks.filter((w) => w.id !== id) })),

      toggleTrainingStep: (petId, stepId) => {
        const id = `${petId}|${stepId}`
        set((s) =>
          s.trainingProgress.some((t) => t.id === id)
            ? { trainingProgress: s.trainingProgress.filter((t) => t.id !== id) }
            : { trainingProgress: [...s.trainingProgress, { id, petId, stepId, completedAt: Date.now() }] },
        )
      },

      updateUserProfile: (patch) =>
        set((s) => ({ userProfile: [{ ...s.userProfile[0], ...patch, id: 'me', updatedAt: Date.now() }] })),

      addDayTask: (date, title, time) => {
        const now = Date.now()
        set((s) => ({ dayTasks: [...s.dayTasks, { id: uuid(), date, title: title.trim(), time: time || undefined, createdAt: now, updatedAt: now }] }))
      },
      updateDayTask: (id, patch) =>
        set((s) => ({ dayTasks: s.dayTasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)) })),
      deleteDayTask: (id) => set((s) => ({ dayTasks: s.dayTasks.filter((t) => t.id !== id) })),
      addFixedTask: (title, weekdays, time) => {
        const now = Date.now()
        set((s) => ({ fixedTasks: [...s.fixedTasks, { id: uuid(), title: title.trim(), weekdays, time: time || undefined, createdAt: now, updatedAt: now }] }))
      },
      archiveFixedTask: (id) =>
        set((s) => ({ fixedTasks: s.fixedTasks.map((t) => (t.id === id ? { ...t, archivedAt: Date.now(), updatedAt: Date.now() } : t)) })),

      setCustomName: (id, name) =>
        set((s) => {
          const rest = s.customNames.filter((n) => n.id !== id)
          const clean = name.trim()
          return { customNames: clean ? [...rest, { id, name: clean, updatedAt: Date.now() }] : rest }
        }),

      importAll: (json) => {
        const data = JSON.parse(json)
        if (data?.app !== 'gestion-squali' || !Array.isArray(data.entries)) throw new Error('Archivo no válido')
        // Compatibilidad con exports viejos, de antes de multi-mascota: petProfile era un objeto (o un array de a lo sumo uno),
        // y petCommands/petWalks/entries no tenían petId.
        const rawProfile = data.petProfile
        const petProfiles: PetProfile[] = Array.isArray(rawProfile) ? rawProfile : rawProfile ? [rawProfile] : []
        const defaultPetId = petProfiles[0]?.id
        const withPetId = <T extends { petId?: string }>(arr: T[]) => (defaultPetId ? arr.map((x) => ({ ...x, petId: x.petId ?? defaultPetId })) : arr)
        const entries: Entry[] = data.entries.map((e: Entry) =>
          defaultPetId && e.categoryId === 'mascota' && PET_OWNED_SUBS.includes(e.subId) ? { ...e, petId: e.petId ?? defaultPetId } : e,
        )
        set({
          entries,
          checks: Array.isArray(data.checks) ? data.checks : [],
          dailyGoals: Array.isArray(data.dailyGoals) ? data.dailyGoals : [],
          longGoals: Array.isArray(data.longGoals) ? data.longGoals : [],
          petProfiles,
          activePetId: petProfiles.find((p) => !p.archived)?.id,
          petCommands: withPetId(Array.isArray(data.petCommands) ? data.petCommands : []),
          petWalks: withPetId(Array.isArray(data.petWalks) ? data.petWalks : []),
          trainingProgress: Array.isArray(data.trainingProgress) ? data.trainingProgress : [],
        })
        return data.entries.length as number
      },
    }),
    {
      name: 'gestion-squali-db',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted: unknown, version) => {
        const state = persisted as Record<string, unknown>
        // v0 -> v1: petProfile pasó de ser un único objeto ("main") a una lista de mascotas.
        // La mascota vieja se conserva como la primera de la lista (mismo id), y todo lo que
        // antes era global (comandos, paseos, registros de alimento/salud) queda a su nombre.
        if (version < 1) {
          const old = state.petProfile as (Omit<PetProfile, 'createdAt' | 'updatedAt'> & { updatedAt?: number }) | undefined
          const defaultPetId = old?.id
          state.petProfiles = old ? [{ ...old, createdAt: old.updatedAt ?? Date.now(), updatedAt: old.updatedAt ?? Date.now() }] : []
          state.activePetId = defaultPetId
          delete state.petProfile
          if (defaultPetId) {
            state.petCommands = ((state.petCommands as PetCommand[]) ?? []).map((c) => ({ ...c, petId: c.petId ?? defaultPetId }))
            state.petWalks = ((state.petWalks as PetWalk[]) ?? []).map((w) => ({ ...w, petId: w.petId ?? defaultPetId }))
            state.entries = ((state.entries as Entry[]) ?? []).map((e) =>
              e.categoryId === 'mascota' && PET_OWNED_SUBS.includes(e.subId) ? { ...e, petId: e.petId ?? defaultPetId } : e,
            )
          }
        }
        // v1 -> v2: "peso" se sumó a las subcategorías por mascota (PET_OWNED_SUBS). Los registros
        // de peso ya cargados no tenían petId: se asignan a la primera mascota de la lista.
        if (version < 2) {
          const defaultPetId = (state.petProfiles as PetProfile[] | undefined)?.[0]?.id
          if (defaultPetId) {
            state.entries = ((state.entries as Entry[]) ?? []).map((e) =>
              e.categoryId === 'mascota' && e.subId === 'peso' ? { ...e, petId: e.petId ?? defaultPetId } : e,
            )
          }
        }
        return state
      },
    },
  ),
)

export function exportAll() {
  const s = useDb.getState()
  return JSON.stringify(
    {
      app: 'gestion-squali',
      version: 5,
      exportedAt: new Date().toISOString(),
      entries: s.entries,
      checks: s.checks,
      dailyGoals: s.dailyGoals,
      longGoals: s.longGoals,
      petProfile: s.petProfiles,
      petCommands: s.petCommands,
      petWalks: s.petWalks,
      trainingProgress: s.trainingProgress,
    },
    null,
    2,
  )
}
