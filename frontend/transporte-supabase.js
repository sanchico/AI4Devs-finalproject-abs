// ---------- Supabase transport: what collab.js needs, on top of a supabase-js client (no DOM; the client is injected) ----------
// collab.js asks for three things (see its header): subscribe, load and send. This is the only module that knows how
// they map onto Supabase: a Realtime channel on `diagram_ops`, three reads, and the `apply_ops` function.
const PAGINA = 1000;          // the API answers at most this many rows per request (`max_rows`)
const MAX_PAGINAS = 10;       // a log holds at most 5 000 operations: more pages than this means something is wrong

// An error that carries the HTTP status the caller needs to explain it (404, 410...); `status` 0 means no answer at all
const error = (mensaje, status) => Object.assign(new Error(mensaje), status > 0 ? { status } : {});
const deLaApi = r => error(r.error.message, r.status);

export function crearTransporte({ client, diagramId, plazo = 10000 }) {
  // Realtime is ready when it sends the `system` message for Postgres Changes with status `ok`, not at SUBSCRIBED:
  // rows written between the two never reach the channel and are not in a log loaded before either.
  async function subscribe(onEntry, onClose) {
    const { data } = await client.auth.getSession();
    if (data?.session) await client.realtime.setAuth(data.session.access_token);
    let canal;
    try {
      await new Promise((resolver, rechazar) => {
        let listo = false, cerrado = false;
        const limite = setTimeout(() => rechazar(error('Realtime: la suscripción no estuvo lista a tiempo')), plazo);
        canal = client.channel(`diagram:${diagramId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diagram_ops', filter: `diagram_id=eq.${diagramId}` },
            payload => onEntry({ seq: payload.new.seq, op_id: payload.new.op_id, op: payload.new.op }))
          .on('system', {}, mensaje => {
            if (mensaje?.extension !== 'postgres_changes' || listo) return;
            if (mensaje.status === 'ok') { listo = true; clearTimeout(limite); resolver(); }
            else if (mensaje.status === 'error') { clearTimeout(limite); rechazar(error(`Realtime: Postgres Changes ${mensaje.status} ${mensaje.message ?? ''}`.trim())); }
          })
          .subscribe((estado, err) => {
            if (estado !== 'CHANNEL_ERROR' && estado !== 'TIMED_OUT' && estado !== 'CLOSED') return;
            if (!listo) { clearTimeout(limite); rechazar(error(`Realtime: ${estado} ${err?.message ?? ''}`.trim())); }
            else if (!cerrado) { cerrado = true; onClose(); }
          });
      });
    } catch (e) {
      if (canal) Promise.resolve(client.removeChannel(canal)).catch(() => {});
      throw e;
    }
  }

  // The diagram's type, the user's role and the whole log, in order. A diagram that does not exist and one the user is not
  // a member of look the same (404): the RLS returns no row in both cases, and the answer must not reveal which.
  async function load() {
    const { data: sesion } = await client.auth.getSession();
    const usuario = sesion?.session?.user?.id;
    if (!usuario) throw error('Sin sesión', 401);

    const d = await client.from('diagrams').select('kind, deleted_at').eq('id', diagramId).maybeSingle();
    if (d.error) throw deLaApi(d);
    if (!d.data) throw error('Sin acceso o no existe', 404);
    if (d.data.deleted_at) throw error('Diagrama borrado', 410);

    const m = await client.from('diagram_members').select('role').eq('diagram_id', diagramId).eq('user_id', usuario).maybeSingle();
    if (m.error) throw deLaApi(m);
    if (!m.data) throw error('Sin acceso o no existe', 404);

    const log = [];
    for (let pagina = 0; ; pagina++) {
      if (pagina >= MAX_PAGINAS) throw error('El registro es más largo de lo posible');
      const r = await client.from('diagram_ops').select('seq, op_id, op').eq('diagram_id', diagramId).order('seq', { ascending: true })
        .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
      if (r.error) throw deLaApi(r);
      for (const { seq, op_id, op } of r.data) log.push({ seq, op_id, op });
      if (r.data.length < PAGINA) break;
    }
    return { kind: d.data.kind, role: m.data.role, log };
  }

  // One gesture in one call. `status: null` = the server never answered, which collab.js retries with the same op_ids.
  async function send(grupo) {
    let r;
    try { r = await client.rpc('apply_ops', { p_diagram_id: diagramId, p_ops: grupo }); } catch { return { ok: false, status: null }; }
    if (!r.error) return { ok: true };
    return { ok: false, status: r.status > 0 ? r.status : null, key: r.error.message };
  }

  return { subscribe, load, send };
}
