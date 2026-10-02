import { useDb } from './db';

/**
 * Deja el día tildado en la grilla de Hoy (sin destildarlo si ya estaba). Lo usan las hojas de
 * categoría al anotar algo (un entrenamiento, una jornada, páginas leídas): anotar = hecho ese día.
 */
export function markDone(date: string, categoryId: string) {
  const { checks, toggleCheck } = useDb.getState();
  if (!checks.some((c) => c.id === `${date}|${categoryId}`)) toggleCheck(date, categoryId);
}
