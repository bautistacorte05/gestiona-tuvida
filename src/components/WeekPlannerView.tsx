import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatDay, monthKey, shiftDay, today, weekStart } from '../lib/dates';
import { dayStatus, orderedTasksOfDate, setTaskDone, type PlanTask } from '../lib/dayTasks';
import { useDb } from '../lib/db';
import { weekDates } from '../lib/habits';
import { useIsDesktop } from '../lib/layout';
import { useThemeColors } from '../lib/theme';
import BackButton from './BackButton';
import EditTaskSheet from './EditTaskSheet';
import ScreenTitle from './ScreenTitle';
import TrashButton from './TrashButton';

const CARD = 'rounded-2xl border border-ink-800 bg-ink-900';
const INPUT = 'h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-base text-ink-100';
/** Ancho mínimo de cada día en la grilla de la PC. */
const DESK_CARD_W = 300;
const DESK_GAP = 12;

type Day = { date: string; tasks: PlanTask[]; done: number; total: number; allDone: boolean; prize?: string };

/** "29 sept – 5 oct" (o "6 – 12 oct" si es el mismo mes). */
function weekLabel(start: string, end: string) {
  const short = (d: string) => formatDay(d, { day: 'numeric', month: 'short' });
  return monthKey(start) === monthKey(end) ? `${Number(start.slice(8))} – ${short(end)}` : `${short(start)} – ${short(end)}`;
}

function NavButton({ label, text, onPress }: { label: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="h-11 w-11 items-center justify-center rounded-xl border border-ink-800 bg-ink-900 active:bg-ink-800">
      <Text className="text-xl text-ink-300">{text}</Text>
    </Pressable>
  );
}

/** Igual que en Hoy: la suelta se borra; la fija deja de repetirse desde hoy. */
function removeTask(task: PlanTask) {
  const { deleteDayTask, archiveFixedTask } = useDb.getState();
  if (task.kind === 'day') deleteDayTask(task.id);
  else archiveFixedTask(task.id);
}

function TaskLine({ task, date, onEdit }: { task: PlanTask; date: string; onEdit: () => void }) {
  return (
    <View className="flex-row items-center gap-1">
      <Pressable
        onPress={() => setTaskDone(useDb.getState(), date, task.key, !task.done)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.title}
        className="min-h-11 flex-1 flex-row items-center gap-2.5 rounded-lg active:bg-ink-800">
        <View className={`h-5 w-5 items-center justify-center rounded-md ${task.done ? 'bg-shu-500' : 'border-2 border-ink-600'}`}>
          {task.done && <Text className="text-[11px] font-bold text-washi">✓</Text>}
        </View>
        <Text className={`flex-1 text-sm ${task.done ? 'text-ink-500 line-through' : 'text-ink-100'}`}>
          {!!task.time && <Text className={task.done ? 'text-ink-500' : 'font-semibold text-shu-400'}>{task.time} </Text>}
          {task.title}
          {task.kind === 'fixed' && <Text className="text-xs text-ink-400"> 🔁</Text>}
        </Text>
      </Pressable>
      <Pressable onPress={onEdit} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Editar "${task.title}"`} className="h-9 w-9 items-center justify-center rounded-lg active:bg-ink-800">
        <Text className="text-sm opacity-60">✏️</Text>
      </Pressable>
      {task.kind === 'fixed' ? (
        <TrashButton what={`la tarea fija "${task.title}"`} detail="Deja de aparecer desde hoy. Los días anteriores quedan como estaban." onDelete={() => removeTask(task)} />
      ) : (
        <TrashButton what={`la tarea "${task.title}"`} onDelete={() => removeTask(task)} />
      )}
    </View>
  );
}

/** Campo para sumar tareas sueltas a ese día (queda abierto para cargar varias seguidas). */
function AddInline({ date, onClose }: { date: string; onClose: () => void }) {
  const c = useThemeColors();
  const [title, setTitle] = useState('');
  const add = () => {
    if (!title.trim()) return;
    useDb.getState().addDayTask(date, title);
    setTitle('');
  };
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        className={`flex-1 ${INPUT}`}
        placeholder="Nueva tarea"
        placeholderTextColor={c['ink-500']}
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={add}
        returnKeyType="done"
        submitBehavior="submit"
        autoFocus
        accessibilityLabel={`Nueva tarea para el ${formatDay(date, { weekday: 'long', day: 'numeric' }).toLowerCase()}`}
      />
      <Pressable onPress={add} accessibilityRole="button" className={`h-11 items-center justify-center rounded-xl bg-shu-500 px-3.5 ${title.trim() ? '' : 'opacity-50'}`}>
        <Text className="font-semibold text-washi">Agregar</Text>
      </Pressable>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center rounded-xl active:bg-ink-800">
        <Text className="text-ink-300">✕</Text>
      </Pressable>
    </View>
  );
}

function PrizeRow({ day, isToday, isPast, onPress }: { day: Day; isToday: boolean; isPast: boolean; onPress: () => void }) {
  if (!day.prize) {
    // A un día que ya pasó no tiene sentido ponerle premio.
    if (isPast) return null;
    return (
      <Pressable onPress={onPress} accessibilityRole="button" className="min-h-11 flex-row items-center gap-2 rounded-xl border border-dashed border-ink-700 px-2.5 active:bg-ink-800">
        <Text className="text-sm opacity-50">🎁</Text>
        <Text className="text-[13px] text-ink-400">+ Poner un premio</Text>
      </Pressable>
    );
  }

  let state: string;
  let tone: 'won' | 'lost' | 'open';
  if (day.allDone) {
    state = '¡Ganado!';
    tone = 'won';
  } else if (isPast) {
    state = 'Se escapó';
    tone = 'lost';
  } else {
    state = !day.total ? 'Sin tareas' : isToday ? `Faltan ${day.total - day.done}` : 'Premio';
    tone = 'open';
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Premio: ${day.prize}. ${state}. Tocá para cambiarlo.`}
      className={`min-h-11 flex-row items-center gap-2 rounded-xl px-2.5 py-2 ${tone === 'won' ? 'bg-shu-500/15' : 'bg-ink-950'}`}>
      <Text className={`text-sm ${tone === 'lost' ? 'opacity-40' : ''}`}>🎁</Text>
      <Text className={`flex-1 text-[13px] ${tone === 'won' ? 'text-ink-100' : tone === 'lost' ? 'text-ink-500 line-through' : 'text-ink-300'}`}>{day.prize}</Text>
      <Text className={`text-xs font-bold ${tone === 'won' ? 'text-shu-300' : tone === 'lost' ? 'text-ink-500' : 'text-ink-400'}`}>{state}</Text>
    </Pressable>
  );
}

