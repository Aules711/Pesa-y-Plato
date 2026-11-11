-- BEINGHEALTHY · registro solo con código de invitación
-- Ejecútalo en Supabase › SQL Editor DESPUÉS de schema.sql. Se puede ejecutar más de una vez.
-- Con esto, Supabase rechaza cualquier registro que no traiga un código válido,
-- aunque alguien intente saltarse la pantalla de la app.

create table if not exists public.invite_codes (
  code       text        primary key,          -- el código, o el email de alguien a quien das de alta a mano
  note       text,                             -- para quién es (solo lo ves tú)
  max_uses   int         not null default 1,   -- cuántas cuentas se pueden crear con él
  uses       int         not null default 0,
  created_at timestamptz not null default now()
);
-- Sin políticas: nadie puede leer ni tocar los códigos desde la web, solo tú desde el panel.
alter table public.invite_codes enable row level security;

create or replace function public.check_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(trim(coalesce(new.raw_user_meta_data->>'invite', '')));
begin
  -- 1) Código de invitación válido y con usos libres
  update public.invite_codes set uses = uses + 1
   where upper(code) = c and c <> '' and uses < max_uses;
  if found then return new; end if;
  -- 2) O su email está en la tabla (para cuentas que crees tú desde el panel)
  update public.invite_codes set uses = uses + 1
   where lower(code) = lower(new.email) and uses < max_uses;
  if found then return new; end if;
  raise exception 'INVITE_INVALID';
end $$;

drop trigger if exists check_invite on auth.users;
create trigger check_invite before insert on auth.users
  for each row execute function public.check_invite();

-- ---------------------------------------------------------------------------
-- CREAR CÓDIGOS (ejecuta solo esta parte cada vez que quieras invitar a gente)
-- Cambia los nombres de la lista por los de tus amigos:
insert into public.invite_codes (code, note)
select upper(substr(md5(random()::text), 1, 4) || '-' || substr(md5(random()::text), 1, 4)), nombre
from unnest(array['Amigo 1', 'Amigo 2', 'Amigo 3']) as nombre;

-- Ver tus códigos y si ya se han usado:
select code, note, uses, max_uses from public.invite_codes order by created_at desc;

-- Un código para un grupo (por ejemplo 10 cuentas con el mismo código):
-- insert into public.invite_codes (code, note, max_uses) values ('GYM-2026', 'Grupo del gimnasio', 10);

-- Anular un código que no se ha usado:
-- delete from public.invite_codes where code = 'ABCD-1234';
