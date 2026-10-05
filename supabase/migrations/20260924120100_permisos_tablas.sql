-- Permisos de tabla (GRANT). RLS decide qué filas; esto decide qué operaciones.
begin;

-- La app nunca lee ni escribe tablas sin sesión.
revoke all on all tables in schema public from anon;

-- TRUNCATE ignora RLS y la app no usa TRIGGER ni REFERENCES.
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Faltaba INSERT: ningún usuario (ni admin) podía crear reclamos.
-- DELETE queda limitado a admins por la política reclamos_delete_admin.
grant insert, delete on public.reclamos to authenticated;

-- Lo mismo para las tablas que se creen en el futuro.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

commit;
