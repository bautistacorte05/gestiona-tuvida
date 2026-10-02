import { Pressable, Text, View } from 'react-native';
import type { Subcategory } from '../config/categories';
import { useDb, type Entry } from '../lib/db';
import { formatValue } from '../lib/stats';
import TrashButton from './TrashButton';

export const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/** Variación porcentual: rojo si subió, verde si bajó (o neutra, para tiempo). */
export function PctBadge({ pct, neutral }: { pct: number; neutral?: boolean }) {
  const r = Math.round(pct * 10) / 10;
  const cls = neutral
    ? 'bg-ink-700/50 text-ink-200'
    : r > 0
      ? 'bg-kurenai-500/15 text-kurenai-300'
      : r < 0
        ? 'bg-moss-500/15 text-moss-300'
        : 'bg-ink-700/50 text-ink-300';
  return (
    <Text className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {r > 0 ? '▲ +' : r < 0 ? '▼ ' : ''}
      {r.toLocaleString('es-AR')}%
    </Text>
  );
}

export function Stepper({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View className="flex-row items-center gap-1 rounded-xl border border-ink-800 bg-ink-900/60 p-1">
      <Pressable onPress={onPrev} className="px-3 py-1.5 active:opacity-70" accessibilityLabel="Anterior">
        <Text className="text-ink-300">‹</Text>
      </Pressable>
      <Text className="min-w-32 text-center text-sm font-medium text-ink-100">{label}</Text>
      <Pressable onPress={onNext} className="px-3 py-1.5 active:opacity-70" accessibilityLabel="Siguiente">
        <Text className="text-ink-300">›</Text>
      </Pressable>
    </View>
  );
}

/** Línea principal + detalle de un registro, según los campos de la subcategoría. */
export function entryText(sub: Subcategory, entry: Entry) {
  const parts = sub.fields
    .filter((f) => {
      const v = entry.values[f.key];
      return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
    })
    .map((f) => formatValue(f, entry.values[f.key], entry));
  if (entry.items?.length) parts.push(`${entry.items.length} producto${entry.items.length > 1 ? 's' : ''}`);
  return { title: parts[0] ?? sub.name, detail: parts.slice(1).join(' · ') };
}

/** Un registro: tocarlo abre el formulario; 🗑️ lo borra sin abrirlo (pregunta antes). */
export function EntryRow({ sub, entry, onPress, showSub }: { sub: Subcategory; entry: Entry; onPress: () => void; showSub?: boolean }) {
  const { title, detail } = entryText(sub, entry);
  return (
    <View className="flex-row items-center">
      <Pressable onPress={onPress} className="min-w-0 flex-1 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-ink-800/60">
        <Text className="text-xl">{sub.icon}</Text>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-medium text-ink-100">
            {showSub && <Text className="text-ink-500">{sub.name} · </Text>}
            {title}
          </Text>
          {!!detail && (
            <Text numberOfLines={1} className="text-xs text-ink-400">
              {detail}
            </Text>
          )}
        </View>
      </Pressable>
      <TrashButton what={`este registro (${title})`} onDelete={() => useDb.getState().deleteEntry(entry.id)} />
    </View>
  );
}

/** Barras por día del mes. `barClass` es una clase Tailwind de fondo, ej: "bg-orange-500". */
export function DayBars({ values, barClass, highlight, labels }: { values: number[]; barClass: string; highlight?: number; labels?: string[] }) {
  const max = Math.max(...values, 0);
  return (
    <View>
      <View className="h-28 flex-row items-end gap-[2px]">
        {values.map((v, i) => (
          <View key={i} className="h-full flex-1 justify-end">
            <View
              className={`w-full rounded-t-sm ${v ? barClass : 'bg-ink-800'} ${highlight === i + 1 ? 'border border-white/60' : ''}`}
              style={{ height: v && max ? `${Math.max((v / max) * 100, 4)}%` : 3 }}
            />
          </View>
        ))}
      </View>
      {labels ? (
        // Una etiqueta debajo de cada barra (ej: L M X J V S D).
        <View className="mt-1 flex-row gap-[2px]">
          {labels.map((l, i) => (
            <Text key={i} className="flex-1 text-center text-[10px] text-ink-500">
              {l}
            </Text>
          ))}
        </View>
      ) : (
        <View className="mt-1 flex-row justify-between">
          <Text className="text-[10px] text-ink-500">1</Text>
          <Text className="text-[10px] text-ink-500">{Math.ceil(values.length / 2)}</Text>
          <Text className="text-[10px] text-ink-500">{values.length}</Text>
        </View>
      )}
    </View>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-dashed border-ink-800 p-6">
      <Text className="text-center text-sm text-ink-500">{children}</Text>
    </View>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-ink-800 bg-ink-900 p-4 ${className}`}>{children}</View>;
}
