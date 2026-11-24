-- apply_ops (F4): un gesto entero (varias operaciones) en una llamada, una transacción y un bloqueo.
-- La lógica vive en write_ops, interna y sin grant (PostgREST no la expone); apply_ops y apply_op solo preparan
-- la entrada, así que los roles, la validación, el reintento y el tope no pueden separarse entre las dos.
-- Igual que apply_op, el servidor NO interpreta el grafo: guarda también lo que los clientes descartarán.

-- Guarda un grupo de operaciones: [{ "op_id": "<uuid>", "op": {...} }, ...]. Devuelve una secuencia por
-- elemento, en el mismo orden. El grupo se guarda entero o no se guarda.
-- Comprobaciones, de las baratas a las que toman el bloqueo de la fila del diagrama:
--   sin sesión -> 401 · no es miembro o no existe -> 404 · lector -> 403 · borrado -> 410
--   grupo mal formado o con una operación inválida -> 422 · registro lleno -> 409
create function public.write_ops(p_diagram_id uuid, p_items jsonb)
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_deleted timestamptz;
  v_last bigint;
  v_op jsonb;
  v_new jsonb;
  v_count int;
  v_seqs bigint[];
begin
  perform public.diagram_role_or_fail(p_diagram_id, array['owner', 'editor']);

  -- Forma del grupo: una lista de 1 a 500 objetos con un op_id (UUID en texto, sin repetir) y una op
  if jsonb_typeof(p_items) is distinct from 'array' then
    perform public.raise_api_error(422, 'invalid_op', 'el grupo no es una lista');
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 500 then
    perform public.raise_api_error(422, 'invalid_op', 'el grupo debe tener entre 1 y 500 operaciones');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) is distinct from 'object'
       or jsonb_typeof(e -> 'op_id') is distinct from 'string'
       or (e ->> 'op_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not (e ? 'op')
  ) then
    perform public.raise_api_error(422, 'invalid_op', 'cada elemento del grupo necesita un op_id (UUID) y una op');
  end if;
  if (select count(distinct lower(e ->> 'op_id')) from jsonb_array_elements(p_items) e) < v_count then
    perform public.raise_api_error(422, 'invalid_op', 'op_id repetido dentro del grupo');
  end if;

  -- Forma de cada operación, antes del bloqueo: un grupo inválido no retiene a nadie
  for v_op in select e -> 'op' from jsonb_array_elements(p_items) e loop
    perform public.validate_op(v_op);
  end loop;

  -- A partir de aquí, las escrituras de este diagrama van en cola
  select d.deleted_at, d.last_seq into v_deleted, v_last
  from public.diagrams d where d.id = p_diagram_id for update;
  if v_deleted is not null then
    perform public.raise_api_error(410, 'diagram_deleted');   -- borrado mientras esperaba
  end if;

  -- Reintento: lo que ya está en el registro conserva su secuencia y no cuenta para el tope
  select coalesce(jsonb_agg(t.e order by t.ord), '[]'::jsonb) into v_new
  from jsonb_array_elements(p_items) with ordinality as t(e, ord)
  where not exists (
    select 1 from public.diagram_ops o
    where o.diagram_id = p_diagram_id and o.op_id = (t.e ->> 'op_id')::uuid
  );
  v_count := jsonb_array_length(v_new);

  if v_count > 0 then
    if v_last + v_count > 5000 then
      perform public.raise_api_error(409, 'op_limit');
    end if;

    -- Solo las nuevas copian título y dirección: reenviar un setMeta viejo no puede devolver la ficha a un valor
    -- anterior. Dentro del grupo gana el último setMeta de cada campo, como al reproducir el registro.
    update public.diagrams d
    set last_seq = d.last_seq + v_count,
        updated_at = now(),
        title = coalesce((
          select t.e -> 'op' -> 'set' ->> 'title'
          from jsonb_array_elements(v_new) with ordinality as t(e, ord)
          where t.e -> 'op' ->> 'type' = 'setMeta' and t.e -> 'op' -> 'set' ? 'title'
          order by t.ord desc limit 1), d.title),
        direction = coalesce((
          select t.e -> 'op' -> 'set' ->> 'dir'
          from jsonb_array_elements(v_new) with ordinality as t(e, ord)
          where t.e -> 'op' ->> 'type' = 'setMeta' and t.e -> 'op' -> 'set' ? 'dir'
          order by t.ord desc limit 1), d.direction)
    where d.id = p_diagram_id;

    insert into public.diagram_ops (diagram_id, seq, user_id, op_id, op)
    select p_diagram_id, v_last + t.ord, v_uid, (t.e ->> 'op_id')::uuid, t.e -> 'op'
    from jsonb_array_elements(v_new) with ordinality as t(e, ord)
    order by t.ord;
  end if;

  -- Una secuencia por elemento del grupo, en su orden (las que ya estaban y las recién guardadas)
  select array_agg(o.seq order by t.ord) into v_seqs
  from jsonb_array_elements(p_items) with ordinality as t(e, ord)
  join public.diagram_ops o on o.diagram_id = p_diagram_id and o.op_id = (t.e ->> 'op_id')::uuid;
  return v_seqs;
end
$$;

-- Guarda un gesto entero y devuelve las secuencias de sus operaciones, en orden.
create function public.apply_ops(p_diagram_id uuid, p_ops jsonb)
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.write_ops(p_diagram_id, p_ops);
end
$$;

-- apply_op: misma firma y mismos errores que antes, ahora como un grupo de una sola operación. Conserva sus
-- permisos (create or replace no los toca). Un op_id nulo, o una operación nula o que no es un objeto, siguen
-- dando 422: llegan a write_ops como un elemento sin op_id válido o con una op que validate_op rechaza.
create or replace function public.apply_op(p_diagram_id uuid, p_op_id uuid, p_op jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  return (public.write_ops(p_diagram_id, jsonb_build_array(jsonb_build_object('op_id', p_op_id, 'op', p_op))))[1];
end
$$;

-- Solo apply_ops (y apply_op) se exponen; write_ops no recibe grant.
revoke all on function public.write_ops(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_ops(uuid, jsonb) from public, anon;
grant execute on function public.apply_ops(uuid, jsonb) to authenticated;
