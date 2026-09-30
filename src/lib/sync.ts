import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { SYNCED_COLLECTIONS, useDb, type SyncedCollection, type SyncMeta } from './db';
import { supabase } from './supabase';

type Row = { id: string } & Record<string, unknown>;
type RemoteRecord = {
  collection: string;
  id: string;
  data: Row | null;
  deleted: boolean;
  updated_at: number;
  server_updated_at: string;
};

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';
export const useSyncStatus = create<{ state: SyncState; lastSyncAt?: number; error?: string }>(() => ({ state: 'idle' }));

// Lotes chicos: un paseo trae todo su recorrido GPS y el perfil de la mascota su foto.
const PUSH_BATCH = 50;
const PULL_PAGE = 1000;
// Dos subidas simultáneas pueden confirmarse fuera de orden, y una podría quedar con hora
// anterior a la marca ya guardada. Por eso, cada vez que la marca avanza, se hace UNA bajada
// con este margen hacia atrás; las siguientes piden solo lo posterior a la marca exacta.
// Re-aplicar un cambio ya visto no tiene efecto (gana la edición más reciente).
const PULL_OVERLAP_MS = 60_000;
const DEBOUNCE_MS = 2_000;
const INTERVAL_MS = 60_000;

const keyOf = (collection: string, id: string) => `${collection}:${id}`;

// Postgres devuelve "2026-09-29 17:13:40.123456+00:00". Date.parse no acepta microsegundos en
// todos los motores (ej. Hermes en el celular), así que se separan los segundos de la fracción.
function toMicros(ts: string) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(ts);
  if (!m) return Date.parse(ts) * 1000;
  let tz = m[4] ?? 'Z';
  if (tz !== 'Z') tz = tz.length === 3 ? `${tz}:00` : tz.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  const fraction = Number((m[3] ?? '').padEnd(6, '0').slice(0, 6));
  return Date.parse(`${m[1]}T${m[2]}${tz}`) * 1000 + fraction;
}
const toMs = (ts: string) => Math.floor(toMicros(ts) / 1000);
const isLater = (a: string, b: string) => toMicros(a) > toMicros(b);
const splitKey = (key: string) => {
  const i = key.indexOf(':');
  return { collection: key.slice(0, i) as SyncedCollection, id: key.slice(i + 1) };
};
const isSynced = (c: string): c is SyncedCollection => (SYNCED_COLLECTIONS as readonly string[]).includes(c);
const rows = (c: SyncedCollection) => useDb.getState()[c] as unknown as Row[];
const setSync = (patch: Partial<SyncMeta>) => useDb.setState((s) => ({ sync: { ...s.sync, ...patch } }));

// ── Detección de cambios locales ─────────────────────────────────────────────
// Las acciones de db.ts son inmutables: un registro editado es un objeto nuevo y
// uno sin tocar conserva su referencia. Comparando antes/después se detecta todo
// alta, edición y borrado sin modificar ninguna acción ni pantalla.

// Se empieza a registrar recién después de cargar la base guardada (esa carga no es un cambio),
// y desde ahí siempre: así no se escapa ninguna edición hecha antes de que arranque la sincronización.
let tracking = false;
void waitForHydration().then(() => {
  tracking = true;
});
function untracked(fn: () => void) {
  const was = tracking;
  tracking = false;
  try {
    fn();
  } finally {
    tracking = was;
  }
}

useDb.subscribe((state, prev) => {
  if (!tracking) return;
  const now = Date.now();
  const pending = { ...state.sync.pending };
  const stamps = { ...state.sync.stamps };
  const tombstones = { ...state.sync.tombstones };
  let changed = false;

  for (const c of SYNCED_COLLECTIONS) {
    const next = state[c] as unknown as Row[];
    const before = prev[c] as unknown as Row[];
    if (next === before) continue;
    const prevById = new Map(before.map((r) => [r.id, r]));
    const nextIds = new Set<string>();
    for (const r of next) {
      nextIds.add(r.id);
      if (prevById.get(r.id) === r) continue;
      const k = keyOf(c, r.id);
      pending[k] = true;
      stamps[k] = now;
      delete tombstones[k];
      changed = true;
    }
    for (const id of prevById.keys()) {
      if (nextIds.has(id)) continue;
      const k = keyOf(c, id);
      pending[k] = true;
      stamps[k] = now;
      tombstones[k] = now;
      changed = true;
    }
  }

  if (changed) {
    untracked(() => setSync({ pending, stamps, tombstones }));
    scheduleSync();
  }
});

