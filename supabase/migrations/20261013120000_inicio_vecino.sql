-- Inicio del vecino: anuncios urgentes y numeración de reclamos por edificio.
--
-- 1. anuncios.urgente_hasta: un anuncio es urgente hasta esa fecha y hora.
--    Sin fecha no es urgente. Vencida, vuelve a ser un anuncio común.
-- 2. edificio.codigo: código corto y único (ej. HP) para identificar reclamos.
-- 3. reclamos.numero: número propio de cada edificio, asignado por la base al
--    crear el reclamo. El ticket se muestra como CODIGO-0000 (ej. HP-0012).
--
-- Todo corre en una transacción: si algo falla, no se aplica nada.
begin;

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Anuncios urgentes
-- ---------------------------------------------------------------------------
alter table public.anuncios add column if not exists urgente_hasta timestamptz;

alter table public.anuncios drop constraint if exists anuncios_urgente_futuro_chk;
alter table public.anuncios
  add constraint anuncios_urgente_futuro_chk
  check (urgente_hasta is null or urgente_hasta > creado_en);

create index if not exists anuncios_urgente_idx
  on public.anuncios (urgente_hasta)
  where urgente_hasta is not null;

-- Un anuncio solo puede cambiar su texto y su urgencia.
grant update (urgente_hasta) on public.anuncios to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Código de cada edificio
-- ---------------------------------------------------------------------------
alter table public.edificio add column if not exists codigo text;

