import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { confirm } from '../../lib/confirm';
import { formatDay, today, weekStart } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { goToSub } from '../../lib/nav';
import { lastWeeks } from '../../lib/training';
import { markDone } from '../../lib/sheets';
import { SPORT_DISCIPLINES, findDiscipline, sportSummary, type SportField } from '../../lib/sports';
import { useThemeColors } from '../../lib/theme';
import TrashButton from '../TrashButton';
import DateField from '../DateField';
import { Chip, PrimaryButton, SheetScreen, SmallButton } from './kit';

function useProfile() {
  return useDb((s) => s.userProfile[0]);
}

function saveDisciplines(ids: string[], customSports?: Record<string, string>) {
  useDb.getState().updateUserProfile({ sportDisciplines: ids, customSports });
}

const isSportsEntry = (e: Entry) => e.categoryId === 'entrenamiento' && e.subId === 'deportes';

interface ResolvedDiscipline {
  id: string;
  name: string;
  emoji: string;
  sessionTypes: string[];
  fields: SportField[];
}

function resolveDiscipline(id: string, customSports: Record<string, string>): ResolvedDiscipline {
  const builtin = findDiscipline(id);
  if (builtin) return { id, name: builtin.name, emoji: builtin.emoji, sessionTypes: builtin.sessionTypes, fields: builtin.fields };
  const emoji = customSports[id] ?? '🏅';
  const name = id.replace('custom:', '').replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  return { id, name, emoji, sessionTypes: ['Entrenamiento', 'Partido', 'Físico'], fields: [] };
}

