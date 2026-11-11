-- BEINGHEALTHY · Conexiones con Strava y Garmin (Premium)
-- Ejecútalo en Supabase › SQL Editor. Se puede ejecutar más de una vez.
-- Guarda el permiso de cada usuario. Nadie puede leerlo desde la web:
-- solo el servidor de la app (las funciones de Vercel con la clave secreta).
create table if not exists public.strava (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  athlete_id    bigint,
  athlete_name  text,
  access_token  text not null,
  refresh_token text not null,
  expires_at    bigint not null,
  updated_at    timestamptz not null default now()
);
alter table public.strava enable row level security;

create table if not exists public.garmin (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  garmin_user_id  text not null unique,
  access_token    text not null,
  refresh_token   text,
  expires_at      bigint not null,
  updated_at      timestamptz not null default now()
);
alter table public.garmin enable row level security;
-- sin políticas a propósito: desde la web no se puede ver ni tocar
