import { useCallback, useMemo } from 'react';

import { CATEGORIES, type Category, type Subcategory } from '../config/categories';
import { useDb } from './db';

/** Ids de los nombres personalizados: 'futbol' para la categoría, 'futbol/partidos' para la subcategoría. */
export const nameIdOf = (categoryId: string, subId?: string) => (subId ? `${categoryId}/${subId}` : categoryId);

function applyNames(names: Map<string, string>): Category[] {
  return CATEGORIES.map((cat) => ({
    ...cat,
    name: names.get(nameIdOf(cat.id)) ?? cat.name,
    subcategories: cat.subcategories.map((sub) => ({ ...sub, name: names.get(nameIdOf(cat.id, sub.id)) ?? sub.name })),
  }));
}

/** Todas las categorías con los nombres que eligió el usuario (incluye subcategorías ocultas). */
export function useCategories(): Category[] {
  const customNames = useDb((s) => s.customNames);
  return useMemo(() => applyNames(new Map(customNames.map((n) => [n.id, n.name]))), [customNames]);
}

/** Función para mostrar el nombre (personalizado) de una categoría por su id. */
export function useCategoryName() {
  const categories = useCategories();
  return useCallback((categoryId: string, fallback: string) => categories.find((c) => c.id === categoryId)?.name ?? fallback, [categories]);
}

/**
 * Categorías para mostrar en los menús: con nombres personalizados, sin subcategorías `hidden` y con
 * las categorías de varias secciones (sin `landing`, se despliegan con acordeón) al final de la lista.
 */
export function useMenuCategories(): Category[] {
  const categories = useCategories();
  return useMemo(() => {
    const visible = categories.map((cat) => ({ ...cat, subcategories: cat.subcategories.filter((s) => !s.hidden) }));
    return [...visible].sort((a, b) => Number(!a.landing) - Number(!b.landing));
  }, [categories]);
}

/** Categoría + subcategoría con nombres personalizados (o undefined si no existe). */
export function useFindSub(categoryId: string, subId: string): { category: Category; sub: Subcategory } | undefined {
  const categories = useCategories();
  return useMemo(() => {
    const category = categories.find((c) => c.id === categoryId);
    const sub = category?.subcategories.find((s) => s.id === subId);
    return category && sub ? { category, sub } : undefined;
  }, [categories, categoryId, subId]);
}
