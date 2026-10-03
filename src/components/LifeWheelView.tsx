import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LIFE_AREAS, LIFE_SCORE_MAX, LIFE_SCORE_MIN, LIFE_WHEEL_RINGS, type LifeArea } from '../config/lifeWheel';
import { monthName, monthShort, monthYear } from '../lib/dateLabels';
import { monthKey, shiftMonth, today } from '../lib/dates';
import { useDb } from '../lib/db';
import { useIsDesktop } from '../lib/layout';
import {
  average,
  chartLayout,
  dashPolygon,
  decimal,
  delta,
  labelPlacement,
  mixHex,
  overlayFor,
  radarPoint,
  radarPolygon,
  scoresOf,
  segmentBox,
  signedDecimal,
  triangleBox,
  type Point,
} from '../lib/lifeWheel';
import { useThemeColors } from '../lib/theme';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

const AREA_IDS = LIFE_AREAS.map((a) => a.id);
const SCORES = Array.from({ length: LIFE_SCORE_MAX - LIFE_SCORE_MIN + 1 }, (_, i) => LIFE_SCORE_MIN + i);
/** Ancho máximo del gráfico (en la PC no se agranda de más). */
const MAX_CHART_WIDTH = 380;
/** Cuánto color de la app lleva el relleno del mes (mezclado con el fondo de la tarjeta). */
const FILL_ALPHA = 0.28;

