-- Coeficientes de prorrateo por edificio.
--
-- Cada edificio reparte sus gastos con uno o más "esquemas" de coeficientes. Un
-- esquema es una bolsa de gasto que reparte el 100% (el valor 1) entre las
-- unidades que participan. Quien no tiene fila en un esquema no paga esa bolsa.
--
--   manual          el valor se carga según el reglamento
--   derivado        valor = coeficiente en el esquema base / suma de los
--                   participantes (por ejemplo, Sector A de Domuyo)
--   partes_iguales  valor = peso / suma de pesos (por ejemplo, tasas)
--
-- Los valores derivados y por partes iguales se GUARDAN calculados, así la
-- liquidación lee una sola tabla y todo queda auditable.
--
-- Un esquema nace en borrador (se puede editar aunque no cierre) y se publica
-- recién cuando suma 1 dentro de su tolerancia. Un esquema publicado no se edita:
-- si cambia el reglamento se crea otro con otra vigencia.
--
-- Solo la administración lee y escribe estas tablas. Las funciones corren con los
-- permisos de quien las llama (security invoker), así que las políticas RLS
-- siempre aplican.
--
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
begin;

-- ---------------------------------------------------------------------------
-- 1. Unidades funcionales
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from public.unidad_funcional where edificio_id is null) then
    raise exception
      'Hay unidades funcionales sin edificio (edificio_id vacío). Corregilas o borralas y volvé a aplicar esta migración.';
  end if;
end $$;

alter table public.unidad_funcional alter column edificio_id set not null;

-- Tipos admitidos (la columna es de texto libre: se agregan local, oficina y otro).
alter table public.unidad_funcional drop constraint if exists unidad_funcional_tipo_chk;
alter table public.unidad_funcional add constraint unidad_funcional_tipo_chk
  check (tipo in ('departamento', 'cochera', 'local', 'baulera', 'oficina', 'otro'));

-- Número de unidad funcional según el reglamento ("UF 21"), si lo hay.
alter table public.unidad_funcional add column if not exists numero_uf text;

-- Unidades anexas: una cochera o baulera con coeficiente propio se carga como
-- unidad aparte y apunta al departamento con el que se liquida.
alter table public.unidad_funcional add column if not exists unidad_principal_id uuid;

-- (Sin ON DELETE: se controla al final de la sentencia, así se puede borrar un
-- edificio entero aunque tenga anexas; borrar solo la principal sí se rechaza.)
-- Para poder apuntar a una unidad "del mismo edificio" con una clave compuesta.
do $$
begin
  -- Sin borrar y volver a crear: otras claves ya dependen de esta restricción.
  if not exists (
    select 1 from pg_constraint
    where conname = 'unidad_funcional_id_edificio_key'
      and conrelid = 'public.unidad_funcional'::regclass
  ) then
    alter table public.unidad_funcional
      add constraint unidad_funcional_id_edificio_key unique (id, edificio_id);
  end if;
end $$;

alter table public.unidad_funcional
  drop constraint if exists unidad_funcional_principal_fkey;
alter table public.unidad_funcional
  add constraint unidad_funcional_principal_fkey
  foreign key (unidad_principal_id, edificio_id)
  references public.unidad_funcional (id, edificio_id);

alter table public.unidad_funcional
  drop constraint if exists unidad_funcional_principal_distinta_chk;
alter table public.unidad_funcional
  add constraint unidad_funcional_principal_distinta_chk
  check (unidad_principal_id is distinct from id);

-- Una anexa no puede tener anexas, y una unidad con anexas no puede ser anexa.
create or replace function public.unidad_funcional_validar_principal()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.unidad_principal_id is not null then
    if exists (
      select 1 from public.unidad_funcional as p
      where p.id = new.unidad_principal_id and p.unidad_principal_id is not null
    ) then
      raise exception 'La unidad principal no puede ser, a su vez, anexa de otra unidad';
    end if;
    if exists (
      select 1 from public.unidad_funcional as a where a.unidad_principal_id = new.id
    ) then
      raise exception 'Esta unidad tiene anexas, así que no puede ser anexa de otra';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.unidad_funcional_validar_principal()
  from public, anon, authenticated;
