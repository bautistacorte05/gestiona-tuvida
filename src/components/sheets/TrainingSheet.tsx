import { useMemo, useState } from 'react';

import { today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { useFindSub } from '../../lib/names';
import { computeStreak } from '../../lib/streak';
import { groupStats, isExerciseEntry, isTraining, lastWeeks, newestFirst, weekSummary } from '../../lib/training';
import EntryForm from '../EntryForm';
import { PrimaryButton, SheetScreen } from './kit';
import { TrainingCalendar, TrainingGroups, TrainingLastWorkout, TrainingPRs, TrainingProgress, TrainingRecent, TrainingWeekHero } from './trainingParts';
import WorkoutForm from './WorkoutForm';

export default function TrainingSheet() {
  const found = useFindSub('entrenamiento', 'gimnasio');
  const entries = useDb((s) => s.entries);
  const checks = useDb((s) => s.checks);
  const [editing, setEditing] = useState<{ entry?: Entry } | null>(null);
  const [workout, setWorkout] = useState<{ entry?: Entry } | null>(null);
  const now = today();

  const groupOptions = useMemo(() => found?.sub.fields.find((f) => f.key === 'grupo')?.options ?? [], [found]);
  const week = useMemo(() => weekSummary(entries, checks, now), [entries, checks, now]);
  const streak = useMemo(() => computeStreak(checks, 'entrenamiento'), [checks]);
  const groups = useMemo(() => groupStats(entries, groupOptions, now), [entries, groupOptions, now]);
  const weeks = useMemo(() => lastWeeks(now), [now]);
  const recent = useMemo(() => entries.filter(isTraining).sort(newestFirst), [entries]);
  const exerciseEntries = useMemo(() => entries.filter(isExerciseEntry), [entries]);

  if (!found) return null;

  const overlay =
    workout !== null ? (
      <WorkoutForm entry={workout.entry} defaultDate={now} onClose={() => setWorkout(null)} />
    ) : editing ? (
      <EntryForm category={found.category} sub={found.sub} entry={editing.entry} defaultDate={now} onClose={() => setEditing(null)} />
    ) : null;

  const openEntry = (entry: Entry) => {
    if (entry.values.ejercicio) setWorkout({ entry });
    else setEditing({ entry });
  };

  return (
    <SheetScreen categoryId="entrenamiento" overlay={overlay}>
      <TrainingWeekHero days={week.days} done={week.done} now={now} trainedDays={week.trainedDays} minutes={week.minutes} streak={streak} />
      <PrimaryButton label="Anotar entrenamiento" onPress={() => setWorkout({})} />
      <TrainingLastWorkout entries={exerciseEntries} now={now} />
      <TrainingPRs entries={exerciseEntries} />
      <TrainingProgress entries={exerciseEntries} />
      <TrainingGroups stats={groups} now={now} />
      <TrainingCalendar weeks={weeks} done={week.done} now={now} />
      <TrainingRecent entries={recent} sub={found.sub} now={now} onOpen={openEntry} onAdd={() => setEditing({})} />
    </SheetScreen>
  );
}
