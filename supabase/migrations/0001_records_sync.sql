-- Sincronización offline-first: cada registro local (entries, checks, metas,
-- mascotas, paseos, etc.) se guarda tal cual como JSON, con su dueño.
-- Pegar entero en Supabase → SQL Editor → Run.

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  -- Momento de la edición en el dispositivo (ms). Decide qué versión gana.
  updated_at bigint not null,
  -- Momento en que llegó al servidor. Lo usan los otros dispositivos para bajar novedades.
  server_updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists records_pull_idx on public.records (user_id, server_updated_at);

-- Cada cuenta solo ve y modifica sus propios registros.
alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
create policy "records_select_own" on public.records
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "records_insert_own" on public.records;
create policy "records_insert_own" on public.records
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "records_update_own" on public.records;
create policy "records_update_own" on public.records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Sin política de DELETE a propósito: los borrados viajan como marca (deleted = true).

revoke all on public.records from anon;
grant select, insert, update on public.records to authenticated;

-- Sube un lote de cambios. Si el servidor ya tiene una edición más nueva de un
-- registro, la conserva (gana la edición más reciente). Corre con los permisos
-- de quien llama, así que las reglas de arriba siguen aplicando.
-- (Cuerpo con "begin atomic" en vez de $$...$$: el copiar/pegar puede perder los $$.)
create or replace function public.sync_push(items jsonb)
returns void
language sql
security invoker
set search_path = ''
begin atomic
  insert into public.records (user_id, collection, id, data, deleted, updated_at, server_updated_at)
  select
    auth.uid(),
    i ->> 'collection',
    i ->> 'id',
    i -> 'data',
    coalesce((i ->> 'deleted')::boolean, false),
    (i ->> 'updated_at')::bigint,
    now()
  from jsonb_array_elements(items) as i
  on conflict (user_id, collection, id) do update
    set data = excluded.data,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at,
        server_updated_at = now()
    where public.records.updated_at <= excluded.updated_at;
end;

revoke execute on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
