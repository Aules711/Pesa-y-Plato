-- beinghealthy · base de datos
-- Pega todo esto en Supabase › SQL Editor › New query y pulsa «Run». Se puede ejecutar más de una vez.

-- 1. Datos de cada usuario ------------------------------------------------------
-- Cada fila es un "documento" JSON: un entreno (w-...), un día del diario (d-AAAA-MM-DD),
-- las rutinas, los ajustes, el peso, la actividad del Watch, etc.
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.docs enable row level security;

-- Cada persona solo puede ver y cambiar sus propias filas
drop policy if exists "docs: ver lo mío"      on public.docs;
drop policy if exists "docs: crear lo mío"    on public.docs;
drop policy if exists "docs: cambiar lo mío"  on public.docs;
drop policy if exists "docs: borrar lo mío"   on public.docs;
create policy "docs: ver lo mío"     on public.docs for select using (auth.uid() = user_id);
create policy "docs: crear lo mío"   on public.docs for insert with check (auth.uid() = user_id);
create policy "docs: cambiar lo mío" on public.docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "docs: borrar lo mío"  on public.docs for delete using (auth.uid() = user_id);

create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.docs_touch();

-- Sincronización en vivo entre móvil y ordenador
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 2. Vídeos de los ejercicios ---------------------------------------------------
-- Bucket privado; cada usuario sube a su propia carpeta: videos/<su id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800,
        array['video/mp4','video/quicktime','video/webm','image/gif','image/webp','image/png','image/jpeg'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos: ver lo mío"     on storage.objects;
drop policy if exists "videos: subir lo mío"   on storage.objects;
drop policy if exists "videos: cambiar lo mío" on storage.objects;
drop policy if exists "videos: borrar lo mío"  on storage.objects;
create policy "videos: ver lo mío"     on storage.objects for select using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: subir lo mío"   on storage.objects for insert with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: cambiar lo mío" on storage.objects for update using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: borrar lo mío"  on storage.objects for delete using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
