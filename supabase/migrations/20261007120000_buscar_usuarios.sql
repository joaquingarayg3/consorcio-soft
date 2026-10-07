-- Búsqueda de usuarios activos para asignarlos a una unidad. Con muchos
-- usuarios no se puede traer la lista entera al navegador, así que se busca en
-- la base. Ignora tildes y mayúsculas ("diaz" encuentra "Díaz") y cada palabra
-- tiene que aparecer en el nombre, el apellido o el email.
--
-- Corre con los permisos de quien llama (security invoker): las políticas RLS
-- de perfiles siguen decidiendo qué filas se ven, así que un usuario común solo
-- encontraría su propio perfil.
begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.buscar_perfiles_activos(
  texto text default '',
  limite integer default 31
)
returns table (id uuid, nombre text, apellido text, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.nombre::text, p.apellido::text, p.email::text
  from public.perfiles as p
  where p.activo
    and not exists (
      -- Palabras de la búsqueda (máximo 5) que NO están en el perfil.
      select 1
      from (
        select w
        from unnest(regexp_split_to_array(btrim(coalesce(texto, '')), '\s+')) as w
        where w <> ''
        limit 5
      ) as palabras
      where extensions.unaccent(
              lower(
                coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, '') || ' ' ||
                coalesce(p.email, '')
              )
            )
            not like '%' || extensions.unaccent(
              lower(replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_'))
            ) || '%'
    )
  order by p.apellido, p.nombre
  limit greatest(1, least(coalesce(limite, 31), 101));
$$;

revoke all on function public.buscar_perfiles_activos(text, integer)
  from public, anon;
grant execute on function public.buscar_perfiles_activos(text, integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
