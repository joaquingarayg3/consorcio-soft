-- Perfil editable por cada persona, datos fiscales y bancarios de cada edificio
-- y contactos útiles por edificio.
--
-- 1. Edificio: CUIT y datos bancarios (banco, titular, CBU y alias). Los ven los
--    administradores y quienes tienen una unidad vigente en ese edificio (la
--    política de lectura de `edificio` ya hace eso); solo los administradores
--    los modifican. La ubicación (ciudad, provincia, código postal) pasa a ser
--    opcional: ya no se pide al crear el edificio.
-- 2. Contactos: tabla `edificio_contactos` (nombre y teléfono). Los ve quien
--    puede ver el edificio; solo los administradores crean, editan o borran.
-- 3. Perfil: cada persona puede editar nombre, apellido y teléfono de su propio
--    perfil. Se limitan las columnas que se pueden modificar desde la API: antes
--    una persona podía tocar cualquier columna que el trigger no protegía (por
--    ejemplo la fecha de creación).
--
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

-- ---------------------------------------------------------------------------
-- 1. Edificio
-- ---------------------------------------------------------------------------

alter table public.edificio add column if not exists cuit text;
alter table public.edificio add column if not exists banco text;
alter table public.edificio add column if not exists titular_cuenta text;
alter table public.edificio add column if not exists cbu text;
alter table public.edificio add column if not exists alias_cbu text;

alter table public.edificio drop constraint if exists edificio_cuit_chk;
alter table public.edificio add constraint edificio_cuit_chk
  check (cuit is null or cuit ~ '^[0-9]{11}$');
alter table public.edificio drop constraint if exists edificio_cbu_chk;
alter table public.edificio add constraint edificio_cbu_chk
  check (cbu is null or cbu ~ '^[0-9]{22}$');
alter table public.edificio drop constraint if exists edificio_alias_cbu_chk;
alter table public.edificio add constraint edificio_alias_cbu_chk
  check (alias_cbu is null or alias_cbu ~ '^[A-Za-z0-9.-]{6,20}$');
alter table public.edificio drop constraint if exists edificio_banco_titular_chk;
alter table public.edificio add constraint edificio_banco_titular_chk
  check (
    (banco is null or (char_length(banco) <= 80 and banco !~ '[[:cntrl:]]'))
    and (titular_cuenta is null
      or (char_length(titular_cuenta) <= 80 and titular_cuenta !~ '[[:cntrl:]]'))
  );

-- La ubicación deja de ser obligatoria (son columnas que ya existen).
alter table public.edificio alter column ciudad drop not null;
alter table public.edificio alter column provincia drop not null;
alter table public.edificio alter column codigo_postal drop not null;

-- ---------------------------------------------------------------------------
-- 2. Contactos del edificio
-- ---------------------------------------------------------------------------

create table if not exists public.edificio_contactos (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references public.edificio (id) on delete cascade,
  nombre text not null,
  telefono text not null,
  creado_en timestamptz not null default now(),
  constraint edificio_contactos_nombre_chk
    check (char_length(btrim(nombre)) between 1 and 80 and nombre !~ '[[:cntrl:]]'),
  -- Solo dígitos y los signos habituales de un teléfono, con entre 6 y 15 dígitos.
  constraint edificio_contactos_telefono_chk
    check (
      char_length(telefono) between 6 and 30
      and telefono ~ '^[0-9+()./ -]+$'
      and char_length(regexp_replace(telefono, '[^0-9]', '', 'g')) between 6 and 15
    )
);

create index if not exists edificio_contactos_edificio_idx
  on public.edificio_contactos (edificio_id);

alter table public.edificio_contactos enable row level security;

drop policy if exists "contactos_select" on public.edificio_contactos;
create policy "contactos_select" on public.edificio_contactos
  for select to authenticated
  using (private.is_admin() or private.usuario_en_edificio(edificio_id));

drop policy if exists "contactos_admin_insert" on public.edificio_contactos;
create policy "contactos_admin_insert" on public.edificio_contactos
  for insert to authenticated with check (private.is_admin());

drop policy if exists "contactos_admin_update" on public.edificio_contactos;
create policy "contactos_admin_update" on public.edificio_contactos
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

drop policy if exists "contactos_admin_delete" on public.edificio_contactos;
create policy "contactos_admin_delete" on public.edificio_contactos
  for delete to authenticated using (private.is_admin());

revoke all on public.edificio_contactos from anon;
revoke all on public.edificio_contactos from authenticated;
grant select, insert, delete on public.edificio_contactos to authenticated;
-- Se puede cambiar el nombre y el teléfono, no a qué edificio pertenece.
grant update (nombre, telefono) on public.edificio_contactos to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Perfil: qué columnas se pueden modificar desde la API
--    nombre, apellido y teléfono: la propia persona (o un admin).
--    rol: solo un admin (lo exige el trigger proteger_campos_privados_perfil).
--    El resto (estado, correo, fechas...) no se toca desde la API: lo cambia la
--    Edge Function con la clave de servicio.
-- ---------------------------------------------------------------------------

-- Topes de largo y sin caracteres de control. Son laxos a propósito: aceptan
-- cualquier dato que ya exista (incluso vacío), así no impiden que la
-- administración apruebe o dé de baja a alguien con datos viejos.
alter table public.perfiles drop constraint if exists perfiles_nombre_apellido_chk;
alter table public.perfiles add constraint perfiles_nombre_apellido_chk
  check (
    char_length(nombre) <= 80 and nombre !~ '[[:cntrl:]]'
    and char_length(apellido) <= 80 and apellido !~ '[[:cntrl:]]'
  ) not valid;
alter table public.perfiles drop constraint if exists perfiles_telefono_chk;
alter table public.perfiles add constraint perfiles_telefono_chk
  check (telefono is null or (char_length(telefono) <= 30 and telefono !~ '[[:cntrl:]]'))
  not valid;

revoke update on public.perfiles from authenticated;
grant update (nombre, apellido, telefono, rol) on public.perfiles to authenticated;

notify pgrst, 'reload schema';

commit;
