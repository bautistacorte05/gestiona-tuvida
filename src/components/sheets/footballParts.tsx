import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { formatDecimal, formatInt, matchStatsText, RESULT_LETTER, RESULTS, resultOf, type MatchResult, type MatchSummary } from '../../lib/football';
import { listDate } from '../../lib/training';
import TrashButton from '../TrashButton';
import { Chip, Choice, Hero, NumberStepper, PrimaryButton, Section, SmallButton, StatTile } from './kit';

/**
 * Piezas de la hoja de Fútbol (ver FootballSheet). Todo el color sale del color de la app:
 * ganado = relleno con el color, empatado = gris, perdido = solo borde (nada de rojo/verde).
 */

type Summary = MatchSummary;

const RESULT_STYLE: Record<MatchResult, { box: string; text: string }> = {
  Ganado: { box: 'bg-shu-500', text: 'text-washi' },
  Empatado: { box: 'bg-ink-700', text: 'text-ink-100' },
  Perdido: { box: 'border border-ink-600 bg-ink-900', text: 'text-ink-300' },
};
const UNKNOWN_STYLE = { box: 'bg-ink-800', text: 'text-ink-400' };
const PLURAL: Record<MatchResult, string> = { Ganado: 'Ganados', Empatado: 'Empatados', Perdido: 'Perdidos' };

/** "Guardado ✓" por un rato después de guardar. */
function useSavedFlash(ms = 2500) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(() => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, flash] as const;
}

/** Letra del resultado (G/E/P) en un círculo (`round`) o un cuadrado redondeado. */
function ResultBadge({ result, round }: { result?: MatchResult; round?: boolean }) {
  const s = result ? RESULT_STYLE[result] : UNKNOWN_STYLE;
  return (
    <View
      accessible
      accessibilityLabel={result ?? 'Sin resultado'}
      className={`items-center justify-center ${round ? 'h-8 w-8 rounded-full' : 'h-10 w-10 rounded-xl'} ${s.box}`}>
      <Text className={`${round ? 'text-[13px]' : 'text-[15px]'} font-extrabold ${s.text}`}>{result ? RESULT_LETTER[result] : '?'}</Text>
    </View>
  );
}

function YearStepper({ year, min, max, onChange }: { year: number; min: number; max: number; onChange: (y: number) => void }) {
  const arrow = (dir: -1 | 1) => {
    const disabled = dir < 0 ? year <= min : year >= max;
    return (
      <Pressable
        onPress={() => onChange(year + dir)}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? 'Año anterior' : 'Año siguiente'}
        accessibilityState={{ disabled }}
        className={`h-8 w-8 items-center justify-center rounded-lg ${disabled ? 'opacity-30' : 'active:bg-ink-800/60'}`}>
        <Text className="text-lg text-ink-300">{dir < 0 ? '‹' : '›'}</Text>
      </Pressable>
    );
  };
  return (
    <View className="flex-row items-center gap-0.5">
      {arrow(-1)}
      <Text className="text-sm font-semibold text-ink-100">{year}</Text>
      {arrow(1)}
    </View>
  );
}

// ——— Este año ———

export function FootballHero({
  year,
  isCurrent,
  bounds,
  onYear,
  summary,
  matches,
}: {
  year: number;
  isCurrent: boolean;
  bounds: { min: number; max: number };
  onYear: (y: number) => void;
  summary: Summary;
  matches: Entry[];
}) {
  const title = `${isCurrent ? 'Este año' : `En ${year}`} · ${summary.played} ${summary.played === 1 ? 'partido' : 'partidos'}`;
  const counts: Record<MatchResult, number> = { Ganado: summary.won, Empatado: summary.drawn, Perdido: summary.lost };
  const last = matches.slice(0, 5); // el más nuevo primero

  return (
    <Hero title={title} right={<YearStepper year={year} min={bounds.min} max={bounds.max} onChange={onYear} />}>
      {summary.winPct !== undefined && <Text className="-mt-2 text-[13px] text-ink-300">{summary.winPct}% ganados</Text>}
      <View className="flex-row gap-2">
        {RESULTS.map((r) => (
          <View key={r} accessible accessibilityLabel={`${PLURAL[r]}: ${counts[r]}`} className={`flex-1 items-center rounded-xl p-3 ${RESULT_STYLE[r].box}`}>
            <Text className={`text-4xl font-extrabold ${RESULT_STYLE[r].text}`}>{counts[r]}</Text>
            <Text className={`mt-1 text-xs font-bold ${RESULT_STYLE[r].text}`}>{PLURAL[r]}</Text>
          </View>
        ))}
      </View>
      {last.length > 0 && (
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-[13px] text-ink-300">{last.length === 1 ? 'Último' : `Últimos ${last.length}`}</Text>
          <View className="flex-row gap-1.5">
            {last.map((m) => (
              <ResultBadge key={m.id} result={resultOf(m)} round />
            ))}
          </View>
        </View>
      )}
    </Hero>
  );
}

// ——— Goles, asistencias, minutos, formato ———