-- Propone un código a partir del nombre: iniciales de hasta 3 palabras
-- ("Hotel Plaza" -> HP) o las 3 primeras letras si es una sola palabra.
create or replace function public.sugerir_codigo_edificio(p_nombre text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  limpio text;
  palabras text[];
  base text;
begin
  limpio := upper(extensions.unaccent(coalesce(p_nombre, '')));
  limpio := regexp_replace(limpio, '[^A-Z0-9 ]', ' ', 'g');
  palabras := array(
    select w
    from unnest(regexp_split_to_array(btrim(limpio), '\s+')) with ordinality as t(w, n)
    where w <> '' and w not in ('DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y')
    order by n
  );

  if coalesce(array_length(palabras, 1), 0) >= 2 then
    base := (
      select string_agg(left(w, 1), '' order by n)
      from (
        select w, n from unnest(palabras) with ordinality as t(w, n) order by n limit 3
      ) as primeras
    );
  elsif coalesce(array_length(palabras, 1), 0) = 1 then
    base := left(palabras[1], 3);
  else
    base := 'ED';
  end if;

  if char_length(base) < 2 then
    base := rpad(base, 2, 'X');
  end if;
  return base;
end;
$$;

-- La sugerencia, pero sin repetir un código que ya tenga otro edificio.
create or replace function public.generar_codigo_edificio(p_nombre text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text := public.sugerir_codigo_edificio(p_nombre);
  candidato text := base;
  n integer := 1;
begin
  while exists (select 1 from public.edificio where codigo = candidato) loop
    n := n + 1;
    candidato := left(base, 5 - char_length(n::text)) || n::text;
  end loop;
  return candidato;
end;
$$;

-- Edificios que ya existen: cada uno recibe un código sugerido (se puede
-- cambiar después desde la pestaña Datos del edificio).
do $$
declare
  r record;
begin
  for r in select id, nombre from public.edificio where codigo is null order by nombre, id loop
    update public.edificio set codigo = public.generar_codigo_edificio(r.nombre) where id = r.id;
  end loop;
end $$;

alter table public.edificio alter column codigo set not null;
alter table public.edificio drop constraint if exists edificio_codigo_chk;
alter table public.edificio
  add constraint edificio_codigo_chk check (codigo ~ '^[A-Z0-9]{2,5}$');
create unique index if not exists edificio_codigo_unico on public.edificio (codigo);

-- Normaliza (mayúsculas, sin espacios) y, si no viene código, lo genera.
create or replace function public.normalizar_codigo_edificio()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.codigo := upper(btrim(coalesce(new.codigo, '')));
  if new.codigo = '' then
    new.codigo := public.generar_codigo_edificio(new.nombre);
  end if;
  return new;
end;
$$;
revoke execute on function public.normalizar_codigo_edificio() from public, anon, authenticated;

drop trigger if exists edificio_normalizar_codigo on public.edificio;
create trigger edificio_normalizar_codigo
  before insert or update of codigo on public.edificio
  for each row execute function public.normalizar_codigo_edificio();

-- ---------------------------------------------------------------------------
-- 3. Número de reclamo por edificio
-- ---------------------------------------------------------------------------
-- El contador vive aparte y nadie lo toca desde la app: solo la función de abajo.
create table if not exists public.reclamo_contadores (
  edificio_id uuid primary key references public.edificio (id) on delete cascade,
  ultimo integer not null default 0
);
alter table public.reclamo_contadores enable row level security;
revoke all on public.reclamo_contadores from anon, authenticated;

alter table public.reclamos add column if not exists numero integer;

-- Reclamos que ya existen: se numeran por orden de creación dentro de su
-- edificio. Se apagan los triggers mientras tanto para no generar historial
-- ni avisos por un cambio que no es de la persona.
alter table public.reclamos disable trigger user;

with base as (
  select uf.edificio_id, coalesce(max(r.numero), 0) as maximo
  from public.reclamos as r
  join public.unidad_funcional as uf on uf.id = r.unidad_funcional_id
  group by uf.edificio_id
),
ordenados as (
  select
    r.id,
    b.maximo + row_number() over (
      partition by uf.edificio_id order by r.fecha_creacion, r.id
    ) as n
  from public.reclamos as r
  join public.unidad_funcional as uf on uf.id = r.unidad_funcional_id
  join base as b on b.edificio_id = uf.edificio_id
  where r.numero is null
)
update public.reclamos as r
set numero = o.n
from ordenados as o
where r.id = o.id;

insert into public.reclamo_contadores (edificio_id, ultimo)
select uf.edificio_id, max(r.numero)
from public.reclamos as r
join public.unidad_funcional as uf on uf.id = r.unidad_funcional_id
where r.numero is not null
group by uf.edificio_id
on conflict (edificio_id) do update
  set ultimo = greatest(public.reclamo_contadores.ultimo, excluded.ultimo);

alter table public.reclamos enable trigger user;

-- Al crear un reclamo, la base le da el siguiente número de su edificio. El
-- INSERT ... ON CONFLICT bloquea la fila del contador, así dos reclamos
-- simultáneos nunca reciben el mismo número.
create or replace function public.asignar_numero_reclamo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_edificio uuid;
  v_numero integer;
begin
  select uf.edificio_id into v_edificio
  from public.unidad_funcional as uf
  where uf.id = new.unidad_funcional_id;

  if v_edificio is null then
    new.numero := null;
    return new;
  end if;

  insert into public.reclamo_contadores as c (edificio_id, ultimo)
  values (v_edificio, 1)
  on conflict (edificio_id) do update set ultimo = c.ultimo + 1
  returning c.ultimo into v_numero;

  new.numero := v_numero;
  return new;
end;
$$;
revoke execute on function public.asignar_numero_reclamo() from public, anon, authenticated;

drop trigger if exists reclamos_asignar_numero on public.reclamos;
create trigger reclamos_asignar_numero
  before insert on public.reclamos
  for each row execute function public.asignar_numero_reclamo();

-- El número no se edita nunca.
create or replace function public.proteger_numero_reclamo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.numero := old.numero;
  return new;
end;
$$;
revoke execute on function public.proteger_numero_reclamo() from public, anon, authenticated;

drop trigger if exists reclamos_proteger_numero on public.reclamos;
create trigger reclamos_proteger_numero
  before update on public.reclamos
  for each row execute function public.proteger_numero_reclamo();

notify pgrst, 'reload schema';

commit;
