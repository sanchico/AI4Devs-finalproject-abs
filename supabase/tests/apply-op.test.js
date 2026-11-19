// apply_op (S2): roles, orden consecutivo, reintentos, tope, copia de setMeta y borrado.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { anonimo, sql } from './helpers/entorno.js';
import { db, equipo, leer, nodo, meta, enviar, guardar } from './helpers/datos.js';

after(() => sql.end());

const PERMISO_DENEGADO = '42501';
const secuencias = async id => (await leer(db, 'diagram_ops', id)).map(o => o.seq).sort((a, b) => a - b);
const ficha = async id => (await leer(db, 'diagrams', id))[0];
const rechazo = (r, estado, clave) => {
  assert.equal(r.status, estado);
  assert.equal(r.error?.code, `PT${estado}`);
  assert.equal(r.error?.message, clave);
  assert.equal(r.data, null);
};

// ---------- Roles ----------
test('el dueño y un editor escriben, y la operación queda a nombre de quien la envió', async () => {
  const { dueno, editor, id } = await equipo();
  assert.equal(await guardar(dueno, id, nodo('a')), 1);
  assert.equal(await guardar(editor, id, nodo('b')), 2);
  const registro = await leer(db, 'diagram_ops', id);
  const porSeq = Object.fromEntries(registro.map(o => [o.seq, o]));
  assert.equal(porSeq[1].user_id, dueno.id);
  assert.equal(porSeq[2].user_id, editor.id);
  assert.deepEqual(porSeq[2].op, nodo('b'));
});

test('un lector recibe 403 y el registro no cambia', async () => {
  const { lector, id } = await equipo();
  rechazo(await enviar(lector, id, nodo('a')), 403, 'forbidden');
  assert.deepEqual(await secuencias(id), []);
  assert.equal((await ficha(id)).last_seq, 0);
});

test('un ajeno y un diagrama inexistente reciben exactamente el mismo 404', async () => {
  const { ajeno, id } = await equipo();
  const aDiagramaAjeno = await enviar(ajeno, id, nodo('a'));
  const aDiagramaInexistente = await enviar(ajeno, randomUUID(), nodo('a'));
  rechazo(aDiagramaAjeno, 404, 'not_found');
  rechazo(aDiagramaInexistente, 404, 'not_found');
  assert.deepEqual(aDiagramaAjeno.error, aDiagramaInexistente.error);
  assert.deepEqual(await secuencias(id), []);
});

test('sin sesión no se puede enviar una operación', async () => {
  const { id } = await equipo();
  const { data, error } = await anonimo().rpc('apply_op', { p_diagram_id: id, p_op_id: randomUUID(), p_op: nodo('a') });
  assert.equal(error?.code, PERMISO_DENEGADO);
  assert.equal(data, null);
  assert.deepEqual(await secuencias(id), []);
});

test('la clave de error distingue al lector (403) del ajeno (404)', async () => {
  const { lector, ajeno, id } = await equipo();
  const [r1, r2] = [await enviar(lector, id, nodo('a')), await enviar(ajeno, id, nodo('a'))];
  assert.deepEqual([r1.status, r1.error.message], [403, 'forbidden']);
  assert.deepEqual([r2.status, r2.error.message], [404, 'not_found']);
});

