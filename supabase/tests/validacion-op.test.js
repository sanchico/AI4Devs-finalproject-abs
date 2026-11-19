// Validación de la forma de la operación en apply_op (S2). El servidor no mira el grafo: solo rechaza lo que
// haría caer a un cliente o dejaría la ficha de `diagrams` distinta del registro reproducido.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from './helpers/entorno.js';
import { db, equipo, leer, nodo, meta, enviar } from './helpers/datos.js';

after(() => sql.end());

const nodoCon = extra => ({ type: 'addNode', node: { id: 'n', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'n', ...extra } });
const arista = extra => ({ type: 'addEdge', edge: { id: 'e', from: 'a', to: 'b', label: '', ...extra } });
const x = n => 'x'.repeat(n);
const emojis = n => '😀'.repeat(n);   // cada uno cuenta 2 unidades UTF-16 en JavaScript

// [nombre, operación]: el servidor las rechaza con 422
const INVALIDAS = [
  ['un array en vez de un objeto', []],
  ['un texto en vez de un objeto', 'addNode'],
  ['sin tipo', {}],
  ['con un tipo que no es texto', { type: 5 }],
  ['de tipo desconocido', { type: 'moverNodo', id: 'a' }],
  ['de más de 2 kB', nodoCon({ relleno: x(2100) })],
  ['addNode sin node', { type: 'addNode' }],
  ['addNode con node que no es un objeto', { type: 'addNode', node: 'a' }],
  ['addNode sin id', nodoCon({ id: undefined })],
  ['addNode con id numérico', nodoCon({ id: 42 })],
  ['addEdge sin edge', { type: 'addEdge' }],
  ['addEdge sin from', arista({ from: undefined })],
  ['addEdge sin to', arista({ to: undefined })],
  ['addEdge con id numérico', arista({ id: 7 })],
  ['updateNode con id numérico', { type: 'updateNode', id: 42, set: { x: 1 } }],
  ['updateNode sin set', { type: 'updateNode', id: 'a' }],
  ['updateNode con set que no es un objeto', { type: 'updateNode', id: 'a', set: 'x' }],
  ['updateEdge sin id', { type: 'updateEdge', set: { label: 'x' } }],
  ['removeNode sin id', { type: 'removeNode' }],
  ['removeEdge con id numérico', { type: 'removeEdge', id: 1 }],
  ['addNode con una etiqueta de 201 caracteres', nodoCon({ label: x(201) })],
  ['updateNode con una etiqueta de 201 caracteres', { type: 'updateNode', id: 'a', set: { label: x(201) } }],
  ['addEdge con una etiqueta de 201 caracteres', arista({ label: x(201) })],
  ['updateEdge con una etiqueta de 201 caracteres', { type: 'updateEdge', id: 'e', set: { label: x(201) } }],
  ['una etiqueta de 101 emojis (202 unidades UTF-16)', nodoCon({ label: emojis(101) })],
  ['una etiqueta numérica', { type: 'updateNode', id: 'a', set: { label: 42 } }],
  ['una etiqueta nula', { type: 'updateNode', id: 'a', set: { label: null } }],
  ['setMeta con tipo', meta({ kind: 'state' })],
  ['setMeta con tipo desconocido', meta({ kind: 'clases' })],
  ['setMeta con título válido y tipo', meta({ title: 'Login', kind: 'state' })],
  ['setMeta con título de espacios', meta({ title: '   ' })],
  ['setMeta con título vacío', meta({ title: '' })],
  ['setMeta con título de tabuladores', meta({ title: '\t\t' })],
  ['setMeta con título de espacios no separables', meta({ title: ' 　' })],
  ['setMeta con título de 201 caracteres', meta({ title: x(201) })],
  ['setMeta con título de 101 emojis (202 unidades UTF-16)', meta({ title: emojis(101) })],
  ['setMeta con título numérico', meta({ title: 42 })],
  ['setMeta con dirección XX', meta({ dir: 'XX' })],
  ['setMeta con título válido y dirección XX', meta({ title: 'Login', dir: 'XX' })],
  ['setMeta sin set', { type: 'setMeta' }],
  ['setMeta con set que no es un objeto', { type: 'setMeta', set: [] }],
];

