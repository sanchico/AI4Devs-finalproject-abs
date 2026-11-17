// Datos de prueba preparados con la clave de servicio (hasta S2 no hay funciones de escritura).
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
