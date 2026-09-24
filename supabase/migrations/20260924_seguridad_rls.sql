-- Endurecimiento de seguridad: corrige la escalada de privilegios en perfiles
-- y define desde cero las políticas RLS de todas las tablas de la app.
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

-- ---------------------------------------------------------------------------
-- 1. Funciones auxiliares (security definer: leen sin pasar por RLS y así
--    evitan recursión entre políticas).
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and activo is distinct from false
  );
$$;

-- ¿El usuario tiene hoy una asignación vigente en esa unidad?
create or replace function public.usuario_en_unidad(
  p_unidad_id public.unidad_funcional.id%type
)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.unidad_usuarios as uu
    where uu.usuario_id = auth.uid() and uu.unidad_id = p_unidad_id
      and uu.fecha_desde <= current_date
      and (uu.fecha_hasta is null or uu.fecha_hasta >= current_date)
  );
$$;

-- ¿El usuario tiene hoy alguna unidad vigente en ese edificio?
create or replace function public.usuario_en_edificio(
  p_edificio_id public.unidad_funcional.edificio_id%type
)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.unidad_usuarios as uu
    join public.unidad_funcional as uf on uf.id = uu.unidad_id
    where uu.usuario_id = auth.uid() and uf.edificio_id = p_edificio_id
      and uu.fecha_desde <= current_date
      and (uu.fecha_hasta is null or uu.fecha_hasta >= current_date)
  );
$$;

