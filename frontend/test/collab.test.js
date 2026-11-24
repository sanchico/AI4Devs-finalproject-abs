// collab.js: apertura, conciliación del registro con lo pendiente, huecos y cierre del canal, y la cola de envío.
// Sin red ni navegador: el transporte es transporte-simulado.js y el modelo no interviene.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollab } from '../collab.js';
import { apply, inverse } from '../ops.js';
import { mermaidCode } from '../kinds/index.js';
import { ServidorSimulado, TransporteSimulado, asentar, turno } from './helpers/transporte-simulado.js';
import { mulberry32, reproducir, vacio } from './helpers/red-simulada.js';

const nodo = (id, extra = {}) => ({ id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: id, ...extra });
const addNode = (id, extra) => ({ type: 'addNode', node: nodo(id, extra) });
const etiqueta = (id, label) => ({ type: 'updateNode', id, set: { label } });
const ids = s => s.nodes.map(n => n.id);
const grupo = (...ops) => ops.map((op, i) => ({ op_id: `op-${Math.random().toString(36).slice(2)}-${i}`, op }));

// Un cliente: su transporte, su cola y lo que la cola le ha ido contando
function cliente(servidor, opciones = {}) {
  const transport = new TransporteSimulado(servidor, opciones);
  const vistas = [], modos = [], avisos = [], esperas = [];
  const colab = createCollab({
    transport,
    onVisible: s => vistas.push(s),
    onMode: m => modos.push(m),
    onNotice: k => avisos.push(k),
    wait: async ms => { esperas.push(ms); },
  });
  return { transport, colab, vistas, modos, avisos, esperas, ultimoModo: () => modos.at(-1) };
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

for (const status of [404, 410]) {
  test(`un fallo de carga con estado ${status} se devuelve con su error, sin mostrar un diagrama a medias`, async () => {
    const c = cliente(new ServidorSimulado());
    const error = Object.assign(new Error('sin acceso'), { status });
    c.transport.load = async () => { throw error; };
    const r = await c.colab.open();
    assert.deepEqual([r.ok, r.reason], [false, 'load']);
    assert.equal(r.error, error);
    assert.equal(r.error.status, status);
    assert.deepEqual(c.ultimoModo(), { mode: 'offline', reason: 'load' });
    assert.equal(c.colab.visible(), null);
    assert.equal(c.vistas.length, 0);
  });
}

test('un fallo sin estado se devuelve con su error', async () => {
  const c = cliente(new ServidorSimulado());
  c.transport.fallaSuscripcion = true;
  const r = await c.colab.open();
  assert.equal(r.ok, false);
  assert.ok(r.error instanceof Error);
  assert.equal(r.error.status, undefined);
  assert.equal(c.ultimoModo().mode, 'offline');
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

// ---------- Cola: un grupo por gesto, en orden y de uno en uno ----------
const idsEnviados = c => c.transport.envios.map(g => g.map(it => it.op.node?.id ?? it.op.id));

test('dos gestos seguidos salen en orden y de uno en uno', async () => {
  const a = cliente(new ServidorSimulado());
  await a.colab.open();
  a.transport.retener = true;
  a.colab.local([addNode('a')]);
  a.colab.local([addNode('b')]);
  assert.deepEqual(idsEnviados(a), [['a']]);          // el segundo espera a la respuesta del primero
  a.transport.responder();
  await turno();
  assert.deepEqual(idsEnviados(a), [['a'], ['b']]);
});

test('cada operación lleva un op_id distinto, también entre gestos', async () => {
  const a = cliente(new ServidorSimulado());
  await a.colab.open();
  a.colab.local([addNode('a'), addNode('b')]);
  a.colab.local([addNode('c')]);
  await asentar([a.transport]);
  const opIds = a.transport.envios.flat().map(it => it.op_id);
  assert.equal(opIds.length, 3);
  assert.equal(new Set(opIds).size, 3);
  assert.ok(opIds.every(id => typeof id === 'string' && id.length >= 32));
});

test('un gesto vacío no envía nada', async () => {
  const a = cliente(new ServidorSimulado());
  await a.colab.open();
  assert.deepEqual(a.colab.local([]), { ok: true });
  await turno();
  assert.equal(a.transport.envios.length, 0);
});

test('un gesto de 1 200 operaciones sale en tramos de 500, 500 y 200, en orden', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  const ops = Array.from({ length: 1200 }, (_, i) => ({ type: 'removeNode', id: `n${i}` }));
  a.colab.local(ops);
  await asentar([a.transport]);
  assert.deepEqual(a.transport.envios.map(g => g.length), [500, 500, 200]);
  assert.deepEqual(a.transport.envios.flat().map(it => it.op.id), ops.map(o => o.id));
  assert.equal(s.registro.length, 1200);
});

// ---------- Rechazos del servidor ----------
for (const [status, key] of [[422, 'invalid_op'], [409, 'op_limit']]) {
  test(`${status} descarta ese grupo, avisa y envía el siguiente`, async () => {
    const s = new ServidorSimulado();
    const a = cliente(s);
    await a.colab.open();
    a.transport.fallos.push({ status, key });
    a.colab.local([addNode('a')]);
    a.colab.local([addNode('b')]);
    assert.deepEqual(ids(a.colab.visible()), ['a', 'b']);
    await asentar([a.transport]);
    assert.deepEqual(ids(a.colab.visible()), ['b']);
    assert.deepEqual(ids(a.colab.confirmed()), ['b']);
    assert.deepEqual(a.avisos, [key]);
    assert.equal(a.ultimoModo().mode, 'edit');
    assert.equal(a.transport.envios.length, 2);
  });
}

for (const [status, key, motivo] of [[403, 'forbidden', 'role'], [404, 'not_found', 'no-access'], [410, 'diagram_deleted', 'deleted']]) {
  test(`${status} descarta todos los grupos pendientes, avisa y deja solo lectura por "${motivo}"`, async () => {
    const s = new ServidorSimulado();
    const a = cliente(s);
    await a.colab.open();
    a.transport.fallos.push({ status, key });
    a.colab.local([addNode('a')]);
    a.colab.local([addNode('b')]);
    a.colab.local([addNode('c')]);
    await asentar([a.transport]);
    assert.deepEqual(a.colab.visible().nodes, []);
    assert.deepEqual(a.ultimoModo(), { mode: 'readonly', reason: motivo });
    assert.deepEqual(a.avisos, [key]);
    assert.equal(a.transport.envios.length, 1);                      // los otros dos ya no se envían
    assert.deepEqual(a.colab.local([addNode('d')]), { ok: false, reason: 'readonly' });
  });
}

test('en solo lectura tras un rechazo sigue aplicándose lo que escriben los demás', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  a.transport.fallos.push({ status: 403, key: 'forbidden' });
  a.colab.local([addNode('a')]);
  await asentar([a.transport]);
  s.guardar(grupo(addNode('z')));
  a.transport.entregarTodo();
  assert.deepEqual(ids(a.colab.visible()), ['z']);
});

// ---------- Fallos de red ----------
test('un fallo de red y un acierto guardan el grupo una sola vez, con los mismos op_id', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  a.transport.fallos.push({ status: null });
  a.colab.local([addNode('a'), addNode('b')]);
  await asentar([a.transport]);
  assert.equal(a.transport.envios.length, 2);
  assert.deepEqual(a.transport.envios[1], a.transport.envios[0]);
  assert.equal(s.registro.length, 2);
  assert.deepEqual(a.esperas, [500]);
  assert.equal(a.ultimoModo().mode, 'edit');
  assert.deepEqual(ids(a.colab.confirmed()), ['a', 'b']);
});