function DayCard({
  day,
  now,
  adding,
  onAdd,
  onCloseAdd,
  onPrize,
  onEditTask,
  width,
}: {
  day: Day;
  now: string;
  adding: boolean;
  onAdd: () => void;
  onCloseAdd: () => void;
  onPrize: () => void;
  onEditTask: (task: PlanTask) => void;
  width?: number;
}) {
  const isToday = day.date === now;
  const isPast = day.date < now;
  return (
    <View className={`gap-2 rounded-2xl bg-ink-900 px-3.5 py-3 ${isToday ? 'border-2 border-shu-500' : 'border border-ink-800'}`} style={width ? { width } : undefined}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="shrink flex-row flex-wrap items-baseline gap-x-1.5">
          <Text className="text-base font-bold text-ink-100">{formatDay(day.date, { weekday: 'long' })}</Text>
          <Text className="text-[13px] text-ink-400">{Number(day.date.slice(8))}</Text>
          {isToday && (
            <View className="self-center rounded-full bg-shu-500 px-2 py-0.5">
              <Text className="text-[11px] font-bold text-washi">HOY</Text>
            </View>
          )}
        </View>
        <View className={`rounded-full px-2.5 py-1 ${day.allDone ? 'bg-shu-500' : 'bg-ink-800'}`}>
          <Text className={`text-xs font-bold ${day.allDone ? 'text-washi' : 'text-ink-400'}`}>{day.total ? `${day.done}/${day.total}` : 'Sin tareas'}</Text>
        </View>
      </View>

      {day.tasks.length > 0 && (
        <View>
          {day.tasks.map((task) => (
            <TaskLine key={task.key} task={task} date={day.date} onEdit={() => onEditTask(task)} />
          ))}
        </View>
      )}

      {adding ? (
        <AddInline date={day.date} onClose={onCloseAdd} />
      ) : (
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={`Agregar una tarea al ${formatDay(day.date, { weekday: 'long', day: 'numeric' }).toLowerCase()}`} className="min-h-11 justify-center self-start">
          <Text className="text-sm font-semibold text-shu-400">+ Agregar</Text>
        </Pressable>
      )}

      <PrizeRow day={day} isToday={isToday} isPast={isPast} onPress={onPrize} />
    </View>
  );
}