-- Mismo criterio que usa el frontend: admin, quien lo creó, o vecinos del
-- mismo edificio con unidad vigente.
create or replace function public.puede_ver_reclamo(p_reclamo_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_admin() or exists (
    select 1 from public.reclamos as r
    left join public.unidad_funcional as uf on uf.id = r.unidad_funcional_id
    where r.id = p_reclamo_id
      and (r.reportante_id = auth.uid() or public.usuario_en_edificio(uf.edificio_id))
  );
$$;

create or replace function public.puede_ver_imagen_reclamo(p_nombre text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_admin()
    or split_part(p_nombre, '/', 1) = auth.uid()::text
    or exists (
      select 1 from public.reclamos as r
      where to_jsonb(r.imagen_urls) ? p_nombre and public.puede_ver_reclamo(r.id)
    );
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.usuario_en_unidad from public, anon;
revoke execute on function public.usuario_en_edificio from public, anon;
revoke execute on function public.puede_ver_reclamo from public, anon;
revoke execute on function public.puede_ver_imagen_reclamo from public, anon;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.usuario_en_unidad to authenticated;
grant execute on function public.usuario_en_edificio to authenticated;
grant execute on function public.puede_ver_reclamo to authenticated;
grant execute on function public.puede_ver_imagen_reclamo to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Arreglo de la escalada de privilegios en perfiles.
--    La versión anterior usaba current_setting('request.jwt.claim.role'),
--    que PostgREST ya no define: la condición daba NULL y el trigger nunca
--    bloqueaba, así que cualquier usuario podía ponerse rol = 'admin'.
--    current_user es el rol real con el que corre la consulta.
-- ---------------------------------------------------------------------------

create or replace function public.proteger_campos_privados_perfil()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon')
    and not public.is_admin()
    and (new.rol is distinct from old.rol
      or new.activo is distinct from old.activo
      or new.email is distinct from old.email
      or new.id is distinct from old.id) then
    raise exception 'No podés modificar el rol, el estado o el correo de un perfil';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_campos_privados_perfil() from public, anon, authenticated;
drop trigger if exists proteger_campos_privados_perfil_trigger on public.perfiles;
create trigger proteger_campos_privados_perfil_trigger before update on public.perfiles
for each row execute function public.proteger_campos_privados_perfil();

-- ---------------------------------------------------------------------------
-- 3. Borrar TODAS las políticas existentes de estas tablas, para que no quede
--    ninguna política vieja y permisiva sumándose a las nuevas.
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'perfiles', 'reclamos', 'reclamo_comentarios', 'reclamos_historial',
      'unidad_funcional', 'unidad_usuarios', 'edificio'
    )
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.perfiles enable row level security;
alter table public.reclamos enable row level security;
alter table public.reclamo_comentarios enable row level security;
alter table public.reclamos_historial enable row level security;
alter table public.unidad_funcional enable row level security;
alter table public.unidad_usuarios enable row level security;
alter table public.edificio enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Políticas nuevas.
-- ---------------------------------------------------------------------------

-- perfiles: cada uno ve y edita el suyo (el trigger protege rol/activo/email);
-- el admin ve y edita todos. Las altas las hace la Edge Function.
create policy "perfiles_select" on public.perfiles for select to authenticated
using (id = auth.uid() or public.is_admin());
create policy "perfiles_update" on public.perfiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- edificio / unidad_funcional: lectura para admin y vecinos del edificio;
-- escritura solo admin.
create policy "edificio_select" on public.edificio for select to authenticated
using (public.is_admin() or public.usuario_en_edificio(id));
create policy "edificio_admin" on public.edificio for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "unidad_funcional_select" on public.unidad_funcional for select to authenticated
using (public.is_admin() or public.usuario_en_edificio(edificio_id));
create policy "unidad_funcional_admin" on public.unidad_funcional for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- unidad_usuarios: cada uno ve sus asignaciones; solo el admin las modifica.
create policy "unidad_usuarios_select" on public.unidad_usuarios for select to authenticated
using (usuario_id = auth.uid() or public.is_admin());
create policy "unidad_usuarios_admin" on public.unidad_usuarios for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- reclamos: un usuario solo puede crear reclamos a su nombre, sobre una
-- unidad propia, abiertos y sin prioridad Urgente. Cambiar estado,
-- prioridad o borrar es solo del admin.
create policy "reclamos_select" on public.reclamos for select to authenticated
using (public.puede_ver_reclamo(id));
create policy "reclamos_insert" on public.reclamos for insert to authenticated
with check (
  reportante_id = auth.uid()
  and (
    public.is_admin()
    or (
      public.usuario_en_unidad(unidad_funcional_id)
      and estado = 'abierto'
      and fecha_cierre is null
      and cerrado_por_id is null
      and nota_admin is null
      and prioridad is distinct from 'Urgente'
    )
  )
);
create policy "reclamos_update_admin" on public.reclamos for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "reclamos_delete_admin" on public.reclamos for delete to authenticated
using (public.is_admin());

-- comentarios: los ve y los agrega quien puede ver el reclamo, siempre a su
-- propio nombre. Editar o borrar, solo admin.
create policy "comentarios_select" on public.reclamo_comentarios for select to authenticated
using (public.puede_ver_reclamo(reclamo_id));
create policy "comentarios_insert" on public.reclamo_comentarios for insert to authenticated
with check (usuario_id = auth.uid() and public.puede_ver_reclamo(reclamo_id));
create policy "comentarios_admin_update" on public.reclamo_comentarios for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "comentarios_admin_delete" on public.reclamo_comentarios for delete to authenticated
using (public.is_admin());

alter table public.reclamo_comentarios
  drop constraint if exists reclamo_comentarios_largo_chk;
alter table public.reclamo_comentarios
  add constraint reclamo_comentarios_largo_chk
  check (char_length(comentario) between 1 and 2000) not valid;

-- historial: guarda copias completas de cada reclamo (incluida nota_admin),
-- la app no lo usa del lado del usuario, así que queda solo para admin.
create policy "historial_select_admin" on public.reclamos_historial for select to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Storage: bucket privado y políticas por carpeta de usuario.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reclamos', 'reclamos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and coalesce(qual, '') || coalesce(with_check, '') ilike '%reclamos%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "reclamos_imagenes_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'reclamos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "reclamos_imagenes_select" on storage.objects for select to authenticated
using (bucket_id = 'reclamos' and public.puede_ver_imagen_reclamo(name));
create policy "reclamos_imagenes_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'reclamos'
  and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
);

notify pgrst, 'reload schema';

commit;
