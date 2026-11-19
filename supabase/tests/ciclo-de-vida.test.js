// Ciclo de vida del diagrama (S2): create_diagram, delete_diagram y restore_diagram.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { anonimo, usuario, sql } from './helpers/entorno.js';
import { db, escenario, leer } from './helpers/datos.js';

after(() => sql.end());

const PERMISO_DENEGADO = '42501';

// Llama a una función y comprueba que termina sin error; devuelve los datos
async function llamar(cliente, nombre, args) {
  const { data, error } = await cliente.rpc(nombre, args);
  assert.equal(error, null, `${nombre}: ${error?.message}`);
  return data;
}
// Comprueba que la llamada se rechaza con ese estado HTTP y esa clave estable
async function rechaza(cliente, nombre, args, estado, clave) {
  const { data, error, status } = await cliente.rpc(nombre, args);
  assert.equal(status, estado, `${nombre}: estado ${status}`);
  assert.equal(error?.code, `PT${estado}`, nombre);
  assert.equal(error?.message, clave, nombre);
  assert.equal(data, null, nombre);
}

// ---------- create_diagram ----------
test('crear un diagrama de estados: valores por defecto, único dueño y correo como nombre visible', async () => {
  const u = await usuario();
  const id = await llamar(u.cliente, 'create_diagram', { p_kind: 'state' });
  assert.match(id, /^[0-9a-f-]{36}$/);
  const [d] = await leer(u.cliente, 'diagrams', id);
  assert.equal(d.title, 'Diagrama sin título');
  assert.equal(d.kind, 'state');
  assert.equal(d.direction, 'TD');
  assert.equal(d.last_seq, 0);
  assert.equal(d.deleted_at, null);
  assert.equal(d.owner_id, u.id);
  const miembros = await leer(db, 'diagram_members', id);
  assert.deepEqual(miembros.map(m => [m.user_id, m.role, m.display_name]), [[u.id, 'owner', u.correo]]);
  assert.deepEqual(await leer(db, 'diagram_ops', id), []);
});

test('crear un diagrama de flujo', async () => {
  const u = await usuario();
  const id = await llamar(u.cliente, 'create_diagram', { p_kind: 'flow' });
  const [d] = await leer(u.cliente, 'diagrams', id);
  assert.equal(d.kind, 'flow');
});

test('un tipo desconocido se rechaza con 422 y no crea nada', async () => {
  const u = await usuario();
  for (const kind of ['class', '', null]) {
    await rechaza(u.cliente, 'create_diagram', { p_kind: kind }, 422, 'invalid_op');
  }
  const { data } = await db.from('diagrams').select('id').eq('owner_id', u.id);
  assert.deepEqual(data, []);
  assert.deepEqual((await db.from('diagram_members').select('diagram_id').eq('user_id', u.id)).data, []);
});

test('sin sesión no se puede crear un diagrama', async () => {
  const { data, error } = await anonimo().rpc('create_diagram', { p_kind: 'flow' });
  assert.equal(error?.code, PERMISO_DENEGADO);
  assert.equal(data, null);
});

// ---------- delete_diagram y restore_diagram ----------
test('el dueño borra: el editor deja de ver el diagrama y el dueño lo sigue viendo con la fecha', async () => {
  const { dueno, editor, diagrama } = await escenario();
  await llamar(dueno.cliente, 'delete_diagram', { p_diagram_id: diagrama.id });
  for (const tabla of ['diagrams', 'diagram_members', 'diagram_ops']) {
    assert.deepEqual(await leer(editor.cliente, tabla, diagrama.id), [], tabla);
  }
  const [visto] = await leer(dueno.cliente, 'diagrams', diagrama.id);
  assert.ok(visto.deleted_at);
});

test('un editor y un lector no pueden borrar ni restaurar: 403', async () => {
  const { editor, lector, diagrama } = await escenario();
  for (const m of [editor, lector]) {
    await rechaza(m.cliente, 'delete_diagram', { p_diagram_id: diagrama.id }, 403, 'forbidden');
    await rechaza(m.cliente, 'restore_diagram', { p_diagram_id: diagrama.id }, 403, 'forbidden');
  }
  const [d] = await leer(db, 'diagrams', diagrama.id);
  assert.equal(d.deleted_at, null);
});

