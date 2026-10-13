-- Eliminación definitiva de un usuario (solo si está inactivo).
--
-- Qué se borra y qué se conserva:
--   * Se borran sus asignaciones a unidades, sus notificaciones, sus lecturas de
--     anuncios y su perfil (más su cuenta de acceso, que borra la Edge Function).
--   * Los reclamos que cargó, sus comentarios, el historial y los anuncios que
--     publicó se CONSERVAN: son el registro del edificio. Solo se desvinculan de
--     la persona (el campo que la identificaba queda en null), así que dejan de
--     mostrar su nombre.
--
-- Todo corre en una sola transacción: si algo falla, no se borra nada.
begin;

-- 1. Los triggers de reclamos tratan como "no admin" a quien no tiene auth.uid()
--    (la Edge Function usa la clave de servicio) y revertirían o rechazarían
--    estos cambios. Mismo criterio que prevent_rol_escalation: sin auth.uid() es
--    la clave de servicio o una conexión directa, y lo que se evita es que un
--    usuario común se autopromueva.
create or replace function public.prevent_reclamo_admin_fields_tampering()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not private.is_admin() then
    if new.estado = 'cerrado' then
      raise exception 'Solo un administrador puede cerrar un reclamo';
    end if;

    new.cerrado_por_id := old.cerrado_por_id;
    new.fecha_cierre := old.fecha_cierre;
    new.nota_admin := old.nota_admin;
  end if;

  return new;
end;
$$;

-- 2. Para desvincular a la persona sin perder el registro, las columnas que la
--    señalan (reportante, autor de un comentario, usuario del historial, quien
--    cerró un reclamo...) tienen que admitir null. Se afloja solo eso, y solo en
--    columnas que son clave foránea hacia perfiles o auth.users. Las tablas de
--    asignación (unidad_usuarios, usuario_notificaciones, anuncio_lecturas) se
--    dejan como están: sus filas se borran.
do $$
declare
  r record;
begin
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
      and a.attnotnull
      and not exists (
        select 1 from pg_index as i
        where i.indrelid = c.conrelid and i.indisprimary and a.attnum = any (i.indkey)
      )
  loop
    execute format('alter table %s alter column %I drop not null', r.tabla, r.columna);
    raise notice 'Ahora admite null: %.%', r.tabla, r.columna;
  end loop;
end $$;

-- 3. La función. La llama solo la Edge Function (clave de servicio).
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
