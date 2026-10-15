-- Nombres a la vista en los reclamos y sus comentarios.
--
-- Un vecino no puede leer el perfil de otro (RLS), así que hasta ahora los
-- comentarios de los demás aparecían sin nombre. La idea es que los vecinos
-- interactúen ahí y se sepa quién dice cada cosa: nombre, unidad y, si es la
-- administración, que lo es. Para eso el nombre se COPIA a la fila en el momento
-- de comentar o de crear el reclamo, con triggers que lo fijan en la base:
--   * nadie puede escribir otro nombre (el trigger pisa lo que mande el cliente);
--   * nadie puede cambiarlo después (editar el perfil no reescribe lo ya dicho,
--     y queda como registro de quién fue);
--   * el correo y el resto del perfil NO se exponen: solo lo copiado.
--
-- Al ELIMINAR definitivamente un usuario, la copia se borra junto con el resto
-- de lo que lo identifica (las filas se conservan, sin su nombre).
--
-- Los reclamos y comentarios que ya existen se completan con el nombre actual
-- del perfil y las unidades que la persona tiene hoy en ese edificio.
--
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

-- 1. Columnas.
alter table public.reclamo_comentarios
  add column if not exists autor_nombre text,
  add column if not exists autor_unidad text,
  add column if not exists autor_es_admin boolean not null default false;
alter table public.reclamos
  add column if not exists reportante_nombre text,
  add column if not exists reportante_es_admin boolean not null default false;

-- 2. Unidades que una persona tiene hoy en el edificio de un reclamo ("1° A, 2° B").
create or replace function private.unidades_del_autor(p_usuario uuid, p_reclamo uuid)
returns text language sql stable security definer
set search_path = public, pg_temp as $$
  select string_agg(s.identificador, ', ' order by s.identificador)
  from (
    select distinct uf.identificador
    from public.unidad_usuarios as uu
    join public.unidad_funcional as uf on uf.id = uu.unidad_id
    where uu.usuario_id = p_usuario
      and uu.fecha_desde <= current_date
      and (uu.fecha_hasta is null or uu.fecha_hasta > current_date)
      and uf.edificio_id = (
        select u.edificio_id
        from public.reclamos as r
        join public.unidad_funcional as u on u.id = r.unidad_funcional_id
        where r.id = p_reclamo
      )
  ) as s;
$$;
revoke execute on function private.unidades_del_autor(uuid, uuid)
  from public, anon, authenticated;

-- 3. Comentarios: se copia al insertar; después no se toca desde la app.
create or replace function public.reclamo_comentarios_fijar_autor()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_rol text;
  v_nombre text;
