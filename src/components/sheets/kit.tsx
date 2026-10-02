import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackButton from '../BackButton';
import ScreenTitle from '../ScreenTitle';

/**
 * Piezas comunes de las hojas de categoría (Entrenamiento, Trabajo, Fútbol, Lectura, Bienestar,
 * Proyectos). Todo el color sale del color de la app (`shu-*`, elegido en Ajustes): nada fijo.
 */

/** Pantalla de una hoja: flecha + título de la categoría (✏️ para renombrarla) y el contenido. `overlay`: ventanas (formularios) fuera del scroll. */
export function SheetScreen({ categoryId, children, overlay }: { categoryId: string; children: ReactNode; overlay?: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      {/* En la PC el contenido no se estira a todo el ancho (max-w-3xl, centrado). */}
      <ScrollView className="flex-1 px-4" contentContainerClassName="w-full max-w-3xl self-center gap-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId={categoryId} />
        </View>
        {children}
      </ScrollView>
      {overlay}
    </SafeAreaView>
  );
}

/** Tarjeta destacada de arriba, teñida con el color de la app. */
export function Hero({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View className="gap-4 rounded-2xl border border-shu-500/40 bg-shu-500/10 p-4">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="text-sm font-bold text-shu-300">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Tarjeta común con título (y aclaración opcional). */
export function Section({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[17px] font-bold text-ink-100">{title}</Text>
          {!!subtitle && <Text className="mt-1 text-xs text-ink-400">{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Número grande con su etiqueta (para la tarjeta destacada). */
export function BigStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View>
      <Text className={`text-4xl font-extrabold ${accent ? 'text-shu-300' : 'text-ink-100'}`}>{value}</Text>
      <Text className="mt-1 text-xs text-ink-300">{label}</Text>
    </View>
  );
}

/** Recuadro chico de dato (grillas de 2 o 3 columnas). */
export function StatTile({ label, value, hint, style }: { label: string; value: string; hint?: string; style?: object }) {
  return (
    <View className="rounded-2xl border border-ink-800 bg-ink-900 p-3.5" style={style}>
      <Text className="text-xs text-ink-400">{label}</Text>
      <Text className="mt-0.5 text-2xl font-extrabold text-ink-100">{value}</Text>
      {!!hint && <Text className="mt-0.5 text-xs text-shu-300">{hint}</Text>}
    </View>
  );
}

const SELECTED = 'border border-shu-400 bg-shu-500/20';
const UNSELECTED = 'border border-ink-700';

/** Opción tipo píldora (se pueden elegir varias o una). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`h-9 justify-center rounded-full px-3.5 ${selected ? SELECTED : UNSELECTED}`}>
      <Text className={`text-sm ${selected ? 'font-semibold text-shu-300' : 'text-ink-300'}`}>{label}</Text>
    </Pressable>
  );
}

/** Botón de elegir más grande (ej. 30/45/60 min), para filas que se reparten el ancho. */
export function Choice({ label, selected, onPress, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      className={`h-11 flex-1 items-center justify-center rounded-xl ${selected ? SELECTED : `${UNSELECTED} bg-ink-950`}`}>
      <Text className={`text-[15px] ${selected ? 'font-bold text-shu-300' : 'text-ink-300'}`}>{label}</Text>
    </Pressable>
  );
}

/** Selector de una opción entre pocas (pestañas). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="flex-row gap-1 rounded-xl border border-ink-800 bg-ink-950 p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`h-10 flex-1 items-center justify-center rounded-lg ${selected ? 'bg-ink-800' : ''}`}>
            <Text numberOfLines={1} className={`text-sm ${selected ? 'font-bold text-ink-100' : 'text-ink-400'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − valor + (goles, horas de sueño…). */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  format = String,
  lessLabel = 'Menos',
  moreLabel = 'Más',
  big,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  lessLabel?: string;
  moreLabel?: string;
  big?: boolean;
}) {
  const size = big ? 'h-[52px] w-[52px] rounded-full' : 'h-11 w-11 rounded-xl';
  return (
    <View className={`flex-row items-center justify-between ${big ? '' : 'rounded-xl border border-ink-700 bg-ink-950 px-1'}`}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - step))}
        accessibilityLabel={lessLabel}
        className={`${size} items-center justify-center ${big ? 'border border-ink-700 bg-ink-950' : ''}`}>
        <Text className="text-2xl text-ink-300">−</Text>
      </Pressable>
      <Text className={`${big ? 'text-4xl' : 'text-xl'} font-extrabold text-ink-100`}>{format(value)}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + step))}
        accessibilityLabel={moreLabel}
        className={`${size} items-center justify-center ${big ? 'border border-shu-400 bg-ink-950' : ''}`}>
        <Text className="text-2xl text-shu-300">+</Text>
      </Pressable>
    </View>
  );
}

/** Botón principal de la hoja (Guardar…), con el color de la app. */
export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`h-12 items-center justify-center rounded-xl bg-shu-500 ${disabled ? 'opacity-40' : 'active:opacity-80'}`}>
      <Text className="text-base font-bold text-washi">{label}</Text>
    </Pressable>
  );
}

/** Botón chico con borde (Empezar, Pausar, Ver más…). `strong`: relleno con el color de la app. */
export function SmallButton({ label, onPress, strong, accessibilityLabel }: { label: string; onPress: () => void; strong?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`h-9 items-center justify-center rounded-lg px-3 ${strong ? 'bg-shu-500' : 'border border-ink-700'}`}>
      <Text className={`text-[13px] font-semibold ${strong ? 'text-washi' : 'text-ink-300'}`}>{label}</Text>
    </Pressable>
  );
}
