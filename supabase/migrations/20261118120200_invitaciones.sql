-- Funciones de servidor, parte 3 (S2): invitaciones.
-- El dueño crea un enlace con un rol (editor o lector); quien lo abre con sesión se añade como miembro.

-- Crea una invitación y devuelve su token: 32 bytes aleatorios en hexadecimal (64 caracteres), con caducidad de
-- 7 días. Solo el dueño de un diagrama vivo (401, 404, 403 y 410 los da la comprobación del rol).
create function public.create_invite(p_diagram_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  perform public.diagram_role_or_fail(p_diagram_id, array['owner']);
  if p_role is null or p_role not in ('editor', 'viewer') then
    perform public.raise_api_error(422, 'invalid_op', 'role');
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.diagram_invites (token, diagram_id, role, created_by, expires_at)
  values (v_token, p_diagram_id, p_role, (select auth.uid()), now() + interval '7 days');
  return v_token;
end
$$;

-- Acepta una invitación y devuelve el diagrama. La invitación se puede usar varias veces hasta que caduque.
-- Quien ya es miembro conserva su rol (el dueño que abre su propio enlace sigue siendo dueño) y repetir la
-- aceptación no falla ni duplica. Un token desconocido y uno caducado dan el mismo error.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_diagram uuid;
  v_role text;
  v_expires timestamptz;
  v_deleted timestamptz;
begin
  if v_uid is null then
    perform public.raise_api_error(401, 'no_session');
  end if;
  select i.diagram_id, i.role, i.expires_at, d.deleted_at into v_diagram, v_role, v_expires, v_deleted
  from public.diagram_invites i
  join public.diagrams d on d.id = i.diagram_id
  where i.token = p_token;
  if not found or v_expires <= now() then
    perform public.raise_api_error(404, 'invite_invalid');
  end if;
  if v_deleted is not null then
    perform public.raise_api_error(410, 'diagram_deleted');
  end if;
  insert into public.diagram_members (diagram_id, user_id, role, display_name)
  values (v_diagram, v_uid, v_role, (select auth.jwt() ->> 'email'))
  on conflict (diagram_id, user_id) do nothing;
  return v_diagram;
end
$$;

revoke all on function public.create_invite(uuid, text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.create_invite(uuid, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
