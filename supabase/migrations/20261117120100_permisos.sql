-- Permisos, RLS de lectura y Realtime (S1). Ninguna escritura directa: solo las funciones de S2.

-- Las tablas que se creen en el futuro nacen cerradas para la API. service_role conserva sus permisos.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- anon no tiene ningún permiso; authenticated solo lee (y aun así filtrado por la RLS).
revoke all on public.diagrams, public.diagram_members, public.diagram_invites, public.diagram_ops
  from anon, authenticated;
grant select on public.diagrams, public.diagram_members, public.diagram_invites, public.diagram_ops
  to authenticated;

alter table public.diagrams enable row level security;
alter table public.diagram_members enable row level security;
alter table public.diagram_invites enable row level security;
alter table public.diagram_ops enable row level security;

-- Rol del usuario actual en un diagrama, o null si no es miembro. Un diagrama en la papelera
-- (deleted_at) solo lo ve su dueño. security definer para que las políticas de diagram_members
-- no se consulten a sí mismas.
create function public.member_role(p_diagram_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.diagram_members m
  join public.diagrams d on d.id = m.diagram_id
  where m.diagram_id = p_diagram_id
    and m.user_id = (select auth.uid())
    and (d.deleted_at is null or m.role = 'owner')
$$;

revoke execute on function public.member_role(uuid) from public, anon;
grant execute on function public.member_role(uuid) to authenticated;

create policy diagrams_lectura on public.diagrams
  for select to authenticated using (public.member_role(id) is not null);

create policy diagram_members_lectura on public.diagram_members
  for select to authenticated using (public.member_role(diagram_id) is not null);

create policy diagram_invites_lectura on public.diagram_invites
  for select to authenticated using (public.member_role(diagram_id) = 'owner');

create policy diagram_ops_lectura on public.diagram_ops
  for select to authenticated using (public.member_role(diagram_id) is not null);
