import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { confirm } from '../lib/confirm';
import { formatDay, shiftDay, today } from '../lib/dates';
import { useDb, type Entry } from '../lib/db';
import { goToSub } from '../lib/nav';
import { healthDue } from '../lib/pets';
import { markDone } from '../lib/sheets';
import { useThemeColors } from '../lib/theme';
import DateField from './DateField';
import PetSwitcher from './PetSwitcher';
import { Chip, PrimaryButton, Section, SheetScreen, SmallButton, StatTile } from './sheets/kit';
import TrashButton from './TrashButton';

const MOTIVOS = ['Control', 'Vacuna', 'Desparasitación', 'Baño', 'Enfermedad', 'Otro'] as const;
const MOTIVO_ICON: Record<string, string> = { Control: '🩺', Vacuna: '💉', Desparasitación: '🪱', Baño: '🛁', Enfermedad: '🤒', Otro: '📋' };
const FILTERS = [
  { id: 'todo', label: 'Todo', match: () => true },
  { id: 'vacunas', label: '💉 Vacunas', match: (m: string[]) => m.includes('Vacuna') },
  { id: 'despara', label: '🪱 Desparasitación', match: (m: string[]) => m.includes('Desparasitación') },
  { id: 'controles', label: '🩺 Controles', match: (m: string[]) => m.includes('Control') || m.includes('Enfermedad') },
  { id: 'otros', label: '📋 Otros', match: (m: string[]) => m.includes('Baño') || m.includes('Otro') },
] as const;

const motivosOf = (e: Entry) => (Array.isArray(e.values.motivo) ? e.values.motivo : e.values.motivo ? [String(e.values.motivo)] : []);
const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const dueText = (dias: number) =>
  dias < 0 ? `vencida hace ${-dias} ${-dias === 1 ? 'día' : 'días'}` : dias === 0 ? 'es hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;

// ——— Formulario de salud (vacuna, control, etc.) ———

