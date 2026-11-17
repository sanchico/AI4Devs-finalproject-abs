// Integridad de los datos guardados y eliminación en cascada. Los datos se preparan con la clave de
// servicio: aquí no se prueban permisos (eso es de lectura.test.js y escritura.test.js).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { admin, usuario, sql } from './helpers/entorno.js';

after(() => sql.end());

const db = admin();

async function crearDiagrama(datos = {}) {
  const dueno = await usuario();
  const { data, error } = await db.from('diagrams').insert({ owner_id: dueno.id, ...datos }).select().single();
  assert.equal(error, null, error?.message);
  return { dueno, diagrama: data };
}

const operacion = (diagrama, seq, extra = {}) =>
  ({ diagram_id: diagrama.id, seq, op_id: randomUUID(), op: { type: 'setMeta', set: { dir: 'LR' } }, ...extra });

test('un diagrama nuevo empieza con los valores por defecto', async () => {
  const { diagrama } = await crearDiagrama();
  assert.equal(diagrama.title, 'Diagrama sin título');
  assert.equal(diagrama.kind, 'flow');
  assert.equal(diagrama.direction, 'TD');
  assert.equal(diagrama.last_seq, 0);
  assert.equal(diagrama.deleted_at, null);
  const { count } = await db.from('diagram_ops').select('*', { count: 'exact', head: true }).eq('diagram_id', diagrama.id);
  assert.equal(count, 0);
});

test('una operación con un op_id repetido se rechaza', async () => {
  const { diagrama } = await crearDiagrama();
  const primera = operacion(diagrama, 1);
  assert.equal((await db.from('diagram_ops').insert(primera)).error, null);
  const { error } = await db.from('diagram_ops').insert(operacion(diagrama, 2, { op_id: primera.op_id }));
  assert.ok(error);
  const { count } = await db.from('diagram_ops').select('*', { count: 'exact', head: true }).eq('diagram_id', diagrama.id);
  assert.equal(count, 1);
});

test('dos operaciones con la misma secuencia se rechazan', async () => {
  const { diagrama } = await crearDiagrama();
  assert.equal((await db.from('diagram_ops').insert(operacion(diagrama, 1))).error, null);
  assert.ok((await db.from('diagram_ops').insert(operacion(diagrama, 1))).error);
});

test('una operación de más de 2 kB se rechaza y una de 2 kB o menos se acepta', async () => {
  const { diagrama } = await crearDiagrama();
  const grande = { type: 'updateNode', id: randomUUID(), set: { label: 'x'.repeat(2100) } };
  assert.ok((await db.from('diagram_ops').insert(operacion(diagrama, 1, { op: grande }))).error);
  const normal = { type: 'updateNode', id: randomUUID(), set: { label: 'x'.repeat(200) } };
  assert.equal((await db.from('diagram_ops').insert(operacion(diagrama, 1, { op: normal }))).error, null);
});

test('una operación que no es un objeto se rechaza', async () => {
  const { diagrama } = await crearDiagrama();
  assert.ok((await db.from('diagram_ops').insert(operacion(diagrama, 1, { op: [1, 2] }))).error);
});

test('el tipo, la dirección y los roles desconocidos se rechazan', async () => {
  const { dueno, diagrama } = await crearDiagrama();
  assert.ok((await db.from('diagrams').insert({ owner_id: dueno.id, kind: 'class' })).error);
  assert.ok((await db.from('diagrams').insert({ owner_id: dueno.id, direction: 'RL' })).error);
  const otro = await usuario();
  assert.ok((await db.from('diagram_members').insert({ diagram_id: diagrama.id, user_id: otro.id, role: 'admin' })).error);
  assert.ok((await db.from('diagram_invites').insert({
    token: randomUUID(), diagram_id: diagrama.id, role: 'owner', created_by: dueno.id, expires_at: new Date(Date.now() + 1e6).toISOString(),
  })).error);
});

test('los títulos vacío, en blanco o de 201 caracteres se rechazan', async () => {
  const dueno = await usuario();
  for (const title of ['', '   ', 'a'.repeat(201)]) {
    assert.ok((await db.from('diagrams').insert({ owner_id: dueno.id, title })).error, `título ${JSON.stringify(title.slice(0, 10))}`);
  }
});

test('los títulos que el cliente acepta se guardan sin cambios', async () => {
  const dueno = await usuario();
  // 100 emojis son 200 unidades UTF-16 (lo que cuenta ops.js) y solo 100 puntos de código.
  for (const title of ['a'.repeat(200), '😀'.repeat(100), '  con espacios al principio']) {
    const { data, error } = await db.from('diagrams').insert({ owner_id: dueno.id, title }).select('title').single();
    assert.equal(error, null, error?.message);
    assert.equal(data.title, title);
  }
});

test('un diagrama no puede tener dos dueños', async () => {
  const { dueno, diagrama } = await crearDiagrama();
  assert.equal((await db.from('diagram_members').insert({ diagram_id: diagrama.id, user_id: dueno.id, role: 'owner' })).error, null);
  const otro = await usuario();
  assert.ok((await db.from('diagram_members').insert({ diagram_id: diagrama.id, user_id: otro.id, role: 'owner' })).error);
});

async function contar(tabla, diagrama) {
  const { count } = await db.from(tabla).select('*', { count: 'exact', head: true }).eq('diagram_id', diagrama.id);
  return count;
}

async function diagramaCompleto() {
  const { dueno, diagrama } = await crearDiagrama();
  const editor = await usuario();
  await db.from('diagram_members').insert([
    { diagram_id: diagrama.id, user_id: dueno.id, role: 'owner' },
    { diagram_id: diagrama.id, user_id: editor.id, role: 'editor' },
  ]);
  await db.from('diagram_invites').insert({
    token: randomUUID(), diagram_id: diagrama.id, role: 'viewer', created_by: dueno.id, expires_at: new Date(Date.now() + 1e6).toISOString(),
  });
  await db.from('diagram_ops').insert([operacion(diagrama, 1, { user_id: dueno.id }), operacion(diagrama, 2, { user_id: editor.id })]);
  return { dueno, editor, diagrama };
}

test('eliminar un diagrama elimina sus miembros, invitaciones y operaciones', async () => {
  const { diagrama } = await diagramaCompleto();
  assert.equal(await contar('diagram_members', diagrama), 2);
  assert.equal((await db.from('diagrams').delete().eq('id', diagrama.id)).error, null);
  for (const tabla of ['diagram_members', 'diagram_invites', 'diagram_ops']) {
    assert.equal(await contar(tabla, diagrama), 0, tabla);
  }
});

test('borrar un usuario deja sus operaciones con el autor vacío en los diagramas ajenos', async () => {
  const { editor, diagrama } = await diagramaCompleto();
  assert.equal((await db.auth.admin.deleteUser(editor.id)).error, null);
  const { data } = await db.from('diagram_ops').select('seq, user_id').eq('diagram_id', diagrama.id).order('seq');
  assert.equal(data.length, 2);
  assert.equal(data[1].user_id, null);
  assert.equal(await contar('diagram_members', diagrama), 1);
});
