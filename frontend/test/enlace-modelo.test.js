// El enlace entre el modelo real y collab.js, tal como lo hará la app: el modelo pasa sus gestos a la cola
// (onChange), la cola le devuelve el diagrama visible (replaceState) y el modo (setReadOnly).
// El otro miembro es una cola sin modelo. Sin red: el servidor y los transportes son simulados.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../model.js';
import { createCollab } from '../collab.js';
import { ServidorSimulado, TransporteSimulado, asentar } from './helpers/transporte-simulado.js';

const { state } = model;
const bb = (x = 0) => ({ x, y: 0, w: 80, h: 40 });
const ids = s => s.nodes.map(n => n.id);

beforeEach(() => { model.onChange(null); model.setReadOnly(null); model.reset(); });

// Lo que hará main.js: la cola gobierna el modelo
async function enlazar(servidor, opciones = {}) {
  const transport = new TransporteSimulado(servidor, opciones);
  const avisos = [];
  const colab = createCollab({
    transport,
    onVisible: model.replaceState,
    onMode: m => model.setReadOnly(m.mode === 'edit' ? null : (m.reason ?? m.mode)),
    onNotice: k => avisos.push(k),
    wait: async () => {},
  });
  model.onChange(colab.local);
  await colab.open();
  return { transport, colab, avisos };
}
// Otro miembro, sin modelo
async function otroMiembro(servidor, opciones = {}) {
  const transport = new TransporteSimulado(servidor, opciones);
  const colab = createCollab({ transport, wait: async () => {} });
  await colab.open();
  return { transport, colab };
}

test('un gesto del modelo llega a otro miembro y el diagrama es el mismo', async () => {
  const s = new ServidorSimulado();
  const yo = await enlazar(s);
  const otro = await otroMiembro(s);
  const { node } = model.addNode('rect', bb());
  await asentar([yo.transport, otro.transport]);
  assert.deepEqual(ids(otro.colab.visible()), [node.id]);
  assert.deepEqual(state, otro.colab.visible());
  assert.deepEqual(model.state, yo.colab.confirmed());
});

test('limpiar es un solo gesto y deshacer lo envía como otro', async () => {
  const s = new ServidorSimulado();
  const yo = await enlazar(s);
  const otro = await otroMiembro(s);
  model.addNode('rect', bb(0)); model.addNode('ellipse', bb(100)); model.addNode('rect', bb(200));
  await asentar([yo.transport, otro.transport]);
  yo.transport.envios.length = 0;
  assert.deepEqual(model.clear(), { ok: true });
  await asentar([yo.transport, otro.transport]);
  assert.deepEqual(yo.transport.envios.map(g => g.length), [3]);       // un grupo con los tres borrados
  assert.deepEqual(otro.colab.visible().nodes, []);
  const r = model.undo();
  assert.equal(r.ok, true);
  await asentar([yo.transport, otro.transport]);
  assert.equal(otro.colab.visible().nodes.length, 3);
  assert.deepEqual(otro.colab.visible(), state);
});

test('deshacer envía la inversa del último gesto propio y los demás dejan de ver el nodo', async () => {
  const s = new ServidorSimulado();
  const yo = await enlazar(s);
  const otro = await otroMiembro(s);
  const { node } = model.addNode('rect', bb());
  await asentar([yo.transport, otro.transport]);
  assert.equal(model.undo().ok, true);
  await asentar([yo.transport, otro.transport]);
  assert.deepEqual(s.registro.at(-1).op, { type: 'removeNode', id: node.id });
  assert.deepEqual(otro.colab.visible().nodes, []);
  assert.deepEqual(state.nodes, []);
});

test('cambiar la dirección se envía y deshacer no la revierte', async () => {
  const s = new ServidorSimulado();
  const yo = await enlazar(s);
  const otro = await otroMiembro(s);
  model.addNode('rect', bb());
  model.setDir('LR');
  await asentar([yo.transport, otro.transport]);
  assert.equal(otro.colab.visible().dir, 'LR');
  model.undo();                                   // deshace el nodo, no la dirección
  await asentar([yo.transport, otro.transport]);
  assert.deepEqual([otro.colab.visible().dir, otro.colab.visible().nodes.length], ['LR', 0]);
  assert.equal(state.dir, 'LR');
});