begin
  if tg_op = 'UPDATE' then
    -- Sin auth.uid() es la clave de servicio o una conexión directa (por ejemplo,
    -- al eliminar un usuario): puede limpiar. Cualquier persona con sesión, no.
    if auth.uid() is not null then
      new.autor_nombre := old.autor_nombre;
      new.autor_unidad := old.autor_unidad;
      new.autor_es_admin := old.autor_es_admin;
    end if;
    return new;
  end if;

  -- Insert: se descarta lo que haya mandado el cliente.
  new.autor_nombre := null;
  new.autor_unidad := null;
  new.autor_es_admin := false;
  if new.usuario_id is null then
    return new;
  end if;

  select p.rol, nullif(btrim(concat_ws(' ', p.nombre, p.apellido)), '')
    into v_rol, v_nombre
  from public.perfiles as p where p.id = new.usuario_id;

  new.autor_nombre := v_nombre;
  new.autor_es_admin := coalesce(v_rol = 'admin', false);
  if not new.autor_es_admin then
    new.autor_unidad := private.unidades_del_autor(new.usuario_id, new.reclamo_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.reclamo_comentarios_fijar_autor()
  from public, anon, authenticated;
drop trigger if exists reclamo_comentarios_fijar_autor_trigger on public.reclamo_comentarios;
create trigger reclamo_comentarios_fijar_autor_trigger
  before insert or update on public.reclamo_comentarios
  for each row execute function public.reclamo_comentarios_fijar_autor();

-- 4. Reclamos: lo mismo con quien lo carga (su unidad ya es la del reclamo).
create or replace function public.reclamos_fijar_reportante()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_rol text;
  v_nombre text;
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is not null then
      new.reportante_nombre := old.reportante_nombre;
      new.reportante_es_admin := old.reportante_es_admin;
    end if;
    return new;
  end if;

  new.reportante_nombre := null;
  new.reportante_es_admin := false;
  if new.reportante_id is null then
    return new;
  end if;
  select p.rol, nullif(btrim(concat_ws(' ', p.nombre, p.apellido)), '')
    into v_rol, v_nombre
  from public.perfiles as p where p.id = new.reportante_id;
  new.reportante_nombre := v_nombre;
  new.reportante_es_admin := coalesce(v_rol = 'admin', false);
  return new;
end;
$$;
revoke execute on function public.reclamos_fijar_reportante()
  from public, anon, authenticated;
drop trigger if exists reclamos_fijar_reportante_trigger on public.reclamos;
create trigger reclamos_fijar_reportante_trigger
  before insert or update on public.reclamos
  for each row execute function public.reclamos_fijar_reportante();

-- 5. Lo que ya existe. Sin auth.uid() los triggers de arriba dejan pasar el
--    cambio; el historial no registra este relleno (no es un cambio del reclamo).
alter table public.reclamos disable trigger registrar_historial_reclamo_trigger;

update public.reclamos as r
set reportante_nombre = nullif(btrim(concat_ws(' ', p.nombre, p.apellido)), ''),
    reportante_es_admin = coalesce(p.rol = 'admin', false)
from public.perfiles as p
where p.id = r.reportante_id;

alter table public.reclamos enable trigger registrar_historial_reclamo_trigger;

update public.reclamo_comentarios as c
set autor_nombre = nullif(btrim(concat_ws(' ', p.nombre, p.apellido)), ''),
    autor_es_admin = coalesce(p.rol = 'admin', false),
    autor_unidad = case
      when coalesce(p.rol = 'admin', false) then null
      else private.unidades_del_autor(c.usuario_id, c.reclamo_id)
    end
from public.perfiles as p
where p.id = c.usuario_id;

-- 6. Al eliminar definitivamente a una persona, su nombre copiado también se va
--    (de los comentarios, de los reclamos y de las copias del historial). Es la
--    función de 20261008120000_eliminar_usuarios.sql con ese paso agregado.
create or replace function public.eliminar_usuario_definitivo(p_usuario uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  pasada integer;
begin
  if p_usuario is null then
    raise exception 'Falta el usuario';
  end if;
  if not exists (select 1 from public.perfiles where id = p_usuario) then
    raise exception 'El usuario no existe';
  end if;
  if exists (
    select 1 from public.perfiles where id = p_usuario and activo is distinct from false
  ) then
    raise exception 'Solo se puede eliminar un usuario inactivo';
  end if;

  -- Filas que solo tienen sentido con la persona: se borran.
  delete from public.unidad_usuarios where usuario_id = p_usuario;
  delete from public.usuario_notificaciones where usuario_id = p_usuario;
  if to_regclass('public.anuncio_lecturas') is not null then
    delete from public.anuncio_lecturas where usuario_id = p_usuario;
  end if;

  -- El nombre copiado en los comentarios y reclamos (antes de desvincular).
  update public.reclamo_comentarios
  set autor_nombre = null, autor_unidad = null, autor_es_admin = false
  where usuario_id = p_usuario;
  update public.reclamos
  set reportante_nombre = null, reportante_es_admin = false
  where reportante_id = p_usuario;
  update public.reclamos_historial as h
  set datos_anteriores = h.datos_anteriores - 'reportante_nombre',
      datos_nuevos = h.datos_nuevos - 'reportante_nombre'
  where h.reclamo_id in (
    select id from public.reclamos where reportante_id = p_usuario
  );

  -- Todo lo demás que la señale se conserva y se desvincula. Son dos pasadas:
  -- si un trigger copia el reclamo al historial cada vez que se actualiza, la
  -- primera pasada puede dejar copias que todavía mencionan a la persona y la
  -- segunda las desvincula.
  for pasada in 1..2 loop
    for r in
      select c.conrelid::regclass::text as tabla, a.attname::text as columna
      from pg_constraint as c
      join pg_class as t on t.oid = c.conrelid
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f'
        and array_length(c.conkey, 1) = 1
        and c.confrelid in ('public.perfiles'::regclass, 'auth.users'::regclass)
        and t.relnamespace = 'public'::regnamespace
        and t.relname not in (
          'perfiles', 'unidad_usuarios', 'usuario_notificaciones', 'anuncio_lecturas'
        )
    loop
      execute format('update %s set %I = null where %I = $1', r.tabla, r.columna, r.columna)
        using p_usuario;
    end loop;
  end loop;

  delete from public.perfiles where id = p_usuario;
end;
$$;

revoke all on function public.eliminar_usuario_definitivo(uuid)
  from public, anon, authenticated;
grant execute on function public.eliminar_usuario_definitivo(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
