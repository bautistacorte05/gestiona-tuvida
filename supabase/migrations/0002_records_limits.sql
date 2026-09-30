-- Límites para que una cuenta no pueda usar la base como depósito de cualquier cosa
-- (el registro de cuentas es abierto). No cambia nada para el uso normal de la app.
-- Pegar entero en Supabase → SQL Editor → Run.
--
-- Colecciones: nombres cortos de solo letras (no una lista fija: con lista, cada tipo de dato
-- nuevo de la app necesitaba otro script, y aplicarla sobre datos ya existentes fallaba).

alter table public.records drop constraint if exists records_collection_known;
alter table public.records add constraint records_collection_known
  check (collection ~ '^[a-zA-Z]{1,40}$');

alter table public.records drop constraint if exists records_id_length;
alter table public.records add constraint records_id_length
  check (char_length(id) between 1 and 200);

-- 2 MB por registro: sobra para un paseo largo con todo su recorrido GPS o la foto de la mascota.
alter table public.records drop constraint if exists records_data_size;
alter table public.records add constraint records_data_size
  check (data is null or octet_length(data::text) <= 2000000);
