-- Reclamos y lo que cuelga de ellos, como están hoy en producción (columnas,
-- claves foráneas con borrado en cascada y triggers revisados en la base real).
-- Se carga DESPUÉS de base_schema.sql. No es una migración.

create table public.reclamos (
  id uuid primary key default gen_random_uuid(),
  unidad_funcional_id uuid references public.unidad_funcional (id),
  reportante_id uuid references public.perfiles (id),
  titulo text not null default 'Reclamo',
  estado text not null default 'abierto',
  prioridad text default 'Media',
  imagen_urls text[] default '{}',
  numero integer,
  fecha_cierre timestamptz,
  cerrado_por_id uuid,
  nota_admin text,
  created_at timestamptz default now()
);

create table public.reclamo_contadores (
  edificio_id uuid primary key references public.edificio (id) on delete cascade,
  ultimo integer not null default 0
);

create table public.reclamo_comentarios (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  usuario_id uuid references public.perfiles (id),
  comentario text not null,
  created_at timestamptz default now()
);

create table public.reclamos_historial (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  usuario_id uuid,
  accion text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  created_at timestamptz default now()
);

create table public.usuario_notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  tipo text not null default 'nuevo_reclamo',
  leida boolean not null default false,
  unique (usuario_id, reclamo_id, tipo)
);

-- Función y triggers tal cual están en producción.
create or replace function public.registrar_historial_reclamo()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp' as $function$
begin
  insert into public.reclamos_historial (
    reclamo_id, usuario_id, accion, datos_anteriores, datos_nuevos
  ) values (
    case when tg_op = 'DELETE' then old.id else new.id end,
    auth.uid(),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
create trigger registrar_historial_reclamo_trigger
  after insert or delete or update on public.reclamos
  for each row execute function public.registrar_historial_reclamo();

create or replace function public.asignar_numero_reclamo()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp' as $function$
declare
  v_edificio uuid;
  v_numero integer;
begin
  select uf.edificio_id into v_edificio
  from public.unidad_funcional as uf where uf.id = new.unidad_funcional_id;
  if v_edificio is null then new.numero := null; return new; end if;
  insert into public.reclamo_contadores as c (edificio_id, ultimo)
  values (v_edificio, 1)
  on conflict (edificio_id) do update set ultimo = c.ultimo + 1
  returning c.ultimo into v_numero;
  new.numero := v_numero;
  return new;
end;
$function$;
create trigger reclamos_asignar_numero
  before insert on public.reclamos
  for each row execute function public.asignar_numero_reclamo();

create or replace function public.prevent_reclamo_admin_fields_tampering()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp' as $function$
begin
  if auth.uid() is null then return new; end if;
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
$function$;
create trigger trg_prevent_reclamo_admin_fields_tampering
  before update on public.reclamos
  for each row execute function public.prevent_reclamo_admin_fields_tampering();

-- Políticas (mismas que en producción; la lectura de comentarios sigue la del reclamo).
create or replace function private.edificio_de_unidad(p_unidad uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select edificio_id from public.unidad_funcional where id = p_unidad $$;
create or replace function private.puede_ver_reclamo(p_reclamo uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select private.is_admin() or exists (
    select 1 from public.reclamos r
    where r.id = p_reclamo
      and (r.reportante_id = auth.uid()
           or private.usuario_en_edificio(private.edificio_de_unidad(r.unidad_funcional_id)))) $$;
grant execute on all functions in schema private to authenticated, service_role;

alter table public.reclamos enable row level security;
create policy reclamos_select on public.reclamos for select to authenticated using (
  private.is_admin() or reportante_id = (select auth.uid())
  or private.usuario_en_edificio(private.edificio_de_unidad(unidad_funcional_id)));
create policy reclamos_insert on public.reclamos for insert to authenticated
  with check (reportante_id = (select auth.uid()));
create policy reclamos_update_admin on public.reclamos for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy reclamos_delete_admin on public.reclamos for delete to authenticated
  using (private.is_admin());

alter table public.reclamo_comentarios enable row level security;
create policy comentarios_select on public.reclamo_comentarios for select to authenticated
  using (private.puede_ver_reclamo(reclamo_id));
create policy comentarios_insert on public.reclamo_comentarios for insert to authenticated
  with check (usuario_id = (select auth.uid()) and private.puede_ver_reclamo(reclamo_id));
create policy comentarios_admin_update on public.reclamo_comentarios for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy comentarios_admin_delete on public.reclamo_comentarios for delete to authenticated
  using (private.is_admin());

alter table public.reclamos_historial enable row level security;
create policy historial_select_admin on public.reclamos_historial for select to authenticated
  using (private.is_admin());

alter table public.usuario_notificaciones enable row level security;
create policy "Usuarios pueden ver sus notificaciones" on public.usuario_notificaciones
  for select to authenticated using (usuario_id = (select auth.uid()));

grant select, insert, update, delete on all tables in schema public to authenticated;
