-- Auditoría de seguridad (solo lectura, no modifica nada).
-- Pegala en el SQL Editor de Supabase y copiá la celda de resultado.
select jsonb_pretty(jsonb_build_object(
  'rls_por_tabla', (
    select jsonb_agg(jsonb_build_object(
      'tabla', c.relname, 'rls', c.relrowsecurity, 'force', c.relforcerowsecurity
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'politicas', (
    select jsonb_agg(jsonb_build_object(
      'esquema', schemaname, 'tabla', tablename, 'politica', policyname,
      'cmd', cmd, 'roles', roles, 'using', qual, 'check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies where schemaname in ('public', 'storage')
  ),
  'funciones_public', (
    select jsonb_agg(jsonb_build_object(
      'funcion', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'config', p.proconfig
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),
  'triggers_auth_users', (
    select jsonb_agg(jsonb_build_object(
      'trigger', t.tgname, 'funcion', t.tgfoid::regproc::text,
      'security_definer', p.prosecdef
    ))
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
  ),
  'buckets', (
    select jsonb_agg(jsonb_build_object(
      'id', id, 'public', public, 'limite', file_size_limit,
      'mime', allowed_mime_types
    ))
    from storage.buckets
  ),
  'columnas', (
    select jsonb_agg(jsonb_build_object(
      'tabla', table_name, 'columna', column_name, 'tipo', data_type
    ) order by table_name, ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
  ),
  'perfiles_por_rol', (
    select jsonb_agg(jsonb_build_object('rol', rol, 'activo', activo, 'cantidad', n))
    from (select rol, activo, count(*) as n from public.perfiles group by 1, 2) s
  ),
  'reclamos_con_imagenes_en_base64', (
    select count(*) from public.reclamos where imagen_urls::text like '%data:%'
  )
));
