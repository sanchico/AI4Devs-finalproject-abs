// Ganchos del modelo para la colaboración: onChange, undo que devuelve lo aplicado, setDir que se envía sin
// deshacerse, solo lectura y replaceState. Sin colaboración el modelo se comporta como siempre.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../model.js';

const { state } = model;
const bb = (x = 0, y = 0) => ({ x, y, w: 80, h: 40 });
let llamadas;

beforeEach(() => {
  model.onChange(null);
  model.setReadOnly(null);
  model.reset();
  llamadas = [];
});
const escuchar = () => model.onChange(ops => llamadas.push(ops));

// ---------- Sin colaboración ----------
test('sin onChange, crear, deshacer y cambiar la dirección funcionan como siempre', () => {
  const r = model.addNode('rect', bb());
  assert.equal(r.ok, true);
  assert.equal(state.nodes.length, 1);
  assert.equal(model.undo().ok, true);
  assert.equal(state.nodes.length, 0);
  assert.equal(model.setDir('LR').ok, true);
  assert.equal(state.dir, 'LR');
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });   // la dirección no entra en la pila
});

// ---------- onChange ----------
test('perform llama a onChange una vez por gesto con las operaciones aplicadas', () => {
  escuchar();
  const { node } = model.addNode('rect', bb());
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0], [{ type: 'addNode', node }]);
  const { node: otro } = model.addNode('ellipse', bb(100));
  llamadas.length = 0;
  assert.deepEqual(model.clear(), { ok: true });
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0], [{ type: 'removeNode', id: node.id }, { type: 'removeNode', id: otro.id }]);
});

test('un gesto sin nada aplicado no llama a onChange', () => {
  escuchar();
  const [r] = model.perform([{ type: 'removeNode', id: 'no-existe' }]);
  assert.deepEqual(r, { ok: false, reason: 'missing' });
  assert.deepEqual(model.clear(), { ok: false, reason: 'empty' });
  assert.equal(llamadas.length, 0);
});

test('onChange recibe solo lo que el modelo aplicó cuando el gesto mezcla aplicadas y rechazadas', () => {
  escuchar();
  const nodo = { id: 'a', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'a' };
  model.perform([{ type: 'removeNode', id: 'no-existe' }, { type: 'addNode', node: nodo }]);
  assert.deepEqual(llamadas, [[{ type: 'addNode', node: nodo }]]);
});

test('perform con undoable: false avisa a onChange pero no apila inversas', () => {
  escuchar();
  const nodo = { id: 'a', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'a' };
  model.perform([{ type: 'addNode', node: nodo }], { undoable: false });
  assert.equal(llamadas.length, 1);
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
  assert.equal(state.nodes.length, 1);
});

// ---------- undo ----------
test('undo devuelve y envía las inversas que se aplicaron', () => {
  escuchar();
  model.addNode('rect', bb());
  const { node: b } = model.addNode('ellipse', bb(100));
  llamadas.length = 0;
  const r = model.undo();
  assert.deepEqual(r, { ok: true, ops: [{ type: 'removeNode', id: b.id }] });
  assert.deepEqual(llamadas, [[{ type: 'removeNode', id: b.id }]]);
});

test('undo no envía las inversas saltadas porque su elemento ya no existe', () => {
  const a = { id: 'a', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'a' };
  const b = { ...a, id: 'b', label: 'b' };
  model.perform([{ type: 'addNode', node: a }, { type: 'addNode', node: b }], { undoable: false });
  model.perform([{ type: 'updateNode', id: 'a', set: { label: 'A' } }, { type: 'updateNode', id: 'b', set: { label: 'B' } }]);
  model.applyRemote({ type: 'removeNode', id: 'b' });   // otro miembro borra b
  escuchar();
  const r = model.undo();
  assert.deepEqual(r, { ok: true, ops: [{ type: 'updateNode', id: 'a', set: { label: 'a' } }] });
  assert.deepEqual(llamadas, [r.ops]);
});

test('undo sin nada que deshacer, o con todo saltado, no envía nada', () => {
  escuchar();
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
  const { node } = model.addNode('rect', bb());
  model.applyRemote({ type: 'removeNode', id: node.id });   // otro miembro lo borra
  llamadas.length = 0;
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
  assert.equal(llamadas.length, 0);
});

test('lo que se aplica de otros no entra en la pila de deshacer', () => {
  escuchar();
  model.applyRemote({ type: 'addNode', node: { id: 'x', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'x' } });
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
  assert.equal(state.nodes.length, 1);
  assert.equal(llamadas.length, 0);
});

// ---------- setDir ----------
test('setDir se envía y no entra en la pila de deshacer', () => {
  escuchar();
  model.addNode('rect', bb());
  llamadas.length = 0;
  assert.deepEqual(model.setDir('LR'), { ok: true });
  assert.deepEqual(llamadas, [[{ type: 'setMeta', set: { dir: 'LR' } }]]);
  assert.equal(model.undo().ok, true);          // deshace el nodo, no la dirección
  assert.equal(state.dir, 'LR');
  assert.equal(state.nodes.length, 0);
});

// ---------- Solo lectura ----------
test('en solo lectura los gestos se rechazan sin cambiar nada ni llamar a onChange', () => {
  const { node } = model.addNode('rect', bb(10, 10));
  model.addNode('ellipse', bb(200, 10));
  const etiqueta = node.label;
  escuchar();
  model.setReadOnly('role');
  const denegado = { ok: false, reason: 'readonly' };
  assert.deepEqual(model.addNode('rect', bb(50)), denegado);
  assert.deepEqual(model.addEdge(state.nodes[0].id, state.nodes[1].id), denegado);
  assert.deepEqual(model.setLabel(node.id, 'otra'), denegado);
  assert.deepEqual(model.removeNode(node.id), denegado);
  assert.deepEqual(model.clear(), denegado);
  assert.deepEqual(model.undo(), denegado);
  assert.deepEqual(model.setDir('LR'), denegado);
  model.previewMove(node.id, 99, 99);
  assert.deepEqual(model.moveNode(node.id, { x: 10, y: 10 }, { x: 99, y: 99 }), denegado);
  assert.deepEqual([state.nodes.length, state.nodes[0].label, state.nodes[0].x, state.nodes[0].y, state.dir], [2, etiqueta, 10, 10, 'TD']);
  assert.equal(llamadas.length, 0);
  model.setReadOnly(null);
  assert.equal(model.addNode('rect', bb(50)).ok, true);
});

test('en solo lectura sigue aplicándose lo que llega de otros', () => {
  model.setReadOnly('role');
  assert.equal(model.applyRemote({ type: 'addNode', node: { id: 'x', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'x' } }).ok, true);
  assert.equal(state.nodes.length, 1);
});

// ---------- replaceState ----------
test('replaceState vuelca el diagrama en el mismo objeto, con copia, y no toca la pila de deshacer', () => {
  const { node } = model.addNode('rect', bb());
  const instantanea = structuredClone(state);
  instantanea.title = 'Con título';
  instantanea.dir = 'LR';
  const mismoObjeto = model.state;
  model.replaceState(instantanea);
  assert.equal(model.state, mismoObjeto);
  assert.deepEqual([state.title, state.dir, state.kind], ['Con título', 'LR', 'flow']);
  instantanea.nodes[0].label = 'cambiado después';
  assert.notEqual(state.nodes[0].label, 'cambiado después');   // no comparte objetos con la copia que se le dio
  assert.equal(model.undo().ok, true);                          // la pila sigue y deshace el nodo
  assert.equal(state.nodes.length, 0);
  assert.ok(node);
});
