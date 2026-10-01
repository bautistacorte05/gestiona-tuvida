import { useDb, type Entry, type PetProfile } from './db';

/**
 * Reorganizaciones de datos por cambios en las categorías. Se corren al arrancar y después de cada
 * bajada de la sincronización (un dispositivo con la versión vieja puede seguir creando registros
 * en el formato anterior). Son idempotentes y sus cambios se sincronizan como cualquier edición.
 *
 * - Mascota → Vacunas se integró a Salud/Veterinario (motivo Vacuna/Desparasitación, nombre, próxima dosis).
 * - Mascota → Peso pasó al historial del perfil de cada mascota (`pesos`).
 */
export function runDataMigrations() {
  const { entries, petProfiles } = useDb.getState();
  const vacunas = entries.filter((e) => e.categoryId === 'mascota' && e.subId === 'vacunas');
  const pesos = entries.filter((e) => e.categoryId === 'mascota' && e.subId === 'peso');
  if (!vacunas.length && !pesos.length) return;

  const now = Date.now();
  const migratedIds = new Set<string>();
  const nextEntries: Entry[] = [];
  const profiles = new Map(petProfiles.map((p) => [p.id, p]));
  const touchedProfiles = new Set<string>();

  for (const e of entries) {
    if (e.categoryId === 'mascota' && e.subId === 'vacunas') {
      const { tipo, nombre, proximaDosis, detalle } = e.values;
      nextEntries.push({
        ...e,
        subId: 'salud',
        values: {
          motivo: [tipo === 'Antiparasitario' ? 'Desparasitación' : 'Vacuna'],
          ...(nombre ? { nombre } : {}),
          ...(proximaDosis ? { proximaDosis } : {}),
          ...(detalle ? { detalle } : {}),
        },
        updatedAt: now,
      });
      migratedIds.add(e.id);
      continue;
    }
    if (e.categoryId === 'mascota' && e.subId === 'peso') {
      const kg = Number(e.values.kg);
      const pet = e.petId ? profiles.get(e.petId) : undefined;
      // Sin mascota a quién asignarlo, se deja como está para no perder el dato.
      if (!pet || !Number.isFinite(kg)) {
        nextEntries.push(e);
        continue;
      }
      const history = pet.pesos ?? [];
      if (!history.some((h) => h.date === e.date && h.kg === kg)) {
        const updated: PetProfile = { ...pet, pesos: [...history, { date: e.date, kg }].sort((a, b) => a.date.localeCompare(b.date)), updatedAt: now };
        profiles.set(pet.id, updated);
        touchedProfiles.add(pet.id);
      }
      migratedIds.add(e.id);
      continue; // el registro suelto se borra: el peso ya vive en el perfil
    }
    nextEntries.push(e);
  }

  if (!migratedIds.size) return;
  useDb.setState({
    entries: nextEntries,
    ...(touchedProfiles.size ? { petProfiles: petProfiles.map((p) => profiles.get(p.id) ?? p) } : {}),
  });
  if (__DEV__) console.log(`[migraciones] ${vacunas.length} vacunas → Salud, ${pesos.length} pesos → perfil`);
}
