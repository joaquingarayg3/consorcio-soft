-- Endurecimiento de auditoria, notificaciones y Storage.
-- Requiere las tablas base: reclamos, perfiles, unidad_funcional y unidad_usuarios.

create table if not exists public.reclamos_historial (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid references public.reclamos(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists reclamos_historial_reclamo_id_idx
on public.reclamos_historial (reclamo_id, creado_en desc);

alter table public.reclamos_historial enable row level security;
drop policy if exists "Usuarios autorizados pueden ver historial" on public.reclamos_historial;
create policy "Usuarios autorizados pueden ver historial"
on public.reclamos_historial for select to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.reclamos as r
    where r.id = reclamo_id and (
      r.reportante_id = auth.uid() or exists (
        select 1 from public.unidad_usuarios as uu
        where uu.usuario_id = auth.uid() and uu.unidad_id = r.unidad_funcional_id
          and uu.fecha_desde <= current_date
          and (uu.fecha_hasta is null or uu.fecha_hasta >= current_date)
      )
    )
  )
);

create or replace function public.registrar_historial_reclamo()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.reclamos_historial
    (reclamo_id, usuario_id, accion, datos_anteriores, datos_nuevos)
  values (
    case when tg_op = 'DELETE' then old.id else new.id end,
    auth.uid(), tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke execute on function public.registrar_historial_reclamo() from public, anon, authenticated;
drop trigger if exists registrar_historial_reclamo_trigger on public.reclamos;
create trigger registrar_historial_reclamo_trigger after insert or update or delete on public.reclamos
for each row execute function public.registrar_historial_reclamo();

create table if not exists public.usuario_notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  reclamo_id uuid not null references public.reclamos(id) on delete cascade,
  tipo text not null default 'nuevo_reclamo',
  leida boolean not null default false,
  ocultada boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (usuario_id, reclamo_id, tipo)
);
create index if not exists usuario_notificaciones_usuario_idx
on public.usuario_notificaciones (usuario_id, ocultada, leida, creado_en desc);
alter table public.usuario_notificaciones enable row level security;
drop policy if exists "Usuarios pueden ver sus notificaciones" on public.usuario_notificaciones;
drop policy if exists "Usuarios pueden actualizar sus notificaciones" on public.usuario_notificaciones;
create policy "Usuarios pueden ver sus notificaciones" on public.usuario_notificaciones
for select to authenticated using (usuario_id = auth.uid());
create policy "Usuarios pueden actualizar sus notificaciones" on public.usuario_notificaciones
for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create or replace function public.proteger_notificacion()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.usuario_id <> old.usuario_id or new.reclamo_id <> old.reclamo_id
    or new.tipo <> old.tipo or new.creado_en <> old.creado_en then
    raise exception 'Solo se puede modificar el estado de la notificacion';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_notificacion() from public, anon, authenticated;
drop trigger if exists proteger_notificacion_trigger on public.usuario_notificaciones;
create trigger proteger_notificacion_trigger before update on public.usuario_notificaciones
for each row execute function public.proteger_notificacion();

create or replace function public.crear_notificaciones_nuevo_reclamo()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.usuario_notificaciones (usuario_id, reclamo_id)
  select distinct p.id, new.id from public.perfiles as p
  where p.activo is distinct from false and (
    p.rol = 'admin' or p.id = new.reportante_id or exists (
      select 1 from public.unidad_usuarios as uu
      where uu.usuario_id = p.id and uu.unidad_id = new.unidad_funcional_id
        and uu.fecha_desde <= current_date
        and (uu.fecha_hasta is null or uu.fecha_hasta >= current_date)
    )
  ) on conflict (usuario_id, reclamo_id, tipo) do nothing;
  return new;
end;
$$;
revoke execute on function public.crear_notificaciones_nuevo_reclamo() from public, anon, authenticated;
drop trigger if exists crear_notificaciones_nuevo_reclamo_trigger on public.reclamos;
create trigger crear_notificaciones_nuevo_reclamo_trigger after insert on public.reclamos
for each row execute function public.crear_notificaciones_nuevo_reclamo();

grant select, update on public.usuario_notificaciones to authenticated;
grant select on public.reclamos_historial to authenticated;
update storage.buckets set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'reclamos';
notify pgrst, 'reload schema';