test('un ajeno recibe 404 al borrar o restaurar, igual que con un diagrama que no existe', async () => {
  const { ajeno, diagrama } = await escenario();
  await rechaza(ajeno.cliente, 'delete_diagram', { p_diagram_id: diagrama.id }, 404, 'not_found');
  await rechaza(ajeno.cliente, 'restore_diagram', { p_diagram_id: diagrama.id }, 404, 'not_found');
  await rechaza(ajeno.cliente, 'delete_diagram', { p_diagram_id: crypto.randomUUID() }, 404, 'not_found');
  const [d] = await leer(db, 'diagrams', diagrama.id);
  assert.equal(d.deleted_at, null);
});

test('sin sesión no se puede borrar ni restaurar', async () => {
  const { diagrama } = await escenario();
  for (const nombre of ['delete_diagram', 'restore_diagram']) {
    const { error } = await anonimo().rpc(nombre, { p_diagram_id: diagrama.id });
    assert.equal(error?.code, PERMISO_DENEGADO, nombre);
  }
});

test('borrar dos veces no da error y la fecha de borrado no cambia', async () => {
  const { dueno, diagrama } = await escenario();
  await llamar(dueno.cliente, 'delete_diagram', { p_diagram_id: diagrama.id });
  const [primera] = await leer(dueno.cliente, 'diagrams', diagrama.id);
  await llamar(dueno.cliente, 'delete_diagram', { p_diagram_id: diagrama.id });
  const [segunda] = await leer(dueno.cliente, 'diagrams', diagrama.id);
  assert.equal(segunda.deleted_at, primera.deleted_at);
});

test('restaurar devuelve el diagrama intacto, con sus operaciones, miembros e invitaciones', async () => {
  const { dueno, editor, diagrama } = await escenario();
  const antes = {
    ops: (await leer(editor.cliente, 'diagram_ops', diagrama.id)).map(o => [o.seq, o.op_id]),
    miembros: (await leer(editor.cliente, 'diagram_members', diagrama.id)).map(m => m.user_id).sort(),
  };
  await llamar(dueno.cliente, 'delete_diagram', { p_diagram_id: diagrama.id });
  // Borrar no pierde nada, aunque nadie más lo vea
  assert.equal((await leer(db, 'diagram_ops', diagrama.id)).length, 2);
  assert.equal((await leer(db, 'diagram_members', diagrama.id)).length, 3);
  assert.equal((await leer(db, 'diagram_invites', diagrama.id)).length, 1);

  await llamar(dueno.cliente, 'restore_diagram', { p_diagram_id: diagrama.id });
  const [d] = await leer(editor.cliente, 'diagrams', diagrama.id);
  assert.equal(d.deleted_at, null);
  assert.deepEqual((await leer(editor.cliente, 'diagram_ops', diagrama.id)).map(o => [o.seq, o.op_id]), antes.ops);
  assert.deepEqual((await leer(editor.cliente, 'diagram_members', diagrama.id)).map(m => m.user_id).sort(), antes.miembros);
  assert.equal((await leer(db, 'diagram_invites', diagrama.id)).length, 1);
});

test('restaurar un diagrama que no está borrado no da error y no cambia nada', async () => {
  const { dueno, diagrama } = await escenario();
  const [antes] = await leer(dueno.cliente, 'diagrams', diagrama.id);
  await llamar(dueno.cliente, 'restore_diagram', { p_diagram_id: diagrama.id });
  const [despues] = await leer(dueno.cliente, 'diagrams', diagrama.id);
  assert.deepEqual(despues, antes);
});

test('el diagrama creado con create_diagram se puede borrar y restaurar por su dueño', async () => {
  const u = await usuario();
  const id = await llamar(u.cliente, 'create_diagram', { p_kind: 'flow' });
  await llamar(u.cliente, 'delete_diagram', { p_diagram_id: id });
  assert.ok((await leer(u.cliente, 'diagrams', id))[0].deleted_at);
  await llamar(u.cliente, 'restore_diagram', { p_diagram_id: id });
  assert.equal((await leer(u.cliente, 'diagrams', id))[0].deleted_at, null);
});
