-- Anuncios por edificio. Los publica un admin desde la pantalla de cada
-- edificio; los ven los admins y quienes tienen una unidad vigente en ese
-- edificio. anuncio_lecturas guarda qué anuncios leyó cada persona, y de ahí
-- sale el aviso de la campanita (no hace falta una notificación por persona).
begin;

create table public.anuncios (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references public.edificio (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  contenido text not null check (char_length(btrim(contenido)) between 1 and 4000),
  creado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

-- La lista de un edificio siempre va de más nuevo a más viejo.
create index anuncios_edificio_creado_idx
  on public.anuncios (edificio_id, creado_en desc);
create index anuncios_creado_por_idx on public.anuncios (creado_por);

create table public.anuncio_lecturas (
  anuncio_id uuid not null references public.anuncios (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  leido_en timestamptz not null default now(),
  primary key (anuncio_id, usuario_id)
);

create index anuncio_lecturas_usuario_idx
  on public.anuncio_lecturas (usuario_id);

alter table public.anuncios enable row level security;
alter table public.anuncio_lecturas enable row level security;

-- Permisos de tabla: RLS decide qué filas; esto decide qué operaciones.
revoke all on public.anuncios, public.anuncio_lecturas from anon;
revoke truncate, trigger, references
  on public.anuncios, public.anuncio_lecturas from authenticated;
grant select, insert, delete on public.anuncios to authenticated;
-- Un anuncio publicado solo puede cambiar su texto: no se mueve de edificio
-- ni cambia de autor.
revoke update on public.anuncios from authenticated;
grant update (titulo, contenido) on public.anuncios to authenticated;
-- Marcar como leído es agregar una fila: nunca se edita ni se borra desde la app.
grant select, insert on public.anuncio_lecturas to authenticated;
revoke update, delete on public.anuncio_lecturas from authenticated;

-- Anuncios: lectura para admins y vecinos del edificio; el resto, solo admins.
create policy "anuncios_select" on public.anuncios for select to authenticated
  using (private.is_admin() or private.usuario_en_edificio(edificio_id));
create policy "anuncios_insert_admin" on public.anuncios for insert to authenticated
  with check (private.is_admin() and creado_por = (select auth.uid()));
create policy "anuncios_update_admin" on public.anuncios for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "anuncios_delete_admin" on public.anuncios for delete to authenticated
  using (private.is_admin());

-- Lecturas: cada persona ve solo las suyas y solo puede marcar como leído un
-- anuncio que tiene permiso de ver (el EXISTS respeta la política anuncios_select).
create policy "anuncio_lecturas_select" on public.anuncio_lecturas for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "anuncio_lecturas_insert" on public.anuncio_lecturas for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (select 1 from public.anuncios as a where a.id = anuncio_id)
  );

notify pgrst, 'reload schema';

commit;
