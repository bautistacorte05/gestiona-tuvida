import { useMemo, useState } from 'react';

import { today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { matchesOfYear, matchSummary, yearBounds } from '../../lib/football';
import { useFindSub } from '../../lib/names';
import EntryForm from '../EntryForm';
import { FootballHero, FootballMatches, FootballQuickLog, FootballStats } from './footballParts';
import { SheetScreen } from './kit';

/**
 * Hoja de Fútbol: primero cargar un partido y después los resultados: resumen del año (‹ año ›
 * para ver otros), goles y asistencias y la lista de partidos de ese año. Fútbol no es un hábito
 * diario: cargar un partido no tilda nada en Hoy.
 */
export default function FootballSheet() {
  const found = useFindSub('futbol', 'partidos');
  const entries = useDb((s) => s.entries);
  const now = today();
  const currentYear = Number(now.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  // Registro abierto en el formulario completo (sin `entry` = uno nuevo).
  const [editing, setEditing] = useState<{ entry?: Entry } | null>(null);

  const formats = useMemo(() => found?.sub.fields.find((f) => f.key === 'formato')?.options ?? [], [found]);
  const bounds = useMemo(() => yearBounds(entries, currentYear), [entries, currentYear]);
  const matches = useMemo(() => matchesOfYear(entries, year), [entries, year]);
  const summary = useMemo(() => matchSummary(matches, formats), [matches, formats]);
  const isCurrent = year === currentYear;

  if (!found) return null;

  return (
    <SheetScreen
      categoryId="futbol"
      overlay={editing ? <EntryForm category={found.category} sub={found.sub} entry={editing.entry} defaultDate={now} onClose={() => setEditing(null)} /> : null}>
      {/* El partido se guarda con la fecha de hoy: se vuelve a este año para verlo en la lista. */}
      <FootballQuickLog formats={formats} onSaved={() => setYear(currentYear)} />
      <FootballHero year={year} isCurrent={isCurrent} bounds={bounds} onYear={setYear} summary={summary} matches={matches} />
      <FootballStats summary={summary} />
      <FootballMatches
        key={year}
        matches={matches}
        year={year}
        isCurrent={isCurrent}
        now={now}
        onOpen={(entry) => setEditing({ entry })}
        onAdd={() => setEditing({})}
      />
    </SheetScreen>
  );
}
