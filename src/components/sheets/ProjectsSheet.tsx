import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { useFindSub } from '../../lib/names';
import { deadlineInfo, deadlineOf, nextDue, projectsIn, type Plazo, type ProjectState } from '../../lib/projects';
import { useThemeColors } from '../../lib/theme';
import { Empty } from '../common';
import EntryForm from '../EntryForm';
import TrashButton from '../TrashButton';
import { Choice, Hero, PrimaryButton, Section, Segmented, SheetScreen, SmallButton } from './kit';

const deleteProject = (p: Entry) => useDb.getState().deleteEntry(p.id);

/**
 * Hoja de Proyectos: lo próximo que vence, los proyectos en curso con sus acciones, los pendientes,
 * pausados y terminados, y un alta rápida. Usa los registros de siempre (proyectos/proyectos).
 * Tocar un proyecto abre la ficha completa (fecha límite, nota, borrar).
 */

type Filter = 'todos' | Plazo;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Corto plazo', label: 'Corto plazo' },
  { value: 'Largo plazo', label: 'Largo plazo' },
];

const nameOf = (p: Entry) => String(p.values.nombre ?? '').trim() || 'Sin nombre';
const plazoOf = (p: Entry) => String(p.values.plazo ?? '');

/** Mensaje corto que se va solo ("Agregado ✓"). */
function useFlash(ms = 2200) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), ms);
    },
    [ms],
  );
  return [msg, show] as const;
}

/** "Corto plazo · vence el 20 de noviembre" / "Largo plazo · sin fecha". */
function metaOf(p: Entry, now: string) {
  const date = deadlineOf(p);
  const when = date ? `${date < now ? 'venció' : 'vence'} el ${formatDay(date, { day: 'numeric', month: 'long' })}` : 'sin fecha';
  return [plazoOf(p), when].filter(Boolean).join(' · ');
}

export default function ProjectsSheet() {
  const entries = useDb((s) => s.entries);
  const saveEntry = useDb((s) => s.saveEntry);
  const found = useFindSub('proyectos', 'proyectos');
  const now = today();
  const [filter, setFilter] = useState<Filter>('todos');
  const [plazo, setPlazo] = useState<Plazo>('Corto plazo');
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);

  const all = useMemo(() => entries.filter((e) => e.categoryId === 'proyectos' && e.subId === 'proyectos'), [entries]);
  const projects = useMemo(() => (filter === 'todos' ? all : all.filter((p) => p.values.plazo === filter)), [all, filter]);
  const due = useMemo(() => nextDue(projects, now), [projects, now]);
  const active = useMemo(() => projectsIn(projects, 'En curso'), [projects]);
  const pending = useMemo(() => projectsIn(projects, 'Pendiente'), [projects]);
  const paused = useMemo(() => projectsIn(projects, 'Pausado', 'recent'), [projects]);
  const done = useMemo(() => projectsIn(projects, 'Terminado', 'recent'), [projects]);

  const setState = (p: Entry, estado: ProjectState) =>
    saveEntry({ id: p.id, categoryId: p.categoryId, subId: p.subId, date: p.date, values: { ...p.values, estado } });

  const changeFilter = (f: Filter) => {
    setFilter(f);
    // Si estás mirando un solo plazo, lo nuevo se carga en ese plazo (así aparece en la lista).
    if (f !== 'todos') setPlazo(f);
  };

  const empty = projects.length === 0;

  return (
    <SheetScreen
      categoryId="proyectos"
      overlay={
        editing && found ? (
          <EntryForm
            key={editing === 'new' ? 'new' : editing.id}
            category={found.category}
            sub={found.sub}
            entry={editing === 'new' ? undefined : editing}
            defaultDate={now}
            onClose={() => setEditing(null)}
          />
        ) : null
      }>
      <Segmented options={FILTERS} value={filter} onChange={changeFilter} />

      {!!due && (
        <Pressable
          onPress={() => setEditing(due.project)}
          accessibilityRole="button"
          accessibilityLabel={`Lo próximo que vence: ${nameOf(due.project)}, ${formatDay(due.date)}, ${deadlineInfo(due.date, now).text.toLowerCase()}`}
          className="active:opacity-80">
          <Hero title="Lo próximo que vence">
            <View className="flex-row items-end justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-2xl font-extrabold text-ink-100">{nameOf(due.project)}</Text>
                <Text className="mt-0.5 text-[13px] text-ink-300">{formatDay(due.date).replace(',', '')}</Text>
              </View>
              <View className="items-end">
                <Text className="text-4xl font-extrabold text-shu-300">{due.days === 0 ? 'Hoy' : due.days}</Text>
                {due.days > 0 && <Text className="text-xs text-ink-300">{due.days === 1 ? 'día' : 'días'}</Text>}
              </View>
            </View>
          </Hero>
        </Pressable>
      )}

      {empty && (
        <Empty>
          {all.length === 0 ? 'Todavía no tenés proyectos. Agregá el primero acá abajo.' : `No tenés proyectos de ${String(filter).toLowerCase()}.`}
        </Empty>
      )}

      {active.length > 0 && (
        <Section title={`En curso · ${active.length}`}>
          {active.map((p, i) => (
            <ActiveProject
              key={p.id}
              project={p}
              now={now}
              first={i === 0}
              onOpen={() => setEditing(p)}
              onPause={() => setState(p, 'Pausado')}
              onDone={() => setState(p, 'Terminado')}
            />
          ))}
        </Section>
      )}

      {pending.length > 0 && (
        <Section title={`Pendientes · ${pending.length}`}>
          <PagedList
            items={pending}
            render={(p, first) => (
              <ProjectRow
                key={p.id}
                project={p}
                now={now}
                first={first}
                onOpen={() => setEditing(p)}
                action={{ label: 'Empezar', onPress: () => setState(p, 'En curso') }}
              />
            )}
          />
        </Section>
      )}

      {(paused.length > 0 || done.length > 0) && (
        <View className="gap-2">
          {paused.length > 0 && (
            <Collapsible label={`Pausados · ${paused.length}`}>
              <PagedList
                items={paused}
                render={(p, first) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    now={now}
                    first={first}
                    onOpen={() => setEditing(p)}
                    action={{ label: 'Retomar', onPress: () => setState(p, 'En curso') }}
                  />
                )}
              />
            </Collapsible>
          )}
          {done.length > 0 && (
            <Collapsible label={`Terminados · ${done.length}`}>
              <PagedList
                items={done}
                render={(p, first) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    now={now}
                    first={first}
                    hideDeadline
                    onOpen={() => setEditing(p)}
                    action={{ label: 'Reabrir', onPress: () => setState(p, 'En curso') }}
                  />
                )}
              />
            </Collapsible>
          )}
        </View>
      )}

      <NewProject plazo={plazo} onPlazo={setPlazo} />
    </SheetScreen>
  );
}

