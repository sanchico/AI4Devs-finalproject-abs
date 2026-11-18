// F2: operaciones sobre el grafo (ops.js), deshacer por operaciones inversas (model.js) e ids en el código.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, inverse, newId } from '../ops.js';
import * as model from '../model.js';
import { mermaidCode } from '../kinds/index.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SIN_TITULO = 'Diagrama sin título';
const empty = () => ({ kind: 'flow', dir: 'TD', title: SIN_TITULO, nodes: [], edges: [] });
const node = (id, extra = {}) => ({ id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: id, ...extra });
const edge = (id, from, to, label = '') => ({ id, from, to, label });
const copy = s => structuredClone(s);
const bb = (x = 0, y = 0) => ({ x, y, w: 100, h: 50 });

// Estado con tres nodos y tres aristas: a→b, b→c, c→a
const triangle = () => ({
  kind: 'flow', dir: 'TD', title: SIN_TITULO,
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

test('setMeta cambia dirección y título, y el tipo no cambia', () => {
  const s = triangle();
  assert.equal(apply(s, { type: 'setMeta', set: { dir: 'LR', title: 'Login' } }).ok, true);
  assert.equal(s.dir, 'LR');
  assert.equal(s.title, 'Login');
  assert.equal(s.kind, 'flow');
  assert.equal(s.nodes.length, 3);
});

// ---------- Etiquetas: texto de 200 caracteres como máximo, vacío válido ----------
test('acepta etiquetas de 200 caracteres y vacías en nodos y conectores', () => {
  const s = triangle(), larga = 'x'.repeat(200);
  assert.equal(apply(s, { type: 'addNode', node: node('d', { label: larga }) }).ok, true);
  assert.equal(apply(s, { type: 'updateNode', id: 'a', set: { label: larga } }).ok, true);
  assert.equal(apply(s, { type: 'updateNode', id: 'a', set: { label: '' } }).ok, true);
  assert.equal(apply(s, { type: 'addEdge', edge: edge('e4', 'a', 'c', larga) }).ok, true);
  assert.equal(apply(s, { type: 'updateEdge', id: 'e4', set: { label: '' } }).ok, true);
  assert.equal(s.nodes.find(n => n.id === 'a').label, '');
  assert.equal(s.nodes.find(n => n.id === 'd').label, larga);
});

test('una etiqueta inválida no deja aplicar ni los demás campos de la operación', () => {
  const s = triangle(), antes = copy(s);
  assert.deepEqual(apply(s, { type: 'updateNode', id: 'a', set: { x: 99, label: 'x'.repeat(201) } }), { ok: false, reason: 'invalid' });
  assert.deepEqual(s, antes);
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
  ['setMeta con un tipo válido (el tipo se fija al crear)', { type: 'setMeta', set: { kind: 'state' } }, 'invalid'],
  ['setMeta con título válido y tipo válido', { type: 'setMeta', set: { title: 'Login', kind: 'state' } }, 'invalid'],
  ['setMeta con título válido y dirección inválida', { type: 'setMeta', set: { title: 'Login', dir: 'XX' } }, 'invalid'],
  ['addNode con una etiqueta de 201 caracteres', { type: 'addNode', node: node('d', { label: 'x'.repeat(201) }) }, 'invalid'],
  ['updateNode con una etiqueta de 201 caracteres', { type: 'updateNode', id: 'a', set: { label: 'x'.repeat(201) } }, 'invalid'],
  ['updateNode con una etiqueta que no es texto', { type: 'updateNode', id: 'a', set: { label: 42 } }, 'invalid'],
  ['addEdge con una etiqueta de 201 caracteres', { type: 'addEdge', edge: edge('e9', 'a', 'c', 'x'.repeat(201)) }, 'invalid'],
  ['updateEdge con una etiqueta de 201 caracteres', { type: 'updateEdge', id: 'e1', set: { label: 'x'.repeat(201) } }, 'invalid'],
  ['setMeta con una dirección inválida', { type: 'setMeta', set: { dir: 'XX' } }, 'invalid'],
  ['setMeta válido a medias (no aplica nada)', { type: 'setMeta', set: { dir: 'LR', kind: 'clases' } }, 'invalid'],
  ['setMeta con un título de solo espacios', { type: 'setMeta', set: { title: '   ' } }, 'invalid'],
  ['setMeta con un título vacío', { type: 'setMeta', set: { title: '' } }, 'invalid'],
  ['setMeta con un título de 201 caracteres', { type: 'setMeta', set: { title: 'x'.repeat(201) } }, 'invalid'],
  ['setMeta con un título que no es texto', { type: 'setMeta', set: { title: 42 } }, 'invalid'],
  ['setMeta con título válido y tipo desconocido', { type: 'setMeta', set: { title: 'Login', kind: 'clases' } }, 'invalid'],
  ['operación de tipo desconocido', { type: 'teletransportar', id: 'a' }, 'unknown'],
  // Mal formadas: faltan el objeto o los identificadores de texto que apply() lee (antes lanzaban una excepción)
  ['addNode sin node', { type: 'addNode' }, 'invalid'],
  ['addNode con node que no es un objeto', { type: 'addNode', node: 'a' }, 'invalid'],
  ['addNode con node nulo', { type: 'addNode', node: null }, 'invalid'],
  ['addNode con un id numérico', { type: 'addNode', node: { id: 42 } }, 'invalid'],
  ['addEdge sin edge', { type: 'addEdge' }, 'invalid'],
  ['addEdge sin extremos', { type: 'addEdge', edge: { id: 'e9' } }, 'invalid'],
  ['addEdge con un extremo numérico', { type: 'addEdge', edge: { id: 'e9', from: 'a', to: 3 } }, 'invalid'],
  ['updateNode con un id numérico', { type: 'updateNode', id: 42, set: { x: 1 } }, 'invalid'],
  ['updateNode sin set', { type: 'updateNode', id: 'a' }, 'invalid'],
  ['updateNode con set que no es un objeto', { type: 'updateNode', id: 'a', set: [] }, 'invalid'],
  ['updateEdge sin set', { type: 'updateEdge', id: 'e1' }, 'invalid'],
  ['removeNode sin id', { type: 'removeNode' }, 'invalid'],
  ['removeEdge con un id numérico', { type: 'removeEdge', id: 1 }, 'invalid'],
  ['setMeta sin set', { type: 'setMeta' }, 'invalid'],
  ['setMeta con set que no es un objeto', { type: 'setMeta', set: 'LR' }, 'invalid'],
  ['una operación nula', null, 'unknown'],
  ['una operación que es un número', 5, 'unknown'],
  ['una operación que es un array', [], 'unknown'],
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

test('un registro con operaciones mal formadas no lanza y deja a todas las réplicas con el mismo diagrama', () => {
  const secuencia = [
    { type: 'addNode', node: node('a') },
    { type: 'addNode' },                                   // sin node: antes lanzaba un TypeError
    { type: 'addEdge' },                                   // sin edge
    { type: 'addEdge', edge: { id: 'e1' } },               // sin extremos
    { type: 'updateNode', id: 'a' },                       // sin set
    { type: 'removeNode' },
    null,
    { type: 'addNode', node: node('b') },
    { type: 'addEdge', edge: edge('e1', 'a', 'b') },
  ];
  const r1 = empty(), r2 = empty();
  const res1 = secuencia.map(op => apply(r1, op));         // si alguna lanzara, el test fallaría aquí
  const res2 = secuencia.map(op => apply(r2, JSON.parse(JSON.stringify(op))));
  assert.deepEqual(res1, res2);
  assert.deepEqual(r1, r2);
  assert.deepEqual(res1.map(r => r.ok ? 'ok' : r.reason), ['ok', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'unknown', 'ok', 'ok']);
  assert.deepEqual(r1.nodes.map(n => n.id), ['a', 'b']);
  assert.deepEqual(r1.edges.map(e => e.id), ['e1']);
});

test('inverse devuelve una lista vacía, sin lanzar, para una operación mal formada', () => {
  const s = triangle();
  for (const op of [{ type: 'addNode' }, { type: 'addEdge' }, { type: 'updateNode', id: 'a' }, { type: 'removeNode' }, { type: 'setMeta' }]) {
    assert.deepEqual(inverse(s, op), [], JSON.stringify(op));
  }
});

// ---------- model.js: gestos, deshacer ----------
const ejemplo = () => { model.reset(); model.loadExample(); return mermaidCode(model.state, model.state.kind, model.state.dir); };

// ---------- Título del diagrama (F3, meta-titulo) ----------
test('setMeta con título cambia solo el título', () => {
  const s = triangle(), antes = copy(s);
  assert.deepEqual(apply(s, { type: 'setMeta', set: { title: 'Login' } }), { ok: true });
  assert.equal(s.title, 'Login');
  assert.deepEqual({ ...s, title: antes.title }, antes);
});

test('un título de 200 caracteres se acepta y se guarda sin transformar', () => {
  const s = empty(), largo = ' ' + 'x'.repeat(198) + ' ';
  assert.equal(largo.length, 200);
  assert.deepEqual(apply(s, { type: 'setMeta', set: { title: largo } }), { ok: true });
  assert.equal(s.title, largo);
});

test('un setMeta con título y su copia serializada dan el mismo diagrama', () => {
  const op = { type: 'setMeta', set: { title: 'Alta de "usuario" <b>' } };
  const s1 = triangle(), s2 = triangle();
  apply(s1, op);
  apply(s2, JSON.parse(JSON.stringify(op)));
  assert.deepEqual(s1, s2);
});

test('la inversa de un setMeta con título devuelve el título anterior', () => {
  const s = { ...triangle(), title: 'Login' };
  const op = { type: 'setMeta', set: { title: 'Alta de usuario' } };
  const inv = inverse(s, op);
  apply(s, op);
  assert.equal(s.title, 'Alta de usuario');
  for (const o of JSON.parse(JSON.stringify(inv))) assert.equal(apply(s, o).ok, true);
  assert.equal(s.title, 'Login');
});

test('un diagrama nuevo se titula "Diagrama sin título"', () => {
  model.reset();
  assert.equal(model.state.title, SIN_TITULO);
});

test('Limpiar conserva el título', () => {
  model.reset();
  model.addNode('rect', bb(0, 0));
  model.applyRemote({ type: 'setMeta', set: { title: 'Login' } });
  assert.equal(model.clear().ok, true);
  assert.equal(model.state.nodes.length, 0);
  assert.equal(model.state.title, 'Login');
});

test('renombrar no cambia el código Mermaid', () => {
  const antes = ejemplo();
  assert.equal(model.applyRemote({ type: 'setMeta', set: { title: 'Login' } }).ok, true);
  assert.equal(mermaidCode(model.state, model.state.kind, model.state.dir), antes);
  assert.ok(!antes.includes('Login') && !antes.includes('title'));
});

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

test('la dirección no se deshace', () => {
  model.reset();
  model.addNode('rect', bb(0, 0));
  model.setDir('LR');
  assert.equal(model.undo().ok, true);
  assert.equal(model.state.nodes.length, 0);
  assert.equal(model.state.dir, 'LR');
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
});

test('un diagrama nuevo queda vacío, sin título, del tipo elegido y sin nada que deshacer', () => {
  model.reset();
  model.addNode('rect', bb(0, 0));
  model.setDir('LR');
  apply(model.state, { type: 'setMeta', set: { title: 'Login' } });
  assert.deepEqual(model.newDiagram('state'), { ok: true });
  assert.deepEqual(model.state.nodes, []);
  assert.deepEqual(model.state.edges, []);
  assert.equal(model.state.kind, 'state');
  assert.equal(model.state.title, SIN_TITULO);
  assert.equal(model.state.dir, 'LR');                       // la dirección se conserva
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
  assert.equal(model.state.kind, 'state');                   // deshacer no devuelve el diagrama anterior
});

test('un diagrama nuevo del mismo tipo también vacía el diagrama', () => {
  model.reset();
  model.addNode('rect', bb(0, 0));
  assert.deepEqual(model.newDiagram('flow'), { ok: true });
  assert.equal(model.state.nodes.length, 0);
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
});

test('un tipo desconocido no empieza un diagrama nuevo', () => {
  model.reset();
  model.addNode('rect', bb(0, 0));
  assert.deepEqual(model.newDiagram('clases'), { ok: false, reason: 'invalid' });
  assert.equal(model.state.nodes.length, 1);
  assert.equal(model.state.kind, 'flow');
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
