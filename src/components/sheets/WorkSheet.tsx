import { useMemo, useState } from 'react';

import type { Subcategory } from '../../config/categories';
import { monthKey, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { weekDates } from '../../lib/habits';
import { useFindSub } from '../../lib/names';
import { newestFirst } from '../../lib/training';
import { DEFAULT_WEEKLY_GOAL, hoursByDay, isJornada, modalityDays, monthName, tasksByState, todayJornada } from '../../lib/work';
import EntryForm from '../EntryForm';
import { SheetScreen } from './kit';
import { WorkGoalModal, WorkModality, WorkRecentDays, WorkTasks, WorkTodayLog, WorkWeekHero } from './workParts';

/**
 * Hoja de Trabajo: horas de la semana contra la meta, cargar las de hoy, dónde se trabajó en el
 * mes, las tareas y las jornadas anteriores. La meta de horas se guarda en el perfil (viaja con la cuenta).
 */
export default function WorkSheet() {
  const found = useFindSub('trabajo', 'jornada');
  const tasksSub = useFindSub('trabajo', 'tareas');
  const entries = useDb((s) => s.entries);
  const checks = useDb((s) => s.checks);
  const savedGoal = useDb((s) => s.userProfile[0]?.metaHorasSemana);
  const goal = typeof savedGoal === 'number' && savedGoal > 0 ? savedGoal : DEFAULT_WEEKLY_GOAL;
  // Registro abierto en el formulario completo (jornada o tarea; sin `entry` = uno nuevo).
  const [editing, setEditing] = useState<{ sub: Subcategory; entry?: Entry } | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const now = today();
  const month = monthKey(now);

  const days = useMemo(() => weekDates(now), [now]);
  const hours = useMemo(() => hoursByDay(entries, checks, days), [entries, checks, days]);
  const modalityOptions = useMemo(() => found?.sub.fields.find((f) => f.key === 'modalidad')?.options ?? [], [found]);
  const modality = useMemo(() => modalityDays(entries, month, modalityOptions), [entries, month, modalityOptions]);
  const tasks = useMemo(() => tasksByState(entries), [entries]);
  const recent = useMemo(() => entries.filter(isJornada).sort(newestFirst), [entries]);
  const existing = useMemo(() => todayJornada(entries, now), [entries, now]);

  if (!found || !tasksSub) return null;

  return (
    <SheetScreen
      categoryId="trabajo"
      overlay={
        <>
          {editing ? <EntryForm category={found.category} sub={editing.sub} entry={editing.entry} defaultDate={now} onClose={() => setEditing(null)} /> : null}
          {goalOpen ? <WorkGoalModal goal={goal} onClose={() => setGoalOpen(false)} /> : null}
        </>
      }>
      <WorkWeekHero days={days} hours={hours} now={now} goal={goal} onEditGoal={() => setGoalOpen(true)} />
      <WorkTodayLog existing={existing} modalities={modalityOptions} categoryName={found.category.name} />
      <WorkModality monthName={monthName(month)} data={modality} options={modalityOptions} />
      <WorkTasks tasks={tasks} onOpen={(entry) => setEditing({ sub: tasksSub.sub, entry })} />
      <WorkRecentDays entries={recent} now={now} onOpen={(entry) => setEditing({ sub: found.sub, entry })} onAdd={() => setEditing({ sub: found.sub })} />
    </SheetScreen>
  );
}
