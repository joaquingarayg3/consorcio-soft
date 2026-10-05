-- Asignaciones de unidad: fecha_hasta pasa a ser exclusiva (finalizar "hoy"
-- corta el acceso en el acto, igual que muestra el panel de edificios) y se
-- puede volver a asignar a alguien a una unidad que ya tuvo.
begin;

create or replace function private.usuario_en_unidad(p_unidad_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.unidad_usuarios as uu
    where uu.usuario_id = auth.uid() and uu.unidad_id = p_unidad_id
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
    where uu.usuario_id = auth.uid() and uf.edificio_id = p_edificio_id
      and uu.fecha_desde <= current_date
      and (uu.fecha_hasta is null or uu.fecha_hasta > current_date)
  );
$$;

create or replace function public.crear_notificaciones_nuevo_reclamo()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.usuario_notificaciones (usuario_id, reclamo_id)
  select distinct p.id, new.id
  from public.perfiles as p
  where p.activo is distinct from false
    and (
      p.rol = 'admin'
      or p.id = new.reportante_id
      or exists (
        select 1
        from public.unidad_usuarios as uu
        where uu.usuario_id = p.id
          and uu.unidad_id = new.unidad_funcional_id
          and uu.fecha_desde <= current_date
          and (uu.fecha_hasta is null or uu.fecha_hasta > current_date)
      )
    )
  on conflict (usuario_id, reclamo_id, tipo) do nothing;
  return new;
end;
$$;
revoke execute on function public.crear_notificaciones_nuevo_reclamo() from public, anon, authenticated;

-- La restricción única incluía asignaciones ya terminadas: impedía volver a
-- asignar a una persona a una unidad que ya había tenido. Ahora solo evita
-- duplicar una asignación abierta.
alter table public.unidad_usuarios
  drop constraint if exists unidad_usuarios_unidad_usuario_vinculo_key;
create unique index if not exists unidad_usuarios_abierta_unica
  on public.unidad_usuarios (unidad_id, usuario_id, vinculo)
  where fecha_hasta is null;

commit;