export function FootballStats({ summary }: { summary: Summary }) {
  const perMatch = (n?: number) => (n === undefined ? undefined : `${formatDecimal(n)} por partido`);
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <StatTile label="Goles" value={formatInt(summary.goals)} hint={perMatch(summary.goalsPerMatch)} style={{ flex: 1 }} />
        <StatTile label="Asistencias" value={formatInt(summary.assists)} hint={perMatch(summary.assistsPerMatch)} style={{ flex: 1 }} />
      </View>
      <View className="flex-row gap-3">
        <StatTile label="Minutos jugados" value={summary.hasMinutes ? formatInt(summary.minutes) : '—'} style={{ flex: 1 }} />
        <StatTile label="Formato que más jugás" value={summary.topFormat ?? '—'} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ——— Cargar partido ———

const DURATIONS = [50, 60, 70, 90];

export function FootballQuickLog({ formats, onSaved }: { formats: string[]; onSaved: () => void }) {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [saved, flash] = useSavedFlash();

  const save = () => {
    if (!result || !format) return;
    const values: Entry['values'] = { formato: format, resultado: result, goles: goals, asistencias: assists };
    if (minutes) values.minutos = minutes;
    useDb.getState().saveEntry({ categoryId: 'futbol', subId: 'partidos', date: today(), values });
    setResult(null);
    setFormat(null);
    setGoals(0);
    setAssists(0);
    setMinutes(null);
    flash();
    onSaved();
  };

  return (
    <Section title="Cargar partido">
      <View className="gap-2">
        <Text className="text-[13px] text-ink-400">¿Cómo salió?</Text>
        <View className="flex-row gap-2">
          {RESULTS.map((r) => {
            const selected = result === r;
            return (
              <Pressable
                key={r}
                onPress={() => setResult(selected ? null : r)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`h-[52px] flex-1 items-center justify-center rounded-xl ${selected ? 'bg-shu-500' : 'border border-ink-700 bg-ink-950'}`}>
                <Text className={`text-[15px] ${selected ? 'font-extrabold text-washi' : 'text-ink-300'}`}>{r}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {formats.map((f) => (
          <Chip key={f} label={f} selected={format === f} onPress={() => setFormat(format === f ? null : f)} />
        ))}
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 gap-1.5">
          <Text className="text-[13px] text-ink-400">Goles</Text>
          <NumberStepper value={goals} onChange={setGoals} lessLabel="Un gol menos" moreLabel="Un gol más" />
        </View>
        <View className="flex-1 gap-1.5">
          <Text className="text-[13px] text-ink-400">Asistencias</Text>
          <NumberStepper value={assists} onChange={setAssists} lessLabel="Una asistencia menos" moreLabel="Una asistencia más" />
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-[13px] text-ink-400">Duración (opcional)</Text>
        <View className="flex-row gap-2">
          {DURATIONS.map((m) => (
            <Choice key={m} label={`${m} min`} accessibilityLabel={`${m} minutos`} selected={minutes === m} onPress={() => setMinutes(minutes === m ? null : m)} />
          ))}
        </View>
      </View>

      <PrimaryButton label="Guardar partido" onPress={save} disabled={!result || !format} />
      {saved && (
        <Text accessibilityLiveRegion="polite" className="text-center text-sm font-semibold text-shu-300">
          Guardado ✓
        </Text>
      )}
    </Section>
  );
}

// ——— Partidos del año ———

export function FootballMatches({
  matches,
  year,
  isCurrent,
  now,
  onOpen,
  onAdd,
}: {
  matches: Entry[];
  year: number;
  isCurrent: boolean;
  now: string;
  onOpen: (e: Entry) => void;
  onAdd: () => void;
}) {
  const [shown, setShown] = useState(5);
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[17px] font-bold text-ink-100">Partidos</Text>
        <SmallButton label="+ Agregar" onPress={onAdd} accessibilityLabel="Agregar un partido (podés elegir la fecha)" />
      </View>
      {matches.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-ink-800 p-5">
          <Text className="text-center text-sm text-ink-500">{isCurrent ? 'Todavía no cargaste partidos este año.' : `No hay partidos cargados en ${year}.`}</Text>
        </View>
      ) : (
        matches.slice(0, shown).map((m) => {
          const r = resultOf(m);
          const formato = typeof m.values.formato === 'string' ? m.values.formato : '';
          const mins = Number(m.values.minutos) || 0;
          const when = `${listDate(m.date, now)}${mins ? ` · ${formatInt(mins)} min` : ''}`;
          const title = [r ?? 'Partido', formato].filter(Boolean).join(' · ');
          const stats = matchStatsText(m);
          return (
            <View key={m.id} className="flex-row items-center rounded-2xl border border-ink-800 bg-ink-900 pr-1">
              <Pressable
                onPress={() => onOpen(m)}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${when}. ${stats}`}
                accessibilityHint="Abre el partido para cambiarlo"
                className="min-w-0 flex-1 flex-row items-center gap-3 rounded-2xl p-3 active:bg-ink-800/60">
                <ResultBadge result={r} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-semibold text-ink-100">{title}</Text>
                  <Text className="mt-0.5 text-xs text-ink-400">{when}</Text>
                </View>
                <Text className="text-right text-[13px] text-ink-300">{stats}</Text>
              </Pressable>
              <TrashButton what={`el partido del ${listDate(m.date, now)}`} onDelete={() => useDb.getState().deleteEntry(m.id)} />
            </View>
          );
        })
      )}
      {matches.length > shown && <SmallButton label="Ver más" onPress={() => setShown((s) => s + 10)} accessibilityLabel="Ver más partidos" />}
    </View>
  );
}
