// F2: operaciones sobre el grafo (ops.js), deshacer por operaciones inversas (model.js) e ids en el código.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, newId } from '../ops.js';
import * as model from '../model.js';
import { mermaidCode } from '../kinds/index.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const empty = () => ({ kind: 'flow', dir: 'TD', nodes: [], edges: [] });
const node = (id, extra = {}) => ({ id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: id, ...extra });
const edge = (id, from, to, label = '') => ({ id, from, to, label });
const copy = s => structuredClone(s);
const bb = (x = 0, y = 0) => ({ x, y, w: 100, h: 50 });

// Estado con tres nodos y tres aristas: a→b, b→c, c→a
const triangle = () => ({
  kind: 'flow', dir: 'TD',
  nodes: [node('a'), node('b'), node('c')],
  edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'a')],
});

// ---------- Identificadores ----------
test('newId devuelve UUID v4 distintos', () => {
  const ids = new Set(Array.from({ length: 50 }, () => newId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, UUID_V4);
});

test('newId funciona sin crypto.randomUUID (contexto HTTP no seguro)', () => {
  const sinRandomUUID = { getRandomValues: a => globalThis.crypto.getRandomValues(a) };
  const ids = new Set(Array.from({ length: 50 }, () => newId(sinRandomUUID)));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, UUID_V4);
});

// ---------- apply: cada tipo de operación ----------
test('addNode añade una copia y respeta la posición `at`', () => {
  const s = triangle();
  const n = node('d');
  assert.deepEqual(apply(s, { type: 'addNode', node: n }), { ok: true });
  n.label = 'cambiado fuera';
  assert.equal(s.nodes[3].label, 'd');
  apply(s, { type: 'addNode', node: node('e'), at: 1 });
  assert.deepEqual(s.nodes.map(k => k.id), ['a', 'e', 'b', 'c', 'd']);
  apply(s, { type: 'addNode', node: node('f'), at: 99 });
  assert.equal(s.nodes.at(-1).id, 'f');
});

test('updateNode cambia solo los campos permitidos', () => {
  const s = triangle();
  assert.equal(apply(s, { type: 'updateNode', id: 'b', set: { x: 5, y: 6, label: 'nuevo', shape: 'diamond', id: 'zzz' } }).ok, true);
  assert.deepEqual(s.nodes[1], node('b', { x: 5, y: 6, label: 'nuevo' }));
});

test('removeNode borra el nodo y todas sus aristas', () => {
  const s = triangle();
  assert.equal(apply(s, { type: 'removeNode', id: 'b' }).ok, true);
  assert.deepEqual(s.nodes.map(k => k.id), ['a', 'c']);
  assert.deepEqual(s.edges.map(k => k.id), ['e3']);
});

test('addEdge, updateEdge y removeEdge', () => {
  const s = triangle();
  assert.equal(apply(s, { type: 'addEdge', edge: edge('e4', 'a', 'c', 'x') }).ok, true);
  assert.equal(s.edges.at(-1).label, 'x');
  assert.equal(apply(s, { type: 'updateEdge', id: 'e4', set: { label: 'y', from: 'b' } }).ok, true);
  assert.deepEqual(s.edges.at(-1), edge('e4', 'a', 'c', 'y'));
  assert.equal(apply(s, { type: 'removeEdge', id: 'e4' }).ok, true);
  assert.equal(s.edges.length, 3);
});

test('setMeta cambia tipo y dirección', () => {
  const s = triangle();
  assert.equal(apply(s, { type: 'setMeta', set: { kind: 'state' } }).ok, true);
  assert.equal(apply(s, { type: 'setMeta', set: { dir: 'LR' } }).ok, true);
  assert.equal(s.kind, 'state');
  assert.equal(s.dir, 'LR');
});

// ---------- apply: rechazos (no cambian nada) ----------
const rechazos = [
  ['addNode con id repetido', { type: 'addNode', node: node('a') }, 'duplicate'],
  ['updateNode de un nodo que no existe', { type: 'updateNode', id: 'zz', set: { x: 1 } }, 'missing'],
  ['removeNode de un nodo que no existe', { type: 'removeNode', id: 'zz' }, 'missing'],
  ['addEdge con origen inexistente', { type: 'addEdge', edge: edge('e9', 'zz', 'a') }, 'missing'],
  ['addEdge con destino inexistente', { type: 'addEdge', edge: edge('e9', 'a', 'zz') }, 'missing'],
  ['addEdge repetido (mismo origen y destino)', { type: 'addEdge', edge: edge('e9', 'a', 'b') }, 'duplicate'],
  ['addEdge con id repetido', { type: 'addEdge', edge: edge('e1', 'a', 'c') }, 'duplicate'],
  ['updateEdge de una arista que no existe', { type: 'updateEdge', id: 'zz', set: { label: 'x' } }, 'missing'],
  ['removeEdge de una arista que no existe', { type: 'removeEdge', id: 'zz' }, 'missing'],
  ['setMeta con un tipo desconocido', { type: 'setMeta', set: { kind: 'clases' } }, 'invalid'],
  ['setMeta con una dirección inválida', { type: 'setMeta', set: { dir: 'XX' } }, 'invalid'],
  ['setMeta válido a medias (no aplica nada)', { type: 'setMeta', set: { dir: 'LR', kind: 'clases' } }, 'invalid'],
  ['operación de tipo desconocido', { type: 'teletransportar', id: 'a' }, 'unknown'],
];
for (const [nombre, op, reason] of rechazos) {
  test(`rechaza ${nombre} (${reason}) sin cambiar nada`, () => {
    const s = triangle(), antes = copy(s);
    assert.deepEqual(apply(s, op), { ok: false, reason });
    assert.deepEqual(s, antes);
  });
}