/** Rueda de la vida: una vez por mes, del 1 al 10 cómo está cada área. */
export default function LifeWheelView() {
  const isDesktop = useIsDesktop();
  const thisMonth = monthKey(today());
  const [month, setMonth] = useState(thisMonth);
  const lifeWheel = useDb((s) => s.lifeWheel);
  const prevMonth = shiftMonth(month, -1);

  const cur = useMemo(() => scoresOf(lifeWheel.find((m) => m.id === month), AREA_IDS), [lifeWheel, month]);
  const prev = useMemo(() => scoresOf(lifeWheel.find((m) => m.id === prevMonth), AREA_IDS), [lifeWheel, prevMonth]);
  const hasCur = Object.keys(cur).length > 0;
  const hasPrev = Object.keys(prev).length > 0;
  const avg = average(cur, AREA_IDS);
  const avgDelta = delta(avg, average(prev, AREA_IDS));
  // Los meses que todavía no llegaron no se pueden puntuar.
  const canNext = month < thisMonth;

  const setScore = (areaId: string, score: number) => useDb.getState().setLifeWheelScore(month, areaId, score);

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="w-full max-w-3xl self-center gap-4 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="metas" subId="rueda" />
        </View>

        <Text className="text-sm leading-5 text-ink-400">
          Una vez por mes, poné del 1 al 10 cómo sentís cada área. La rueda te muestra dónde poner energía.
        </Text>

        <View className="flex-row items-center justify-between rounded-2xl border border-ink-800 bg-ink-900 px-1">
          <Pressable onPress={() => setMonth(prevMonth)} className="h-11 w-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Mes anterior">
            <Text className="text-xl text-ink-300">‹</Text>
          </Pressable>
          <View className="items-center">
            <Text className="text-base font-bold text-ink-100">{monthYear(month)}</Text>
            {month !== thisMonth && (
              <Pressable onPress={() => setMonth(thisMonth)} hitSlop={8}>
                <Text className="text-xs text-shu-400">Volver a este mes</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => canNext && setMonth(shiftMonth(month, 1))}
            disabled={!canNext}
            className={`h-11 w-11 items-center justify-center ${canNext ? '' : 'opacity-30'}`}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            accessibilityState={{ disabled: !canNext }}>
            <Text className="text-xl text-ink-300">›</Text>
          </Pressable>
        </View>

        <View className={isDesktop ? 'flex-row items-start gap-4' : 'gap-4'}>
          <View className={`items-center gap-2.5 rounded-2xl border border-ink-800 bg-ink-900 p-4 ${isDesktop ? 'flex-1' : ''}`}>
            <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 self-stretch">
              <Text className="text-base font-bold text-ink-100">{monthName(month)}</Text>
              <Text className="text-[13px] text-ink-400">
                Promedio <Text className="text-lg font-extrabold text-ink-100">{avg !== undefined ? decimal(avg) : '—'}</Text>
                {avgDelta !== undefined && (
                  <Text className={`font-bold ${avgDelta > 0 ? 'text-shu-300' : 'text-ink-400'}`}>
                    {'  '}
                    {avgDelta === 0 ? `igual que ${monthShort(prevMonth)}` : `${signedDecimal(avgDelta)} vs ${monthShort(prevMonth)}`}
                  </Text>
                )}
              </Text>
            </View>

            {!hasCur && (
              <Text className="self-stretch text-sm leading-5 text-ink-400">
                Todavía no puntuaste {monthName(month).toLowerCase()}. Tocá un número del 1 al 10 en cada área: 1 es muy mal y 10 es excelente.
              </Text>
            )}

            <RadarChart cur={cur} prev={prev} showCur={hasCur} showPrev={hasPrev} />

            <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-1">
              {hasCur && <LegendNow label={monthName(month)} />}
              {hasPrev && <LegendPrev label={monthName(prevMonth)} />}
            </View>
          </View>

          <View className={`rounded-2xl border border-ink-800 bg-ink-900 px-4 py-1.5 ${isDesktop ? 'flex-1' : ''}`}>
            {LIFE_AREAS.map((area, i) => (
              <AreaRow key={area.id} area={area} value={cur[area.id]} prev={prev[area.id]} last={i === LIFE_AREAS.length - 1} onSet={(v) => setScore(area.id, v)} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Una área: nombre, cambio contra el mes anterior, el puntaje y los botones del 1 al 10. */
function AreaRow({ area, value, prev, last, onSet }: { area: LifeArea; value?: number; prev?: number; last: boolean; onSet: (v: number) => void }) {
  const d = delta(value, prev);
  return (
    <View className={`gap-2 py-2.5 ${last ? '' : 'border-b border-ink-800'}`}>
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="shrink text-[15px] font-semibold text-ink-100">
          {area.icon} {area.name}
        </Text>
        <Text className="text-[13px] text-ink-400">
          {d !== undefined && (
            <Text className={d > 0 ? 'font-bold text-shu-300' : d < 0 ? 'font-bold text-ink-400' : 'text-ink-500'}>
              {d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '='}
              {'  '}
            </Text>
          )}
          {value !== undefined ? (
            <>
              <Text className="text-[17px] font-extrabold text-ink-100">{value}</Text>/10
            </>
          ) : (
            <Text className="text-[17px] font-extrabold text-ink-500">—</Text>
          )}
        </Text>
      </View>
      <View className="flex-row gap-1">
        {SCORES.map((n) => {
          const filled = value !== undefined && n <= value;
          return (
            <Pressable
              key={n}
              onPress={() => onSet(n)}
              accessibilityRole="button"
              accessibilityLabel={`${area.name}: ${n} de ${LIFE_SCORE_MAX}`}
              accessibilityState={{ selected: value === n }}
              className="h-11 flex-1 justify-center">
              <View className={`h-8 items-center justify-center rounded-md ${filled ? 'bg-shu-500' : 'bg-ink-800'}`}>
                <Text className={`text-[13px] ${value === n ? 'font-extrabold' : 'font-semibold'} ${filled ? 'text-washi' : 'text-ink-500'}`}>{n}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LegendNow({ label }: { label: string }) {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 14, height: 10, borderRadius: 3, borderWidth: 2, borderColor: c['shu-400'], backgroundColor: mixHex(c['ink-900'], c['shu-500'], FILL_ALPHA) }} />
      <Text className="text-xs text-ink-400">{label}</Text>
    </View>
  );
}

function LegendPrev({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="flex-row gap-[3px]">
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-0.5 w-1 bg-ink-500" />
        ))}
      </View>
      <Text className="text-xs text-ink-400">{label}</Text>
    </View>
  );
}

/**
 * El gráfico de araña. No hay librería de SVG en la app: cada raya es una View finita rotada y el
 * relleno son triángulos (centro + dos puntas) hechos con bordes. Las cuentas están en lib/lifeWheel.
 */
function RadarChart({ cur, prev, showCur, showPrev }: { cur: Record<string, number>; prev: Record<string, number>; showCur: boolean; showPrev: boolean }) {
  const c = useThemeColors();
  const [width, setWidth] = useState(0);
  const layout = useMemo(() => (width ? chartLayout(width) : null), [width]);

  const shapes = useMemo(() => {
    if (!layout) return null;
    const { cx, cy, radius } = layout;
    const n = LIFE_AREAS.length;
    const ring = (lv: number) => LIFE_AREAS.map((_, i) => radarPoint(i, n, lv, cx, cy, radius));
    const curPts = radarPolygon(AREA_IDS.map((id) => cur[id]), cx, cy, radius);
    const prevPts = radarPolygon(AREA_IDS.map((id) => prev[id]), cx, cy, radius);
    return {
      rings: LIFE_WHEEL_RINGS.map(ring),
      axes: ring(LIFE_SCORE_MAX),
      curPts,
      prevDashes: dashPolygon(prevPts, 5, 4),
      labels: LIFE_AREAS.map((a, i) => ({ ...labelPlacement(i, n, cx, cy, layout.labelRadius), name: a.name })),
    };
  }, [layout, cur, prev]);

  const center: Point | null = layout ? { x: layout.cx, y: layout.cy } : null;
  const fill = mixHex(c['ink-900'], c['shu-500'], FILL_ALPHA);
  const grid = overlayFor(c['ink-900'], c['ink-800']);

  return (
    <View
      className="self-stretch"
      style={{ marginHorizontal: -8 }}
      onLayout={(e) => setWidth(Math.min(Math.round(e.nativeEvent.layout.width), MAX_CHART_WIDTH))}
      accessible
      accessibilityLabel={`Rueda de la vida: ${LIFE_AREAS.map((a) => `${a.name} ${cur[a.id] ?? 'sin puntaje'}`).join(', ')}`}>
      {layout && shapes && center ? (
        <View pointerEvents="none" style={{ width, height: layout.height, alignSelf: 'center' }}>
          {/* Relleno opaco (ver lib/lifeWheel): triángulos + rayas del mismo color tapando las uniones. */}
          {showCur &&
            shapes.curPts.map((p, i) => <Triangle key={`f${i}`} p1={center} p2={p} p3={shapes.curPts[(i + 1) % shapes.curPts.length]} color={fill} />)}
          {showCur && shapes.curPts.map((p, i) => <Line key={`c${i}`} a={center} b={p} color={fill} thickness={3} />)}
          {/* La grilla va encima del relleno, semitransparente: se ve a través como en el diseño. */}
          {shapes.rings.map((pts, r) => pts.map((p, i) => <Line key={`r${r}-${i}`} a={p} b={pts[(i + 1) % pts.length]} color={grid} thickness={1} />))}
          {shapes.axes.map((p, i) => (
            <Line key={`a${i}`} a={center} b={p} color={grid} thickness={1} />
          ))}
          {showPrev && shapes.prevDashes.map(([a, b], i) => <Line key={`p${i}`} a={a} b={b} color={c['ink-500']} thickness={2} />)}
          {showCur && (
            <>
              {shapes.curPts.map((p, i) => (
                <Line key={`s${i}`} a={p} b={shapes.curPts[(i + 1) % shapes.curPts.length]} color={c['shu-400']} thickness={2.5} />
              ))}
              {/* Puntitos en las esquinas para que la línea no quede cortada en los ángulos. */}
              {shapes.curPts.map((p, i) => (
                <View key={`d${i}`} style={{ position: 'absolute', left: p.x - 1.5, top: p.y - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: c['shu-400'] }} />
              ))}
            </>
          )}
          {shapes.labels.map((l) => (
            <Text
              key={l.name}
              numberOfLines={1}
              className="text-xs font-semibold text-ink-300"
              style={{
                position: 'absolute',
                top: l.y - 8,
                width: 96,
                left: l.align === 'left' ? l.x - 2 : l.align === 'right' ? l.x - 94 : l.x - 48,
                textAlign: l.align,
              }}>
              {l.name}
            </Text>
          ))}
        </View>
      ) : (
        // Antes de medir el ancho: el lugar reservado, para que no salte la pantalla.
        <View style={{ height: chartLayout(320).height }} />
      )}
    </View>
  );
}

/** Raya de `a` a `b`: una View finita, rotada. */
function Line({ a, b, color, thickness }: { a: Point; b: Point; color: string; thickness: number }) {
  const s = segmentBox(a, b, thickness);
  if (!s) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: s.left,
        top: s.top,
        width: s.width,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${s.angle}rad` }],
      }}
    />
  );
}

/** Triángulo relleno: View sin tamaño con el borde de abajo pintado y los de los costados transparentes. `color`: '#rrggbb'. */
function Triangle({ p1, p2, p3, color }: { p1: Point; p2: Point; p3: Point; color: string }) {
  const t = triangleBox(p1, p2, p3);
  if (!t) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: t.left,
        top: t.top,
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderTopWidth: 0,
        borderLeftWidth: t.leftPart,
        borderRightWidth: t.width - t.leftPart,
        borderBottomWidth: t.height,
        // Transparente pero del mismo color (con 'transparent' algunos navegadores oscurecen el borde).
        borderLeftColor: `${color}00`,
        borderRightColor: `${color}00`,
        borderBottomColor: color,
        transform: [{ rotate: `${t.angle}rad` }],
      }}
    />
  );
}
