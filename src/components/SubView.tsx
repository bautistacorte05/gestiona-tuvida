import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLOR_CLASSES, type Category, type Field, type Subcategory } from '../config/categories';
import { PET_OWNED_SUBS, useDb, type Entry } from '../lib/db';
import { daysBetween, daysUntil, formatDay, formatMonth, monthKey, monthRange, shiftMonth, today } from '../lib/dates';
import { goToSub } from '../lib/nav';
import { breakdown, formatValue, summarize } from '../lib/stats';
import { Card, DayBars, Empty, EntryRow, Stepper } from './common';
import EntryForm from './EntryForm';
import ExpenseInsights from './ExpenseInsights';
import PeriodPicker, { usePeriod, WEEK_LABELS } from './PeriodPicker';
import PetSwitcher from './PetSwitcher';
import SavingsInsights from './SavingsInsights';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

export default function SubView({ category, sub }: { category: Category; sub: Subcategory }) {
  const [month, setMonth] = useState(() => monthKey(today()));
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  const colors = COLOR_CLASSES[category.color];
  // Selector Día / Semana / Mes, solo si la subcategoría lo pide (sub.periods).
  const period = usePeriod();
  const { start, end, days } = sub.periods ? period : monthRange(month);
  const isPetOwned = category.id === 'mascota' && PET_OWNED_SUBS.includes(sub.id);

  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const addPetProfile = useDb((s) => s.addPetProfile);
  const hasPets = petProfiles.some((p) => !p.archived);

  const allEntries = useDb((s) => s.entries);
  const entries = useMemo(
    () =>
      allEntries.filter(
        (e) => e.categoryId === category.id && e.subId === sub.id && e.date >= start && e.date <= end && (!isPetOwned || e.petId === activePetId),
      ),
    [allEntries, category.id, sub.id, start, end, isPetOwned, activePetId],
  );

  const prevMonth = shiftMonth(month, -1);
  const prevRange = monthRange(prevMonth);
  const prevEntries = useMemo(
    () =>
      sub.itemized ? allEntries.filter((e) => e.categoryId === category.id && e.subId === sub.id && e.date >= prevRange.start && e.date <= prevRange.end) : [],
    [allEntries, category.id, sub.id, prevRange.start, prevRange.end, sub.itemized],
  );

  const metrics = useMemo(() => (sub.savings ? [] : summarize(sub, entries)), [sub, entries]);
  const mainField = metrics[0]?.field;
  const selectField = sub.fields.find((f) => f.type === 'select');
  const moneyField = sub.fields.find((f) => f.money);
  const reminderField = sub.fields.find((f) => f.reminder);

  const allSubEntries = useMemo(
    () =>
      reminderField
        ? allEntries.filter((e) => e.categoryId === category.id && e.subId === sub.id && (!isPetOwned || e.petId === activePetId))
        : [],
    [allEntries, category.id, sub.id, reminderField, isPetOwned, activePetId],
  );
  const nextReminder = useMemo(() => {
    if (!reminderField) return undefined;
    const t = today();
    return allSubEntries
      .map((e) => ({ e, date: String(e.values[reminderField.key] ?? '') }))
      .filter((x) => x.date >= t)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [allSubEntries, reminderField]);

  const perDay = useMemo(() => {
    const arr = Array<number>(days).fill(0);
    for (const e of entries) {
      const d = sub.periods ? daysBetween(start, e.date) : Number(e.date.slice(8)) - 1;
      arr[d] += mainField ? Number(e.values[mainField.key]) || 0 : 1;
    }
    return arr;
  }, [entries, days, mainField, sub.periods, start]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)) {
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries]);

  const activeDays = perDay.filter(Boolean).length;
  const isCurrentMonth = month === monthKey(today());

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <BackButton />
            <ScreenTitle categoryId={category.id} subId={sub.id} />
          </View>
          {sub.link && (
            <Pressable onPress={() => goToSub(category.id, sub.link!.subId)} className="rounded-lg bg-shu-500 px-4 py-2.5">
              <Text className="font-medium text-washi">{sub.link.label}</Text>
            </Pressable>
          )}
        </View>

        {isPetOwned && hasPets && <PetSwitcher onAdd={() => addPetProfile({ nombre: '' })} />}
        {isPetOwned && !hasPets && (
          <Empty>
            <Text className="text-sm text-ink-400">
              Primero completá el{' '}
              <Text className="text-shu-400 underline" onPress={() => goToSub('mascota', 'perfil')}>
                Perfil / DNI
              </Text>{' '}
              de tu mascota.
            </Text>
          </Empty>
        )}

        {sub.periods ? (
          <PeriodPicker period={period} />
        ) : (
          <Stepper label={formatMonth(month)} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />
        )}

        {category.id !== 'finanzas' && moneyField && <Text className="text-xs text-ink-500">💰 {moneyField.label} se descuenta del saldo de Finanzas.</Text>}

        {nextReminder && <ReminderCallout field={reminderField!} entry={nextReminder.e} date={nextReminder.date} onPress={() => setEditing(nextReminder.e)} />}

        <View className="flex-row flex-wrap gap-3">
          <Stat label="Registros" value={String(entries.length)} />
          <Stat label="Días activos" value={`${activeDays} / ${days}`} />
          {metrics.map((m) => (
            <Stat key={m.field.key} label={m.field.aggregate === 'avg' ? `${m.field.label} (prom.)` : `${m.field.label} ${sub.periods ? period.noun : 'del mes'}`} value={formatValue(m.field, m.value)} />
          ))}
        </View>

        {!sub.savings && !sub.periods && (
          <Card>
            <Text className="mb-3 text-sm text-ink-400">{mainField ? `${mainField.label} por día` : 'Registros por día'}</Text>
            <DayBars values={perDay} barClass={colors.bar} highlight={isCurrentMonth ? Number(today().slice(8)) : undefined} />
          </Card>
        )}
        {!sub.savings && sub.periods && period.kind !== 'day' && (
          <Card>
            <Text className="mb-3 text-sm text-ink-400">{mainField ? `${mainField.label} por día` : 'Registros por día'}</Text>
            <DayBars
              values={perDay}
              barClass={colors.bar}
              highlight={today() >= start && today() <= end ? daysBetween(start, today()) + 1 : undefined}
              labels={period.kind === 'week' ? WEEK_LABELS : undefined}
            />
          </Card>
        )}

        {sub.itemized && <ExpenseInsights sub={sub} entries={entries} prevEntries={prevEntries} prevMonth={prevMonth} />}

        {sub.savings && <SavingsInsights categoryId={category.id} subId={sub.id} entries={entries} />}

        {!sub.itemized && !sub.savings && selectField && entries.length > 0 && (
          <Card>
            <Text className="mb-3 text-sm text-ink-400">
              Por {selectField.label.toLowerCase()}
              {moneyField ? ` (${moneyField.label.toLowerCase()})` : ''}
            </Text>
            <Breakdown rows={breakdown(selectField, entries, moneyField?.key)} barClass={colors.bar} format={(v) => (moneyField ? formatValue(moneyField, v) : String(v))} />
          </Card>
        )}

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-semibold text-ink-100">Registros</Text>
            {(!isPetOwned || hasPets) && (
              <Pressable onPress={() => setEditing('new')} className="rounded-lg bg-shu-500 px-4 py-2.5">
                <Text className="font-medium text-washi">+ Agregar</Text>
              </Pressable>
            )}
          </View>
          {byDay.length === 0 ? (
            <Empty>{sub.periods ? period.emptyText : `Sin registros en ${formatMonth(month).toLowerCase()}.`}</Empty>
          ) : (
            <View className="gap-3">
              {byDay.map(([date, list]) => (
                <View key={date} className="rounded-xl border border-ink-800 bg-ink-900/60 p-2">
                  <Text className="px-3 pb-1 pt-1 text-xs font-medium text-ink-500">{formatDay(date)}</Text>
                  {list.map((e) => (
                    <EntryRow key={e.id} sub={sub} entry={e} onPress={() => setEditing(e)} />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {editing && (
        <EntryForm category={category} sub={sub} entry={editing === 'new' ? undefined : editing} defaultDate={sub.periods ? period.defaultDate : isCurrentMonth ? today() : `${month}-01`} onClose={() => setEditing(null)} />
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4" style={{ width: '47%' }}>
      <Text className="text-xs text-ink-400">{label}</Text>
      <Text className="mt-1 text-xl font-semibold text-ink-100">{value}</Text>
    </View>
  );
}

function Breakdown({ rows, barClass, format }: { rows: [string, number][]; barClass: string; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <View className="gap-2">
      {rows.map(([k, v]) => (
        <View key={k} className="flex-row items-center gap-3">
          <Text className="w-24 text-sm text-ink-300" numberOfLines={1}>{k}</Text>
          <View className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
            <View className={`h-full rounded-full ${barClass}`} style={{ width: `${(v / max) * 100}%` }} />
          </View>
          <Text className="w-20 text-right text-sm text-ink-400">{format(v)}</Text>
        </View>
      ))}
    </View>
  );
}

function ReminderCallout({ field, entry, date, onPress }: { field: Field; entry: Entry; date: string; onPress: () => void }) {
  const left = daysUntil(date);
  const urgent = left <= 7;
  const label = entry.values.nombre ?? entry.values.tipo ?? field.label;
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-3 rounded-xl border-2 border-l-4 bg-ink-900/60 p-4 ${urgent ? 'border-gold-500' : 'border-ink-800'}`}>
      <Text className="text-2xl">⏰</Text>
      <View className="flex-1">
        <Text className="text-sm text-ink-400">{field.label}</Text>
        <Text className="font-medium text-ink-100">{String(label)}</Text>
      </View>
      <View className="items-end">
        <Text className={`text-sm font-medium ${urgent ? 'text-gold-400' : 'text-ink-400'}`}>{left === 0 ? 'Hoy' : left === 1 ? 'Mañana' : `en ${left} días`}</Text>
        <Text className="text-xs text-ink-500">{formatDay(date, { day: 'numeric', month: 'short' })}</Text>
      </View>
    </Pressable>
  );
}
