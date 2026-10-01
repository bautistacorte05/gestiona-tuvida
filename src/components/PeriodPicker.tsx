import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatMonth, monthKey, monthRange, shiftDay, shiftMonth, today, weekRange } from '../lib/dates';
import { Stepper } from './common';

export type PeriodKind = 'day' | 'week' | 'month';

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
];

/** Etiquetas del eje del gráfico semanal (lunes a domingo). */
export const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const short = (iso: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', opts).replace(/[.,]/g, '');
};

/** "mié 30 sept" */
const dayLabel = (iso: string) => `${short(iso, { weekday: 'short' })} ${short(iso, { day: 'numeric', month: 'short' })}`;

/** Período elegido (día / semana / mes) alrededor de una fecha de referencia. Arranca en el mes actual. */
export function usePeriod() {
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState(today);
  const t = today();

  const range = kind === 'day' ? { start: anchor, end: anchor, days: 1 } : kind === 'week' ? weekRange(anchor) : monthRange(monthKey(anchor));
  const month = monthKey(anchor);
  const label =
    kind === 'day'
      ? anchor === t
        ? 'Hoy'
        : dayLabel(anchor)
      : kind === 'week'
        ? `${short(range.start, { day: 'numeric', month: 'short' })} – ${short(range.end, { day: 'numeric', month: 'short' })}`
        : formatMonth(month);

  const shift = (delta: number) => {
    if (kind === 'day') setAnchor(shiftDay(anchor, delta));
    else if (kind === 'week') setAnchor(shiftDay(anchor, 7 * delta));
    else {
      // Al cambiar de mes, se para en hoy si es el mes actual o en el día 1.
      const m = shiftMonth(month, delta);
      setAnchor(m === monthKey(t) ? t : `${m}-01`);
    }
  };

  const emptyText =
    kind === 'day' ? (anchor === t ? 'Sin registros hoy.' : `Sin registros el ${label}.`) : kind === 'week' ? `Sin registros en la semana del ${label}.` : `Sin registros en ${label.toLowerCase()}.`;
  const noun = kind === 'day' ? 'del día' : kind === 'week' ? 'de la semana' : 'del mes';
  // Fecha que propone el formulario al agregar: hoy si cae en el período, si no el primer día.
  const defaultDate = t >= range.start && t <= range.end ? t : range.start;

  return { kind, setKind, label, ...range, shift, emptyText, noun, defaultDate };
}

export type Period = ReturnType<typeof usePeriod>;

export default function PeriodPicker({ period }: { period: Period }) {
  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        {KINDS.map((k) => {
          const active = period.kind === k.id;
          return (
            <Pressable
              key={k.id}
              onPress={() => period.setKind(k.id)}
              className={`flex-1 items-center rounded-lg border py-2.5 ${active ? 'border-shu-500 bg-shu-500/15' : 'border-ink-700'}`}>
              <Text className={`text-sm ${active ? 'font-semibold text-shu-300' : 'text-ink-300'}`}>{k.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Stepper label={period.label} onPrev={() => period.shift(-1)} onNext={() => period.shift(1)} />
    </View>
  );
}
