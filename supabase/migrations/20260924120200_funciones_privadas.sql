-- Mueve las funciones auxiliares de RLS a un esquema que la API no expone,
-- así no se pueden llamar por /rest/v1/rpc (avisos 0028 y 0029 del linter).
-- Las políticas guardan la función por OID, así que siguen funcionando.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.usuario_en_unidad(uuid) set schema private;
alter function public.usuario_en_edificio(uuid) set schema private;
alter function public.puede_ver_reclamo(uuid) set schema private;
alter function public.puede_ver_imagen_reclamo(text) set schema private;

-- Cuerpos que llamaban a otras auxiliares por su nombre con public.
create or replace function private.puede_ver_reclamo(p_reclamo_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select private.is_admin() or exists (
    select 1 from public.reclamos as r
    left join public.unidad_funcional as uf on uf.id = r.unidad_funcional_id
    where r.id = p_reclamo_id
      and (r.reportante_id = auth.uid() or private.usuario_en_edificio(uf.edificio_id))
  );
$$;

create or replace function private.puede_ver_imagen_reclamo(p_nombre text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select private.is_admin()
    or split_part(p_nombre, '/', 1) = auth.uid()::text
    or exists (
      select 1 from public.reclamos as r
      where to_jsonb(r.imagen_urls) ? p_nombre and private.puede_ver_reclamo(r.id)
    );
$$;

-- Triggers que usaban public.is_admin().
create or replace function public.proteger_campos_privados_perfil()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon')
    and not private.is_admin()
    and (new.rol is distinct from old.rol
      or new.activo is distinct from old.activo
      or new.email is distinct from old.email
      or new.id is distinct from old.id) then
    raise exception 'No podés modificar el rol, el estado o el correo de un perfil';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_rol_escalation()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  -- Sin auth.uid() = conexión directa (dashboard) o la Edge Function con la
  -- clave de servicio: lo que se evita es que un usuario común se autopromueva.
  if auth.uid() is null then
    return new;
  end if;

  if (new.rol is distinct from old.rol or new.activo is distinct from old.activo)
     and not private.is_admin() then
    raise exception 'No tenés permisos para modificar el rol o el estado de un usuario';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_reclamo_admin_fields_tampering()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
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

-- Versión vieja que ninguna política usa.
drop function if exists public.puede_leer_imagen_reclamo(text);

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Las funciones de trigger no se llaman por la API, pero tampoco hace falta
-- que anon o authenticated puedan ejecutarlas directamente.
revoke execute on function public.prevent_rol_escalation() from public, anon, authenticated;
revoke execute on function public.prevent_reclamo_admin_fields_tampering() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
