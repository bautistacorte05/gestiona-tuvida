import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, today } from '../lib/dates';
import { useDb, type DayTask, type FixedTask } from '../lib/db';
import { useThemeColors } from '../lib/theme';
import { CheckSquare } from './HabitPanel';
import TimeField from './TimeField';
import TrashButton from './TrashButton';

const WEEKDAYS = [
  { day: 1, label: 'L' },
  { day: 2, label: 'M' },
  { day: 3, label: 'X' },
  { day: 4, label: 'J' },
  { day: 5, label: 'V' },
  { day: 6, label: 'S' },
  { day: 0, label: 'D' },
];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WORKDAYS = [1, 2, 3, 4, 5];

type Item = {
  key: string;
  title: string;
  time?: string;
  done: boolean;
  createdAt: number;
  toggle: () => void;
  remove?: () => void;
  badge?: string;
};

// Las tareas fijas guardan el tilde de cada día en `checks` (como las actividades y las metas diarias).
const taskCheckId = (id: string) => `task:${id}`;

function buildItems(date: string, tasks: DayTask[], fixed: FixedTask[], checked: Set<string>) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const dayEnd = new Date(`${date}T23:59:59`).getTime();
  const { toggleCheck, updateDayTask, deleteDayTask, archiveFixedTask } = useDb.getState();
  const items: Item[] = [];

  for (const t of tasks) {
    if (t.date !== date) continue;
    items.push({
      key: t.id,
      title: t.title,
      time: t.time,
      done: !!t.done,
      createdAt: t.createdAt,
      toggle: () => updateDayTask(t.id, { done: !t.done }),
      remove: () => deleteDayTask(t.id),
    });
  }
  for (const f of fixed) {
    // Aparece los días elegidos, desde que se creó y hasta el día anterior a dejar de repetirla.
    if (!f.weekdays.includes(weekday) || f.createdAt > dayEnd || (f.archivedAt && f.archivedAt <= dayEnd)) continue;
    items.push({
      key: f.id,
      title: f.title,
      time: f.time,
      done: checked.has(taskCheckId(f.id)),
      createdAt: f.createdAt,
      toggle: () => toggleCheck(date, taskCheckId(f.id)),
      remove: () => archiveFixedTask(f.id),
      badge: '🔁',
    });
  }

  // Primero lo que tiene hora (en orden), después el resto en el orden en que se cargó.
  return items.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.createdAt - b.createdAt;
  });
}

function Row({ item }: { item: Item }) {
  return (
    <View className="flex-row items-center gap-3 py-1.5">
      {/* El mismo cuadradito que la grilla de hábitos. */}
      <CheckSquare state={item.done ? 'done' : 'missed'} size={26} label={`${item.title}: ${item.done ? 'hecho' : 'sin hacer'}`} onPress={item.toggle} />
      {/* Márgenes explícitos (no gap-x): en el celular el gap entre textos no se aplicaba y la hora quedaba pegada. */}
      <Pressable onPress={item.toggle} className="flex-1 flex-row flex-wrap items-center">
        {!!item.time && <Text className={`mr-2 text-sm font-semibold ${item.done ? 'text-ink-500' : 'text-shu-400'}`}>{item.time}</Text>}
        <Text className={`mr-2 text-base ${item.done ? 'text-ink-500 line-through' : 'text-ink-100'}`}>{item.title}</Text>
        {!!item.badge && <Text className="text-xs text-ink-400">{item.badge}</Text>}
      </Pressable>
      {!!item.remove &&
        (item.badge === '🔁' ? (
          <TrashButton what={`la tarea fija "${item.title}"`} detail="Deja de aparecer desde este día. Los días anteriores quedan como estaban." onDelete={item.remove} />
        ) : (
          <TrashButton what={`la tarea "${item.title}"`} onDelete={item.remove} />
        ))}
    </View>
  );
}

