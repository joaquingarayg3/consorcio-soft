-- Listado de usuarios para la pantalla de administración: búsqueda por texto
-- (ignora tildes y mayúsculas; cada palabra tiene que aparecer en el nombre, el
-- apellido o el email), filtros por estado y rol, orden y paginado. Devuelve el
-- total de coincidencias en cada fila para poder decir "50 de 1.234".
--
-- Corre con los permisos de quien llama (security invoker): las políticas RLS de
-- perfiles siguen decidiendo qué filas se ven, así que un usuario común solo
-- encontraría su propio perfil.
begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.buscar_perfiles(
  texto text default '',
  filtro_estado text default 'todos',   -- 'todos' | 'activos' | 'inactivos'
  filtro_rol text default 'todos',      -- 'todos' | 'admin' | 'user'
  orden text default 'alfabetico',      -- 'alfabetico' | 'recientes'
  limite integer default 50,
  desde integer default 0
)
returns table (
  id uuid,
  nombre text,
  apellido text,
  email text,
  rol text,
  activo boolean,
  created_at timestamptz,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.nombre::text,
    p.apellido::text,
    p.email::text,
    p.rol::text,
    p.activo,
    p.created_at::timestamptz,
    count(*) over () as total
  from public.perfiles as p
  where (
      coalesce(filtro_estado, 'todos') = 'todos'
      or (filtro_estado = 'activos' and p.activo)
      or (filtro_estado = 'inactivos' and not p.activo)
    )
    and (
      coalesce(filtro_rol, 'todos') = 'todos'
      or p.rol::text = filtro_rol
    )
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
  order by
    case when orden = 'recientes' then p.created_at end desc nulls last,
    p.apellido,
    p.nombre,
    p.id
  limit greatest(1, least(coalesce(limite, 50), 200))
  offset greatest(0, coalesce(desde, 0));
$$;

revoke all on function public.buscar_perfiles(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.buscar_perfiles(text, text, text, text, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