drop trigger if exists unidad_funcional_validar_principal_trigger on public.unidad_funcional;
create trigger unidad_funcional_validar_principal_trigger
  before insert or update of unidad_principal_id on public.unidad_funcional
  for each row execute function public.unidad_funcional_validar_principal();

-- Las unidades nuevas ya no traen el porcentaje fiscal: el dato vive en los
-- esquemas. La columna queda como historial hasta que se la retire.
alter table public.unidad_funcional alter column porcentaje_fiscal set default 0;
comment on column public.unidad_funcional.porcentaje_fiscal is
  'OBSOLETO. Se migró (dividido por 100) al esquema GENERAL de cada edificio; usar public.coeficiente.';

-- ---------------------------------------------------------------------------
-- 2. Esquemas y coeficientes
-- ---------------------------------------------------------------------------

create table if not exists public.esquema_coeficiente (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references public.edificio (id) on delete cascade,
  codigo text not null,            -- 'GENERAL', 'DPTOS', 'COCHERAS', 'TASAS', 'SECTOR_A'
  nombre text not null,            -- como lo llama la administración
  metodo text not null default 'manual',
  esquema_base_id uuid,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  tolerancia numeric(8, 6) not null default 0.0001,
  estado text not null default 'borrador',
  publicado_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint esquema_coeficiente_id_edificio_key unique (id, edificio_id),
  constraint esquema_coeficiente_codigo_vigencia_key
    unique (edificio_id, codigo, vigente_desde),
  -- La base de un esquema derivado tiene que ser del mismo edificio.
  constraint esquema_coeficiente_base_fkey
    foreign key (esquema_base_id, edificio_id)
    references public.esquema_coeficiente (id, edificio_id),
  constraint esquema_coeficiente_metodo_chk
    check (metodo in ('manual', 'derivado', 'partes_iguales')),
  constraint esquema_coeficiente_base_chk
    check ((metodo = 'derivado') = (esquema_base_id is not null)),
  constraint esquema_coeficiente_base_distinta_chk
    check (esquema_base_id is distinct from id),
  constraint esquema_coeficiente_vigencia_chk
    check (vigente_hasta is null or vigente_hasta > vigente_desde),
  constraint esquema_coeficiente_tolerancia_chk
    check (tolerancia >= 0 and tolerancia <= 0.01),
  constraint esquema_coeficiente_estado_chk
    check (estado in ('borrador', 'publicado')),
  constraint esquema_coeficiente_publicado_chk
    check ((estado = 'publicado') = (publicado_en is not null)),
  constraint esquema_coeficiente_codigo_chk
    check (codigo ~ '^[A-Z0-9_]{1,30}$'),
  constraint esquema_coeficiente_nombre_chk
    check (char_length(btrim(nombre)) between 1 and 80 and nombre !~ '[[:cntrl:]]')
);

create index if not exists esquema_coeficiente_edificio_idx
  on public.esquema_coeficiente (edificio_id);

create table if not exists public.coeficiente (
  esquema_id uuid not null,
  unidad_id uuid not null,
  -- Se repite a propósito: las claves compuestas obligan a que la unidad y el
  -- esquema sean del mismo edificio, y las políticas RLS filtran sin joins.
  edificio_id uuid not null,
  valor numeric(12, 10) not null default 0 check (valor between 0 and 1),
  peso numeric(8, 4) not null default 1 check (peso > 0),  -- solo partes_iguales
  primary key (esquema_id, unidad_id),
  foreign key (esquema_id, edificio_id)
    references public.esquema_coeficiente (id, edificio_id) on delete cascade,
  foreign key (unidad_id, edificio_id)
    references public.unidad_funcional (id, edificio_id) on delete cascade
);