// [nombre, operación]: el servidor las guarda (el grafo es cosa del cliente)
const VALIDAS = [
  ['addNode sin etiqueta', nodoCon({ label: undefined })],
  ['addNode con una etiqueta de 200 caracteres', nodoCon({ id: 'n2', label: x(200) })],
  ['addNode con una etiqueta de 100 emojis (200 unidades UTF-16)', nodoCon({ id: 'n3', label: emojis(100) })],
  ['addNode con una etiqueta vacía', nodoCon({ id: 'n4', label: '' })],
  ['updateNode de un nodo que no existe', { type: 'updateNode', id: 'zz', set: { x: 1 } }],
  ['updateNode con set vacío', { type: 'updateNode', id: 'zz', set: {} }],
  ['addEdge entre nodos que no existen', arista({ id: 'e1', from: 'zz', to: 'yy' })],
  ['updateEdge con una etiqueta de 200 caracteres', { type: 'updateEdge', id: 'zz', set: { label: x(200) } }],
  ['removeNode de un nodo que no existe', { type: 'removeNode', id: 'zz' }],
  ['removeEdge de una arista que no existe', { type: 'removeEdge', id: 'zz' }],
  ['setMeta con dirección LR', meta({ dir: 'LR' })],
  ['setMeta con set vacío', meta({})],
  ['setMeta con título con espacios alrededor', meta({ title: ' Login ' })],
  ['setMeta con título de 200 caracteres', meta({ title: x(200) })],
  ['setMeta con título de 100 emojis (200 unidades UTF-16)', meta({ title: emojis(100) })],
  ['setMeta con título y dirección', meta({ title: 'Alta', dir: 'TD' })],
];

test('rechaza con 422 y no guarda ninguna operación mal formada', async () => {
  const { editor, id } = await equipo();
  for (const [nombre, op] of INVALIDAS) {
    const r = await enviar(editor, id, op);
    assert.equal(r.status, 422, nombre);
    assert.equal(r.error?.code, 'PT422', nombre);
    assert.equal(r.error?.message, 'invalid_op', nombre);
    assert.equal(r.data, null, nombre);
  }
  assert.deepEqual(await leer(db, 'diagram_ops', id), []);
  const [f] = await leer(db, 'diagrams', id);
  assert.deepEqual([f.last_seq, f.title, f.direction, f.kind], [0, 'Diagrama sin título', 'TD', 'flow']);
});

test('guarda cada operación bien formada y les da secuencias consecutivas', async () => {
  const { editor, id } = await equipo();
  let seq = 0;
  for (const [nombre, op] of VALIDAS) {
    const { data, error } = await enviar(editor, id, op);
    assert.equal(error, null, `${nombre}: ${error?.message} ${error?.details ?? ''}`);
    assert.equal(data, ++seq, nombre);
  }
  assert.equal((await leer(db, 'diagram_ops', id)).length, VALIDAS.length);
});

test('un título aceptado por el servidor es el que la ficha muestra, sin transformar', async () => {
  const { editor, id } = await equipo();
  for (const titulo of [' Login ', x(200), emojis(100)]) {
    const { error } = await enviar(editor, id, meta({ title: titulo }));
    assert.equal(error, null);
    assert.equal((await leer(db, 'diagrams', id))[0].title, titulo);
  }
});

test('un setMeta rechazado no cambia la ficha', async () => {
  const { editor, id } = await equipo();
  await enviar(editor, id, meta({ title: 'Login', dir: 'LR' }));
  await enviar(editor, id, meta({ title: 'Otro', kind: 'state' }));
  await enviar(editor, id, meta({ title: '\t' }));
  const [f] = await leer(db, 'diagrams', id);
  assert.deepEqual([f.title, f.direction, f.kind, f.last_seq], ['Login', 'LR', 'flow', 1]);
});

test('las operaciones de ejemplo del helper son válidas', async () => {
  const { editor, id } = await equipo();
  assert.equal((await enviar(editor, id, nodo('a'))).error, null);
});