function HealthForm({ petId, entry, onClose }: { petId: string; entry?: Entry; onClose: () => void }) {
  const c = useThemeColors();
  const saved = useRef(false);
  const [date, setDate] = useState(entry?.date ?? today());
  const [motivos, setMotivos] = useState<string[]>(entry ? motivosOf(entry) : []);
  const [nombre, setNombre] = useState(String(entry?.values.nombre ?? ''));
  const [proxima, setProxima] = useState(String(entry?.values.proximaDosis ?? ''));
  const [costo, setCosto] = useState(entry?.values.costo !== undefined ? String(entry.values.costo) : '');
  const [detalle, setDetalle] = useState(String(entry?.values.detalle ?? ''));
  const valid = motivos.length > 0;

  const save = () => {
    if (saved.current || !valid) return;
    saved.current = true;
    const values: Entry['values'] = { motivo: motivos };
    if (nombre.trim()) values.nombre = nombre.trim();
    if (proxima) values.proximaDosis = proxima;
    if (Number(costo) > 0) values.costo = Number(costo);
    if (detalle.trim()) values.detalle = detalle.trim();
    useDb.getState().saveEntry({ id: entry?.id, categoryId: 'mascota', subId: 'salud', date, values, petId: entry?.petId ?? petId });
    if (!entry) markDone(date, 'mascota');
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm('¿Borrar este registro?', 'No se puede deshacer.', 'Borrar'))) return;
    useDb.getState().deleteEntry(entry.id);
    onClose();
  };

  const input = 'h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100';
  return (
    <Sheet title={entry ? '✏️ Editar registro' : '🩺 Nuevo registro'} onClose={onClose} onSave={save} onDelete={entry ? remove : undefined} valid={valid}>
      <View className="gap-2">
        <Text className="text-xs text-ink-500">¿Qué fue?</Text>
        <View className="flex-row flex-wrap gap-2">
          {MOTIVOS.map((m) => (
            <Chip
              key={m}
              label={`${MOTIVO_ICON[m]} ${m}`}
              selected={motivos.includes(m)}
              onPress={() => setMotivos((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}
            />
          ))}
        </View>
      </View>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Vacuna o medicamento (opcional)</Text>
        <TextInput className={input} value={nombre} onChangeText={setNombre} placeholder="Antirrábica" placeholderTextColor={c['ink-600']} />
      </View>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Fecha</Text>
        <DateField value={date} onChange={setDate} />
      </View>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Próxima dosis o control (opcional)</Text>
        <DateField value={proxima} onChange={setProxima} />
        {!!proxima && (
          <View className="mt-2 flex-row">
            <SmallButton label="Quitar fecha" onPress={() => setProxima('')} />
          </View>
        )}
      </View>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Costo (opcional)</Text>
        <TextInput className={input} keyboardType="number-pad" value={costo} onChangeText={setCosto} placeholder="—" placeholderTextColor={c['ink-600']} />
      </View>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Detalle (opcional)</Text>
        <TextInput
          className="min-h-[60px] rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-[15px] text-ink-100"
          multiline
          value={detalle}
          onChangeText={setDetalle}
          placeholderTextColor={c['ink-600']}
        />
      </View>
    </Sheet>
  );
}

// ——— Formulario de medicación ———

function MedForm({ petId, entry, onClose }: { petId: string; entry?: Entry; onClose: () => void }) {
  const c = useThemeColors();
  const saved = useRef(false);
  const [nombre, setNombre] = useState(String(entry?.values.nombre ?? ''));
  const [dosis, setDosis] = useState(String(entry?.values.dosis ?? ''));
  const [veces, setVeces] = useState(Number(entry?.values.veces) || 1);
  const [hasta, setHasta] = useState(String(entry?.values.hasta ?? ''));
  const valid = !!nombre.trim();

  const save = () => {
    if (saved.current || !valid) return;
    saved.current = true;
    const values: Entry['values'] = { ...(entry?.values ?? {}), nombre: nombre.trim(), veces };
    if (dosis.trim()) values.dosis = dosis.trim();
    else delete values.dosis;
    if (hasta) values.hasta = hasta;
    else delete values.hasta;
    useDb.getState().saveEntry({ id: entry?.id, categoryId: 'mascota', subId: 'medicacion', date: entry?.date ?? today(), values, petId: entry?.petId ?? petId });
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm('¿Borrar esta medicación?', 'Se pierde también el registro de tomas.', 'Borrar'))) return;
    useDb.getState().deleteEntry(entry.id);
    onClose();
  };

  const input = 'h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100';
  return (
    <Sheet title={entry ? '✏️ Editar medicación' : '💊 Nueva medicación'} onClose={onClose} onSave={save} onDelete={entry ? remove : undefined} valid={valid}>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Medicamento</Text>
        <TextInput className={input} value={nombre} onChangeText={setNombre} placeholder="Antibiótico" placeholderTextColor={c['ink-600']} />
      </View>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Dosis (opcional)</Text>
        <TextInput className={input} value={dosis} onChangeText={setDosis} placeholder="½ pastilla" placeholderTextColor={c['ink-600']} />
      </View>
      <View className="gap-2">
        <Text className="text-xs text-ink-500">Veces por día</Text>
        <View className="flex-row gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} label={String(n)} selected={veces === n} onPress={() => setVeces(n)} />
          ))}
        </View>
      </View>
      <View>
        <Text className="mb-1 text-xs text-ink-500">Hasta cuándo (opcional)</Text>
        <DateField value={hasta} onChange={setHasta} />
        {!!hasta && (
          <View className="mt-2 flex-row">
            <SmallButton label="Sin fecha de fin" onPress={() => setHasta('')} />
          </View>
        )}
      </View>
    </Sheet>
  );
}