// ---------- Serialización y determinismo ----------
test('aplicar la operación o su copia serializada da el mismo diagrama', () => {
  const op = { type: 'addNode', node: node('d', { label: 'ñ "x" <b>' }), at: 2 };
  const s1 = triangle(), s2 = triangle();
  apply(s1, op);
  apply(s2, JSON.parse(JSON.stringify(op)));
  assert.deepEqual(s1, s2);
});

test('dos réplicas con la misma secuencia (con rechazos) terminan iguales', () => {
  const secuencia = [
    { type: 'addNode', node: node('a') },
    { type: 'addNode', node: node('b') },
    { type: 'addEdge', edge: edge('e1', 'a', 'b') },
    { type: 'addEdge', edge: edge('e2', 'a', 'b') },       // rechazada: duplicada
    { type: 'updateNode', id: 'zz', set: { x: 1 } },       // rechazada: no existe
    { type: 'updateNode', id: 'a', set: { label: 'Inicio' } },
    { type: 'removeNode', id: 'b' },
    { type: 'updateEdge', id: 'e1', set: { label: 'x' } }, // rechazada: borrada con b
    { type: 'setMeta', set: { dir: 'LR' } },
  ];
  const r1 = empty(), r2 = empty();
  const res1 = secuencia.map(op => apply(r1, op));
  const res2 = secuencia.map(op => apply(r2, JSON.parse(JSON.stringify(op))));
  assert.deepEqual(res1, res2);
  assert.deepEqual(r1, r2);
  assert.deepEqual(res1.map(r => r.ok), [true, true, true, false, false, true, true, false, true]);
  assert.deepEqual(r1.nodes, [node('a', { label: 'Inicio' })]);
});

// ---------- model.js: gestos, deshacer ----------
const ejemplo = () => { model.reset(); model.loadExample(); return mermaidCode(model.state, model.state.kind, model.state.dir); };

test('los nodos y las aristas nuevos tienen UUID v4 distintos', () => {
  model.reset();
  const a = model.addNode('rect', bb(0, 0)).node, b = model.addNode('rect', bb(300, 0)).node;
  const e = model.addEdge(a.id, b.id).edge;
  assert.equal(new Set([a.id, b.id, e.id]).size, 3);
  for (const id of [a.id, b.id, e.id]) assert.match(id, UUID_V4);
});

test('un conector repetido se rechaza y no entra en la pila de deshacer', () => {
  model.reset();
  const a = model.addNode('rect', bb(0, 0)).node, b = model.addNode('rect', bb(300, 0)).node;
  assert.equal(model.addEdge(a.id, b.id).ok, true);
  assert.deepEqual(model.addEdge(a.id, b.id), { ok: false, reason: 'duplicate' });
  assert.equal(model.state.edges.length, 1);
  model.undo();                                   // deshace el conector, no el intento repetido
  assert.equal(model.state.edges.length, 0);
});

test('Limpiar es un solo paso y deshacer devuelve el mismo código Mermaid', () => {
  const antes = ejemplo();
  assert.equal(model.clear().ok, true);
  assert.equal(model.state.nodes.length, 0);
  assert.equal(model.undo().ok, true);
  assert.equal(mermaidCode(model.state, 'flow', 'TD'), antes);
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
});

test('Limpiar con el diagrama vacío no hace nada', () => {
  model.reset();
  assert.deepEqual(model.clear(), { ok: false, reason: 'empty' });
});

test('borrar un nodo intermedio y deshacer restaura el orden exacto', () => {
  const antes = ejemplo();
  const estado = copy(model.state);
  const medio = model.state.nodes[2];             // «¿Válida?»: 3 aristas, entra y sale
  model.removeNode(medio.id);
  assert.equal(model.state.nodes.length, 4);
  assert.equal(model.state.edges.length, 2);
  assert.equal(model.undo().ok, true);
  assert.deepEqual(model.state, estado);
  assert.equal(mermaidCode(model.state, 'flow', 'TD'), antes);
});

