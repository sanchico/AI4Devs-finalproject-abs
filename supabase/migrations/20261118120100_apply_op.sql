-- Funciones de servidor, parte 2 (S2): apply_op y la validación de la forma de la operación.
-- El servidor NO interpreta el grafo (apply solo existe en JavaScript): valida únicamente lo que protege
-- a los clientes y a las copias de `diagrams`. Las reglas de longitud y de blancos son las de frontend/ops.js,
-- ni más estrictas ni más laxas, para que lo que el servidor copia a la ficha sea siempre lo que los
-- clientes aceptan al reproducir el registro.

-- Longitud en unidades UTF-16, que es lo que cuenta String.length en JavaScript: char_length cuenta puntos de
-- código, así que un carácter fuera del plano básico (un emoji) cuenta 1 allí y 2 en el cliente.
create function public.utf16_length(p_text text)
returns int
language sql
immutable
set search_path = ''
as $$
  select char_length(p_text) + char_length(regexp_replace(p_text, '[^\U00010000-\U0010ffff]', '', 'g'))
$$;

-- ¿Solo blancos, según String.prototype.trim de JavaScript? (btrim solo quita espacios.)
create function public.is_blank(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_text ~ '^[ \t\n\v\f\r   -     　﻿]*$'
$$;

-- Una etiqueta presente debe ser texto de 200 unidades como máximo (vacía vale).
create function public.label_ok(p_obj jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not (p_obj ? 'label')
         or (jsonb_typeof(p_obj -> 'label') = 'string' and public.utf16_length(p_obj ->> 'label') <= 200)
$$;

create function public.is_text(p_obj jsonb, p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_obj -> p_key) = 'string'
$$;

-- Rechaza con 422 (invalid_op) una operación mal formada. No mira el grafo.
create function public.validate_op(p_op jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_type text;
  v_obj jsonb;
  v_ok boolean;
begin
  if p_op is null or jsonb_typeof(p_op) <> 'object' then
    perform public.raise_api_error(422, 'invalid_op', 'la operación no es un objeto');
  end if;
  if octet_length(p_op::text) > 2048 then
    perform public.raise_api_error(422, 'invalid_op', 'la operación ocupa más de 2 kB');
  end if;
  v_type := case when jsonb_typeof(p_op -> 'type') = 'string' then p_op ->> 'type' end;

  v_ok := case v_type
    -- node con id de texto
    when 'addNode' then
      jsonb_typeof(p_op -> 'node') = 'object' and public.is_text(p_op -> 'node', 'id')
      and public.label_ok(p_op -> 'node')
    -- edge con id, from y to de texto
    when 'addEdge' then
      jsonb_typeof(p_op -> 'edge') = 'object' and public.is_text(p_op -> 'edge', 'id')
      and public.is_text(p_op -> 'edge', 'from') and public.is_text(p_op -> 'edge', 'to')
      and public.label_ok(p_op -> 'edge')
    -- id de texto y set objeto
    when 'updateNode' then
      public.is_text(p_op, 'id') and jsonb_typeof(p_op -> 'set') = 'object' and public.label_ok(p_op -> 'set')
    when 'updateEdge' then
      public.is_text(p_op, 'id') and jsonb_typeof(p_op -> 'set') = 'object' and public.label_ok(p_op -> 'set')
    when 'removeNode' then public.is_text(p_op, 'id')
    when 'removeEdge' then public.is_text(p_op, 'id')
    -- el tipo se fija al crear (kind se rechaza entero); título y dirección válidos
    when 'setMeta' then
      jsonb_typeof(p_op -> 'set') = 'object'
      and not (p_op -> 'set' ? 'kind')
      and (not (p_op -> 'set' ? 'title')
           or (public.is_text(p_op -> 'set', 'title')
               and not public.is_blank(p_op -> 'set' ->> 'title')
               and public.utf16_length(p_op -> 'set' ->> 'title') <= 200))
      and (not (p_op -> 'set' ? 'dir') or (p_op -> 'set' ->> 'dir') in ('TD', 'LR'))
    else false
  end;

  if v_ok is distinct from true then
    perform public.raise_api_error(422, 'invalid_op', 'operación mal formada o de tipo desconocido');
  end if;
end
$$;

-- Autoriza, valida, numera y guarda una operación; devuelve su secuencia.
-- Las comprobaciones baratas van antes del bloqueo de la fila para que un ajeno, un lector o una operación
-- inválida no la tomen. El bloqueo dura hasta el final de la transacción: las filas de un diagrama se
-- confirman en orden de seq y Realtime (que lee el WAL en orden de commit) las entrega en ese orden.
create function public.apply_op(p_diagram_id uuid, p_op_id uuid, p_op jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_deleted timestamptz;
  v_last bigint;
  v_seq bigint;
  v_type text;
begin
  -- 401 sin sesión, 404 no es miembro, 403 lector, 410 diagrama borrado
  perform public.diagram_role_or_fail(p_diagram_id, array['owner', 'editor']);
  if p_op_id is null then
    perform public.raise_api_error(422, 'invalid_op', 'falta el op_id');
  end if;
  perform public.validate_op(p_op);

  -- A partir de aquí, las escrituras de este diagrama van en cola
  select d.deleted_at, d.last_seq into v_deleted, v_last
  from public.diagrams d where d.id = p_diagram_id for update;
  if v_deleted is not null then
    perform public.raise_api_error(410, 'diagram_deleted');   -- borrado mientras esperaba
  end if;

  -- Reintento: la misma secuencia, sin guardar nada (antes del tope: reenviar la última siempre vale)
  select o.seq into v_seq from public.diagram_ops o where o.diagram_id = p_diagram_id and o.op_id = p_op_id;
  if found then
    return v_seq;
  end if;

  if v_last >= 5000 then
    perform public.raise_api_error(409, 'op_limit');
  end if;

  v_type := p_op ->> 'type';
  update public.diagrams d
  set last_seq = d.last_seq + 1,
      updated_at = now(),
      title = case when v_type = 'setMeta' and p_op -> 'set' ? 'title' then p_op -> 'set' ->> 'title' else d.title end,
      direction = case when v_type = 'setMeta' and p_op -> 'set' ? 'dir' then p_op -> 'set' ->> 'dir' else d.direction end
  where d.id = p_diagram_id
  returning d.last_seq into v_seq;

  insert into public.diagram_ops (diagram_id, seq, user_id, op_id, op)
  values (p_diagram_id, v_seq, v_uid, p_op_id, p_op);
  return v_seq;
end
$$;

-- Solo apply_op se expone; las auxiliares no reciben grant.
revoke all on function public.apply_op(uuid, uuid, jsonb) from public, anon;
grant execute on function public.apply_op(uuid, uuid, jsonb) to authenticated;