function customLabel(id: string) {
  return id.replace('custom:', '').replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// ——— Selector de disciplinas ———

function DisciplinePicker({ selected, customSports, onDone }: { selected: string[]; customSports: Record<string, string>; onDone: (ids: string[], custom: Record<string, string>) => void }) {
  const c = useThemeColors();
  const [picked, setPicked] = useState<string[]>(selected);
  const [customs, setCustoms] = useState<Record<string, string>>(customSports);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🏅');

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addCustom = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `custom:${name.toLowerCase().replace(/\s+/g, '-')}`;
    setCustoms((prev) => ({ ...prev, [id]: newEmoji || '🏅' }));
    setPicked((prev) => [...prev, id]);
    setNewName('');
    setNewEmoji('🏅');
    setAdding(false);
  };

  return (
    <View className="flex-1 gap-5">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-ink-100">¿Qué deportes practicás?</Text>
        <Text className="text-sm text-ink-400">Elegí uno o varios. Después podés cambiarlos.</Text>
      </View>

      <View className="flex-row flex-wrap gap-2.5">
        {SPORT_DISCIPLINES.map((d) => {
          const active = picked.includes(d.id);
          return (
            <Pressable
              key={d.id}
              onPress={() => toggle(d.id)}
              className={`flex-row items-center gap-2 rounded-xl px-4 py-3 ${active ? 'border border-shu-400 bg-shu-500/20' : 'border border-ink-700 bg-ink-950'}`}>
              <Text className="text-xl">{d.emoji}</Text>
              <Text className={`text-[15px] ${active ? 'font-semibold text-shu-300' : 'text-ink-300'}`}>{d.name}</Text>
            </Pressable>
          );
        })}
        {Object.entries(customs).map(([id, emoji]) => {
          const active = picked.includes(id);
          return (
            <Pressable
              key={id}
              onPress={() => toggle(id)}
              className={`flex-row items-center gap-2 rounded-xl px-4 py-3 ${active ? 'border border-shu-400 bg-shu-500/20' : 'border border-ink-700 bg-ink-950'}`}>
              <Text className="text-xl">{emoji}</Text>
              <Text className={`text-[15px] ${active ? 'font-semibold text-shu-300' : 'text-ink-300'}`}>{customLabel(id)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setAdding(true)}
          className="flex-row items-center gap-2 rounded-xl border border-dashed border-shu-500/40 bg-shu-500/10 px-4 py-3">
          <Text className="text-sm font-semibold text-shu-400">+ Otro deporte</Text>
        </Pressable>
      </View>

      {adding && (
        <View className="gap-3 rounded-xl border border-ink-800 bg-ink-900 p-4">
          <Text className="text-sm font-semibold text-ink-100">Agregar disciplina</Text>
          <View className="flex-row gap-2">
            <TextInput
              className="h-11 w-14 rounded-xl border border-ink-700 bg-ink-950 text-center text-xl"
              value={newEmoji}
              onChangeText={setNewEmoji}
              maxLength={4}
            />
            <TextInput
              className="h-11 flex-1 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
              placeholder="Nombre del deporte"
              placeholderTextColor={c['ink-500']}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
          </View>
          <View className="flex-row gap-2">
            <SmallButton label="Cancelar" onPress={() => setAdding(false)} />
            <SmallButton label="Agregar" onPress={addCustom} strong />
          </View>
        </View>
      )}

      <PrimaryButton label={picked.length === 0 ? 'Elegí al menos uno' : 'Continuar'} onPress={() => onDone(picked, customs)} disabled={picked.length === 0} />
    </View>
  );
}

// ——— Formulario de sesión ———

const INTENSITIES = [1, 2, 3, 4, 5];

interface FormProps {
  entry?: Entry;
  defaultDate: string;
  disciplines: ResolvedDiscipline[];
  onClose: () => void;
}

function SportsEntryForm({ entry, defaultDate, disciplines, onClose }: FormProps) {
  const c = useThemeColors();
  const deleteEntry = useDb((s) => s.deleteEntry);
  const saved = useRef(false);

  const initialDiscipline = entry ? String(entry.values.disciplina ?? '') : disciplines.length === 1 ? disciplines[0].id : '';
  const [disciplineId, setDisciplineId] = useState(initialDiscipline);
  const [sessionType, setSessionType] = useState(entry ? String(entry.values.tipoSesion ?? '') : '');
  const [date, setDate] = useState(entry?.date ?? defaultDate);
  const [minutes, setMinutes] = useState(entry ? String(entry.values.minutos ?? '') : '');
  const [intensity, setIntensity] = useState<number | null>(entry ? (Number(entry.values.intensidad) || null) : null);
  const [notes, setNotes] = useState(entry ? String(entry.values.notas ?? '') : '');
  const [extraFields, setExtraFields] = useState<Record<string, string>>(() => {
    if (!entry) return {};
    const out: Record<string, string> = {};
    const disc = disciplines.find((d) => d.id === String(entry.values.disciplina));
    if (disc) {
      for (const f of disc.fields) {
        if (entry.values[f.key] !== undefined) out[f.key] = String(entry.values[f.key]);
      }
    }
    return out;
  });

  const discipline = disciplines.find((d) => d.id === disciplineId);
  const valid = !!disciplineId && !!sessionType && Number(minutes) > 0;

  const save = () => {
    if (saved.current || !valid) return;
    saved.current = true;
    const db = useDb.getState();
    const values: Entry['values'] = {
      disciplina: disciplineId,
      tipoSesion: sessionType,
      minutos: Number(minutes),
    };
    if (intensity) values.intensidad = intensity;
    if (notes.trim()) values.notas = notes.trim();
    if (discipline) {
      for (const f of discipline.fields) {
        const v = extraFields[f.key];
        if (v !== undefined && v !== '') {
          values[f.key] = f.type === 'number' ? Number(v) || 0 : v;
        }
      }
    }

    if (entry) {
      db.saveEntry({ id: entry.id, categoryId: 'entrenamiento', subId: 'deportes', date, values });
    } else {
      db.saveEntry({ categoryId: 'entrenamiento', subId: 'deportes', date, values });
      markDone(date, 'entrenamiento');
    }
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm('¿Borrar esta sesión?', 'No se puede deshacer.', 'Borrar'))) return;
    deleteEntry(entry.id);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="max-h-[88%] rounded-t-3xl border border-ink-800 bg-ink-900" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-3">
              <Text className="text-lg font-bold text-ink-100">{entry ? '✏️ Editar sesión' : '🏅 Anotar sesión'}</Text>
              <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              {/* Fecha */}
              <View>
                <Text className="mb-1 text-xs text-ink-500">Fecha</Text>
                <DateField value={date} onChange={setDate} />
              </View>

              {/* Disciplina */}
              {disciplines.length > 1 && (
                <View className="gap-2">
                  <Text className="text-xs text-ink-500">Disciplina</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                    {disciplines.map((d) => {
                      const active = d.id === disciplineId;
                      return (
                        <Pressable
                          key={d.id}
                          onPress={() => {
                            setDisciplineId(d.id);
                            setSessionType('');
                            setExtraFields({});
                          }}
                          className={`flex-row items-center gap-1.5 rounded-xl px-3.5 py-2.5 ${active ? 'border border-shu-400 bg-shu-500/20' : 'border border-ink-700 bg-ink-950'}`}>
                          <Text className="text-base">{d.emoji}</Text>
                          <Text className={`text-sm ${active ? 'font-semibold text-shu-300' : 'text-ink-300'}`}>{d.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Tipo de sesión */}
              {!!discipline && (
                <View className="gap-2">
                  <Text className="text-xs text-ink-500">Tipo de sesión</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {discipline.sessionTypes.map((type) => (
                      <Chip key={type} label={type} selected={sessionType === type} onPress={() => setSessionType(sessionType === type ? '' : type)} />
                    ))}
                  </View>
                </View>
              )}

              {/* Duración */}
              <View>
                <Text className="mb-1 text-xs text-ink-500">Duración (min)</Text>
                <TextInput
                  className="h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
                  keyboardType="number-pad"
                  value={minutes}
                  onChangeText={setMinutes}
                  placeholder="60"
                  placeholderTextColor={c['ink-600']}
                />
              </View>

              {/* Intensidad */}
              <View className="gap-2">
                <Text className="text-xs text-ink-500">Intensidad</Text>
                <View className="flex-row gap-2">
                  {INTENSITIES.map((n) => {
                    const sel = intensity === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setIntensity(sel ? null : n)}
                        className={`h-11 w-11 items-center justify-center rounded-full ${sel ? 'bg-shu-500' : 'border border-ink-700'}`}>
                        <Text className={`text-[15px] ${sel ? 'font-bold text-washi' : 'text-ink-300'}`}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Campos específicos del deporte */}
              {!!discipline && discipline.fields.length > 0 && (
                <View className="gap-3">
                  {discipline.fields.map((f) => (
                    <View key={f.key}>
                      <Text className="mb-1 text-xs text-ink-500">
                        {f.label}
                        {!!f.unit && ` (${f.unit})`}
                      </Text>
                      <TextInput
                        className="h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
                        keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                        value={extraFields[f.key] ?? ''}
                        onChangeText={(v) => setExtraFields((prev) => ({ ...prev, [f.key]: v }))}
                        placeholder="—"
                        placeholderTextColor={c['ink-600']}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* Notas */}
              <View>
                <Text className="mb-1 text-xs text-ink-500">Notas</Text>
                <TextInput
                  className="min-h-[60px] rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-[15px] text-ink-100"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Opcional"
                  placeholderTextColor={c['ink-600']}
                />
              </View>
            </ScrollView>

            <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
              {!!entry && (
                <Pressable onPress={remove} className="items-center justify-center rounded-lg px-4 py-2.5">
                  <Text className="font-medium text-kurenai-400">Borrar</Text>
                </Pressable>
              )}
              <Pressable
                onPress={save}
                disabled={!valid}
                className={`flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5 ${!valid ? 'opacity-40' : ''}`}>
                <Text className="font-medium text-washi">Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ——— Pantalla principal de Deportes ———

function listDate(iso: string, now: string) {
  return iso.slice(0, 4) === now.slice(0, 4)
    ? formatDay(iso, { weekday: 'long', day: 'numeric', month: 'long' })
    : formatDay(iso, { day: 'numeric', month: 'long', year: 'numeric' });
}

// ——— Fila para Hoy ———

export function SportEntryRow({ entry }: { entry: Entry }) {
  const customSports = useDb((s) => s.userProfile[0]?.customSports);
  const disc = resolveDiscipline(String(entry.values.disciplina ?? ''), customSports ?? {});
  const tipo = String(entry.values.tipoSesion ?? '');
  const min = Number(entry.values.minutos) || 0;
  const extras = disc.fields
    .filter((f) => entry.values[f.key] !== undefined && entry.values[f.key] !== '' && entry.values[f.key] !== 0)
    .map((f) => `${entry.values[f.key]}${f.unit ? ` ${f.unit}` : ''}`);
  return (
    <Pressable onPress={() => goToSub('entrenamiento', 'deportes')} className="flex-row justify-between gap-3 rounded-xl px-3 py-2.5 active:bg-ink-800/60">
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-ink-100">{disc.emoji} {tipo || disc.name}</Text>
        <Text className="mt-0.5 text-xs text-ink-400">{disc.name}{extras.length > 0 ? ` · ${extras.join(' · ')}` : ''}</Text>
      </View>
      <Text className="text-[15px] font-bold text-ink-100">{min} min</Text>
    </Pressable>
  );
}

// ——— Calendario de deportes ———

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function SportsCalendar({ recent, resolved, now }: { recent: Entry[]; resolved: ResolvedDiscipline[]; now: string }) {
  const weeks = useMemo(() => lastWeeks(now, 5), [now]);
  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of recent) {
      const d = resolved.find((x) => x.id === String(e.values.disciplina));
      if (!d) continue;
      const list = map.get(e.date) ?? [];
      if (!list.includes(d.emoji)) list.push(d.emoji);
      map.set(e.date, list);
    }
    return map;
  }, [recent, resolved]);

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[17px] font-bold text-ink-100">Tus días</Text>
        <Text className="text-xs text-ink-400">últimas 5 semanas</Text>
      </View>
      <View className="gap-1.5 rounded-2xl border border-ink-800 bg-ink-900 p-3">
        <View className="flex-row gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <Text key={i} className="flex-1 text-center text-[11px] text-ink-500">{w}</Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} className="flex-row gap-1.5">
            {week.map((d) => {
              const emojis = byDay.get(d);
              const future = d > now;
              return (
                <View
                  key={d}
                  className={`h-11 flex-1 items-center justify-center rounded-lg ${emojis ? 'border border-shu-500/45 bg-shu-500/15' : future ? 'opacity-30' : 'bg-ink-950'} ${d === now ? 'border border-shu-400' : ''}`}>
                  <Text className="text-[10px] text-ink-400">{Number(d.slice(8))}</Text>
                  {!!emojis && <Text className="text-xs">{emojis.slice(0, 2).join('')}</Text>}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ——— Progreso por disciplina ———

function SportsProgress({ recent, resolved, now }: { recent: Entry[]; resolved: ResolvedDiscipline[]; now: string }) {
  const [selId, setSelId] = useState('');
  const disc = resolved.find((d) => d.id === selId) ?? resolved[0];

  const month = useMemo(() => {
    const prefix = now.slice(0, 7);
    const list = recent.filter((e) => e.date.startsWith(prefix));
    const rated = list.filter((e) => Number(e.values.intensidad) > 0);
    return {
      sessions: list.length,
      minutes: list.reduce((s, e) => s + (Number(e.values.minutos) || 0), 0),
      avg: rated.length ? rated.reduce((s, e) => s + Number(e.values.intensidad), 0) / rated.length : null,
    };
  }, [recent, now]);

  const summary = useMemo(
    () => (disc ? sportSummary(recent.filter((e) => String(e.values.disciplina) === disc.id), disc.fields, disc.id) : null),
    [recent, disc],
  );

  if (!disc || !summary) return null;
  const maxVal = Math.max(...summary.series.map((p) => p.value), 1);
  const first = summary.series[0]?.value ?? 0;
  const last = summary.series[summary.series.length - 1]?.value ?? 0;
  const fmt = (n: number) => String(Math.round(n * 10) / 10);

  return (
    <View className="gap-3">
      <Text className="text-[17px] font-bold text-ink-100">Este mes</Text>
      <View className="flex-row gap-2">
        {[
          { label: 'Sesiones', value: String(month.sessions) },
          { label: 'Minutos', value: String(month.minutes) },
          { label: 'Intensidad', value: month.avg ? fmt(month.avg) : '—' },
        ].map((t) => (
          <View key={t.label} className="flex-1 rounded-xl border border-ink-800 bg-ink-900 p-3">
            <Text className="text-xl font-bold text-ink-100" style={{ fontVariant: ['tabular-nums'] }}>{t.value}</Text>
            <Text className="text-xs text-ink-400">{t.label}</Text>
          </View>
        ))}
      </View>

      <Text className="mt-2 text-[17px] font-bold text-ink-100">Progreso</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {resolved.map((d) => (
          <Chip key={d.id} label={`${d.emoji} ${d.name}`} selected={d.id === disc.id} onPress={() => setSelId(d.id)} />
        ))}
      </ScrollView>

      {summary.sessions === 0 ? (
        <View className="rounded-2xl border border-dashed border-ink-800 p-5">
          <Text className="text-center text-sm text-ink-500">Todavía no anotaste sesiones de {disc.name}.</Text>
        </View>
      ) : (
        <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <Text className="text-sm text-ink-300">
            {summary.sessions} {summary.sessions === 1 ? 'sesión' : 'sesiones'} · {summary.minutes} min en total
            {summary.avgIntensity ? ` · intensidad ${fmt(summary.avgIntensity)}` : ''}
          </Text>
          {(summary.totals.length > 0 || !!summary.bestPace) && (
            <View className="flex-row flex-wrap gap-2">
              {summary.totals.map((t) => (
                <View key={t.label} className="rounded-lg bg-shu-500/15 px-3 py-1.5">
                  <Text className="text-xs text-shu-300">
                    {t.label}: <Text className="font-bold">{fmt(t.value)}{t.unit ? ` ${t.unit}` : ''}</Text>
                  </Text>
                </View>
              ))}
              {!!summary.bestPace && (
                <View className="rounded-lg bg-shu-500/15 px-3 py-1.5">
                  <Text className="text-xs text-shu-300">Mejor ritmo: <Text className="font-bold">{summary.bestPace}</Text></Text>
                </View>
              )}
            </View>
          )}
          {summary.series.length > 1 && (
            <View className="gap-2">
              <Text className="text-xs text-ink-500">
                {summary.metricLabel} por sesión ({summary.metricUnit}) · últimas {summary.series.length}
                {last !== first ? `  ${last > first ? '▲' : '▼'} ${fmt(Math.abs(last - first))}` : ''}
              </Text>
              <View className="h-28 flex-row items-end gap-1.5">
                {summary.series.map((p, i) => (
                  <View key={`${p.date}-${i}`} className="flex-1 items-center justify-end" style={{ height: '100%' }}>
                    <Text className="mb-0.5 text-[10px] text-ink-400">{fmt(p.value)}</Text>
                    <View className="w-full rounded-t bg-shu-500" style={{ height: `${Math.max((p.value / maxVal) * 75, 4)}%` }} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function SportsSheet() {
  const profile = useProfile();
  const disciplines = useMemo(() => profile?.sportDisciplines ?? [], [profile?.sportDisciplines]);
  const customSports = useMemo(() => profile?.customSports ?? {}, [profile?.customSports]);
  const allEntries = useDb((s) => s.entries);
  const [configuring, setConfiguring] = useState(false);
  const [editing, setEditing] = useState<{ entry?: Entry } | null>(null);
  const [shown, setShown] = useState(8);
  const now = today();

  const resolved = useMemo(
    () => disciplines.map((id) => resolveDiscipline(id, customSports)),
    [disciplines, customSports],
  );

  const recent = useMemo(
    () => allEntries.filter(isSportsEntry).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [allEntries],
  );

  const weekStats = useMemo(() => {
    const startOfWeek = weekStart(now)
    const byDisc = new Map<string, { count: number; minutes: number }>();
    for (const e of recent) {
      if (e.date < startOfWeek || e.date > now) continue;
      const id = String(e.values.disciplina ?? '');
      const prev = byDisc.get(id) ?? { count: 0, minutes: 0 };
      byDisc.set(id, { count: prev.count + 1, minutes: prev.minutes + (Number(e.values.minutos) || 0) });
    }
    return byDisc;
  }, [recent, now]);

  const hasDisciplines = disciplines.length > 0;

  if (!hasDisciplines || configuring) {
    return (
      <SheetScreen categoryId="entrenamiento">
        <DisciplinePicker
          selected={disciplines}
          customSports={customSports}
          onDone={(ids, custom) => {
            saveDisciplines(ids, custom);
            setConfiguring(false);
          }}
        />
      </SheetScreen>
    );
  }

  const overlay =
    editing !== null ? <SportsEntryForm entry={editing.entry} defaultDate={now} disciplines={resolved} onClose={() => setEditing(null)} /> : null;

  return (
    <SheetScreen categoryId="entrenamiento" overlay={overlay}>
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-ink-100">Deportes</Text>
          <SmallButton label="Cambiar" onPress={() => setConfiguring(true)} />
        </View>
        <Text className="text-sm text-ink-400">Tus disciplinas deportivas</Text>
      </View>

      <PrimaryButton label="Anotar sesión" onPress={() => setEditing({})} />

      {/* Stats de la semana por disciplina */}
      {weekStats.size > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {resolved.map((d) => {
            const stat = weekStats.get(d.id);
            if (!stat) return null;
            return (
              <View key={d.id} className="min-w-[46%] flex-1 rounded-xl border border-shu-500/45 bg-shu-500/15 p-3">
                <Text className="text-sm font-bold text-ink-100">
                  {d.emoji} {d.name}
                </Text>
                <Text className="mt-0.5 text-xs text-shu-300">
                  {stat.count} {stat.count === 1 ? 'sesión' : 'sesiones'} · {stat.minutes} min
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <SportsProgress recent={recent} resolved={resolved} now={now} />

      <SportsCalendar recent={recent} resolved={resolved} now={now} />

      {/* Lista de sesiones recientes */}
      <View className="gap-2.5">
        <Text className="text-[17px] font-bold text-ink-100">Últimas sesiones</Text>
        {recent.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-ink-800 p-5">
            <Text className="text-center text-sm text-ink-500">Todavía no anotaste sesiones deportivas.</Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
            {recent.slice(0, shown).map((e, i, list) => {
              const discId = String(e.values.disciplina ?? '');
              const disc = resolveDiscipline(discId, customSports);
              const tipo = String(e.values.tipoSesion ?? '');
              const min = Number(e.values.minutos) || 0;
              const intens = Number(e.values.intensidad) || 0;

              const extras: string[] = [];
              if (disc.fields.length > 0) {
                for (const f of disc.fields) {
                  const v = e.values[f.key];
                  if (v !== undefined && v !== '' && v !== 0) {
                    extras.push(`${v}${f.unit ? ` ${f.unit}` : ''}`);
                  }
                }
              }

              return (
                <View key={e.id} className={`flex-row items-center pr-1 ${i < list.length - 1 ? 'border-b border-ink-800' : ''}`}>
                  <Pressable
                    onPress={() => setEditing({ entry: e })}
                    className="min-w-0 flex-1 flex-row justify-between gap-3 py-3.5 pl-4 pr-2 active:bg-ink-800/60">
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-semibold text-ink-100">
                        {disc.emoji} {tipo || disc.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-ink-400">
                        {disc.name} · {listDate(e.date, now)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[15px] font-bold text-ink-100" style={{ fontVariant: ['tabular-nums'] }}>
                        {min} min
                      </Text>
                      {intens > 0 && <Text className="mt-0.5 text-xs text-shu-300">intensidad {intens}</Text>}
                      {extras.length > 0 && <Text className="mt-0.5 text-xs text-ink-400">{extras.join(' · ')}</Text>}
                    </View>
                  </Pressable>
                  <TrashButton what={`la sesión (${disc.name} ${tipo}, ${listDate(e.date, now)})`} onDelete={() => useDb.getState().deleteEntry(e.id)} />
                </View>
              );
            })}
          </View>
        )}
        {recent.length > shown && <SmallButton label="Ver más" onPress={() => setShown((s) => s + 10)} />}
      </View>
    </SheetScreen>
  );
}