create index if not exists coeficiente_unidad_idx on public.coeficiente (unidad_id);
create index if not exists coeficiente_edificio_idx on public.coeficiente (edificio_id);

-- Reglas que una restricción simple no puede expresar.
create or replace function public.esquema_coeficiente_validar()
returns trigger language plpgsql set search_path = '' as $$
declare
  hay_ciclo boolean;
begin
  if tg_op = 'INSERT' and new.estado <> 'borrador' then
    raise exception 'Los esquemas se crean como borrador; se publican con publicar_esquema';
  end if;

  -- Dos vigencias del mismo código en un edificio no pueden superponerse.
  if exists (
    select 1 from public.esquema_coeficiente as o
    where o.edificio_id = new.edificio_id and o.codigo = new.codigo and o.id <> new.id
      and daterange(o.vigente_desde, o.vigente_hasta, '[)')
          && daterange(new.vigente_desde, new.vigente_hasta, '[)')
  ) then
    raise exception 'Ya hay un esquema % en este edificio con una vigencia que se superpone', new.codigo;
  end if;

  -- Un esquema no puede derivar de sí mismo, ni en cadena.
  if new.esquema_base_id is not null then
    with recursive cadena (id) as (
      select new.esquema_base_id
      union
      select e.esquema_base_id
      from public.esquema_coeficiente as e join cadena as c on e.id = c.id
      where e.esquema_base_id is not null
    )
    select exists (select 1 from cadena where id = new.id) into hay_ciclo;
    if hay_ciclo then
      raise exception 'Un esquema no puede derivar de sí mismo, ni en cadena';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- Lo publicado no cambia su definición (el nombre y el cierre de vigencia sí).
    if old.estado = 'publicado' and (
      (new.edificio_id, new.codigo, new.metodo, new.esquema_base_id, new.vigente_desde, new.tolerancia)
      is distinct from
      (old.edificio_id, old.codigo, old.metodo, old.esquema_base_id, old.vigente_desde, old.tolerancia)
    ) then
      raise exception 'El esquema % está publicado: no se puede cambiar su definición. Despublicalo o creá otro con otra vigencia', old.codigo;
    end if;
    -- El estado solo cambia con publicar_esquema y despublicar_esquema, que
    -- validan antes. Evita publicar con una actualización directa.
    if old.estado is distinct from new.estado
       and coalesce(current_setting('app.cambio_estado_esquema', true), '') <> 'on' then
      raise exception 'El estado se cambia con publicar_esquema o despublicar_esquema';
    end if;
  end if;

  return new;
end;
$$;
revoke execute on function public.esquema_coeficiente_validar()
  from public, anon, authenticated;
drop trigger if exists esquema_coeficiente_validar_trigger on public.esquema_coeficiente;
create trigger esquema_coeficiente_validar_trigger
  before insert or update on public.esquema_coeficiente
  for each row execute function public.esquema_coeficiente_validar();

-- Los valores de un esquema publicado no se tocan.
create or replace function public.coeficiente_bloquear_publicado()
returns trigger language plpgsql set search_path = '' as $$
declare
  esquema_anterior uuid := null;
begin
  if tg_op = 'UPDATE' then
    esquema_anterior := old.esquema_id;
  end if;
  if exists (
    select 1 from public.esquema_coeficiente as e
    where e.estado = 'publicado'
      and e.id in (new.esquema_id, coalesce(esquema_anterior, new.esquema_id))
  ) then
    raise exception 'El esquema está publicado: despublicalo para modificar sus coeficientes';
  end if;
  return new;
end;
$$;
revoke execute on function public.coeficiente_bloquear_publicado()
  from public, anon, authenticated;
drop trigger if exists coeficiente_bloquear_publicado_trigger on public.coeficiente;
create trigger coeficiente_bloquear_publicado_trigger
  before insert or update on public.coeficiente
  for each row execute function public.coeficiente_bloquear_publicado();

