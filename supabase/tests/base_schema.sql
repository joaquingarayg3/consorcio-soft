-- Esquema MÍNIMO de lo que ya existe en Supabase antes de las migraciones de
-- coeficientes, solo para poder probarlas sin conectarse a la base real. Imita
-- los nombres, tipos y restricciones que tiene hoy (revisados en producción) y
-- las funciones auxiliares de seguridad. No es una migración: no se aplica en
-- Supabase.

create schema if not exists private;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

grant usage on schema public, private, auth to anon, authenticated, service_role;

-- auth.uid() de Supabase: el usuario sale del JWT que PostgREST deja en la sesión.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.perfiles (
  id uuid primary key,
  rol text not null default 'user',
  activo boolean not null default true
);

create table public.edificio (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text
);

-- Igual que en producción (columnas, restricciones y trigger de porcentaje).
create table public.unidad_funcional (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid references public.edificio (id) on delete cascade,
  identificador text not null,
  piso text,
  tipo text not null,
  superficie_m2 numeric,
  porcentaje_fiscal numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint "U-edificio_id-identificador" unique (edificio_id, identificador)
);

create table public.unidad_usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  unidad_id uuid not null references public.unidad_funcional (id) on delete cascade
);

-- Trigger propio de producción (su código real no está en el repositorio): se
-- imita con la regla que sugiere su nombre, "el % fiscal del edificio no pasa de 100".
create or replace function public.validar_porcentaje_fiscal() returns trigger
language plpgsql as $$
begin
  if (select coalesce(sum(porcentaje_fiscal), 0) from public.unidad_funcional
      where edificio_id = new.edificio_id and id is distinct from new.id) + new.porcentaje_fiscal > 100 then
    raise exception 'El porcentaje fiscal del edificio supera el 100%%';
  end if;
  return new;
end $$;
create trigger trg_validar_porcentaje_fiscal
  before insert or update on public.unidad_funcional
  for each row execute function public.validar_porcentaje_fiscal();

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.perfiles
                 where id = auth.uid() and rol = 'admin' and activo is distinct from false)
$$;

create or replace function private.usuario_en_edificio(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.unidad_usuarios as uu
    join public.unidad_funcional as uf on uf.id = uu.unidad_id
    where uu.usuario_id = auth.uid() and uf.edificio_id = p_edificio)
$$;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- Políticas que ya existen en producción para estas tablas.
alter table public.perfiles enable row level security;
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or private.is_admin());
alter table public.edificio enable row level security;
create policy edificio_select on public.edificio for select to authenticated
  using (private.is_admin() or private.usuario_en_edificio(id));
create policy edificio_admin on public.edificio for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
alter table public.unidad_funcional enable row level security;
create policy unidad_funcional_select on public.unidad_funcional for select to authenticated
  using (private.is_admin() or private.usuario_en_edificio(edificio_id));
create policy unidad_funcional_admin on public.unidad_funcional for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
alter table public.unidad_usuarios enable row level security;
create policy unidad_usuarios_select on public.unidad_usuarios for select to authenticated
  using (usuario_id = auth.uid() or private.is_admin());

grant select, insert, update, delete on all tables in schema public to authenticated;
