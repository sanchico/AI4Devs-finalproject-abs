// collab.js: apertura, conciliación del registro con lo pendiente, huecos y cierre del canal, y la cola de envío.
// Sin red ni navegador: el transporte es transporte-simulado.js y el modelo no interviene.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollab } from '../collab.js';
import { ServidorSimulado, TransporteSimulado, asentar, turno } from './helpers/transporte-simulado.js';

const nodo = (id, extra = {}) => ({ id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: id, ...extra });
const addNode = (id, extra) => ({ type: 'addNode', node: nodo(id, extra) });
const etiqueta = (id, label) => ({ type: 'updateNode', id, set: { label } });
const ids = s => s.nodes.map(n => n.id);
const grupo = (...ops) => ops.map((op, i) => ({ op_id: `op-${Math.random().toString(36).slice(2)}-${i}`, op }));

// Un cliente: su transporte, su cola y lo que la cola le ha ido contando
function cliente(servidor, opciones = {}) {
  const transport = new TransporteSimulado(servidor, opciones);
  const vistas = [], modos = [], avisos = [];
  const colab = createCollab({
    transport,
    onVisible: s => vistas.push(s),
    onMode: m => modos.push(m),
    onNotice: k => avisos.push(k),
    wait: async () => {},
  });
  return { transport, colab, vistas, modos, avisos, ultimoModo: () => modos.at(-1) };
}

// ---------- Apertura ----------
test('abre con el tipo y el registro del servidor, y queda en edición', async () => {
  const s = new ServidorSimulado({ kind: 'state' });
  s.guardar(grupo(addNode('a'), { type: 'setMeta', set: { title: 'Login', dir: 'LR' } }));
  const c = cliente(s);
  const r = await c.colab.open();
  assert.deepEqual(r, { ok: true });
  const v = c.colab.visible();
  assert.deepEqual([v.kind, v.title, v.dir, ids(v)], ['state', 'Login', 'LR', ['a']]);
  assert.deepEqual(c.modos, [{ mode: 'loading', reason: null }, { mode: 'edit', reason: null }]);
});

test('al abrir, el diagrama visible se entrega una sola vez', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('a'), addNode('b'), addNode('c')));
  const c = cliente(s);
  await c.colab.open();
  assert.equal(c.vistas.length, 1);
  assert.deepEqual(ids(c.vistas[0]), ['a', 'b', 'c']);
});

test('un diagrama sin operaciones abre vacío y sin título propio', async () => {
  const c = cliente(new ServidorSimulado());
  await c.colab.open();
  const v = c.colab.visible();
  assert.deepEqual([v.kind, v.dir, v.nodes, v.edges], ['flow', 'TD', [], []]);
  assert.equal(v.title, 'Diagrama sin título');
});

test('un rol de lector abre en solo lectura por rol', async () => {
  const c = cliente(new ServidorSimulado(), { rol: 'viewer' });
  await c.colab.open();
  assert.deepEqual(c.ultimoModo(), { mode: 'readonly', reason: 'role' });
});

test('no admite gestos hasta terminar la carga', async () => {
  const c = cliente(new ServidorSimulado());
  assert.deepEqual(c.colab.local([addNode('a')]), { ok: false, reason: 'loading' });
  await c.colab.open();
  assert.deepEqual(c.colab.local([addNode('a')]), { ok: true });
});

test('una operación que llega durante la carga, tras leer el registro, se aplica una vez', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('a')));
  const c = cliente(s);
  c.transport.despuesDeCargar = async () => { s.guardar(grupo(addNode('b'))); c.transport.entregarTodo(); };
  await c.colab.open();
  assert.deepEqual(ids(c.colab.visible()), ['a', 'b']);
});

test('una operación que está a la vez en lo cargado y en el canal se aplica una vez', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('a')));
  const c = cliente(s);
  c.transport.antesDeCargar = async () => { s.guardar(grupo(addNode('b'))); c.transport.entregarTodo(); };
  await c.colab.open();
  assert.deepEqual(ids(c.colab.visible()), ['a', 'b']);
});

test('un fallo al suscribirse o al cargar deja el diagrama sin conexión', async () => {
  const [a, b] = [cliente(new ServidorSimulado()), cliente(new ServidorSimulado())];
  a.transport.fallaSuscripcion = true;
  b.transport.fallaCarga = true;
  for (const c of [a, b]) {
    assert.equal((await c.colab.open()).ok, false);
    assert.deepEqual(c.ultimoModo(), { mode: 'offline', reason: 'load' });
  }
});

// ---------- Registro: una vez y en orden ----------
test('una entrada con una secuencia ya aplicada se ignora', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('a')));
  const c = cliente(s);
  await c.colab.open();
  const antes = c.vistas.length;
  c.transport.onEntry({ seq: 1, op_id: 'repetida', op: addNode('z') });
  assert.deepEqual(ids(c.colab.visible()), ['a']);
  assert.equal(c.vistas.length, antes);
  assert.equal(c.ultimoModo().mode, 'edit');
});

test('un salto de secuencia deja sin conexión sin aplicar la operación y conserva el diagrama', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('a')));
  const c = cliente(s);
  await c.colab.open();
  c.transport.onEntry({ seq: 3, op_id: 'salto', op: addNode('z') });
  assert.deepEqual(c.ultimoModo(), { mode: 'offline', reason: 'gap' });
  assert.deepEqual(ids(c.colab.visible()), ['a']);
  assert.deepEqual(c.avisos, ['gap']);
  c.transport.onEntry({ seq: 2, op_id: 'tarde', op: addNode('y') });   // ya no se aplica nada más
  assert.deepEqual(ids(c.colab.visible()), ['a']);
});

