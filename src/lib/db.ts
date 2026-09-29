import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TrainingCategory } from '../config/training'
import type { Item } from './prices'

/** Subcategorías de Mascota cuyos registros pertenecen a una mascota puntual. */
export const PET_OWNED_SUBS = ['paseos', 'alimento', 'salud', 'peso']

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

/** Paso del plan de adiestramiento (config/training.ts) marcado como hecho para una mascota. */
export interface TrainingStepDone {
  id: string // `${petId}|${stepId}`
  petId: string
  stepId: string
  completedAt: number
}

/** Colecciones que se sincronizan con la cuenta (cada una es un array de registros con `id`). */
export const SYNCED_COLLECTIONS = ['entries', 'checks', 'dailyGoals', 'longGoals', 'petProfiles', 'petCommands', 'petWalks', 'trainingProgress'] as const
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
  addPetCommand: (petId: string, nombre: string) => string
  updatePetCommand: (id: string, patch: Partial<Pick<PetCommand, 'nivel' | 'sesiones'>>) => void
  archivePetCommand: (id: string) => void
  savePetWalk: (walk: Omit<PetWalk, 'id' | 'createdAt'>) => string
  deletePetWalk: (id: string) => void
  toggleTrainingStep: (petId: string, stepId: string) => void
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
      archiveDailyGoal: (id) => set((s) => ({ dailyGoals: s.dailyGoals.map((g) => (g.id === id ? { ...g, archived: true } : g)) })),

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
