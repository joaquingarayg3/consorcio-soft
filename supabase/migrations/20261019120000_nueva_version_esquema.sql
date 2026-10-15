-- Nueva versión de un esquema de coeficientes.
--
-- Cuando cambia el reglamento no se pisa el esquema publicado: se crea uno nuevo
-- con otra vigencia. nueva_version_esquema hace los tres pasos juntos y sin
-- posibilidad de dejar algo a medias:
--   1. cierra la vigencia del esquema actual (vigente_hasta = fecha de la nueva),
--   2. crea una versión nueva en borrador, con el mismo código, método y
--      tolerancia, y
--   3. copia los participantes y sus valores, para que solo haya que corregir lo
--      que cambió.
--
-- Si el esquema deriva de otro, la versión nueva deriva de la versión de esa base
-- que rige en la fecha nueva (por ejemplo, del GENERAL nuevo si ya se creó).
--
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

create or replace function public.nueva_version_esquema(p_esquema uuid, p_desde date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  e public.esquema_coeficiente;
  codigo_base text;
  base_nueva uuid;
  nuevo uuid;
begin
  if not private.is_admin() then
    raise exception 'Solo la administración puede crear nuevas versiones de un esquema';
  end if;

  select * into e from public.esquema_coeficiente where id = p_esquema;
  if not found then
    raise exception 'El esquema no existe';
  end if;
  if e.estado <> 'publicado' then
    raise exception 'Solo se crea una nueva versión a partir de un esquema publicado: uno en borrador se edita directamente';
  end if;
  if e.vigente_hasta is not null then
    raise exception 'El esquema % ya tiene fecha de fin: creá la nueva versión desde el que está vigente', e.codigo;
  end if;
  if p_desde is null or p_desde <= e.vigente_desde then
    raise exception 'La nueva versión tiene que empezar después de la actual (que empieza el %)', e.vigente_desde;
  end if;

  base_nueva := e.esquema_base_id;
  if e.esquema_base_id is not null then
    select b.codigo into codigo_base
    from public.esquema_coeficiente as b where b.id = e.esquema_base_id;

    select b.id into base_nueva
    from public.esquema_coeficiente as b
    where b.edificio_id = e.edificio_id and b.codigo = codigo_base
      and b.vigente_desde <= p_desde
      and (b.vigente_hasta is null or b.vigente_hasta > p_desde)
    order by b.vigente_desde desc
    limit 1;

    base_nueva := coalesce(base_nueva, e.esquema_base_id);
  end if;

  -- Primero se cierra la actual (si no, las dos vigencias se superpondrían).
  update public.esquema_coeficiente set vigente_hasta = p_desde where id = e.id;

  insert into public.esquema_coeficiente
    (edificio_id, codigo, nombre, metodo, esquema_base_id, vigente_desde, tolerancia)
  values
    (e.edificio_id, e.codigo, e.nombre, e.metodo, base_nueva, p_desde, e.tolerancia)
  returning id into nuevo;

  insert into public.coeficiente (esquema_id, unidad_id, edificio_id, valor, peso)
  select nuevo, c.unidad_id, c.edificio_id, c.valor, c.peso
  from public.coeficiente as c where c.esquema_id = e.id;

  -- Los derivados y de partes iguales se vuelven a calcular con sus nuevas bases.
  perform private.recalcular_esquema_en_cascada(nuevo, array[]::uuid[]);

  return nuevo;
end;
$$;

revoke execute on function public.nueva_version_esquema(uuid, date) from public, anon;
grant execute on function public.nueva_version_esquema(uuid, date) to authenticated;

notify pgrst, 'reload schema';

commit;
