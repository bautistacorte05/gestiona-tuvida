import { useMemo, useState } from 'react';

import { today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { useFindSub } from '../../lib/names';
import { computeStreak } from '../../lib/streak';
import { groupStats, isTraining, lastWeeks, newestFirst, weekSummary } from '../../lib/training';
import EntryForm from '../EntryForm';
import { SheetScreen } from './kit';
import { TrainingCalendar, TrainingGroups, TrainingQuickLog, TrainingRecent, TrainingWeekHero } from './trainingParts';

/**
 * Hoja de Entrenamiento: la semana, los días de las últimas semanas, anotar el de hoy, qué grupos
 * se trabajaron y los últimos registros. Los días salen de lo que se tilda en Hoy o de los
 * registros de Gimnasio (no hace falta cargar nada para que cuenten).
 */
export default function TrainingSheet() {
  const found = useFindSub('entrenamiento', 'gimnasio');
  const entries = useDb((s) => s.entries);
  const checks = useDb((s) => s.checks);
  // Registro abierto en el formulario completo (sin `entry` = uno nuevo).
  const [editing, setEditing] = useState<{ entry?: Entry } | null>(null);
  const now = today();

  const groupOptions = useMemo(() => found?.sub.fields.find((f) => f.key === 'grupo')?.options ?? [], [found]);
  const week = useMemo(() => weekSummary(entries, checks, now), [entries, checks, now]);
  const streak = useMemo(() => computeStreak(checks, 'entrenamiento'), [checks]);
  const groups = useMemo(() => groupStats(entries, groupOptions, now), [entries, groupOptions, now]);
  const weeks = useMemo(() => lastWeeks(now), [now]);
  const recent = useMemo(() => entries.filter(isTraining).sort(newestFirst), [entries]);

  if (!found) return null;

  return (
    <SheetScreen
      categoryId="entrenamiento"
      overlay={editing ? <EntryForm category={found.category} sub={found.sub} entry={editing.entry} defaultDate={now} onClose={() => setEditing(null)} /> : null}>
      <TrainingWeekHero days={week.days} done={week.done} now={now} trainedDays={week.trainedDays} minutes={week.minutes} streak={streak} />
      <TrainingCalendar weeks={weeks} done={week.done} now={now} />
      <TrainingQuickLog groups={groupOptions} />
      <TrainingGroups stats={groups} now={now} />
      <TrainingRecent entries={recent} sub={found.sub} now={now} onOpen={(entry) => setEditing({ entry })} onAdd={() => setEditing({})} />
    </SheetScreen>
  );
}
