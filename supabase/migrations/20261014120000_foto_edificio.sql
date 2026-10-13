-- Foto de cada edificio, para que los vecinos la vean en su inicio.
--
-- Una sola foto por edificio, en un almacenamiento PRIVADO (bucket "edificios"):
--   * la ven los administradores y quienes tienen una unidad vigente en ese
--     edificio (igual que las fotos de los reclamos);
--   * solo los administradores pueden subirla o borrarla.
-- Cada archivo vive en una carpeta con el id de su edificio:
--   <edificio_id>/<marca de tiempo>.jpg        (portada)
--   <edificio_id>/<marca de tiempo>-mini.jpg   (miniatura)
-- La app guarda en edificio.foto_path y edificio.miniatura_path cuál es la
-- vigente; al cambiar la foto, el archivo anterior se borra.
begin;

alter table public.edificio
  add column if not exists foto_path text,
  add column if not exists miniatura_path text,
  add column if not exists foto_actualizada_en timestamptz;

-- Una foto solo puede apuntar a la carpeta de su propio edificio.
alter table public.edificio drop constraint if exists edificio_foto_chk;
alter table public.edificio
  add constraint edificio_foto_chk check (
    (foto_path is null or split_part(foto_path, '/', 1) = id::text)
    and (miniatura_path is null or split_part(miniatura_path, '/', 1) = id::text)
  );

-- Bucket privado: solo imágenes y hasta 5 MB (la app las achica antes de subir).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'edificios', 'edificios', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ¿Puede esta persona ver el archivo? Admin, o vecino del edificio de la carpeta.
-- Si el nombre no empieza con un id válido, no.
create or replace function private.puede_ver_foto_edificio(p_nombre text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_edificio text := split_part(p_nombre, '/', 1);
begin
  if private.is_admin() then
    return true;
  end if;
  if v_edificio !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.usuario_en_edificio(v_edificio::uuid);
end;
$$;
revoke execute on function private.puede_ver_foto_edificio(text) from public, anon;
grant execute on function private.puede_ver_foto_edificio(text) to authenticated, service_role;

drop policy if exists "edificios_fotos_select" on storage.objects;
create policy "edificios_fotos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'edificios' and private.puede_ver_foto_edificio(name));

drop policy if exists "edificios_fotos_insert" on storage.objects;
create policy "edificios_fotos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'edificios'
    and private.is_admin()
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

drop policy if exists "edificios_fotos_delete" on storage.objects;
create policy "edificios_fotos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'edificios' and private.is_admin());

notify pgrst, 'reload schema';

commit;
