-- Registro autónomo de vecinos con aprobación de la administración.
--
-- Flujo nuevo:
--   1. La persona crea su cuenta (correo + contraseña) y Supabase le manda un
--      correo para verificar que el mail es suyo.
--   2. Recién cuando verifica, se crea su perfil: inactivo (activo = false) y
--      sin aprobar (aprobado_en = null). Se la ve como "pendiente".
--   3. Mientras esté pendiente solo ve la pantalla "Activación pendiente": ni la
--      app ni la base le muestran nada del consorcio.
--   4. La administración la aprueba (activo = true, aprobado_en = ahora) y le
--      asigna su unidad. Sin unidad, la app sigue sin mostrarle nada.
--
-- Estados de un perfil:
--   pendiente = activo false y aprobado_en null   (todavía no la aprobaron)
--   activo    = activo true
--   de baja   = activo false y aprobado_en con fecha (la aprobaron y después
--               la dieron de baja; su cuenta de acceso además queda bloqueada)
--
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas.
--    Los perfiles que ya existen los dio de alta la administración: se marcan
--    como aprobados. Solo la primera vez (si se volviera a correr, no tiene que
--    aprobar a quien hoy está pendiente).
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles'
      and column_name = 'aprobado_en'
  ) then
    alter table public.perfiles add column aprobado_en timestamptz;
    update public.perfiles set aprobado_en = coalesce(created_at, now());
  end if;
end $$;

-- Lo que la persona escribe al registrarse para que la administración sepa
-- quién es ("Av. Corrientes 1234, 5° B"). Es un dato declarado, sin verificar.
alter table public.perfiles add column if not exists unidad_declarada text;
alter table public.perfiles
  drop constraint if exists perfiles_unidad_declarada_largo_chk;
alter table public.perfiles
  add constraint perfiles_unidad_declarada_largo_chk
  check (char_length(unidad_declarada) <= 120);

-- ---------------------------------------------------------------------------
-- 2. aprobado_en no lo puede tocar la propia persona (igual que rol y activo).
-- ---------------------------------------------------------------------------

create or replace function public.proteger_campos_privados_perfil()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon')
    and not private.is_admin()
    and (new.rol is distinct from old.rol
      or new.activo is distinct from old.activo
      or new.aprobado_en is distinct from old.aprobado_en
      or new.email is distinct from old.email
      or new.id is distinct from old.id) then
    raise exception 'No podés modificar el rol, el estado o el correo de un perfil';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. El perfil se crea cuando se verifica el correo, siempre como pendiente.
--
--    Seguridad: lo que llega en raw_user_meta_data lo escribe quien se registra
--    (cualquiera puede llamar a la API de registro con los datos que quiera).
--    Por eso solo se leen de ahí el nombre, el apellido y la unidad declarada,
--    recortados y sin caracteres de control. El rol y el estado NUNCA salen de
--    esos datos: son siempre 'user' y inactivo. Subir a alguien a administrador
--    o activarlo solo lo puede hacer un administrador.
-- ---------------------------------------------------------------------------