test('lo que escribe otro miembro aparece en el modelo y no entra en su pila de deshacer', async () => {
  const s = new ServidorSimulado();
  const yo = await enlazar(s);
  const otro = await otroMiembro(s);
  otro.colab.local([{ type: 'addNode', node: { id: 'ajeno', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'ajeno' } }]);
  await asentar([yo.transport, otro.transport]);
  assert.deepEqual(ids(state), ['ajeno']);
  assert.deepEqual(model.undo(), { ok: false, reason: 'empty' });
  assert.deepEqual(ids(state), ['ajeno']);
});

test('lo propio sigue visible al llegar lo ajeno, y gana el orden del servidor', async () => {
  const s = new ServidorSimulado();
  const yo = await enlazar(s);
  const otro = await otroMiembro(s);
  const { node } = model.addNode('rect', bb());
  await asentar([yo.transport, otro.transport]);
  otro.colab.local([{ type: 'updateNode', id: node.id, set: { label: 'del otro' } }]);   // el servidor la ordena primero
  model.setLabel(node.id, 'mía');
  assert.equal(state.nodes[0].label, 'mía');
  yo.transport.entregar();                                                              // llega la del otro
  assert.equal(state.nodes[0].label, 'mía');                                            // lo mío sigue encima mientras no se confirma
  await asentar([yo.transport, otro.transport]);
  assert.equal(state.nodes[0].label, 'mía');
  assert.equal(otro.colab.visible().nodes[0].label, 'mía');
});

test('un lector no puede dibujar pero ve lo que escriben los editores', async () => {
  const s = new ServidorSimulado();
  const lector = await enlazar(s, { rol: 'viewer' });
  const editor = await otroMiembro(s);
  assert.deepEqual(model.addNode('rect', bb()), { ok: false, reason: 'readonly' });
  assert.deepEqual(model.setDir('LR'), { ok: false, reason: 'readonly' });
  assert.equal(s.registro.length, 0);
  editor.colab.local([{ type: 'addNode', node: { id: 'e', shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'e' } }]);
  await asentar([lector.transport, editor.transport]);
  assert.deepEqual(ids(state), ['e']);
});

test('un 403 del servidor descarta lo pendiente del modelo y lo deja en solo lectura', async () => {
  const s = new ServidorSimulado();
  const yo = await enlazar(s);
  yo.transport.fallos.push({ status: 403, key: 'forbidden' });
  model.addNode('rect', bb());
  assert.equal(state.nodes.length, 1);                                                   // se ve al instante
  await asentar([yo.transport]);
  assert.deepEqual(state.nodes, []);                                                     // el servidor lo rechazó
  assert.deepEqual(yo.avisos, ['forbidden']);
  assert.deepEqual(model.addNode('rect', bb()), { ok: false, reason: 'readonly' });
});

test('el modelo no admite gestos mientras se carga el diagrama', async () => {
  const s = new ServidorSimulado();
  const transport = new TransporteSimulado(s);
  const colab = createCollab({ transport, onVisible: model.replaceState, onMode: m => model.setReadOnly(m.mode === 'edit' ? null : (m.reason ?? m.mode)), wait: async () => {} });
  model.onChange(colab.local);
  let durante;
  transport.antesDeCargar = async () => { durante = model.addNode('rect', bb()); };
  await colab.open();
  assert.deepEqual(durante, { ok: false, reason: 'readonly' });   // el modelo rechaza con el mismo motivo en cualquier modo que no edita
  assert.equal(model.addNode('rect', bb()).ok, true);
});

test('sin enlazar nada, el modelo sigue funcionando en solitario', () => {
  assert.equal(model.addNode('rect', bb()).ok, true);
  assert.equal(model.undo().ok, true);
  assert.deepEqual(state.nodes, []);
});
