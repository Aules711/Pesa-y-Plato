-- BEINGHEALTHY · Premium
-- Ejecútalo en Supabase › SQL Editor (después de schema.sql). Se puede ejecutar más de una vez.
-- Cada fila = una persona con Premium. "until" vacío = Premium para siempre (regalado).
create table if not exists public.premium (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  until      date,
  note       text,
  updated_at timestamptz not null default now()
);
alter table public.premium enable row level security;

-- Cada persona solo puede VER su propia fila. Nadie puede crearla ni cambiarla desde la web:
-- solo tú, desde el panel de administración de la app (que usa la clave secreta en Vercel).
drop policy if exists "premium: ver lo mío" on public.premium;
create policy "premium: ver lo mío" on public.premium for select using (auth.uid() = user_id);
