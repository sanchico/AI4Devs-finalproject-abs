// Convergencia de varios clientes con operaciones pendientes (criterio de terminado 2 del PRD), sin red.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../ops.js';
import { mermaidCode } from '../kinds/index.js';
import { Servidor, Cliente, asentar, reproducir, mulberry32, vacio } from './helpers/red-simulada.js';

const nodo = (id, extra = {}) => ({ id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: id, ...extra });
const arista = (id, from, to) => ({ id, from, to, label: '' });
const inicialCon = (nodes = [], edges = []) => ({ ...vacio(), nodes, edges });
const ids = s => s.nodes.map(n => n.id);
const codigo = s => mermaidCode(s, s.kind, s.dir);

// Lo que exige el criterio: visible, confirmado y el registro reproducido son iguales, y el Mermaid también
function comprobarConvergencia(servidor, inicial, etiqueta = '') {
  const esperado = reproducir(servidor.registro, inicial);
  for (const c of servidor.clientes) {
    assert.deepEqual(c.pendientes, [], `${etiqueta} ${c.nombre}: quedan pendientes`);
    assert.deepEqual(c.confirmado, esperado, `${etiqueta} ${c.nombre}: confirmado ≠ registro reproducido`);
    assert.deepEqual(c.visible, esperado, `${etiqueta} ${c.nombre}: visible ≠ registro reproducido`);
    assert.equal(codigo(c.visible), codigo(esperado), `${etiqueta} ${c.nombre}: Mermaid distinto`);
  }
  return esperado;
}
function escenario(inicial, nombres = ['A', 'B']) {
  const servidor = new Servidor();
  return { servidor, clientes: nombres.map(n => new Cliente(n, servidor, inicial)) };
}

// ---------- Un solo cliente ----------
test('visible incluye lo pendiente y al confirmarse es igual a confirmado', () => {
  const { servidor, clientes: [a] } = escenario(vacio(), ['A']);
  a.editar({ type: 'addNode', node: nodo('p') });
  assert.deepEqual(ids(a.visible), ['p']);
  assert.deepEqual(ids(a.confirmado), []);
  asentar(servidor);
  assert.deepEqual(a.visible, a.confirmado);
  assert.deepEqual(ids(a.confirmado), ['p']);
});

// ---------- Casos escritos a mano ----------
test('(a) dos inserciones en la misma posición: mismo orden de nodos y mismo Mermaid en ambos', () => {
  const inicial = inicialCon([nodo('x')]);
  const { servidor, clientes: [a, b] } = escenario(inicial);
  a.editar({ type: 'addNode', node: nodo('p'), at: 0 });
  b.editar({ type: 'addNode', node: nodo('q'), at: 0 });
  assert.deepEqual(ids(a.visible), ['p', 'x']);   // cada uno ve lo suyo antes de saber lo ajeno
  assert.deepEqual(ids(b.visible), ['q', 'x']);
  b.enviar(); a.enviar();                          // el servidor ordena q, p
  asentar(servidor);
  const fin = comprobarConvergencia(servidor, inicial, '(a)');
  assert.deepEqual(ids(fin), ['p', 'q', 'x']);
  assert.match(codigo(fin), /n1\["p"\]\n {2}n2\["q"\]\n {2}n3\["x"\]/);
});

test('(b) dos updateNode de la misma etiqueta: gana la última del registro en todos', () => {
  const inicial = inicialCon([nodo('x')]);
  const { servidor, clientes: [a, b] } = escenario(inicial);
  a.editar({ type: 'updateNode', id: 'x', set: { label: 'de A' } });
  b.editar({ type: 'updateNode', id: 'x', set: { label: 'de B' } });
  a.enviar(); b.enviar();
  asentar(servidor);
  const fin = comprobarConvergencia(servidor, inicial, '(b)');
  assert.equal(fin.nodes[0].label, 'de B');
});

