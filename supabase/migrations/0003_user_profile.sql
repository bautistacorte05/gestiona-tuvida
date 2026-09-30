-- Suma el perfil de la persona (Ajustes → Perfil) a las colecciones permitidas.
-- Se puede correr haya o no se haya corrido antes 0002_records_limits.sql.
-- Pegar entero en Supabase → SQL Editor → Run.

alter table public.records drop constraint if exists records_collection_known;
alter table public.records add constraint records_collection_known
  check (collection in ('entries', 'checks', 'dailyGoals', 'longGoals', 'petProfiles', 'petCommands', 'petWalks', 'trainingProgress', 'userProfile'));
