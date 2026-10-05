-- Rendimiento: índices en claves foráneas sin índice y auth.uid() evaluado
-- una vez por consulta en vez de una vez por fila (lint auth_rls_initplan).
-- No cambia qué puede ver o hacer cada usuario.
begin;

create index if not exists reclamo_comentarios_usuario_id_idx
  on public.reclamo_comentarios (usuario_id);
create index if not exists reclamos_cerrado_por_id_idx
  on public.reclamos (cerrado_por_id);
create index if not exists reclamos_historial_usuario_id_idx
  on public.reclamos_historial (usuario_id);
create index if not exists usuario_notificaciones_reclamo_id_idx
  on public.usuario_notificaciones (reclamo_id);

alter policy "perfiles_select" on public.perfiles
  using (id = (select auth.uid()) or private.is_admin());
alter policy "perfiles_update" on public.perfiles
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

alter policy "unidad_usuarios_select" on public.unidad_usuarios
  using (usuario_id = (select auth.uid()) or private.is_admin());

alter policy "reclamos_insert" on public.reclamos
  with check (
    reportante_id = (select auth.uid())
    and (
      private.is_admin()
      or (
        private.usuario_en_unidad(unidad_funcional_id)
        and estado = 'abierto'
        and fecha_cierre is null
        and cerrado_por_id is null
        and nota_admin is null
        and prioridad is distinct from 'Urgente'
      )
    )
  );

alter policy "comentarios_insert" on public.reclamo_comentarios
  with check (
    usuario_id = (select auth.uid()) and private.puede_ver_reclamo(reclamo_id)
  );

alter policy "Usuarios pueden ver sus notificaciones" on public.usuario_notificaciones
  using (usuario_id = (select auth.uid()));
alter policy "Usuarios pueden actualizar sus notificaciones" on public.usuario_notificaciones
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

alter policy "reclamos_imagenes_insert" on storage.objects
  with check (
    bucket_id = 'reclamos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
alter policy "reclamos_imagenes_delete" on storage.objects
  using (
    bucket_id = 'reclamos'
    and (private.is_admin() or (storage.foldername(name))[1] = (select auth.uid())::text)
  );

commit;