test('(c) uno borra un nodo y otro lo edita: el nodo no existe en ninguno', () => {
  const inicial = inicialCon([nodo('x'), nodo('y')], [arista('e', 'x', 'y')]);
  const { servidor, clientes: [a, b] } = escenario(inicial);
  a.editar({ type: 'removeNode', id: 'x' });
  b.editar({ type: 'updateNode', id: 'x', set: { label: 'nuevo' } });
  a.enviar(); b.enviar();
  asentar(servidor);
  const fin = comprobarConvergencia(servidor, inicial, '(c)');
  assert.deepEqual(ids(fin), ['y']);
  assert.deepEqual(fin.edges, []);
});

test('(d) los dos crean la misma arista: la segunda se descarta en todos', () => {
  const inicial = inicialCon([nodo('x'), nodo('y')]);
  const { servidor, clientes: [a, b] } = escenario(inicial);
  a.editar({ type: 'addEdge', edge: arista('eA', 'x', 'y') });
  b.editar({ type: 'addEdge', edge: arista('eB', 'x', 'y') });
  b.enviar(); a.enviar();
  asentar(servidor);
  const fin = comprobarConvergencia(servidor, inicial, '(d)');
  assert.deepEqual(fin.edges.map(e => e.id), ['eB']);
});

test('(e) una pendiente que el registro deja sin efecto desaparece de lo visible', () => {
  const inicial = inicialCon([nodo('x'), nodo('y')]);
  const { servidor, clientes: [a, b] } = escenario(inicial);
  a.editar({ type: 'addEdge', edge: arista('e', 'x', 'y') });
  b.editar({ type: 'removeNode', id: 'y' });
  assert.equal(a.visible.edges.length, 1);
  b.enviar();
  a.entregar();                                    // A recibe el borrado antes de que se confirme su arista
  assert.equal(a.pendientes.length, 1);
  assert.deepEqual(a.visible.edges, []);           // la pendiente ya no tiene efecto
  a.enviar();
  asentar(servidor);
  const fin = comprobarConvergencia(servidor, inicial, '(e)');
  assert.deepEqual(fin.edges, []);
});

// ---------- Control negativo: aplicar lo propio al momento y no repetirlo diverge ----------
// Es la regla "por campo" del PRD v0.6. Este cliente solo existe para comprobar que la red simulada
// produce conflictos de verdad: si dejara de hacerlo, este test fallaría.
class ClienteAlMomento extends Cliente {
  estado = structuredClone(this.confirmado);
  get visible() { return this.estado; }
  editar(op) { super.editar(op); apply(this.estado, op); }
  entregar() {
    const e = this.bandeja.shift();
    if (!e) return false;
    this.ultimaSeq = e.seq;
    if (e.opId === this.enVuelo?.opId) { this.pendientes.shift(); this.enVuelo = null; } // lo propio no se repite
    else apply(this.estado, e.op);
    return true;
  }
}

test('control: aplicar lo propio al momento y no repetirlo diverge en la inserción en la misma posición', () => {
  const inicial = inicialCon([nodo('x')]);
  const servidor = new Servidor();
  const a = new ClienteAlMomento('A', servidor, inicial), b = new ClienteAlMomento('B', servidor, inicial);
  a.editar({ type: 'addNode', node: nodo('p'), at: 0 });
  b.editar({ type: 'addNode', node: nodo('q'), at: 0 });
  b.enviar(); a.enviar();
  asentar(servidor);
  assert.deepEqual(ids(a.visible), ['q', 'p', 'x']);
  assert.deepEqual(ids(b.visible), ['p', 'q', 'x']);
  assert.notEqual(codigo(a.visible), codigo(b.visible));
});

// ---------- Ráfagas con semilla fija ----------
const SEMILLAS = 100, CLIENTES = 3, PASOS = 40;
const TIPOS = ['addNode', 'updateNode', 'removeNode', 'addEdge', 'updateEdge', 'removeEdge', 'setMeta'];