// ── Subir / bajar ────────────────────────────────────────────────────────────

// Código de Postgres cuando un registro no cumple una regla de la tabla (check_violation).
const REJECTED_BY_RULES = '23514';

async function push() {
  const { pending, stamps, tombstones } = useDb.getState().sync;
  const keys = Object.keys(pending);
  for (let i = 0; i < keys.length; i += PUSH_BATCH) {
    const batch = keys.slice(i, i + PUSH_BATCH);
    const items: object[] = [];
    const itemKeys: string[] = [];
    /** Registros que viajan en este lote, con el sello de edición que tenían al salir. */
    const sent: Record<string, number> = {};
    /** Claves que ya no existen (o no se sincronizan): se descartan de pendientes. */
    const orphans = new Set<string>();
    for (const k of batch) {
      const { collection, id } = splitKey(k);
      const record = isSynced(collection) ? rows(collection).find((r) => r.id === id) : undefined;
      if (tombstones[k] != null) {
        items.push({ collection, id, data: null, deleted: true, updated_at: tombstones[k] });
      } else if (record) {
        items.push({ collection, id, data: record, deleted: false, updated_at: stamps[k] ?? Date.now() });
      } else {
        orphans.add(k);
        continue;
      }
      itemKeys.push(k);
      sent[k] = stamps[k];
    }
    if (items.length) {
      const { error } = await supabase.rpc('sync_push', { items });
      if (error?.code === REJECTED_BY_RULES) {
        // Un registro que el servidor rechaza (tipo no permitido, demasiado grande) no frena a
        // los demás: se suben de a uno y el rechazado queda pendiente para reintentar.
        for (let j = 0; j < items.length; j++) {
          const one = await supabase.rpc('sync_push', { items: [items[j]] });
          if (one.error?.code === REJECTED_BY_RULES) {
            delete sent[itemKeys[j]];
            if (__DEV__) console.warn(`[sync] el servidor rechazó ${itemKeys[j]}: ${one.error.message}`);
          } else if (one.error) throw one.error;
        }
      } else if (error) throw error;
      if (__DEV__) console.log(`[sync] subidos ${Object.keys(sent).length} de ${items.length} registros`);
    }
    // Solo se da por subido lo que llegó y no se volvió a editar mientras viajaba.
    untracked(() =>
      useDb.setState((s) => {
        const next = { ...s.sync.pending };
        for (const k of batch) if (orphans.has(k) || (k in sent && s.sync.stamps[k] === sent[k])) delete next[k];
        return { sync: { ...s.sync, pending: next } };
      }),
    );
  }
}

async function pull() {
  const { lastPulledAt: last, pullOverlapFor } = useDb.getState().sync;
  const withOverlap = !!last && pullOverlapFor !== last;
  const since = !last ? null : withOverlap ? new Date(toMs(last) - PULL_OVERLAP_MS).toISOString() : last;
  let from = 0;
  let maxSeen = last;
  for (;;) {
    let query = supabase
      .from('records')
      .select('collection,id,data,deleted,updated_at,server_updated_at')
      .order('server_updated_at', { ascending: true })
      .order('collection', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PULL_PAGE - 1);
    if (since) query = query.gt('server_updated_at', since);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as RemoteRecord[];
    if (__DEV__) {
      const sample = page[page.length - 1]?.server_updated_at;
      console.log(`[sync] bajados ${page.length} registros · desde=${since} · última marca guardada=${last} · ejemplo=${sample} → ${sample ? toMs(sample) : '-'}`);
    }
    applyRemote(page);
    for (const r of page) if (!maxSeen || isLater(r.server_updated_at, maxSeen)) maxSeen = r.server_updated_at;
    if (page.length < PULL_PAGE) break;
    from += PULL_PAGE;
  }
  untracked(() => setSync({ lastPulledAt: maxSeen, pullOverlapFor: withOverlap ? last : pullOverlapFor }));
}

