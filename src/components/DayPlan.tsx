import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, today } from '../lib/dates';
import { moveKey, orderedTasksOfDate, setTaskDone, type PlanTask } from '../lib/dayTasks';
import { useDb } from '../lib/db';
import { goToSub } from '../lib/nav';
import { useThemeColors } from '../lib/theme';
import FocusTimer from './FocusTimer';
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

/** Tilda o destilda una tarea ese día (sueltas: `done`; fijas: un tilde en `checks`). */
function toggleTask(date: string, task: PlanTask) {
  setTaskDone(useDb.getState(), date, task.key, !task.done);
}

function removeTask(task: PlanTask) {
  const { deleteDayTask, archiveFixedTask } = useDb.getState();
  if (task.kind === 'day') deleteDayTask(task.id);
  else archiveFixedTask(task.id);
}

function TaskTitle({ task }: { task: PlanTask }) {
  return (
    // Márgenes explícitos (no gap-x): en el celular el gap entre textos no se aplicaba y la hora quedaba pegada.
    <>
      {!!task.time && <Text className={`mr-2 text-sm font-semibold ${task.done ? 'text-ink-500' : 'text-shu-400'}`}>{task.time}</Text>}
      <Text className={`mr-2 text-base ${task.done ? 'text-ink-500 line-through' : 'text-ink-100'}`}>{task.title}</Text>
      {task.kind === 'fixed' && <Text className="text-xs text-ink-400">🔁</Text>}
    </>
  );
}

function Row({ task, date, onFocus }: { task: PlanTask; date: string; onFocus: () => void }) {
  const toggle = () => toggleTask(date, task);
  return (
    <View className="flex-row items-center gap-2 py-1">
      {/* El mismo cuadradito que la grilla de hábitos. */}
      <CheckSquare state={task.done ? 'done' : 'missed'} size={26} label={`${task.title}: ${task.done ? 'hecho' : 'sin hacer'}`} onPress={toggle} />
      <Pressable onPress={toggle} className="ml-1 flex-1 flex-row flex-wrap items-center">
        <TaskTitle task={task} />
      </Pressable>
      <Pressable
        onPress={onFocus}
        accessibilityRole="button"
        accessibilityLabel={`Temporizador para ${task.title}`}
        className="h-11 w-11 items-center justify-center rounded-xl bg-shu-500/15 active:bg-shu-500/30">
        <Text className="text-lg">⏱️</Text>
      </Pressable>
      {task.kind === 'fixed' ? (
        <TrashButton what={`la tarea fija "${task.title}"`} detail="Deja de aparecer desde este día. Los días anteriores quedan como estaban." onDelete={() => removeTask(task)} />
      ) : (
        <TrashButton what={`la tarea "${task.title}"`} onDelete={() => removeTask(task)} />
      )}
    </View>
  );
}

function MoveButton({ dir, title, disabled, onPress }: { dir: 'up' | 'down'; title: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${dir === 'up' ? 'Subir' : 'Bajar'} ${title}`}
      accessibilityState={{ disabled }}
      className={`h-11 w-11 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 active:bg-ink-700 ${disabled ? 'opacity-30' : ''}`}>
      <Text className="text-lg font-bold text-ink-100">{dir === 'up' ? '↑' : '↓'}</Text>
    </Pressable>
  );
}

/** Fila en modo "Ordenar": número de lugar y flechas para subirla o bajarla. */
function OrderRow({ task, index, count, onMove }: { task: PlanTask; index: number; count: number; onMove: (delta: -1 | 1) => void }) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-2 py-1">
      <Text className="w-6 text-center text-sm font-bold text-ink-500">{index + 1}</Text>
      <View className="flex-1 flex-row flex-wrap items-center">
        <TaskTitle task={task} />
      </View>
      <MoveButton dir="up" title={task.title} disabled={index === 0} onPress={() => onMove(-1)} />
      <MoveButton dir="down" title={task.title} disabled={index === count - 1} onPress={() => onMove(1)} />
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

/**
 * Hoy → "Plan del día": tareas sueltas del día y tareas fijas de ese día de la semana (las metas
 * diarias van en la grilla). Se pueden ordenar a mano ("Ordenar") y abrir un temporizador de
 * enfoque (⏱️) para cada una. El orden y las tareas salen de `lib/dayTasks.ts` (igual que Mi semana).
 */
export default function DayPlan({ date }: { date: string }) {
  const dayTasks = useDb((s) => s.dayTasks);
  const fixedTasks = useDb((s) => s.fixedTasks);
  const checks = useDb((s) => s.checks);
  const dayOrders = useDb((s) => s.dayOrders);
  // Se ordena el día en que se tocó "Ordenar": al cambiar de día en Hoy, sale solo del modo.
  const [orderingDate, setOrderingDate] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ date: string; key: string; title: string } | null>(null);

  const items = useMemo(() => orderedTasksOfDate(date, { dayTasks, fixedTasks, checks, dayOrders }), [date, dayTasks, fixedTasks, checks, dayOrders]);

  const ordering = orderingDate === date;
  const doneCount = items.filter((i) => i.done).length;
  const isToday = date === today();

  // Cada movida guarda el orden completo de ese día.
  const move = (index: number, delta: -1 | 1) =>
    useDb.getState().setDayOrder(
      date,
      moveKey(
        items.map((i) => i.key),
        index,
        delta,
      ),
    );

  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="shrink text-base font-bold text-ink-100">📝 Plan del día</Text>
        <View className="flex-row items-center gap-3">
          {items.length > 0 && (
            <Text className="text-sm text-ink-400">
              {doneCount}/{items.length}
            </Text>
          )}
          {(ordering || items.length > 1) && (
            <Pressable
              onPress={() => setOrderingDate(ordering ? null : date)}
              accessibilityRole="button"
              accessibilityLabel={ordering ? 'Terminar de ordenar' : 'Ordenar las tareas'}
              className={`h-11 items-center justify-center rounded-xl border px-3.5 ${ordering ? 'border-shu-500 bg-shu-500' : 'border-ink-700 active:bg-ink-800'}`}>
              <Text className={`text-sm font-semibold ${ordering ? 'text-washi' : 'text-ink-300'}`}>{ordering ? 'Listo' : 'Ordenar'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isToday && <PendingFromBefore />}

      {items.length ? (
        <View>
          {items.map((task, i) =>
            ordering ? (
              <OrderRow key={task.key} task={task} index={i} count={items.length} onMove={(delta) => move(i, delta)} />
            ) : (
              <Row key={task.key} task={task} date={date} onFocus={() => setFocus({ date, key: task.key, title: task.title })} />
            ),
          )}
        </View>
      ) : (
        <Text className="text-sm text-ink-400">Todavía no hay nada para este día. Agregá lo que tenés que hacer.</Text>
      )}

      {ordering ? <Text className="text-xs text-ink-500">Usá las flechas para cambiar el orden. Tocá &quot;Listo&quot; cuando termines.</Text> : <AddTask date={date} />}

      <Pressable onPress={() => goToSub('semana', 'plan')} accessibilityRole="link" className="min-h-11 justify-center self-start">
        <Text className="text-sm font-semibold text-shu-400">Ver la semana →</Text>
      </Pressable>

      {!!focus && <FocusTimer date={focus.date} taskKey={focus.key} title={focus.title} onClose={() => setFocus(null)} />}
    </View>
  );
}