// Un gesto aleatorio sobre lo que el cliente ve; los ids son deterministas (c1-n3), no UUID
function operacionAleatoria(c, rng) {
  const ent = n => Math.floor(rng() * n), elige = l => l[ent(l.length)];
  const v = c.visible, id = `${c.nombre}-${c.contador + 1}`;
  const tipo = elige([...TIPOS, 'addNode', 'updateNode', 'addEdge']);
  const n = v.nodes.length, e = v.edges.length;
  if (tipo === 'updateNode' && n) return { type: tipo, id: elige(v.nodes).id, set: rng() < 0.5 ? { label: id } : { x: ent(500), y: ent(500) } };
  if (tipo === 'removeNode' && n > 2) return { type: tipo, id: elige(v.nodes).id };
  if (tipo === 'addEdge' && n) return { type: tipo, edge: arista(id, elige(v.nodes).id, elige(v.nodes).id), ...(rng() < 0.5 && { at: ent(e + 1) }) };
  if (tipo === 'updateEdge' && e) return { type: tipo, id: elige(v.edges).id, set: { label: id } };
  if (tipo === 'removeEdge' && e) return { type: tipo, id: elige(v.edges).id };
  if (tipo === 'setMeta') return { type: tipo, set: elige([{ kind: 'state' }, { kind: 'flow' }, { dir: 'LR' }, { dir: 'TD' }, { title: id }, { kind: 'zzz' }, { title: '  ' }]) };
  return { type: 'addNode', node: nodo(id, { shape: elige(['rect', 'diamond', 'ellipse']), label: rng() < 0.2 ? '' : id }), ...(rng() < 0.7 && { at: ent(n + 1) }) };
}

function rafaga(seed, Clase) {
  const rng = mulberry32(seed), servidor = new Servidor();
  const clientes = Array.from({ length: CLIENTES }, (_, i) => new Clase(`c${i + 1}`, servidor));
  for (let paso = 0; paso < PASOS; paso++) {
    const c = clientes[Math.floor(rng() * CLIENTES)], r = rng();
    if (r < 0.5) c.editar(operacionAleatoria(c, rng));
    else if (r < 0.75) c.enviar();
    else c.entregar();
  }
  asentar(servidor);
  return { servidor, clientes };
}

test(`ráfagas: ${SEMILLAS} semillas × ${CLIENTES} clientes convergen en diagrama y en Mermaid`, () => {
  const cuenta = { rechazadas: 0, ...Object.fromEntries(TIPOS.map(t => [t, 0])) };
  for (let seed = 1; seed <= SEMILLAS; seed++) {
    const { servidor } = rafaga(seed, Cliente);
    comprobarConvergencia(servidor, vacio(), `semilla ${seed}:`);
    reproducir(servidor.registro, vacio(), () => cuenta.rechazadas++);
    for (const e of servidor.registro) cuenta[e.op.type]++;
  }
  assert.ok(cuenta.rechazadas > 0, 'ninguna ráfaga produjo operaciones rechazadas: el test sería vacío');
  for (const t of TIPOS) assert.ok(cuenta[t] > 0, `ninguna ráfaga usó ${t}`);
});

test('ráfagas: el control (aplicar al momento) diverge en alguna semilla', () => {
  let divergen = 0;
  for (let seed = 1; seed <= SEMILLAS; seed++) {
    const { clientes } = rafaga(seed, ClienteAlMomento);
    if (clientes.some(c => codigo(c.visible) !== codigo(clientes[0].visible))) divergen++;
  }
  assert.ok(divergen > 0, 'la red simulada no produce conflictos: las ráfagas no prueban nada');
});

test('las ráfagas son deterministas: la misma semilla da el mismo registro', () => {
  const a = rafaga(7, Cliente).servidor.registro, b = rafaga(7, Cliente).servidor.registro;
  assert.deepEqual(a, b);
});