function AddTask({ date }: { date: string }) {
  const c = useThemeColors();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<number[]>(EVERY_DAY);

  const add = () => {
    if (!title.trim()) return;
    const { addDayTask, addFixedTask } = useDb.getState();
    if (repeat) {
      if (!days.length) return;
      addFixedTask(title, days, time);
    } else addDayTask(date, title, time);
    setTitle('');
    setTime('');
    setRepeat(false);
    setDays(EVERY_DAY);
  };

  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  return (
    <View className="gap-2 border-t border-ink-800 pt-3">
      <View className="flex-row gap-2">
        <TextInput
          className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
          placeholder="Agregar tarea, ej: Llamar al veterinario"
          placeholderTextColor={c['ink-500']}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <View style={{ width: 104 }}>
          <TimeField value={time} onChange={setTime} />
        </View>
        <Pressable onPress={add} accessibilityLabel="Agregar" className={`w-11 items-center justify-center rounded-lg bg-shu-500 ${title.trim() ? '' : 'opacity-50'}`}>
          <Text className="text-xl font-semibold text-washi">+</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <Pressable
          onPress={() => setRepeat((r) => !r)}
          className={`rounded-full border px-3 py-1 ${repeat ? 'border-shu-500 bg-shu-500/15' : 'border-ink-700'}`}>
          <Text className={`text-sm ${repeat ? 'text-shu-300' : 'text-ink-400'}`}>🔁 Repetir</Text>
        </Pressable>
        {repeat &&
          WEEKDAYS.map(({ day, label }) => {
            const on = days.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                accessibilityLabel={`${label}: ${on ? 'sí' : 'no'}`}
                className={`h-8 w-8 items-center justify-center rounded-full border ${on ? 'border-shu-500 bg-shu-500' : 'border-ink-700'}`}>
                <Text className={`text-xs font-semibold ${on ? 'text-washi' : 'text-ink-400'}`}>{label}</Text>
              </Pressable>
            );
          })}
      </View>
      {repeat && (
        <View className="flex-row gap-3">
          <Pressable onPress={() => setDays(EVERY_DAY)}>
            <Text className="text-xs text-shu-400">Todos los días</Text>
          </Pressable>
          <Pressable onPress={() => setDays(WORKDAYS)}>
            <Text className="text-xs text-shu-400">Lun a Vie</Text>
          </Pressable>
          {!days.length && <Text className="text-xs text-kurenai-300">Elegí al menos un día</Text>}
        </View>
      )}
    </View>
  );
}

function PendingFromBefore() {
  const allTasks = useDb((s) => s.dayTasks);
  const t = today();
  const pending = useMemo(() => allTasks.filter((x) => x.date < t && !x.done && !x.dismissed).sort((a, b) => a.date.localeCompare(b.date)), [allTasks, t]);
  if (!pending.length) return null;
  const { updateDayTask } = useDb.getState();

  return (
    <View className="gap-2 rounded-lg border border-gold-500/40 bg-gold-500/10 p-3">
      <Text className="text-sm font-semibold text-gold-300">Pendientes de días anteriores ({pending.length})</Text>
      {pending.map((p) => (
        <View key={p.id} className="flex-row flex-wrap items-center gap-2">
          <Text className="flex-1 text-sm text-ink-100">
            {p.title} <Text className="text-xs text-ink-400">· {formatDay(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
          </Text>
          <Pressable onPress={() => updateDayTask(p.id, { date: t })} className="rounded-lg bg-shu-500 px-3 py-1.5">
            <Text className="text-xs font-semibold text-washi">Pasar a hoy</Text>
          </Pressable>
          <Pressable onPress={() => updateDayTask(p.id, { dismissed: true })} className="rounded-lg border border-ink-700 px-3 py-1.5">
            <Text className="text-xs text-ink-400">Descartar</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** Hoy → "Plan del día": tareas sueltas del día y tareas fijas de ese día de la semana (las metas diarias van en la grilla). */
export default function DayPlan({ date }: { date: string }) {
  const tasks = useDb((s) => s.dayTasks);
  const fixed = useDb((s) => s.fixedTasks);
  const allChecks = useDb((s) => s.checks);

  const items = useMemo(() => {
    const checked = new Set(allChecks.filter((c) => c.date === date).map((c) => c.categoryId));
    return buildItems(date, tasks, fixed, checked);
  }, [date, tasks, fixed, allChecks]);

  const doneCount = items.filter((i) => i.done).length;
  const isToday = date === today();

  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-ink-100">📝 Plan del día</Text>
        {items.length > 0 && (
          <Text className="text-sm text-ink-400">
            {doneCount}/{items.length}
          </Text>
        )}
      </View>

      {isToday && <PendingFromBefore />}

      {items.length ? (
        <View>
          {items.map((item) => (
            <Row key={item.key} item={item} />
          ))}
        </View>
      ) : (
        <Text className="text-sm text-ink-400">Todavía no hay nada para este día. Agregá lo que tenés que hacer.</Text>
      )}

      <AddTask date={date} />
    </View>
  );
}