test('si se perdió la respuesta pero el servidor guardó el grupo, el reintento no lo duplica', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  a.transport.fallos.push({ status: null, guardado: true });
  a.colab.local([addNode('a')]);
  await asentar([a.transport]);
  assert.equal(s.registro.length, 1);
  assert.deepEqual(ids(a.colab.confirmed()), ['a']);
  assert.deepEqual(a.colab.visible(), a.colab.confirmed());
});

test('cuatro fallos seguidos dejan el diagrama sin conexión, con lo que se veía', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  a.transport.fallos.push({ status: null }, { status: null }, { status: null }, { status: null });
  a.colab.local([addNode('a')]);
  a.colab.local([addNode('b')]);
  await asentar([a.transport]);
  assert.equal(a.transport.envios.length, 4);                       // la primera y tres reintentos; b no llega a salir
  assert.deepEqual(a.esperas, [500, 1000, 2000]);
  assert.deepEqual(a.ultimoModo(), { mode: 'offline', reason: 'network' });
  assert.deepEqual(a.avisos, ['network']);
  assert.deepEqual(ids(a.colab.visible()), ['a', 'b']);
  assert.deepEqual(a.colab.local([addNode('c')]), { ok: false, reason: 'offline' });
  assert.equal(s.registro.length, 0);
});