test('borrar una arista intermedia y deshacer restaura su posición', () => {
  const antes = ejemplo();
  model.removeEdge(model.state.edges[1].id);
  model.undo();
  assert.equal(mermaidCode(model.state, 'flow', 'TD'), antes);
});

test('renombrar y deshacer devuelve la etiqueta anterior (nodo y arista)', () => {
  ejemplo();
  const n = model.state.nodes[0], e = model.state.edges[2];
  model.setLabel(n.id, 'Otro');
  model.setLabel(e.id, 'quizá');
  assert.equal(model.state.nodes[0].label, 'Otro');
  assert.equal(model.state.edges[2].label, 'quizá');
  model.undo(); model.undo();
  assert.equal(model.state.nodes[0].label, 'Inicio');
  assert.equal(model.state.edges[2].label, 'sí');
});

test('un arrastre completo es un solo paso de deshacer', () => {
  model.reset();
  const n = model.addNode('rect', bb(100, 100)).node, id = n.id;
  const from = { x: n.x, y: n.y };
  for (let i = 1; i <= 20; i++) model.previewMove(id, from.x + i * 5, from.y + i * 3);
  model.moveNode(id, from, { x: from.x + 100, y: from.y + 60 });
  assert.deepEqual([model.state.nodes[0].x, model.state.nodes[0].y], [from.x + 100, from.y + 60]);
  assert.equal(model.undo().ok, true);
  assert.deepEqual([model.state.nodes[0].x, model.state.nodes[0].y], [from.x, from.y]);
  assert.equal(model.state.nodes.length, 1);      // el nodo sigue: solo se deshizo el arrastre
});

test('un arrastre que no mueve el nodo no entra en la pila', () => {
  model.reset();
  const n = model.addNode('rect', bb(100, 100)).node;
  model.previewMove(n.id, n.x + 10, n.y);
  model.moveNode(n.id, { x: n.x - 10, y: n.y }, { x: n.x - 10, y: n.y });
  model.undo();                                   // deshace el addNode
  assert.equal(model.state.nodes.length, 0);
});

test('deshacer salta la inversa de un nodo que ya borró otro usuario', () => {
  model.reset();
  const n = model.addNode('rect', bb(0, 0)).node;
  model.setLabel(n.id, 'mío');
  assert.deepEqual(model.applyRemote({ type: 'removeNode', id: n.id }), { ok: true });
  assert.doesNotThrow(() => model.undo());
  assert.equal(model.state.nodes.length, 0);      // el nodo sigue borrado
});

test('las operaciones ajenas no entran en la pila de deshacer', () => {
  model.reset();
  model.applyRemote({ type: 'addNode', node: node('ajeno') });
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
  assert.deepEqual(model.state.nodes.map(k => k.id), ['ajeno']);
});

test('el tipo y la dirección no se deshacen', () => {
  model.reset();
  model.addNode('rect', bb(0, 0));
  model.setKind('state');
  model.setDir('LR');
  assert.equal(model.undo().ok, true);
  assert.equal(model.state.nodes.length, 0);
  assert.equal(model.state.kind, 'state');
  assert.equal(model.state.dir, 'LR');
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
});

test('la pila guarda como máximo 60 pasos', () => {
  model.reset();
  for (let i = 0; i < 65; i++) model.addNode('rect', bb(i, 0));
  let deshechos = 0;
  while (model.undo().ok) deshechos++;
  assert.equal(deshechos, 60);
  assert.equal(model.state.nodes.length, 5);
});

// ---------- Identificadores en el código Mermaid ----------
test('el código numera los nodos n1, n2… aunque sus ids sean UUID', () => {
  model.reset();
  model.addNode('rect', bb(0, 0));
  model.addNode('rect', bb(300, 0));
  const [a, b] = model.state.nodes;
  model.addEdge(a.id, b.id);
  assert.equal(mermaidCode(model.state, 'flow', 'TD'), [
    'flowchart TD',
    '  n1["Proceso 1"]',
    '  n2["Proceso 2"]',
    '  n1 --> n2',
  ].join('\n'));
  assert.doesNotMatch(mermaidCode(model.state, 'flow', 'TD'), /[0-9a-f]{8}-/);
});

test('al borrar el nodo del medio, los demás pasan a n1 y n2', () => {
  model.reset();
  for (let i = 0; i < 3; i++) model.addNode('rect', bb(i * 200, 0));
  const [a, b, c] = model.state.nodes;
  model.addEdge(a.id, c.id);
  model.removeNode(b.id);
  assert.equal(mermaidCode(model.state, 'flow', 'TD'), [
    'flowchart TD',
    '  n1["Proceso 1"]',
    '  n2["Proceso 3"]',
    '  n1 --> n2',
  ].join('\n'));
});