function PlazoBadge({ plazo }: { plazo: string }) {
  if (!plazo) return null;
  const short = plazo === 'Corto plazo';
  return (
    <View className={`rounded-full px-2 py-0.5 ${short ? 'bg-shu-500/20' : 'bg-ink-800'}`}>
      <Text numberOfLines={1} className={`text-[11px] font-bold ${short ? 'text-shu-300' : 'text-ink-300'}`}>
        {plazo}
      </Text>
    </View>
  );
}

/** Proyecto en curso: nombre, plazo, nota, cuándo vence y Pausar / Terminado. */
function ActiveProject({
  project,
  now,
  first,
  onOpen,
  onPause,
  onDone,
}: {
  project: Entry;
  now: string;
  first: boolean;
  onOpen: () => void;
  onPause: () => void;
  onDone: () => void;
}) {
  const name = nameOf(project);
  const nota = String(project.values.nota ?? '').trim();
  const info = deadlineInfo(deadlineOf(project), now);
  return (
    <View className={`gap-2.5 ${first ? '' : 'border-t border-ink-800 pt-3'}`}>
      <View className="flex-row items-start">
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${name}. Tocá para ver o editar.`} className="min-w-0 flex-1 gap-1.5 active:opacity-70">
          <View className="flex-row items-start justify-between gap-2.5">
            <Text className="min-w-0 flex-1 text-base font-bold text-ink-100">{name}</Text>
            <PlazoBadge plazo={plazoOf(project)} />
          </View>
          {!!nota && (
            <Text numberOfLines={2} className="text-[13px] text-ink-400">
              {nota}
            </Text>
          )}
        </Pressable>
        <View className="-mr-2 -mt-2.5">
          <TrashButton what={`el proyecto "${name}"`} onDelete={() => deleteProject(project)} />
        </View>
      </View>
      <View className="flex-row flex-wrap items-center justify-between gap-2.5">
        <Text className={`text-[13px] ${info.urgent ? 'font-semibold text-gold-400' : 'text-ink-400'}`}>{info.text}</Text>
        <View className="flex-row gap-2">
          <SmallButton label="Pausar" onPress={onPause} accessibilityLabel={`Pausar ${name}`} />
          <SmallButton label="Terminado" strong onPress={onDone} accessibilityLabel={`Marcar ${name} como terminado`} />
        </View>
      </View>
    </View>
  );
}

/** Fila de proyecto (pendientes, pausados, terminados) con una acción. */
function ProjectRow({
  project,
  now,
  first,
  hideDeadline,
  onOpen,
  action,
}: {
  project: Entry;
  now: string;
  first: boolean;
  hideDeadline?: boolean;
  onOpen: () => void;
  action: { label: string; onPress: () => void };
}) {
  const name = nameOf(project);
  const meta = hideDeadline ? plazoOf(project) : metaOf(project, now);
  const date = deadlineOf(project);
  const overdue = !hideDeadline && !!date && date < now;
  return (
    <View className={`flex-row items-center gap-2.5 py-3 ${first ? '' : 'border-t border-ink-800'}`}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${name}${meta ? `, ${meta}` : ''}. Tocá para ver o editar.`} className="min-w-0 flex-1 active:opacity-70">
        <Text numberOfLines={1} className="text-[15px] font-semibold text-ink-100">
          {name}
        </Text>
        {!!meta && (
          <Text numberOfLines={1} className={`mt-0.5 text-xs ${overdue ? 'text-gold-400' : 'text-ink-400'}`}>
            {meta}
          </Text>
        )}
      </Pressable>
      <SmallButton label={action.label} onPress={action.onPress} accessibilityLabel={`${action.label} ${name}`} />
      <TrashButton what={`el proyecto "${name}"`} onDelete={() => deleteProject(project)} />
    </View>
  );
}