create or replace function public.crear_perfil_al_verificar_correo()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  datos jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  insert into public.perfiles (id, email, nombre, apellido, rol, activo, unidad_declarada)
  values (
    new.id,
    lower(new.email),
    left(btrim(regexp_replace(coalesce(datos->>'nombre', ''), '[[:cntrl:]]', '', 'g')), 80),
    left(btrim(regexp_replace(coalesce(datos->>'apellido', ''), '[[:cntrl:]]', '', 'g')), 80),
    'user',
    false,
    nullif(
      left(btrim(regexp_replace(coalesce(datos->>'unidad_declarada', ''), '[[:cntrl:]]', '', 'g')), 120),
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
revoke execute on function public.crear_perfil_al_verificar_correo()
  from public, anon, authenticated;

-- El trigger anterior creaba el perfil apenas se registraba la cuenta (sin
-- esperar la verificación) y con el estado que tuviera por defecto la columna.
-- Se quita el que inserta en perfiles al crearse un usuario; si quedara alguno,
-- las cuentas sin verificar aparecerían como pendientes.
do $$
declare
  t record;
begin
  for t in
    select tg.tgname
    from pg_trigger as tg
    join pg_proc as p on p.oid = tg.tgfoid
    where tg.tgrelid = 'auth.users'::regclass
      and not tg.tgisinternal
      and (tg.tgtype & 4) = 4  -- se dispara al insertar
      and tg.tgname not in (
        'crear_perfil_al_insertar_confirmado', 'crear_perfil_al_verificar_correo'
      )
      and p.prosrc ~* 'insert\s+into\s+(public\.)?"?perfiles'
  loop
    execute format('drop trigger %I on auth.users', t.tgname);
    raise notice 'Se quitó el trigger anterior que creaba perfiles: %', t.tgname;
  end loop;
end $$;

-- Cuenta creada ya verificada (la crea la Edge Function de administración).
drop trigger if exists crear_perfil_al_insertar_confirmado on auth.users;
create trigger crear_perfil_al_insertar_confirmado
  after insert on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function public.crear_perfil_al_verificar_correo();

-- Cuenta que verifica su correo después de registrarse.
drop trigger if exists crear_perfil_al_verificar_correo on auth.users;
create trigger crear_perfil_al_verificar_correo
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.crear_perfil_al_verificar_correo();

-- ---------------------------------------------------------------------------
-- 4. Una cuenta que no está activa no ve nada del consorcio, aunque tenga una
--    unidad asignada o una sesión todavía vigente. Las políticas de edificios,
--    unidades, reclamos, anuncios y fotos pasan por estas dos funciones.
-- ---------------------------------------------------------------------------

create or replace function private.usuario_en_unidad(p_unidad_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.unidad_usuarios as uu
    join public.perfiles as p on p.id = uu.usuario_id
    where uu.usuario_id = auth.uid() and uu.unidad_id = p_unidad_id
      and p.activo is distinct from false
      and uu.fecha_desde <= current_date
      and (uu.fecha_hasta is null or uu.fecha_hasta > current_date)
  );
$$;

create or replace function private.usuario_en_edificio(p_edificio_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.unidad_usuarios as uu
    join public.unidad_funcional as uf on uf.id = uu.unidad_id
    join public.perfiles as p on p.id = uu.usuario_id
    where uu.usuario_id = auth.uid() and uf.edificio_id = p_edificio_id
      and p.activo is distinct from false
      and uu.fecha_desde <= current_date
      and (uu.fecha_hasta is null or uu.fecha_hasta > current_date)
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Listado de la administración: agrega el estado "pendientes" y devuelve si
--    fue aprobado y lo que declaró la persona. 'inactivos' pasa a ser solo "de
--    baja" (los pendientes tienen su propio filtro).
-- ---------------------------------------------------------------------------

drop function if exists public.buscar_perfiles(text, text, text, text, integer, integer);

create function public.buscar_perfiles(
  texto text default '',
  filtro_estado text default 'todos',   -- 'todos' | 'pendientes' | 'activos' | 'inactivos' (de baja)
  filtro_rol text default 'todos',      -- 'todos' | 'admin' | 'user'
  orden text default 'alfabetico',      -- 'alfabetico' | 'recientes'
  limite integer default 50,
  desde integer default 0
)
returns table (
  id uuid,
  nombre text,
  apellido text,
  email text,
  rol text,
  activo boolean,
  created_at timestamptz,
  aprobado_en timestamptz,
  unidad_declarada text,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.nombre::text,
    p.apellido::text,
    p.email::text,
    p.rol::text,
    p.activo,
    p.created_at::timestamptz,
    p.aprobado_en,
    p.unidad_declarada,
    count(*) over () as total
  from public.perfiles as p
  where (
      coalesce(filtro_estado, 'todos') = 'todos'
      or (filtro_estado = 'activos' and p.activo is distinct from false)
      or (filtro_estado = 'pendientes' and p.activo = false and p.aprobado_en is null)
      or (filtro_estado = 'inactivos' and p.activo = false and p.aprobado_en is not null)
    )
    and (
      coalesce(filtro_rol, 'todos') = 'todos'
      or p.rol::text = filtro_rol
    )
    and not exists (
      -- Palabras de la búsqueda (máximo 5) que NO están en el perfil.
      select 1
      from (
        select w
        from unnest(regexp_split_to_array(btrim(coalesce(texto, '')), '\s+')) as w
        where w <> ''
        limit 5
      ) as palabras
      where extensions.unaccent(
              lower(
                coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, '') || ' ' ||
                coalesce(p.email, '') || ' ' || coalesce(p.unidad_declarada, '')
              )
            )
            not like '%' || extensions.unaccent(
              lower(replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_'))
            ) || '%'
    )
  order by
    case when orden = 'recientes' then p.created_at end desc nulls last,
    p.apellido,
    p.nombre,
    p.id
  limit greatest(1, least(coalesce(limite, 50), 200))
  offset greatest(0, coalesce(desde, 0));
$$;

revoke all on function public.buscar_perfiles(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.buscar_perfiles(text, text, text, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Limpieza de cuentas que nunca verificaron su correo. Estas cuentas no
--    tienen perfil, así que no aparecen en la pantalla de usuarios: solo ocupan
--    lugar en el sistema de acceso. La función las borra pasados unos días.
--    No se programa sola: se ejecuta a mano o con pg_cron (ver README). Solo
--    la puede correr el dueño de la base o la clave de servicio.
-- ---------------------------------------------------------------------------

create or replace function public.purgar_cuentas_sin_verificar(p_dias integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  borradas integer;
begin
  if p_dias is null or p_dias < 1 then
    raise exception 'Los días tienen que ser 1 o más';
  end if;
  delete from auth.users
  where email_confirmed_at is null
    and created_at < now() - make_interval(days => p_dias);
  get diagnostics borradas = row_count;
  return borradas;
end;
$$;
revoke all on function public.purgar_cuentas_sin_verificar(integer)
  from public, anon, authenticated;
grant execute on function public.purgar_cuentas_sin_verificar(integer) to service_role;

notify pgrst, 'reload schema';

commit;