function applyRemote(records: RemoteRecord[]) {
  if (!records.length) return;
  untracked(() =>
    useDb.setState((s) => {
      const sync = { ...s.sync, pending: { ...s.sync.pending }, stamps: { ...s.sync.stamps }, tombstones: { ...s.sync.tombstones } };
      const patch: Partial<Record<SyncedCollection, Row[]>> = {};
      for (const r of records) {
        if (!isSynced(r.collection)) continue;
        const k = keyOf(r.collection, r.id);
        const local = sync.stamps[k];
        // Un cambio local sin subir y más nuevo gana: se sube en la próxima pasada.
        if (sync.pending[k] && local != null && local > r.updated_at) continue;
        // Ya aplicado (por ejemplo, el propio cambio que acabamos de subir).
        if (!sync.pending[k] && local === r.updated_at) continue;
        const list = patch[r.collection] ?? [...(s[r.collection] as unknown as Row[])];
        const idx = list.findIndex((x) => x.id === r.id);
        if (r.deleted || !r.data) {
          if (idx >= 0) list.splice(idx, 1);
          sync.tombstones[k] = r.updated_at;
        } else {
          if (idx >= 0) list[idx] = r.data;
          else list.push(r.data);
          delete sync.tombstones[k];
        }
        patch[r.collection] = list;
        sync.stamps[k] = r.updated_at;
        delete sync.pending[k];
      }
      return { ...(patch as object), sync };
    }),
  );
}

// ── Ciclo de sincronización ──────────────────────────────────────────────────

let userId: string | null = null;
let running: Promise<void> | null = null;
let again = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
const cleanups: (() => void)[] = [];

const looksOffline = (e: unknown) => /network|fetch|failed to fetch|timeout/i.test(String((e as Error)?.message ?? e));

export function syncNow(): Promise<void> {
  if (!userId) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    useSyncStatus.setState({ state: 'syncing', error: undefined });
    try {
      do {
        again = false;
        await push();
        await pull();
      } while (again);
      useSyncStatus.setState({ state: 'idle', lastSyncAt: Date.now() });
    } catch (e) {
      if (__DEV__) console.warn('[sync] error:', (e as Error)?.message ?? e);
      useSyncStatus.setState(looksOffline(e) ? { state: 'offline' } : { state: 'error', error: String((e as Error)?.message ?? e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

function scheduleSync() {
  if (!userId) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

function waitForHydration() {
  if (useDb.persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const unsub = useDb.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

function clearLocalData() {
  untracked(() =>
    useDb.setState({
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
      sync: { pending: {}, stamps: {}, tombstones: {} },
    }),
  );
}

/** Arranca la sincronización para la cuenta que acaba de entrar. */
export async function startSync(uid: string) {
  if (userId === uid) return;
  stopSync();
  await waitForHydration();

  const { ownerId } = useDb.getState().sync;
  if (ownerId && ownerId !== uid) {
    // Datos de otra cuenta que no se cerró bien: no se mezclan con esta.
    clearLocalData();
  } else if (!ownerId) {
    // Datos cargados antes del login: pasan a ser de esta cuenta y se suben.
    untracked(() =>
      useDb.setState((s) => {
        const pending = { ...s.sync.pending };
        const stamps = { ...s.sync.stamps };
        for (const c of SYNCED_COLLECTIONS) {
          for (const r of s[c] as unknown as Row[]) {
            const k = keyOf(c, r.id);
            pending[k] = true;
            stamps[k] ??= Number(r.updatedAt ?? r.createdAt ?? r.completedAt ?? Date.now());
          }
        }
        return { sync: { ...s.sync, pending, stamps } };
      }),
    );
  }
  untracked(() => setSync({ ownerId: uid }));

  userId = uid;

  if (Platform.OS === 'web') {
    const onFocus = () => void syncNow();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    cleanups.push(() => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    });
  } else {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void syncNow();
    });
    cleanups.push(() => sub.remove());
  }
  interval = setInterval(() => void syncNow(), INTERVAL_MS);
  if (__DEV__) console.log(`[sync] iniciada · ${pendingCount()} cambios pendientes de subir`);
  void syncNow();
}

export function stopSync() {
  userId = null;
  if (debounce) clearTimeout(debounce);
  if (interval) clearInterval(interval);
  debounce = null;
  interval = null;
  while (cleanups.length) cleanups.pop()!();
  useSyncStatus.setState({ state: 'idle' });
}

export const pendingCount = () => Object.keys(useDb.getState().sync.pending).length;

/**
 * Cierra sesión: primero intenta subir lo pendiente. Si quedan cambios sin subir
 * (por ejemplo, sin conexión) y `force` es false, no cierra y devuelve cuántos son.
 */
export async function signOutSafely(force = false): Promise<{ unsynced: number }> {
  await syncNow();
  const unsynced = pendingCount();
  if (unsynced > 0 && !force) return { unsynced };
  stopSync();
  clearLocalData();
  await supabase.auth.signOut();
  return { unsynced: 0 };
}