test('una llamada que lanza una excepción se trata como un fallo de red', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  const enviar = a.transport.send.bind(a.transport);
  let primera = true;
  a.transport.send = g => { if (primera) { primera = false; return Promise.reject(new Error('sin red')); } return enviar(g); };
  a.colab.local([addNode('a')]);
  await asentar([a.transport]);
  assert.deepEqual(ids(a.colab.confirmed()), ['a']);
  assert.deepEqual(a.esperas, [500]);
});

test('otro estado inesperado del servidor deja el diagrama sin conexión', async () => {
  const a = cliente(new ServidorSimulado());
  await a.colab.open();
  a.transport.fallos.push({ status: 500, key: 'boom' });
  a.colab.local([addNode('a')]);
  await asentar([a.transport]);
  assert.deepEqual(a.ultimoModo(), { mode: 'offline', reason: 'network' });
});

// ---------- Sin editar ----------
test('sin conexión o en solo lectura por rol, local no envía nada', async () => {
  const s = new ServidorSimulado();
  const [lector, caido] = [cliente(s, { rol: 'viewer' }), cliente(s)];
  await lector.colab.open();
  await caido.colab.open();
  caido.transport.cerrarCanal();
  assert.deepEqual(lector.colab.local([addNode('a')]), { ok: false, reason: 'readonly' });
  assert.deepEqual(caido.colab.local([addNode('a')]), { ok: false, reason: 'offline' });
  await turno();
  assert.equal(lector.transport.envios.length + caido.transport.envios.length, 0);
});

test('si el canal se cierra mientras se reintenta, no se sigue enviando', async () => {
  const s = new ServidorSimulado();
  const a = cliente(s);
  await a.colab.open();
  a.transport.fallos.push({ status: null }, { status: null });
  assert.equal(a.colab.local([addNode('a')]).ok, true);
  a.transport.cerrarCanal();
  await asentar([a.transport]);
  assert.equal(a.transport.envios.length, 1);
  assert.deepEqual(a.ultimoModo(), { mode: 'offline', reason: 'closed' });
});

// ---------- Convergencia de varios clientes (criterio de terminado 2) ----------
// Tres clientes con gestos aleatorios (ráfagas, deshacer, vaciar, cambios de dirección y de título), respuestas y
// entregas en orden barajado, algún rechazo y algún fallo de red, y uno que se une a mitad. Cada cliente de prueba
// hace lo que el modelo: aplica el gesto a su diagrama, apila las inversas y se lo pasa a collab.local. Al final
// los tres tienen el mismo diagrama que resulta de reproducir el registro, y el mismo código Mermaid.
function clienteDePrueba(nombre, servidor) {
  const transport = new TransporteSimulado(servidor);
  transport.retener = true;
  const h = { nombre, transport, state: null, historia: [], avisos: [], modo: null, n: 0 };
  h.colab = createCollab({
    transport,
    onVisible: s => { h.state = s; },
    onMode: m => { h.modo = m; },
    onNotice: k => h.avisos.push(k),
    wait: async () => {},
  });
  h.hacer = ops => {
    const grupo = [], aplicadas = [];
    for (const op of ops) {
      const inv = inverse(h.state, op), r = apply(h.state, op);
      if (r.ok) { grupo.push(inv); aplicadas.push(op); }
    }
    if (grupo.length) h.historia.push(grupo);
    h.enviar(aplicadas);
  };
  h.deshacer = () => {
    while (h.historia.length) {
      const g = h.historia.pop(), ops = [];
      for (const u of g.reverse()) for (const op of u) if (apply(h.state, op).ok) ops.push(op);
      if (ops.length) { h.enviar(ops); return; }
    }
  };
  // Lo que la cola muestra tras un gesto (confirmado + pendiente) tiene que ser lo que el modelo ya mostraba
  h.enviar = ops => {
    if (!ops.length) return;
    const mostrado = structuredClone(h.state);
    h.colab.local(ops);
    assert.deepEqual(h.state, mostrado, `${nombre}: tras un gesto, confirmado + pendiente no es lo que mostraba el modelo`);
  };
  return h;
}

