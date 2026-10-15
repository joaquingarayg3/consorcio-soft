-- Borrar reclamos cerrados (solo la administración).
--
-- Hasta ahora ningún reclamo se podía borrar, ni siquiera siendo administrador:
-- el trigger registrar_historial_reclamo intentaba anotar el borrado en
-- reclamos_historial DESPUÉS de borrar, y esa fila apunta (clave foránea) a un
-- reclamo que ya no existe, así que la base la rechazaba y deshacía el borrado.
-- Un borrado no puede quedar en un historial que se borra junto con el reclamo
-- (ON DELETE CASCADE): el trigger ahora lo deja pasar sin registrarlo.
--
-- Qué se borra con un reclamo (todo, como se decidió): sus comentarios, sus
-- notificaciones y las copias de su historial interno, por las claves foráneas
-- con borrado en cascada. Las imágenes viven en el almacenamiento (no en la base):
-- la función devuelve sus rutas para que la app las borre.
--
-- Solo se pueden borrar reclamos cerrados, y lo exige la base: la política de
-- borrado pasa a pedir estado = 'cerrado' (antes un administrador podía borrar uno
-- abierto llamando a la API) y la función revisa lo mismo con un mensaje claro.
-- El número de ticket del edificio no se reutiliza: su contador sigue subiendo.
--
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

create or replace function public.registrar_historial_reclamo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Un reclamo borrado se lleva su historial (clave foránea en cascada): no hay
  -- dónde registrarlo y intentarlo hacía fallar el borrado.
  if tg_op = 'DELETE' then
    return old;
  end if;

  insert into public.reclamos_historial (
    reclamo_id, usuario_id, accion, datos_anteriores, datos_nuevos
  ) values (
    new.id,
    auth.uid(),
    tg_op,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$function$;

alter policy "reclamos_delete_admin" on public.reclamos
  using (private.is_admin() and estado = 'cerrado');

-- Borra un reclamo cerrado y devuelve las rutas de sus imágenes (una lista JSON)
-- para que la app las quite del almacenamiento.
create or replace function public.eliminar_reclamo_cerrado(p_reclamo uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.reclamos;
  imagenes jsonb;
  borrados integer;
begin
  if not private.is_admin() then
    raise exception 'Solo la administración puede borrar reclamos';
  end if;

  select * into r from public.reclamos where id = p_reclamo;
  if not found then
    raise exception 'El reclamo no existe';
  end if;
  if r.estado is distinct from 'cerrado' then
    raise exception 'Solo se pueden borrar reclamos cerrados';
  end if;

  imagenes := coalesce(to_jsonb(r.imagen_urls), '[]'::jsonb);

  delete from public.reclamos where id = r.id;
  get diagnostics borrados = row_count;
  if borrados = 0 then
    -- Otra persona lo reabrió justo antes: no se borró nada.
    raise exception 'El reclamo cambió de estado y no se borró. Volvé a cargar la pantalla';
  end if;

  return imagenes;
end;
$$;

revoke execute on function public.eliminar_reclamo_cerrado(uuid) from public, anon;
grant execute on function public.eliminar_reclamo_cerrado(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
