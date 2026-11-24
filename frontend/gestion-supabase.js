// ---------- Managing diagrams on Supabase: the list, creating one, sharing and accepting an invitation (no DOM; the client is injected) ----------
// The same split as transporte-supabase.js: this is the only place that knows which table or function each action uses, so it is
// testable in Node with a fake client. Every failure is an Error; `status` is the HTTP status when the server answered (403, 404, 410...)
// and is absent when it never did, which is what avisos.js uses to tell a refusal from a lost connection.
const TIPOS = ['flow', 'state'];

const error = (mensaje, status) => Object.assign(new Error(mensaje), status > 0 ? { status } : {});

// A call that may throw (no network) or answer with an error (a refusal): both end as an Error, with or without a status
async function llamar(accion) {
  let r;
  try { r = await accion(); } catch (e) { throw error(e?.message ?? 'Sin respuesta'); }
  if (r.error) throw error(r.error.message, r.status);
  return r.data;
}

// The user's diagrams, newest first. The RLS already limits the rows to the ones the user is a member of; the owner also sees
// the deleted ones, which the list leaves out.
export function listarDiagramas(client) {
  return llamar(() => client.from('diagrams').select('id, title, kind, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }));
}

// An empty diagram of the given type, owned by the user. Returns its id.
export async function crearDiagrama(client, kind) {
  if (!TIPOS.includes(kind)) throw error('Tipo de diagrama desconocido');
  return llamar(() => client.rpc('create_diagram', { p_kind: kind }));
}

// An invitation as editor (the only role the interface offers). Returns the token; only the owner can make one (403).
export function crearInvitacion(client, diagramId) {
  return llamar(() => client.rpc('create_invite', { p_diagram_id: diagramId, p_role: 'editor' }));
}

// Accepts an invitation and returns the id of its diagram. An unknown and an expired token are both a 404.
export function aceptarInvitacion(client, token) {
  return llamar(() => client.rpc('accept_invite', { p_token: token }));
}
