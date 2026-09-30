-- En vez de una lista fija de colecciones (había que correr un script cada vez que la app
-- sumaba un tipo de dato, como las tareas de Hoy), se aceptan nombres cortos de solo letras.
-- Siguen vigentes el límite de 2 MB por registro y el de largo del id (0002).
-- Se puede correr haya o no se haya corrido antes 0002/0003. Pegar entero en SQL Editor → Run.

alter table public.records drop constraint if exists records_collection_known;
alter table public.records add constraint records_collection_known
  check (collection ~ '^[a-zA-Z]{1,40}$');