function gestoAleatorio(h, rng) {
  const n = h.state.nodes, e = h.state.edges;
  const entero = tope => Math.floor(rng() * tope);
  const uno = lista => lista[entero(lista.length)];
  const r = rng();
  if (r < 0.30 || n.length === 0) {
    const at = rng() < 0.5 ? { at: entero(n.length + 1) } : {};
    h.hacer([{ type: 'addNode', node: { id: `${h.nombre}-${++h.n}`, shape: 'rect', x: entero(400), y: entero(300), w: 80, h: 40, label: `n${entero(100)}` }, ...at }]);
  } else if (r < 0.45 && n.length >= 2) {
    const [a, b] = [uno(n), uno(n)];
    h.hacer([{ type: 'addEdge', edge: { id: `${h.nombre}-e${++h.n}`, from: a.id, to: b.id, label: '' } }]);
  } else if (r < 0.62) {
    h.hacer([{ type: 'updateNode', id: uno(n).id, set: rng() < 0.5 ? { label: `L${entero(100)}` } : { x: entero(400), y: entero(300) } }]);
  } else if (r < 0.69) {
    h.hacer([{ type: 'removeNode', id: uno(n).id }]);
  } else if (r < 0.71) {
    h.hacer(n.map(x => ({ type: 'removeNode', id: x.id })));
  } else if (r < 0.77) {
    h.hacer([{ type: 'setMeta', set: rng() < 0.5 ? { dir: rng() < 0.5 ? 'TD' : 'LR' } : { title: `T${entero(100)}` } }]);
  } else if (r < 0.83 && e.length) {
    h.hacer([{ type: 'updateEdge', id: uno(e).id, set: { label: `e${entero(100)}` } }]);
  } else if (r < 0.88 && e.length) {
    h.hacer([{ type: 'removeEdge', id: uno(e).id }]);
  } else {
    h.deshacer();
  }
}

async function simular(semilla) {
  const rng = mulberry32(semilla);
  const servidor = new ServidorSimulado();
  const clientes = ['A', 'B', 'C'].map(n => clienteDePrueba(n, servidor));
  await clientes[0].colab.open();
  await clientes[1].colab.open();
  const UNIRSE = 40, PASOS = 140;
  for (let paso = 0; paso < PASOS; paso++) {
    if (paso === UNIRSE) await clientes[2].colab.open();
    const activos = clientes.filter(c => c.state);
    const c = activos[Math.floor(rng() * activos.length)];
    const r = rng();
    if (r < 0.45) { for (let i = rng() < 0.15 ? 3 + Math.floor(rng() * 4) : 1; i > 0; i--) gestoAleatorio(c, rng); }
    else if (r < 0.70) c.transport.responder();
    else c.transport.entregar();
    if (rng() < 0.03 && !c.transport.fallos.length) {
      c.transport.fallos.push(rng() < 0.5 ? { status: 422, key: 'invalid_op' } : { status: null, guardado: rng() < 0.5 });
    }
    await turno();
    for (const x of activos) assert.deepEqual(x.state, x.colab.visible(), `semilla ${semilla}, paso ${paso}: ${x.nombre} ve algo distinto de confirmado + pendiente`);
  }
  await asentar(clientes.map(c => c.transport));
  const esperado = reproducir(servidor.registro, vacio());
  assert.ok(servidor.registro.length >= 15, `semilla ${semilla}: casi no hubo operaciones (${servidor.registro.length})`);
  for (const c of clientes) {
    assert.deepEqual(c.colab.confirmed(), esperado, `semilla ${semilla}: ${c.nombre} confirmado ≠ registro reproducido`);
    assert.deepEqual(c.colab.visible(), esperado, `semilla ${semilla}: ${c.nombre} visible ≠ registro reproducido`);
    assert.deepEqual(c.state, esperado, `semilla ${semilla}: ${c.nombre} lo que muestra ≠ registro reproducido`);
    assert.equal(mermaidCode(c.state, c.state.kind, c.state.dir), mermaidCode(esperado, esperado.kind, esperado.dir), `semilla ${semilla}: ${c.nombre} Mermaid distinto`);
    assert.deepEqual(c.modo, { mode: 'edit', reason: null }, `semilla ${semilla}: ${c.nombre} no quedó en edición`);
    assert.ok(c.avisos.every(k => k === 'invalid_op'), `semilla ${semilla}: ${c.nombre} avisos inesperados ${c.avisos}`);
  }
  return servidor.registro.length;
}

test('tres clientes con gestos aleatorios, rechazos y fallos de red convergen (semillas 1 a 50)', async () => {
  let total = 0;
  for (let semilla = 1; semilla <= 50; semilla++) total += await simular(semilla);
  assert.ok(total > 1500, `pocas operaciones en total: ${total}`);
});