/** Hoja de abajo con título, contenido, Guardar y Borrar (igual que los formularios de Deportes y Comida). */
function Sheet({
  title,
  children,
  onClose,
  onSave,
  onDelete,
  valid,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  valid: boolean;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="max-h-[88%] rounded-t-3xl border border-ink-800 bg-ink-900" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-3">
              <Text className="text-lg font-bold text-ink-100">{title}</Text>
              <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="px-5 py-4" contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
              {!!onDelete && (
                <Pressable onPress={onDelete} className="items-center justify-center rounded-lg px-4 py-2.5">
                  <Text className="font-medium text-kurenai-400">Borrar</Text>
                </Pressable>
              )}
              <Pressable
                onPress={onSave}
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

// ——— Pantalla ———

type Editing = { kind: 'health' | 'med'; entry?: Entry } | null;

/** Salud de la mascota activa: próximos controles, medicación del día y libreta sanitaria. */
export default function PetHealthView() {
  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const entries = useDb((s) => s.entries);
  const pet = petProfiles.find((p) => p.id === activePetId && !p.archived);
  const now = today();
  const [editing, setEditing] = useState<Editing>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('todo');
  const [shown, setShown] = useState(8);

  const onAdd = () => {
    useDb.getState().addPetProfile({ nombre: '' });
    goToSub('mascota', 'perfil');
  };

  const health = useMemo(
    () =>
      entries
        .filter((e) => e.categoryId === 'mascota' && e.subId === 'salud' && e.petId === pet?.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [entries, pet?.id],
  );
  const meds = useMemo(
    () =>
      entries
        .filter((e) => e.categoryId === 'mascota' && e.subId === 'medicacion' && e.petId === pet?.id)
        .filter((e) => !e.values.hasta || String(e.values.hasta) >= now)
        .sort((a, b) => a.createdAt - b.createdAt),
    [entries, pet?.id, now],
  );
  const due = useMemo(() => (pet ? healthDue(entries, pet.id, now).slice(0, 5) : []), [entries, pet, now]);
  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    return health.filter((e) => f.match(motivosOf(e) as never));
  }, [health, filter]);
  const yearCost = useMemo(
    () => health.filter((e) => e.date.startsWith(now.slice(0, 4))).reduce((s, e) => s + (Number(e.values.costo) || 0), 0),
    [health, now],
  );

  const toggleDose = (med: Entry, n: number) => {
    const key = `${now}#${n}`;
    const cutoff = shiftDay(now, -60);
    const tomas = (Array.isArray(med.values.tomas) ? med.values.tomas : []).filter((t) => t.slice(0, 10) >= cutoff);
    const next = tomas.includes(key) ? tomas.filter((t) => t !== key) : [...tomas, key];
    useDb.getState().saveEntry({ id: med.id, categoryId: 'mascota', subId: 'medicacion', date: med.date, values: { ...med.values, tomas: next }, petId: med.petId });
  };

  if (!pet) {
    return (
      <SheetScreen categoryId="mascota">
        <PetSwitcher onAdd={onAdd} />
        <View className="items-center gap-3 rounded-2xl border border-dashed border-ink-800 p-8">
          <Text className="text-4xl">🩺</Text>
          <Text className="text-center text-sm text-ink-400">Primero agregá una mascota para llevar su libreta sanitaria.</Text>
          <PrimaryButton label="Agregar mi mascota" onPress={onAdd} />
        </View>
      </SheetScreen>
    );
  }

  const overlay =
    editing?.kind === 'health' ? (
      <HealthForm key={editing.entry?.id ?? 'new'} petId={pet.id} entry={editing.entry} onClose={() => setEditing(null)} />
    ) : editing?.kind === 'med' ? (
      <MedForm key={editing.entry?.id ?? 'new'} petId={pet.id} entry={editing.entry} onClose={() => setEditing(null)} />
    ) : null;

  return (
    <SheetScreen categoryId="mascota" overlay={overlay}>
      <PetSwitcher onAdd={onAdd} />

      <View className="gap-1">
        <Text className="text-2xl font-bold text-ink-100">Salud de {pet.nombre || 'tu mascota'}</Text>
        <Text className="text-sm text-ink-400">Vacunas, controles y medicación</Text>
      </View>

      <PrimaryButton label="Anotar vacuna o control" onPress={() => setEditing({ kind: 'health' })} />

      <Section title="⏰ Próximos controles" subtitle={due.length === 0 ? 'Nada pendiente. Poné la próxima dosis al anotar una vacuna.' : undefined}>
        {due.map((d) => {
          const entry = entries.find((e) => e.id === d.id);
          return (
            <Pressable
              key={d.id}
              onPress={() => entry && setEditing({ kind: 'health', entry })}
              className="flex-row items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-950 px-3 py-2.5 active:opacity-70">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-[15px] font-semibold text-ink-100">
                  {d.nombre}
                </Text>
                <Text className="mt-0.5 text-xs text-ink-400">{formatDay(d.fecha, { weekday: 'short', day: 'numeric', month: 'long' })}</Text>
              </View>
              <Text className={`text-xs font-semibold ${d.dias < 0 ? 'text-kurenai-400' : d.dias <= 7 ? 'text-shu-300' : 'text-ink-300'}`}>{dueText(d.dias)}</Text>
            </Pressable>
          );
        })}
      </Section>

      <Section title="💊 Medicación" right={<SmallButton label="+ Agregar" onPress={() => setEditing({ kind: 'med' })} />}>
        {meds.length === 0 ? (
          <Text className="text-sm text-ink-400">Sin medicación activa. Agregá una y tildá cada toma del día.</Text>
        ) : (
          meds.map((m) => {
            const veces = Number(m.values.veces) || 1;
            const tomas = Array.isArray(m.values.tomas) ? m.values.tomas : [];
            const done = Array.from({ length: veces }, (_, i) => tomas.includes(`${now}#${i + 1}`));
            const weekTaken = Array.from({ length: 7 }, (_, d) => shiftDay(now, -d)).reduce(
              (s, day) => s + tomas.filter((t) => t.startsWith(`${day}#`)).length,
              0,
            );
            return (
              <View key={m.id} className="gap-2 rounded-xl border border-ink-800 bg-ink-950 p-3">
                <Pressable onPress={() => setEditing({ kind: 'med', entry: m })} className="flex-row items-start justify-between gap-3 active:opacity-70">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[15px] font-semibold text-ink-100">{String(m.values.nombre ?? '')}</Text>
                    <Text className="mt-0.5 text-xs text-ink-400">
                      {[m.values.dosis ? String(m.values.dosis) : '', `${veces} ${veces === 1 ? 'vez' : 'veces'} por día`, m.values.hasta ? `hasta el ${formatDay(String(m.values.hasta), { day: 'numeric', month: 'short' })}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text className="text-xs text-ink-500">✏️</Text>
                </Pressable>
                <View className="flex-row items-center gap-2">
                  {done.map((d, i) => (
                    <Pressable
                      key={i}
                      onPress={() => toggleDose(m, i + 1)}
                      accessibilityLabel={`Toma ${i + 1} de hoy`}
                      accessibilityState={{ checked: d }}
                      className={`h-10 min-w-[48px] items-center justify-center rounded-full px-3 ${d ? 'bg-shu-500' : 'border border-ink-700'}`}>
                      <Text className={`text-sm font-semibold ${d ? 'text-washi' : 'text-ink-300'}`}>{d ? '✓' : `${i + 1}ª`}</Text>
                    </Pressable>
                  ))}
                  <Text className="ml-1 flex-1 text-right text-xs text-ink-400">
                    {done.filter(Boolean).length}/{veces} hoy · {weekTaken} en 7 días
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </Section>

      <View className="flex-row gap-2">
        <StatTile label="Registros" value={String(health.length)} />
        <StatTile label={`Gastado en ${now.slice(0, 4)}`} value={yearCost > 0 ? money(yearCost) : '—'} />
      </View>

      <View className="gap-2.5">
        <Text className="text-[17px] font-bold text-ink-100">Libreta sanitaria</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => {
                setFilter(f.id);
                setShown(8);
              }}
            />
          ))}
        </ScrollView>
        {list.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-ink-800 p-5">
            <Text className="text-center text-sm text-ink-500">Todavía no hay registros acá.</Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
            {list.slice(0, shown).map((e, i, arr) => {
              const ms = motivosOf(e);
              const nombre = String(e.values.nombre ?? '');
              const costo = Number(e.values.costo) || 0;
              return (
                <View key={e.id} className={`flex-row items-center pr-1 ${i < arr.length - 1 ? 'border-b border-ink-800' : ''}`}>
                  <Pressable onPress={() => setEditing({ kind: 'health', entry: e })} className="min-w-0 flex-1 flex-row justify-between gap-3 py-3.5 pl-4 pr-2 active:bg-ink-800/60">
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-semibold text-ink-100">
                        {MOTIVO_ICON[ms[0]] ?? '📋'} {nombre || ms.join(', ')}
                      </Text>
                      <Text className="mt-0.5 text-xs text-ink-400">
                        {nombre ? `${ms.join(', ')} · ` : ''}
                        {formatDay(e.date, { day: 'numeric', month: 'long', year: 'numeric' })}
                      </Text>
                      {!!e.values.proximaDosis && (
                        <Text className="mt-0.5 text-xs text-shu-300">Próxima: {formatDay(String(e.values.proximaDosis), { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                      )}
                    </View>
                    {costo > 0 && <Text className="text-sm text-ink-300">{money(costo)}</Text>}
                  </Pressable>
                  <TrashButton what={`el registro (${nombre || ms.join(', ')})`} onDelete={() => useDb.getState().deleteEntry(e.id)} />
                </View>
              );
            })}
          </View>
        )}
        {list.length > shown && <SmallButton label="Ver más" onPress={() => setShown((s) => s + 10)} />}
      </View>
    </SheetScreen>
  );
}
