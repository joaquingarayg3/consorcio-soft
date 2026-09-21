-- Impide que usuarios comunes eleven privilegios o reactiven cuentas.
alter table public.perfiles enable row level security;

drop policy if exists "Usuarios pueden ver su perfil" on public.perfiles;
drop policy if exists "Usuarios pueden actualizar su perfil" on public.perfiles;
create policy "Usuarios pueden ver su perfil" on public.perfiles
for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Usuarios pueden actualizar su perfil" on public.perfiles
for update to authenticated using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create or replace function public.proteger_campos_privados_perfil()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    and not public.is_admin()
    and (new.rol is distinct from old.rol or new.activo is distinct from old.activo) then
    raise exception 'No podes modificar el rol o estado de un perfil';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_campos_privados_perfil() from public, anon, authenticated;
drop trigger if exists proteger_campos_privados_perfil_trigger on public.perfiles;
create trigger proteger_campos_privados_perfil_trigger before update on public.perfiles
for each row execute function public.proteger_campos_privados_perfil();
notify pgrst, 'reload schema';
