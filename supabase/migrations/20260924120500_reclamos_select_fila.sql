-- La política de lectura de reclamos buscaba el reclamo por id dentro de
-- una función STABLE. En INSERT ... RETURNING (lo que hace la app con
-- .insert().select()) la fila recién creada todavía no es visible para esa
-- búsqueda, así que la política daba falso y un usuario común no podía crear
-- reclamos. Ahora se evalúa con las columnas de la propia fila.
begin;

create or replace function private.edificio_de_unidad(p_unidad_id uuid)
returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select edificio_id from public.unidad_funcional where id = p_unidad_id;
$$;
revoke execute on function private.edificio_de_unidad(uuid) from public, anon;
grant execute on function private.edificio_de_unidad(uuid) to authenticated, service_role;

alter policy "reclamos_select" on public.reclamos
  using (
    private.is_admin()
    or reportante_id = (select auth.uid())
    or private.usuario_en_edificio(private.edificio_de_unidad(unidad_funcional_id))
  );

commit;