// ---------- Orden ----------
test('dos sesiones a la vez: 20 operaciones dan exactamente las secuencias 1 a 20', async () => {
  const { dueno, editor, id } = await equipo();
  const envios = Array.from({ length: 10 }, (_, i) => [guardar(dueno, id, nodo(`d${i}`)), guardar(editor, id, nodo(`e${i}`))]).flat();
  const devueltas = (await Promise.all(envios)).sort((a, b) => a - b);
  assert.deepEqual(devueltas, Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(await secuencias(id), devueltas);
  const registro = await leer(db, 'diagram_ops', id);
  assert.equal(new Set(registro.map(o => o.op_id)).size, 20);
  assert.equal(new Set(registro.map(o => JSON.stringify(o.op))).size, 20);
  assert.equal((await ficha(id)).last_seq, 20);
});

test('una operación rechazada no gasta una secuencia', async () => {
  const { editor, id } = await equipo();
  assert.equal(await guardar(editor, id, nodo('a')), 1);
  rechazo(await enviar(editor, id, { type: 'moverNodo' }), 422, 'invalid_op');
  assert.equal(await guardar(editor, id, nodo('b')), 2);
  assert.deepEqual(await secuencias(id), [1, 2]);
  assert.equal((await ficha(id)).last_seq, 2);
});

// ---------- Reintentos ----------
test('reenviar el mismo op_id devuelve la misma secuencia y guarda la operación una sola vez', async () => {
  const { editor, id } = await equipo();
  const opId = randomUUID();
  const primera = await guardar(editor, id, nodo('a'), opId);
  const segunda = await guardar(editor, id, nodo('a'), opId);
  assert.equal(segunda, primera);
  assert.deepEqual(await secuencias(id), [1]);
  assert.equal((await ficha(id)).last_seq, 1);
  assert.equal(await guardar(editor, id, nodo('b')), 2);   // el reintento no gastó una secuencia
});

test('el mismo op_id enviado a la vez varias veces da la misma secuencia y una sola fila', async () => {
  const { editor, id } = await equipo();
  const opId = randomUUID();
  const devueltas = await Promise.all(Array.from({ length: 5 }, () => guardar(editor, id, nodo('a'), opId)));
  assert.deepEqual(new Set(devueltas), new Set([1]));
  assert.deepEqual(await secuencias(id), [1]);
});

// ---------- Tope ----------
test('con 5 000 operaciones, reenviar la última vale y una nueva recibe 409', async () => {
  const { editor, id } = await equipo();
  // Sin sembrar 4 999 filas: basta con la secuencia, la clave de servicio salta el permiso de escritura
  const { error } = await db.from('diagrams').update({ last_seq: 4999 }).eq('id', id);
  assert.equal(error, null);
  const ultima = randomUUID();
  assert.equal(await guardar(editor, id, nodo('a'), ultima), 5000);
  assert.equal(await guardar(editor, id, nodo('a'), ultima), 5000);   // reintento con el registro lleno
  rechazo(await enviar(editor, id, nodo('b')), 409, 'op_limit');
  assert.equal((await leer(db, 'diagram_ops', id)).length, 1);
  assert.equal((await ficha(id)).last_seq, 5000);
});

// ---------- Copia de setMeta ----------
test('setMeta copia el título y la dirección a la ficha y no cambia el tipo', async () => {
  const { editor, id } = await equipo('state');
  await guardar(editor, id, meta({ title: 'Login', dir: 'LR' }));
  const f = await ficha(id);
  assert.deepEqual([f.title, f.direction, f.kind], ['Login', 'LR', 'state']);
});

test('gana el último setMeta, y un setMeta de un solo campo respeta el otro', async () => {
  const { dueno, editor, id } = await equipo();
  await guardar(dueno, id, meta({ title: 'Primero', dir: 'LR' }));
  await guardar(editor, id, meta({ title: 'Segundo' }));
  const f = await ficha(id);
  assert.deepEqual([f.title, f.direction], ['Segundo', 'LR']);
});

test('el título se guarda tal cual, sin transformar (espacios alrededor y emojis)', async () => {
  const { editor, id } = await equipo();
  const titulo = '  Alta 😀 de usuario  ';
  await guardar(editor, id, meta({ title: titulo }));
  assert.equal((await ficha(id)).title, titulo);
});

test('una operación que no es setMeta deja el título y la dirección y actualiza la fecha de modificación', async () => {
  const { editor, id } = await equipo();
  await guardar(editor, id, meta({ title: 'Login', dir: 'LR' }));
  const antes = await ficha(id);
  await new Promise(r => setTimeout(r, 20));
  await guardar(editor, id, nodo('a'));
  const despues = await ficha(id);
  assert.deepEqual([despues.title, despues.direction], ['Login', 'LR']);
  assert.ok(new Date(despues.updated_at) > new Date(antes.updated_at));
});

// ---------- El servidor no interpreta el grafo ----------
test('guarda una operación sobre un nodo inexistente y un addEdge repetido', async () => {
  const { editor, id } = await equipo();
  assert.equal(await guardar(editor, id, { type: 'updateNode', id: 'no-existe', set: { x: 1 } }), 1);
  assert.equal(await guardar(editor, id, { type: 'removeEdge', id: 'tampoco' }), 2);
  const arista = { type: 'addEdge', edge: { id: 'e1', from: 'a', to: 'b', label: '' } };
  assert.equal(await guardar(editor, id, arista), 3);
  assert.equal(await guardar(editor, id, { ...arista, edge: { ...arista.edge, id: 'e2' } }), 4);
});

// ---------- Borrado ----------
test('con el diagrama borrado, el editor y el dueño reciben 410 y, al restaurar, la operación se guarda', async () => {
  const { dueno, editor, id } = await equipo();
  await guardar(editor, id, nodo('a'));
  assert.equal((await dueno.cliente.rpc('delete_diagram', { p_diagram_id: id })).error, null);
  rechazo(await enviar(editor, id, nodo('b')), 410, 'diagram_deleted');
  rechazo(await enviar(dueno, id, nodo('b')), 410, 'diagram_deleted');
  assert.deepEqual(await secuencias(id), [1]);
  assert.equal((await dueno.cliente.rpc('restore_diagram', { p_diagram_id: id })).error, null);
  assert.equal(await guardar(editor, id, nodo('b')), 2);
});

test('a un ajeno se le sigue respondiendo 404 aunque el diagrama esté borrado', async () => {
  const { dueno, ajeno, id } = await equipo();
  await dueno.cliente.rpc('delete_diagram', { p_diagram_id: id });
  rechazo(await enviar(ajeno, id, nodo('a')), 404, 'not_found');
});

test('borrar a la vez que se escribe: cada operación se guarda antes del borrado o recibe 410', async () => {
  const { dueno, editor, id } = await equipo();
  const envios = Array.from({ length: 6 }, (_, i) => enviar(editor, id, nodo(`n${i}`)));
  const borrado = dueno.cliente.rpc('delete_diagram', { p_diagram_id: id });
  const respuestas = await Promise.all([...envios, borrado]);
  const [ops, del] = [respuestas.slice(0, 6), respuestas[6]];
  assert.equal(del.error, null);
  const guardadas = ops.filter(r => r.error === null).map(r => r.data).sort((a, b) => a - b);
  for (const r of ops.filter(r => r.error)) rechazo(r, 410, 'diagram_deleted');
  // Las guardadas son consecutivas desde 1 y están todas en el registro
  assert.deepEqual(guardadas, Array.from({ length: guardadas.length }, (_, i) => i + 1));
  assert.deepEqual(await secuencias(id), guardadas);
  assert.ok((await ficha(id)).deleted_at);
});

test('sin op_id se rechaza con 422', async () => {
  const { editor, id } = await equipo();
  const r = await editor.cliente.rpc('apply_op', { p_diagram_id: id, p_op_id: null, p_op: nodo('a') });
  rechazo(r, 422, 'invalid_op');
});
