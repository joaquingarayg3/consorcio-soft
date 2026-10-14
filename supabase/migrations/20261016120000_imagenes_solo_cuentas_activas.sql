-- Subir imágenes de reclamos: solo cuentas activas.
--
-- Con el registro público, cualquiera puede crear una cuenta y verificar su
-- correo. Esa cuenta queda pendiente y no ve nada del consorcio, pero la política
-- de subida del bucket `reclamos` solo pedía que la carpeta fuera la propia: una
-- cuenta pendiente (o dada de baja con una sesión todavía vigente) podía subir
-- imágenes sin límite de cantidad a su carpeta y ocupar almacenamiento. Ahora la
-- cuenta tiene que estar activa.
--
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

-- ¿Quien llama tiene la cuenta activa? (mismo criterio que private.is_admin:
-- activo null cuenta como activo; solo `false` es inactivo).
create or replace function private.cuenta_activa()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and activo is distinct from false
  );
$$;
revoke execute on function private.cuenta_activa() from public, anon;
grant execute on function private.cuenta_activa() to authenticated, service_role;

alter policy "reclamos_imagenes_insert" on storage.objects
  with check (
    bucket_id = 'reclamos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.cuenta_activa()
  );

notify pgrst, 'reload schema';

commit;