test('el cierre del canal deja sin conexión con el mismo diagrama', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('a')));
  const c = cliente(s);
  await c.colab.open();
  c.transport.cerrarCanal();
  assert.deepEqual(c.ultimoModo(), { mode: 'offline', reason: 'closed' });
  assert.deepEqual(ids(c.colab.visible()), ['a']);
  assert.deepEqual(c.avisos, ['closed']);
});

test('un lector sigue viendo lo que escriben los demás', async () => {
  const s = new ServidorSimulado();
  const lector = cliente(s, { rol: 'viewer' });
  await lector.colab.open();
  s.guardar(grupo(addNode('a')));
  lector.transport.entregarTodo();
  assert.deepEqual(ids(lector.colab.visible()), ['a']);
});

// ---------- Conciliación: confirmado + pendiente ----------
test('lo visible es el confirmado más lo pendiente', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('x')));
  const c = cliente(s);
  await c.colab.open();
  c.transport.retener = true;
  c.colab.local([addNode('p')]);
  assert.deepEqual(ids(c.colab.visible()), ['x', 'p']);
  assert.deepEqual(ids(c.colab.confirmed()), ['x']);
  assert.deepEqual(ids(c.vistas.at(-1)), ['x', 'p']);   // lo propio se ve al instante
});

test('lo ajeno llega con un gesto pendiente: se ve lo ajeno con lo pendiente encima', async () => {
  const s = new ServidorSimulado();
  const c = cliente(s);
  await c.colab.open();
  c.transport.retener = true;
  c.colab.local([addNode('p')]);
  const otro = cliente(s);
  await otro.colab.open();
  s.guardar(grupo(addNode('q')));
  c.transport.entregar();                  // primero llega la propia (p), luego la ajena (q): se entregan en orden
  c.transport.entregar();
  assert.deepEqual(ids(c.colab.visible()), ['p', 'q']);
  assert.deepEqual(ids(c.colab.confirmed()), ['p', 'q']);
});

test('gana el orden del servidor: dos cambios de la misma etiqueta acaban igual en los dos', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('x')));
  const [a, b] = [cliente(s), cliente(s)];
  await a.colab.open();
  await b.colab.open();
  b.colab.local([etiqueta('x', 'de B')]);   // el servidor ordena primero la de B...
  a.colab.local([etiqueta('x', 'de A')]);   // ...y después la de A
  assert.equal(b.colab.visible().nodes[0].label, 'de B');   // cada uno ve lo suyo antes de saber lo ajeno
  assert.equal(a.colab.visible().nodes[0].label, 'de A');
  await asentar([a.transport, b.transport]);
  for (const c of [a, b]) {
    assert.equal(c.colab.visible().nodes[0].label, 'de A');
    assert.deepEqual(c.colab.visible(), c.colab.confirmed());
  }
});

test('con un gesto pendiente de A, lo ajeno que llega antes no lo pisa en lo que A ve', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('x')));
  const [a, b] = [cliente(s), cliente(s)];
  await a.colab.open();
  await b.colab.open();
  b.colab.local([etiqueta('x', 'de B')]);
  a.transport.retener = true;
  a.colab.local([etiqueta('x', 'de A')]);
  a.transport.entregar();                  // llega la de B antes que la propia
  assert.equal(a.colab.confirmed().nodes[0].label, 'de B');
  assert.equal(a.colab.visible().nodes[0].label, 'de A');   // lo pendiente sigue encima
});

test('un pendiente que deja de valer porque otro borró el nodo no da error', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo(addNode('x')));
  const a = cliente(s);
  await a.colab.open();
  s.guardar(grupo({ type: 'removeNode', id: 'x' }));   // otro miembro lo borra y A aún no se ha enterado
  a.colab.local([etiqueta('x', 'mío')]);
  assert.equal(a.colab.visible().nodes[0].label, 'mío');
  await asentar([a.transport]);
  assert.deepEqual(a.colab.visible().nodes, []);
  assert.deepEqual(a.colab.confirmed().nodes, []);
  assert.deepEqual(a.avisos, []);
});

test('el registro llega antes que la respuesta: se aplica una vez y la respuesta no cambia nada', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  a.transport.retener = true;
  a.colab.local([addNode('p')]);
  a.transport.entregarTodo();                       // llega la propia por el canal
  assert.deepEqual(ids(a.colab.confirmed()), ['p']);
  assert.deepEqual(ids(a.colab.visible()), ['p']);
  const antes = a.vistas.length;
  a.transport.responder();
  await turno();
  assert.deepEqual(ids(a.colab.visible()), ['p']);
  assert.equal(a.vistas.length, antes);
  assert.deepEqual(a.avisos, []);
});

test('la respuesta llega antes que el registro: lo propio sigue pendiente hasta verlo', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  a.colab.local([addNode('p')]);
  await turno();                                      // la respuesta ya llegó
  assert.deepEqual(ids(a.colab.confirmed()), []);
  assert.deepEqual(ids(a.colab.visible()), ['p']);
  a.transport.entregarTodo();
  assert.deepEqual(ids(a.colab.confirmed()), ['p']);
});