/** Alta rápida: nombre + plazo. La fecha límite y la nota se cargan tocando el proyecto. */
function NewProject({ plazo, onPlazo }: { plazo: Plazo; onPlazo: (p: Plazo) => void }) {
  const c = useThemeColors();
  const saveEntry = useDb((s) => s.saveEntry);
  const [name, setName] = useState('');
  const [flash, showFlash] = useFlash();
  const valid = !!name.trim();

  const add = () => {
    const nombre = name.trim();
    if (!nombre) return;
    saveEntry({ categoryId: 'proyectos', subId: 'proyectos', date: today(), values: { nombre, plazo, estado: 'Pendiente' } });
    setName('');
    showFlash(`Agregado ✓ · ${nombre} quedó en Pendientes`);
  };

  return (
    <Section title="Nuevo proyecto">
      <View className="gap-1.5">
        <Text className="text-[13px] text-ink-400">Nombre</Text>
        <TextInput
          className="h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
          placeholder="Ej: Pintar el living"
          placeholderTextColor={c['ink-500']}
          accessibilityLabel="Nombre del proyecto nuevo"
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
        />
      </View>
      <View className="flex-row gap-2">
        <Choice label="Corto plazo" selected={plazo === 'Corto plazo'} onPress={() => onPlazo('Corto plazo')} />
        <Choice label="Largo plazo" selected={plazo === 'Largo plazo'} onPress={() => onPlazo('Largo plazo')} />
      </View>
      <PrimaryButton label="Agregar proyecto" onPress={add} disabled={!valid} />
      <Text className={`text-xs ${flash ? 'font-semibold text-shu-300' : 'text-ink-500'}`} accessibilityLiveRegion="polite">
        {flash ?? 'La fecha límite y una nota se agregan tocando el proyecto en la lista.'}
      </Text>
    </Section>
  );
}

/** Lista que muestra los primeros y suma más con "Ver más". */
function PagedList({ items, render }: { items: Entry[]; render: (item: Entry, first: boolean) => ReactNode }) {
  const [shown, setShown] = useState(5);
  return (
    <View>
      {items.slice(0, shown).map((item, i) => render(item, i === 0))}
      {items.length > shown && (
        <View className="mt-2">
          <SmallButton label="Ver más" onPress={() => setShown((n) => n + 10)} />
        </View>
      )}
    </View>
  );
}

/** Fila que se despliega (Pausados, Terminados). */
function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-2xl border border-ink-800 bg-ink-900">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="h-[52px] flex-row items-center justify-between px-4 active:opacity-70">
        <Text className="text-[15px] text-ink-300">{label}</Text>
        <Text className="text-xl text-ink-400" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          ›
        </Text>
      </Pressable>
      {open && <View className="px-4 pb-1">{children}</View>}
    </View>
  );
}
