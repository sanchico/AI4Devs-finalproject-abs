-- Funciones de servidor, parte 1 (S2): errores y ciclo de vida del diagrama.
-- Toda escritura en las tablas pasa por funciones `security definer`, que se saltan la RLS: cada
-- comprobación de permisos es manual. `search_path` vacío: todo va cualificado (public., auth.).
-- Los parámetros llevan el prefijo p_ para no chocar con los nombres de las columnas.

-- Rechazo con un estado HTTP y una clave estable. PostgREST convierte el SQLSTATE `PTxyz` en la
-- respuesta HTTP `xyz` y devuelve `message` (la clave), `details` y `code`. Auxiliar interna: sin grant.
create function public.raise_api_error(p_status int, p_key text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- RAISE no admite un detail nulo
  raise exception using errcode = 'PT' || p_status::text, message = p_key, detail = coalesce(p_detail, '');
end
$$;

-- Comprueba que el usuario actual es miembro del diagrama con uno de los roles dados y devuelve su rol.
-- Lee diagram_members directamente (no member_role, que oculta un diagrama borrado a quien no es dueño):
-- a un miembro de un diagrama borrado hay que decirle que está borrado.
--   sin sesión -> 401 · no es miembro o no existe -> 404 · rol insuficiente -> 403 · borrado -> 410
create function public.diagram_role_or_fail(p_diagram_id uuid, p_roles text[], p_allow_deleted boolean default false)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_deleted timestamptz;
begin
  if v_uid is null then
    perform public.raise_api_error(401, 'no_session');
  end if;
  select m.role, d.deleted_at into v_role, v_deleted
  from public.diagram_members m
  join public.diagrams d on d.id = m.diagram_id
  where m.diagram_id = p_diagram_id and m.user_id = v_uid;
  if not found then
    perform public.raise_api_error(404, 'not_found');
  end if;
  if not (v_role = any (p_roles)) then
    perform public.raise_api_error(403, 'forbidden');
  end if;
  if v_deleted is not null and not p_allow_deleted then
    perform public.raise_api_error(410, 'diagram_deleted');
  end if;
  return v_role;
end
$$;

-- Crea un diagrama vacío ("Diagrama sin título", dirección TD) y a su dueño como miembro.
create function public.create_diagram(p_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    perform public.raise_api_error(401, 'no_session');
  end if;
  if p_kind is null or p_kind not in ('flow', 'state') then
    perform public.raise_api_error(422, 'invalid_op', 'kind');
  end if;
  insert into public.diagrams (owner_id, kind) values (v_uid, p_kind) returning id into v_id;
  insert into public.diagram_members (diagram_id, user_id, role, display_name)
  values (v_id, v_uid, 'owner', (select auth.jwt() ->> 'email'));
  return v_id;
end
$$;

-- Borrado lógico: marca deleted_at. Solo el dueño. Repetirlo no hace nada. El bloqueo de la fila ordena el
-- borrado respecto a una apply_op en curso: la operación se guarda antes o recibe diagram_deleted.
create function public.delete_diagram(p_diagram_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.diagram_role_or_fail(p_diagram_id, array['owner'], true);
  perform 1 from public.diagrams d where d.id = p_diagram_id for update;
  update public.diagrams d set deleted_at = now(), updated_at = now()
  where d.id = p_diagram_id and d.deleted_at is null;
end
$$;

-- Quita la marca de borrado. Solo el dueño. Repetirlo no hace nada.
create function public.restore_diagram(p_diagram_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.diagram_role_or_fail(p_diagram_id, array['owner'], true);
  perform 1 from public.diagrams d where d.id = p_diagram_id for update;
  update public.diagrams d set deleted_at = null, updated_at = now()
  where d.id = p_diagram_id and d.deleted_at is not null;
end
$$;

-- Solo los usuarios con sesión las ejecutan. Las auxiliares (raise_api_error, diagram_role_or_fail) no
-- reciben grant: PostgREST no las expone.
revoke all on function public.create_diagram(text) from public, anon;
revoke all on function public.delete_diagram(uuid) from public, anon;
revoke all on function public.restore_diagram(uuid) from public, anon;
grant execute on function public.create_diagram(text) to authenticated;
grant execute on function public.delete_diagram(uuid) to authenticated;
grant execute on function public.restore_diagram(uuid) to authenticated;
