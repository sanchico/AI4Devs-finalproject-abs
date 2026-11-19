// Datos de prueba. escenario() siembra con la clave de servicio, saltándose las funciones (sirve para probar la
// lectura y la RLS); equipo() crea el diagrama con create_diagram, como lo hará la app, y es lo que hay que usar
// para probar las funciones de escritura, porque escenario() no actualiza last_seq.
import { randomUUID } from 'node:crypto';
import { admin, usuario } from './entorno.js';

export const db = admin();

export const operacion = (diagramaId, seq, extra = {}) => ({
  diagram_id: diagramaId, seq, op_id: randomUUID(), op: { type: 'setMeta', set: { dir: 'LR' } }, ...extra,
});

/** Un diagrama con dueño, editor y lector, una invitación y dos operaciones; más un usuario ajeno. */
export async function escenario() {
  const [dueno, editor, lector, ajeno] = await Promise.all([usuario(), usuario(), usuario(), usuario()]);
  const { data: diagrama, error } = await db.from('diagrams').insert({ owner_id: dueno.id, title: 'De prueba' }).select().single();
  if (error) throw error;
  const escribir = async promesa => { const { error: e } = await promesa; if (e) throw e; };
  await escribir(db.from('diagram_members').insert([
    { diagram_id: diagrama.id, user_id: dueno.id, role: 'owner', display_name: dueno.correo },
    { diagram_id: diagrama.id, user_id: editor.id, role: 'editor', display_name: editor.correo },
    { diagram_id: diagrama.id, user_id: lector.id, role: 'viewer', display_name: lector.correo },
  ]));
  const token = randomUUID();
  await escribir(db.from('diagram_invites').insert({
    token, diagram_id: diagrama.id, role: 'editor', created_by: dueno.id, expires_at: new Date(Date.now() + 864e5).toISOString(),
  }));
  await escribir(db.from('diagram_ops').insert([
    operacion(diagrama.id, 1, { user_id: dueno.id }),
    operacion(diagrama.id, 2, { user_id: editor.id }),
  ]));
  return { dueno, editor, lector, ajeno, diagrama, token };
}

/** Lee una tabla filtrando por diagrama con el cliente dado; devuelve las filas (o lanza si hay error). */
export async function leer(cliente, tabla, diagramaId) {
  const columna = tabla === 'diagrams' ? 'id' : 'diagram_id';
  const { data, error } = await cliente.from(tabla).select('*').eq(columna, diagramaId);
  if (error) throw error;
  return data;
}

/** Un diagrama creado con create_diagram por su dueño, más un editor y un lector (añadidos con la clave de servicio, hasta que haya invitaciones) y un ajeno. */
export async function equipo(kind = 'flow') {
  const [dueno, editor, lector, ajeno] = await Promise.all([usuario(), usuario(), usuario(), usuario()]);
  const { data: id, error } = await dueno.cliente.rpc('create_diagram', { p_kind: kind });
  if (error) throw error;
  const { error: e } = await db.from('diagram_members').insert([
    { diagram_id: id, user_id: editor.id, role: 'editor', display_name: editor.correo },
    { diagram_id: id, user_id: lector.id, role: 'viewer', display_name: lector.correo },
  ]);
  if (e) throw e;
  return { dueno, editor, lector, ajeno, id };
}

// ---------- Operaciones de ejemplo (las que envía el cliente) ----------
export const nodo = (id, extra = {}) => ({ type: 'addNode', node: { id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: id, ...extra } });
export const meta = set => ({ type: 'setMeta', set });

/** Envía una operación con un nuevo op_id (o el dado); devuelve la respuesta de supabase-js. */
export const enviar = (usuario, diagramaId, op, opId = randomUUID()) =>
  usuario.cliente.rpc('apply_op', { p_diagram_id: diagramaId, p_op_id: opId, p_op: op });

/** Envía una operación y exige que se guarde; devuelve su secuencia. */
export async function guardar(usuario, diagramaId, op, opId) {
  const { data, error } = await enviar(usuario, diagramaId, op, opId);
  if (error) throw new Error(`apply_op rechazada: ${error.code} ${error.message} ${error.details ?? ''}`);
  return data;
}
