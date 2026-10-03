import type { Check, DayOrder, DayTask, FixedTask } from './db';

/**
 * Las tareas de un día (Hoy → Plan del día y Mi semana), armadas siempre de la misma forma:
 * - las tareas sueltas de esa fecha (menos las descartadas),
 * - más las tareas fijas de ese día de la semana (desde que se crearon y hasta que dejaron de repetirse),
 * - en el orden por defecto (primero las que tienen hora, en orden; después el resto en el orden en que se cargó),
 * - y, si ese día se ordenó a mano (`dayOrders`), primero las de esa lista en ese orden y después las demás.
 *
 * Funciones puras (sin la base de datos): se pueden probar sueltas.
 */

export type TaskKind = 'day' | 'fixed';

export interface PlanTask {
  /** `day:<id>` o `fixed:<id>` (la misma clave que `DayOrder.keys` y `FocusSession.taskKey`). */
  key: string;
  kind: TaskKind;
  id: string;
  title: string;
  time?: string;
  done: boolean;
  createdAt: number;
}

export const dayTaskKey = (id: string) => `day:${id}`;
export const fixedTaskKey = (id: string) => `fixed:${id}`;
/** Las tareas fijas guardan el tilde de cada día en `checks` (como las actividades y las metas diarias). */
export const taskCheckId = (id: string) => `task:${id}`;

export function parseTaskKey(key: string): { kind: TaskKind; id: string } | null {
  const i = key.indexOf(':');
  const kind = key.slice(0, i);
  if (i < 1 || (kind !== 'day' && kind !== 'fixed')) return null;
  return { kind, id: key.slice(i + 1) };
}

const parts = (date: string) => date.split('-').map(Number);

/** 0 = domingo … 6 = sábado (como `FixedTask.weekdays`). */
export function weekdayOf(date: string) {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d).getDay();
}

/** Último instante del día (hora local). */
function dayEnd(date: string) {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}

/** La tarea fija aparece ese día: es uno de sus días, ya existía y todavía no había dejado de repetirse. */
export function fixedTaskAppliesOn(f: FixedTask, date: string) {
  const end = dayEnd(date);
  return f.weekdays.includes(weekdayOf(date)) && f.createdAt <= end && !(f.archivedAt && f.archivedAt <= end);
}

/** Tildes de tareas fijas de ese día (ids de `checks` sin la fecha, ej. `task:abc`). */
export function checkedIdsOn(checks: Check[], date: string) {
  return new Set(checks.filter((c) => c.date === date).map((c) => c.categoryId));
}

/** Orden por defecto: primero lo que tiene hora (en orden), después el resto en el orden en que se cargó. */
export function byDefaultOrder(a: PlanTask, b: PlanTask) {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.createdAt - b.createdAt;
}

/**
 * Tareas del día en el orden por defecto (sin el orden manual). Las descartadas en "Pendientes"
 * siguen apareciendo en su día (sin tildar): descartar solo deja de arrastrarlas.
 */
export function tasksOfDate(date: string, dayTasks: DayTask[], fixedTasks: FixedTask[], checked: Set<string>): PlanTask[] {
  const out: PlanTask[] = [];
  for (const t of dayTasks) {
    if (t.date !== date) continue;
    out.push({ key: dayTaskKey(t.id), kind: 'day', id: t.id, title: t.title, time: t.time, done: !!t.done, createdAt: t.createdAt });
  }
  for (const f of fixedTasks) {
    if (!fixedTaskAppliesOn(f, date)) continue;
    out.push({ key: fixedTaskKey(f.id), kind: 'fixed', id: f.id, title: f.title, time: f.time, done: checked.has(taskCheckId(f.id)), createdAt: f.createdAt });
  }
  return out.sort(byDefaultOrder);
}

/**
 * Aplica el orden manual: las tareas cuya clave está en `keys` van primero, en ese orden; las que
 * no están (ej. agregadas después de ordenar) van después, en el orden que ya traían.
 */
export function applyOrder(tasks: PlanTask[], keys: string[] | undefined): PlanTask[] {
  if (!keys?.length) return tasks;
  const pos = new Map<string, number>();
  keys.forEach((k, i) => {
    if (!pos.has(k)) pos.set(k, i);
  });
  const listed = tasks.filter((t) => pos.has(t.key)).sort((a, b) => pos.get(a.key)! - pos.get(b.key)!);
  const rest = tasks.filter((t) => !pos.has(t.key));
  return [...listed, ...rest];
}

export interface TaskSources {
  dayTasks: DayTask[];
  fixedTasks: FixedTask[];
  checks: Check[];
  dayOrders: DayOrder[];
}

/** Las tareas de un día tal como se muestran (Hoy y Mi semana). */
export function orderedTasksOfDate(date: string, src: TaskSources): PlanTask[] {
  const tasks = tasksOfDate(date, src.dayTasks, src.fixedTasks, checkedIdsOn(src.checks, date));
  return applyOrder(tasks, src.dayOrders.find((o) => o.id === date)?.keys);
}

/** Claves en el orden nuevo después de mover la tarea `index` un lugar (-1 = arriba, 1 = abajo). */
export function moveKey(keys: string[], index: number, delta: -1 | 1): string[] {
  const j = index + delta;
  if (index < 0 || index >= keys.length || j < 0 || j >= keys.length) return keys;
  const next = [...keys];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/** Lo mínimo de la base de datos para tildar/destildar (se le pasa `useDb.getState()`). */
export interface TaskStore {
  dayTasks: DayTask[];
  checks: Check[];
  updateDayTask: (id: string, patch: { done?: boolean }) => void;
  toggleCheck: (date: string, categoryId: string) => void;
}

/** Deja la tarea hecha (o sin hacer) ese día. No hace nada si ya estaba así. */
export function setTaskDone(db: TaskStore, date: string, key: string, done: boolean) {
  const parsed = parseTaskKey(key);
  if (!parsed) return;
  if (parsed.kind === 'day') {
    const t = db.dayTasks.find((x) => x.id === parsed.id);
    if (t && !!t.done !== done) db.updateDayTask(t.id, { done });
    return;
  }
  const checkId = taskCheckId(parsed.id);
  const has = db.checks.some((c) => c.id === `${date}|${checkId}`);
  if (has !== done) db.toggleCheck(date, checkId);
}

/** Resumen de un día para Mi semana. Un día sin tareas no se puede ganar. */
export function dayStatus(tasks: PlanTask[]) {
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, allDone: tasks.length > 0 && done === tasks.length };
}