-- ---------------------------------------------------------------------------
-- 3. Seguridad: solo la administración
-- ---------------------------------------------------------------------------

alter table public.esquema_coeficiente enable row level security;
alter table public.coeficiente enable row level security;

drop policy if exists "esquemas_admin_select" on public.esquema_coeficiente;
create policy "esquemas_admin_select" on public.esquema_coeficiente
  for select to authenticated using (private.is_admin());
drop policy if exists "esquemas_admin_insert" on public.esquema_coeficiente;
create policy "esquemas_admin_insert" on public.esquema_coeficiente
  for insert to authenticated with check (private.is_admin());
drop policy if exists "esquemas_admin_update" on public.esquema_coeficiente;
create policy "esquemas_admin_update" on public.esquema_coeficiente
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
-- Un esquema publicado no se borra directamente: primero se despublica.
drop policy if exists "esquemas_admin_delete" on public.esquema_coeficiente;
create policy "esquemas_admin_delete" on public.esquema_coeficiente
  for delete to authenticated
  using (private.is_admin() and estado = 'borrador');

drop policy if exists "coeficientes_admin_select" on public.coeficiente;
create policy "coeficientes_admin_select" on public.coeficiente
  for select to authenticated using (private.is_admin());
drop policy if exists "coeficientes_admin_insert" on public.coeficiente;
create policy "coeficientes_admin_insert" on public.coeficiente
  for insert to authenticated with check (private.is_admin());
drop policy if exists "coeficientes_admin_update" on public.coeficiente;
create policy "coeficientes_admin_update" on public.coeficiente
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
drop policy if exists "coeficientes_admin_delete" on public.coeficiente;
create policy "coeficientes_admin_delete" on public.coeficiente
  for delete to authenticated using (private.is_admin());

revoke all on public.esquema_coeficiente from anon, authenticated;
revoke all on public.coeficiente from anon, authenticated;
grant select, insert, delete on public.esquema_coeficiente to authenticated;
-- Nunca se cambia el edificio de un esquema. Lo publicado conserva su definición
-- (lo exige el trigger) y el estado solo cambia con publicar_esquema y
-- despublicar_esquema (también lo exige el trigger).
grant update (codigo, nombre, metodo, esquema_base_id, vigente_desde, vigente_hasta,
              tolerancia, estado, publicado_en)
  on public.esquema_coeficiente to authenticated;
grant select, insert, delete on public.coeficiente to authenticated;
grant update (valor, peso) on public.coeficiente to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Vista: coeficiente de cada "cuenta" (la unidad principal con sus anexas)
-- ---------------------------------------------------------------------------

create or replace view public.v_coeficiente_por_cuenta
with (security_invoker = true) as
select c.edificio_id,
       c.esquema_id,
       e.codigo as esquema,
       coalesce(u.unidad_principal_id, u.id) as unidad_cuenta_id,
       sum(c.valor) as coeficiente_total,
       count(*) as unidades_incluidas
from public.coeficiente as c
join public.unidad_funcional as u on u.id = c.unidad_id
join public.esquema_coeficiente as e on e.id = c.esquema_id
group by c.edificio_id, c.esquema_id, e.codigo, coalesce(u.unidad_principal_id, u.id);

revoke all on public.v_coeficiente_por_cuenta from anon, authenticated;
grant select on public.v_coeficiente_por_cuenta to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Funciones (security invoker: las políticas RLS siempre aplican)
-- ---------------------------------------------------------------------------