/** Hoja para poner, cambiar o sacar el premio de un día. */
function PrizeSheet({ date, current, onClose }: { date: string; current?: string; onClose: () => void }) {
  const c = useThemeColors();
  const [text, setText] = useState(current ?? '');
  const save = (value: string) => {
    useDb.getState().setDayPrize(date, value);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="gap-3 rounded-t-3xl border border-ink-800 bg-ink-900 px-5 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-ink-100">🎁 Premio del {formatDay(date, { weekday: 'long', day: 'numeric' }).toLowerCase()}</Text>
              <Pressable onPress={onClose} className="h-11 w-11 items-center justify-center" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <TextInput
              className={INPUT}
              value={text}
              onChangeText={setText}
              placeholder="Ej: Un helado, un capítulo de la serie"
              placeholderTextColor={c['ink-500']}
              onSubmitEditing={() => save(text)}
              returnKeyType="done"
              maxLength={80}
              autoFocus
              accessibilityLabel="Premio"
            />
            <Text className="text-xs text-ink-500">Lo ganás si terminás todas las tareas de ese día.</Text>
            <View className="flex-row gap-2 pt-1">
              {!!current && (
                <Pressable onPress={() => save('')} className="h-11 items-center justify-center rounded-xl border border-ink-700 px-4">
                  <Text className="text-ink-300">Sacar premio</Text>
                </Pressable>
              )}
              <Pressable onPress={() => save(text)} className="h-11 flex-1 items-center justify-center rounded-xl bg-shu-500">
                <Text className="font-semibold text-washi">Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Mi semana: las tareas de cada día de la semana (las mismas de Hoy, en el mismo orden), para
 * tildarlas o sumar tareas a otros días, y un premio por día que se gana terminando todo.
 */
export default function WeekPlannerView() {
  const isDesktop = useIsDesktop();
  const now = today();
  const [anchor, setAnchor] = useState(today);
  const [adding, setAdding] = useState<string | null>(null);
  const [prizeFor, setPrizeFor] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<PlanTask | null>(null);
  const [gridW, setGridW] = useState(0);

  const dayTasks = useDb((s) => s.dayTasks);
  const fixedTasks = useDb((s) => s.fixedTasks);
  const checks = useDb((s) => s.checks);
  const dayOrders = useDb((s) => s.dayOrders);
  const dayPrizes = useDb((s) => s.dayPrizes);

  const dates = useMemo(() => weekDates(anchor), [anchor]);
  const days: Day[] = useMemo(
    () =>
      dates.map((date) => {
        const tasks = orderedTasksOfDate(date, { dayTasks, fixedTasks, checks, dayOrders });
        return { date, tasks, ...dayStatus(tasks), prize: dayPrizes.find((p) => p.id === date)?.text };
      }),
    [dates, dayTasks, fixedTasks, checks, dayOrders, dayPrizes],
  );

  const total = days.reduce((sum, d) => sum + d.total, 0);
  const done = days.reduce((sum, d) => sum + d.done, 0);
  const withPrize = days.filter((d) => d.prize).length;
  const won = days.filter((d) => d.prize && d.allDone).length;
  const isThisWeek = weekStart(anchor) === weekStart(now);

  // PC: los días en columnas que llenan el ancho (en el celular, uno abajo del otro).
  const cols = isDesktop && gridW ? Math.max(1, Math.floor((gridW + DESK_GAP) / (DESK_CARD_W + DESK_GAP))) : 1;
  const cardW = cols > 1 ? Math.floor((gridW - DESK_GAP * (cols - 1)) / cols) : undefined;

  const goWeek = (delta: number) => {
    setAnchor((a) => shiftDay(a, delta * 7));
    setAdding(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-4 pb-10 pt-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="semana" subId="plan" />
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <NavButton label="Semana anterior" text="‹" onPress={() => goWeek(-1)} />
          <View className="flex-1 items-center">
            <Text className="text-base font-semibold text-ink-100">{weekLabel(dates[0], dates[6])}</Text>
            {isThisWeek ? (
              <Text className="text-xs text-ink-400">Esta semana</Text>
            ) : (
              <Pressable onPress={() => setAnchor(today())} accessibilityRole="button" hitSlop={8}>
                <Text className="text-xs text-shu-400">Volver a esta semana</Text>
              </Pressable>
            )}
          </View>
          <NavButton label="Semana siguiente" text="›" onPress={() => goWeek(1)} />
        </View>

        <View className="flex-row gap-2.5">
          <View className={`flex-1 gap-2 p-3 ${CARD}`}>
            <Text className="text-xs text-ink-400">Tareas de la semana</Text>
            <Text className="text-2xl font-extrabold text-ink-100">
              {done} <Text className="text-sm font-medium text-ink-400">de {total}</Text>
            </Text>
            <View className="h-1.5 overflow-hidden rounded-full bg-ink-800">
              <View className="h-full rounded-full bg-shu-500" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
            </View>
          </View>
          <View className={`flex-1 gap-2 p-3 ${CARD}`}>
            <Text className="text-xs text-ink-400">Premios ganados</Text>
            <Text className="text-2xl font-extrabold text-shu-300">
              {won} {withPrize > 0 && <Text className="text-sm font-medium text-ink-400">de {withPrize}</Text>}
            </Text>
            <Text className="text-xs text-ink-500">{withPrize > 0 ? 'terminando todo el día' : 'Ponele un premio a algún día'}</Text>
          </View>
        </View>

        <View
          className={cols > 1 ? 'flex-row flex-wrap' : 'gap-3'}
          style={cols > 1 ? { gap: DESK_GAP } : undefined}
          onLayout={isDesktop ? (e) => setGridW(e.nativeEvent.layout.width) : undefined}>
          {days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              now={now}
              width={cardW}
              adding={adding === day.date}
              onAdd={() => setAdding(day.date)}
              onCloseAdd={() => setAdding(null)}
              onPrize={() => setPrizeFor(day.date)}
              onEditTask={setEditingTask}
            />
          ))}
        </View>
      </ScrollView>

      {!!prizeFor && <PrizeSheet date={prizeFor} current={days.find((d) => d.date === prizeFor)?.prize} onClose={() => setPrizeFor(null)} />}
      {!!editingTask && <EditTaskSheet task={editingTask} onClose={() => setEditingTask(null)} />}
    </SafeAreaView>
  );
}
