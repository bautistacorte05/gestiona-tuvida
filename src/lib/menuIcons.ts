// Íconos de línea (estilo "Huella") para el menú ☰ del celular y la barra lateral de PC.
// Solo se usan ahí: el resto de la app (Hoy, Mes, hojas) sigue con el emoji de categories.ts.
import type { Ionicons } from '@expo/vector-icons'

export type MenuIconName = keyof typeof Ionicons.glyphMap

export const TOP_ICONS = {
  hoy: 'home-outline',
  mes: 'bar-chart-outline',
} as const satisfies Record<string, MenuIconName>

const CATEGORY_ICONS: Record<string, MenuIconName> = {
  ritual: 'sunny-outline',
  semana: 'calendar-outline',
  finanzas: 'wallet-outline',
  entrenamiento: 'barbell-outline',
  trabajo: 'briefcase-outline',
  comida: 'restaurant-outline',
  futbol: 'football-outline',
  lectura: 'book-outline',
  mascota: 'paw-outline',
  bienestar: 'moon-outline',
  metas: 'trophy-outline',
  proyectos: 'folder-outline',
  notas: 'create-outline',
}

const SUB_ICONS: Record<string, MenuIconName> = {
  'finanzas:balance': 'stats-chart-outline',
  'finanzas:gastos': 'trending-down-outline',
  'finanzas:ingresos': 'trending-up-outline',
  'finanzas:ahorros': 'archive-outline',
  'comida:comidas': 'fast-food-outline',
  'comida:agua': 'water-outline',
  'mascota:perfil': 'card-outline',
  'mascota:paseos': 'walk-outline',
  'mascota:alimento': 'basket-outline',
  'mascota:salud': 'medkit-outline',
  'mascota:entrenamiento': 'school-outline',
  'mascota:perdido': 'warning-outline',
  'metas:diarias': 'checkbox-outline',
  'metas:largoplazo': 'flag-outline',
  'metas:rueda': 'pie-chart-outline',
}

export function categoryIcon(categoryId: string): MenuIconName {
  return CATEGORY_ICONS[categoryId] ?? 'ellipse-outline'
}

export function subIcon(categoryId: string, subId: string): MenuIconName {
  return SUB_ICONS[`${categoryId}:${subId}`] ?? categoryIcon(categoryId)
}