-- Recalcula un esquema y, en cascada, los que derivan de él. `p_visitados`
-- frena cualquier cadena circular o demasiado larga.
create or replace function private.recalcular_esquema_en_cascada(
  p_esquema uuid,
  p_visitados uuid[]
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  e public.esquema_coeficiente;
  total numeric;
  faltan text;
  hijo uuid;
begin
  if p_esquema = any (p_visitados) or cardinality(p_visitados) > 10 then
    raise exception 'La cadena de esquemas derivados es circular o demasiado larga';
  end if;

  select * into e from public.esquema_coeficiente where id = p_esquema;
  if not found then
    raise exception 'El esquema no existe';
  end if;
  if e.estado = 'publicado' then
    raise exception 'El esquema % está publicado: despublicalo antes de recalcularlo', e.codigo;
  end if;

  if e.metodo = 'partes_iguales' then
    select sum(peso) into total from public.coeficiente where esquema_id = e.id;
    if total is not null then
      update public.coeficiente set valor = peso / total where esquema_id = e.id;
    end if;

  elsif e.metodo = 'derivado' then
    -- Toda unidad que participa tiene que participar también en la base.
    select string_agg(u.identificador, ', ' order by u.identificador) into faltan
    from public.coeficiente as c
    join public.unidad_funcional as u on u.id = c.unidad_id
    where c.esquema_id = e.id
      and not exists (
        select 1 from public.coeficiente as b
        where b.esquema_id = e.esquema_base_id and b.unidad_id = c.unidad_id
      );
    if faltan is not null then
      raise exception 'En el esquema % participan unidades que no están en su esquema base: %',
        e.codigo, faltan;
    end if;

    select sum(b.valor) into total
    from public.coeficiente as c
    join public.coeficiente as b
      on b.unidad_id = c.unidad_id and b.esquema_id = e.esquema_base_id
    where c.esquema_id = e.id;

    -- Un esquema derivado todavía sin unidades no tiene nada que calcular.
    if total is not null then
      if total = 0 then
        raise exception 'El esquema % deriva de uno cuyos participantes suman 0', e.codigo;
      end if;
      update public.coeficiente as c set valor = b.valor / total
      from public.coeficiente as b
      where c.esquema_id = e.id
        and b.esquema_id = e.esquema_base_id
        and b.unidad_id = c.unidad_id;
    end if;
  end if;

  for hijo in
    select id from public.esquema_coeficiente where esquema_base_id = e.id
  loop
    perform private.recalcular_esquema_en_cascada(hijo, p_visitados || e.id);
  end loop;
end;
$$;

create or replace function public.recalcular_esquema(p_esquema uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Solo la administración puede recalcular esquemas';
  end if;
  perform private.recalcular_esquema_en_cascada(p_esquema, array[]::uuid[]);
end;
$$;

-- Devuelve lo que suma el esquema si cierra en 1 dentro de su tolerancia; si no,
-- lanza una excepción. Sin `p_tol` usa la tolerancia propia del esquema.
create or replace function public.validar_esquema(p_esquema uuid, p_tol numeric default null)
returns numeric language plpgsql security invoker set search_path = '' as $$
declare
  e public.esquema_coeficiente;
  suma numeric;
  cantidad integer;
  tolerancia numeric;
begin
  select * into e from public.esquema_coeficiente where id = p_esquema;
  if not found then
    raise exception 'El esquema no existe o no tenés permiso para verlo';
  end if;
  tolerancia := coalesce(p_tol, e.tolerancia);

  select coalesce(sum(valor), 0), count(*) into suma, cantidad
  from public.coeficiente where esquema_id = e.id;

  if cantidad = 0 then
    raise exception 'El esquema % no tiene unidades', e.codigo;
  end if;
  if abs(suma - 1) > tolerancia then
    raise exception 'El esquema % suma % (debe sumar 1 ± %)', e.codigo, round(suma, 6), tolerancia;
  end if;
  return suma;
end;
$$;

create or replace function public.crear_esquema(
  p_edificio uuid,
  p_codigo text,
  p_nombre text,
  p_metodo text default 'manual',
  p_base uuid default null,
  p_desde date default current_date,
  p_tolerancia numeric default 0.0001
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  nuevo uuid;
begin
  if not private.is_admin() then
    raise exception 'Solo la administración puede crear esquemas';
  end if;
  insert into public.esquema_coeficiente
    (edificio_id, codigo, nombre, metodo, esquema_base_id, vigente_desde, tolerancia)
  values (p_edificio, upper(btrim(p_codigo)), btrim(p_nombre), p_metodo, p_base,
          coalesce(p_desde, current_date), coalesce(p_tolerancia, 0.0001))
  returning id into nuevo;
  return nuevo;
end;
$$;

-- Reemplaza los participantes de un esquema en borrador por la lista recibida:
--   [{"unidad_id": "...", "valor": 0.0646, "peso": 1}, ...]
-- `valor` solo se usa en los manuales; `peso`, en partes iguales. Después
-- recalcula los derivados y los de partes iguales. NO exige que sume 1: un
-- borrador se puede guardar a medias. Devuelve lo que suma ahora.
create or replace function public.guardar_coeficientes(p_esquema uuid, p_filas jsonb)
returns numeric language plpgsql security invoker set search_path = '' as $$
declare
  e public.esquema_coeficiente;
  suma numeric;
begin
  if not private.is_admin() then
    raise exception 'Solo la administración puede cargar coeficientes';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' then
    raise exception 'Las filas tienen que venir como una lista';
  end if;

  select * into e from public.esquema_coeficiente where id = p_esquema;
  if not found then
    raise exception 'El esquema no existe';
  end if;
  if e.estado = 'publicado' then
    raise exception 'El esquema % está publicado: despublicalo para modificarlo', e.codigo;
  end if;

  if (select count(*) <> count(distinct x.unidad_id)
      from jsonb_to_recordset(p_filas) as x (unidad_id uuid)) then
    raise exception 'Hay una unidad repetida en la lista';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_filas) as x (unidad_id uuid)
    where x.unidad_id is null
       or not exists (
         select 1 from public.unidad_funcional as u
         where u.id = x.unidad_id and u.edificio_id = e.edificio_id
       )
  ) then
    raise exception 'Hay unidades que no existen o no son de este edificio';
  end if;

  delete from public.coeficiente
  where esquema_id = e.id
    and unidad_id not in (
      select x.unidad_id from jsonb_to_recordset(p_filas) as x (unidad_id uuid)
    );

  insert into public.coeficiente (esquema_id, unidad_id, edificio_id, valor, peso)
  select e.id, x.unidad_id, e.edificio_id, coalesce(x.valor, 0), coalesce(x.peso, 1)
  from jsonb_to_recordset(p_filas) as x (unidad_id uuid, valor numeric, peso numeric)
  on conflict (esquema_id, unidad_id) do update
    set valor = case when e.metodo = 'manual' then excluded.valor
                     else public.coeficiente.valor end,
        peso = excluded.peso;

  perform private.recalcular_esquema_en_cascada(e.id, array[]::uuid[]);

  select coalesce(sum(valor), 0) into suma
  from public.coeficiente where esquema_id = e.id;
  return suma;
end;
$$;

-- Recalcula, valida y publica. Un derivado solo se publica si su base ya está
-- publicada.
create or replace function public.publicar_esquema(p_esquema uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  e public.esquema_coeficiente;
begin
  if not private.is_admin() then
    raise exception 'Solo la administración puede publicar esquemas';
  end if;
  select * into e from public.esquema_coeficiente where id = p_esquema;
  if not found then
    raise exception 'El esquema no existe';
  end if;
  if e.estado = 'publicado' then
    return;
  end if;
  if e.metodo = 'derivado' and not exists (
    select 1 from public.esquema_coeficiente as b
    where b.id = e.esquema_base_id and b.estado = 'publicado'
  ) then
    raise exception 'El esquema % deriva de otro que todavía no está publicado: publicá primero la base', e.codigo;
  end if;

  perform private.recalcular_esquema_en_cascada(e.id, array[]::uuid[]);
  perform public.validar_esquema(e.id);

  perform set_config('app.cambio_estado_esquema', 'on', true);
  update public.esquema_coeficiente
  set estado = 'publicado', publicado_en = now()
  where id = e.id;
  perform set_config('app.cambio_estado_esquema', '', true);
end;
$$;

create or replace function public.despublicar_esquema(p_esquema uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  e public.esquema_coeficiente;
begin
  if not private.is_admin() then
    raise exception 'Solo la administración puede despublicar esquemas';
  end if;
  select * into e from public.esquema_coeficiente where id = p_esquema;
  if not found then
    raise exception 'El esquema no existe';
  end if;
  if exists (
    select 1 from public.esquema_coeficiente as h
    where h.esquema_base_id = e.id and h.estado = 'publicado'
  ) then
    raise exception 'Hay esquemas publicados que derivan de %: despublicalos primero', e.codigo;
  end if;

  perform set_config('app.cambio_estado_esquema', 'on', true);
  update public.esquema_coeficiente
  set estado = 'borrador', publicado_en = null
  where id = e.id;
  perform set_config('app.cambio_estado_esquema', '', true);
end;
$$;

revoke execute on function public.recalcular_esquema(uuid) from public, anon;
revoke execute on function public.validar_esquema(uuid, numeric) from public, anon;
revoke execute on function public.crear_esquema(uuid, text, text, text, uuid, date, numeric)
  from public, anon;
revoke execute on function public.guardar_coeficientes(uuid, jsonb) from public, anon;
revoke execute on function public.publicar_esquema(uuid) from public, anon;
revoke execute on function public.despublicar_esquema(uuid) from public, anon;
grant execute on function public.recalcular_esquema(uuid) to authenticated;
grant execute on function public.validar_esquema(uuid, numeric) to authenticated;
grant execute on function public.crear_esquema(uuid, text, text, text, uuid, date, numeric)
  to authenticated;
grant execute on function public.guardar_coeficientes(uuid, jsonb) to authenticated;
grant execute on function public.publicar_esquema(uuid) to authenticated;
grant execute on function public.despublicar_esquema(uuid) to authenticated;

revoke execute on function private.recalcular_esquema_en_cascada(uuid, uuid[])
  from public, anon;
grant execute on function private.recalcular_esquema_en_cascada(uuid, uuid[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Migración de lo que ya había: porcentaje_fiscal → esquema GENERAL (borrador)
--    valor = porcentaje / 100. Las unidades con 0 no participan (no tienen fila).
--    Solo en edificios que todavía no tienen un esquema GENERAL, así se puede
--    volver a correr sin duplicar nada.
-- ---------------------------------------------------------------------------

do $$
declare
  ed record;
  esquema uuid;
begin
  for ed in
    select u.edificio_id,
           count(*) as unidades,
           sum(u.porcentaje_fiscal) as porcentaje
    from public.unidad_funcional as u
    where u.porcentaje_fiscal > 0 and u.porcentaje_fiscal <= 100
      and not exists (
        select 1 from public.esquema_coeficiente as e
        where e.edificio_id = u.edificio_id and e.codigo = 'GENERAL'
      )
    group by u.edificio_id
  loop
    insert into public.esquema_coeficiente (edificio_id, codigo, nombre, metodo)
    values (ed.edificio_id, 'GENERAL', 'General', 'manual')
    returning id into esquema;

    insert into public.coeficiente (esquema_id, unidad_id, edificio_id, valor)
    select esquema, u.id, u.edificio_id, round(u.porcentaje_fiscal / 100, 10)
    from public.unidad_funcional as u
    where u.edificio_id = ed.edificio_id
      and u.porcentaje_fiscal > 0 and u.porcentaje_fiscal <= 100;

    if abs(ed.porcentaje - 100) > 0.01 then
      raise notice 'Edificio %: el GENERAL migrado suma % por ciento (queda en borrador)',
        ed.edificio_id, round(ed.porcentaje, 4);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
