// transporte-supabase.js: el adaptador entre collab.js y supabase-js. Se prueba con un cliente falso (helpers/supabase-falso.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearTransporte } from '../transporte-supabase.js';
import { SupabaseFalso } from './helpers/supabase-falso.js';

const ID = '3f2b8a1c-9d4e-4b7a-8c11-0a1b2c3d4e5f';
const LISTO = { extension: 'postgres_changes', status: 'ok' };
const turno = () => new Promise(r => setImmediate(r));
const op = i => ({ type: 'addNode', node: { id: `n${i}`, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: `n${i}` } });
const fila = seq => ({ diagram_id: ID, seq, op_id: `o${seq}`, op: op(seq), user_id: 'u1', created_at: '2026-11-24T00:00:00Z' });
const tablas = (n, { kind = 'flow', rol = 'editor', borrado = null, usuario = 'u1' } = {}) => ({
  diagrams: [{ id: ID, kind, deleted_at: borrado }],
  diagram_members: [{ diagram_id: ID, user_id: usuario, role: rol }],
  diagram_ops: Array.from({ length: n }, (_, i) => fila(i + 1)),
});
const rangos = f => f.consultas.filter(c => c.tabla === 'diagram_ops').map(c => c.rango);
const rechazo = async promesa => { try { await promesa; } catch (e) { return e; } assert.fail('debía rechazar'); };

// Suscribe y espera a que el cliente falso haya creado el canal (la suscripción empieza leyendo la sesión)
async function suscribir(f, opciones = {}) {
  const t = crearTransporte({ client: f, diagramId: ID, plazo: 200, ...opciones });
  const entradas = [], cierres = [];
  const promesa = t.subscribe(e => entradas.push(e), () => cierres.push(1));
  const estado = { resuelto: false, error: null };
  promesa.then(() => { estado.resuelto = true; }, e => { estado.error = e; });
  for (let i = 0; i < 20 && !f.canales.length; i++) await turno();
  return { t, canal: f.ultimoCanal, entradas, cierres, estado, promesa };
}

// ---------- subscribe ----------
test('subscribe no resuelve con SUBSCRIBED: espera al mensaje system de Postgres Changes con estado ok', async () => {
  const f = new SupabaseFalso();
  const { canal, estado, promesa } = await suscribir(f);
  canal.emitirEstado('SUBSCRIBED');
  await turno();
  assert.equal(estado.resuelto, false);
  canal.emitirSistema({ extension: 'presence', status: 'ok' });         // otra extensión: se ignora
  await turno();
  assert.equal(estado.resuelto, false);
  canal.emitirSistema(LISTO);
  await promesa;
  assert.equal(estado.resuelto, true);
});

test('un system de Postgres Changes con error rechaza la suscripción', async () => {
  const f = new SupabaseFalso();
  const { canal, estado } = await suscribir(f);
  canal.emitirSistema({ extension: 'postgres_changes', status: 'error', message: 'filtro inválido' });
  await turno();
  assert.match(estado.error?.message ?? '', /Postgres Changes/);
});

test('el canal es diagram:<id> y filtra los INSERT de diagram_ops de ese diagrama', async () => {
  const f = new SupabaseFalso();
  const { canal } = await suscribir(f);
  assert.equal(canal.nombre, `diagram:${ID}`);
  assert.deepEqual(canal.filtroPostgres, { event: 'INSERT', schema: 'public', table: 'diagram_ops', filter: `diagram_id=eq.${ID}` });
});

test('fija el JWT del canal antes de crearlo, y sin sesión no lo toca', async () => {
  const f = new SupabaseFalso({ token: 'jwt-9' });
  await suscribir(f);
  assert.deepEqual(f.tokensRealtime, ['jwt-9']);
  const sin = new SupabaseFalso({ sesion: false });
  await suscribir(sin);
  assert.deepEqual(sin.tokensRealtime, []);
});

for (const estadoCanal of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
  test(`${estadoCanal} antes de estar listo rechaza y quita el canal`, async () => {
    const f = new SupabaseFalso();
    const { canal, estado } = await suscribir(f);
    canal.emitirEstado(estadoCanal, { message: 'fallo' });
    await turno();
    assert.match(estado.error?.message ?? '', new RegExp(estadoCanal));
    assert.equal(f.canalesQuitados.length, 1);
  });
}

test('si el canal no está listo al pasar el plazo, rechaza', async () => {
  const f = new SupabaseFalso();
  const { estado } = await suscribir(f, { plazo: 20 });
  await new Promise(r => setTimeout(r, 60));
  assert.ok(estado.error, 'debía rechazar por el plazo');
  assert.equal(f.canalesQuitados.length, 1);
});

test('cada INSERT llega como {seq, op_id, op} y nada más', async () => {
  const f = new SupabaseFalso();
  const { canal, entradas, promesa } = await suscribir(f);
  canal.emitirSistema(LISTO);
  await promesa;
  canal.emitirInsert(fila(5));
  assert.deepEqual(entradas, [{ seq: 5, op_id: 'o5', op: op(5) }]);
});

test('una vez listo, el cierre del canal llama a onClose una sola vez', async () => {
  const f = new SupabaseFalso();
  const { canal, cierres, promesa } = await suscribir(f);
  canal.emitirSistema(LISTO);
  await promesa;
  canal.emitirEstado('SUBSCRIBED');                 // no es un cierre
  assert.equal(cierres.length, 0);
  canal.emitirEstado('CLOSED');
  canal.emitirEstado('CHANNEL_ERROR');
  canal.emitirEstado('TIMED_OUT');
  assert.equal(cierres.length, 1);
});

// ---------- load ----------
test('load devuelve el tipo, el rol y el registro ordenado, solo con seq, op_id y op', async () => {
  const f = new SupabaseFalso({ tablas: tablas(3, { kind: 'state', rol: 'viewer' }) });
  f.tablas.diagram_ops.reverse();
  const r = await crearTransporte({ client: f, diagramId: ID }).load();
  assert.deepEqual([r.kind, r.role], ['state', 'viewer']);
  assert.deepEqual(r.log, [1, 2, 3].map(s => ({ seq: s, op_id: `o${s}`, op: op(s) })));
});

test('load consulta solo el diagrama, el miembro y el registro de ese diagrama y de ese usuario', async () => {
  const f = new SupabaseFalso({ tablas: tablas(1) });
  await crearTransporte({ client: f, diagramId: ID }).load();
  assert.deepEqual(f.consultas.map(c => [c.tabla, c.filtros]), [
    ['diagrams', { id: ID }],
    ['diagram_members', { diagram_id: ID, user_id: 'u1' }],
    ['diagram_ops', { diagram_id: ID }],
  ]);
});

for (const [n, paginas] of [[0, [[0, 999]]], [1, [[0, 999]]], [999, [[0, 999]]], [1000, [[0, 999], [1000, 1999]]], [1500, [[0, 999], [1000, 1999]]], [2500, [[0, 999], [1000, 1999], [2000, 2999]]], [5000, [0, 1000, 2000, 3000, 4000, 5000].map(d => [d, d + 999])]]) {
  test(`un registro de ${n} operaciones se lee completo en ${paginas.length} página(s) de 1 000`, async () => {
    const f = new SupabaseFalso({ tablas: tablas(n) });
    const r = await crearTransporte({ client: f, diagramId: ID }).load();
    assert.deepEqual(rangos(f), paginas);
    assert.equal(r.log.length, n);
    assert.deepEqual(r.log.map(e => e.seq), Array.from({ length: n }, (_, i) => i + 1));
  });
}

test('sin fila de diagrama (no existe o no es miembro) rechaza con estado 404', async () => {
  const f = new SupabaseFalso({ tablas: { diagrams: [], diagram_members: [], diagram_ops: [] } });
  const e = await rechazo(crearTransporte({ client: f, diagramId: ID }).load());
  assert.equal(e.status, 404);
  assert.equal(rangos(f).length, 0);                // no sigue leyendo el registro
});

test('una fila de diagrama sin fila de miembro también es 404', async () => {
  const f = new SupabaseFalso({ tablas: tablas(2, { usuario: 'otro' }) });
  assert.equal((await rechazo(crearTransporte({ client: f, diagramId: ID }).load())).status, 404);
});

test('un diagrama borrado (lo ve su dueño) rechaza con estado 410', async () => {
  const f = new SupabaseFalso({ tablas: tablas(2, { borrado: '2026-11-24T10:00:00Z' }) });
  assert.equal((await rechazo(crearTransporte({ client: f, diagramId: ID }).load())).status, 410);
});

test('un error de la API se relanza con su estado y su mensaje', async () => {
  for (const tabla of ['diagrams', 'diagram_members', 'diagram_ops']) {
    const f = new SupabaseFalso({ tablas: tablas(2) });
    f.errores[tabla] = { message: 'boom', status: 500 };
    const e = await rechazo(crearTransporte({ client: f, diagramId: ID }).load());
    assert.deepEqual([e.status, e.message], [500, 'boom'], tabla);
  }
});

test('sin respuesta del servidor (estado 0) el error no lleva estado', async () => {
  const f = new SupabaseFalso({ tablas: tablas(2) });
  f.errores.diagrams = { message: 'TypeError: fetch failed', status: 0 };
  const e = await rechazo(crearTransporte({ client: f, diagramId: ID }).load());
  assert.equal(e.status, undefined);
});

test('sin sesión no se puede leer: rechaza con estado 401', async () => {
  const f = new SupabaseFalso({ tablas: tablas(1), sesion: false });
  assert.equal((await rechazo(crearTransporte({ client: f, diagramId: ID }).load())).status, 401);
});

// ---------- send ----------
test('send llama a apply_ops con el diagrama y el grupo tal cual, y devuelve ok', async () => {
  const f = new SupabaseFalso();
  const grupo = [{ op_id: 'a', op: op(1) }, { op_id: 'b', op: op(2) }];
  assert.deepEqual(await crearTransporte({ client: f, diagramId: ID }).send(grupo), { ok: true });
  assert.deepEqual(f.llamadasRpc, [{ nombre: 'apply_ops', args: { p_diagram_id: ID, p_ops: grupo } }]);
});

for (const [status, key] of [[422, 'invalid_op'], [403, 'forbidden'], [404, 'not_found'], [410, 'diagram_deleted'], [409, 'op_limit'], [500, 'boom']]) {
  test(`send traduce el rechazo ${status} a {ok: false, status, key}`, async () => {
    const f = new SupabaseFalso();
    f.rpcRespuestas.push({ data: null, error: { message: key, code: `PT${status}` }, status });
    assert.deepEqual(await crearTransporte({ client: f, diagramId: ID }).send([{ op_id: 'a', op: op(1) }]), { ok: false, status, key });
  });
}

test('send traduce la falta de respuesta (estado 0) y una excepción a status null', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push({ data: null, error: { message: 'TypeError: fetch failed' }, status: 0 });
  assert.equal((await crearTransporte({ client: f, diagramId: ID }).send([{ op_id: 'a', op: op(1) }])).status, null);
  f.rpc = () => Promise.reject(new Error('sin red'));
  assert.deepEqual(await crearTransporte({ client: f, diagramId: ID }).send([{ op_id: 'a', op: op(1) }]), { ok: false, status: null });
});

// ---------- Con collab.js ----------
import { createCollab } from '../collab.js';
import { textoErrorApertura } from '../avisos.js';

async function abrirConCola(f, opciones = {}) {
  const vistas = [];
  const colab = createCollab({ transport: crearTransporte({ client: f, diagramId: ID, plazo: 500 }), onVisible: s => vistas.push(s), wait: async () => {}, ...opciones });
  const abierto = colab.open();
  for (let i = 0; i < 20 && !f.canales.length; i++) await turno();
  return { colab, abierto, vistas };
}

test('un diagrama de 1 500 operaciones se abre completo y una operación nueva por el canal llega a lo visible', async () => {
  const f = new SupabaseFalso({ tablas: tablas(1500) });
  const { colab, abierto } = await abrirConCola(f);
  f.ultimoCanal.emitirSistema(LISTO);
  assert.deepEqual(await abierto, { ok: true });
  assert.equal(colab.visible().nodes.length, 1500);
  f.ultimoCanal.emitirInsert(fila(1501));
  assert.deepEqual([colab.visible().nodes.length, colab.visible().nodes.at(-1).id], [1501, 'n1501']);
});

test('lo que llega por el canal mientras se carga se aplica una vez, esté o no en lo cargado', async () => {
  const f = new SupabaseFalso({ tablas: tablas(1500) });
  const { colab, abierto } = await abrirConCola(f);
  f.ultimoCanal.emitirSistema(LISTO);
  f.ultimoCanal.emitirInsert(fila(1500));        // ya está en el registro que se va a cargar
  f.ultimoCanal.emitirInsert(fila(1501));        // no está
  await abierto;
  assert.equal(colab.visible().nodes.length, 1501);
});

test('un diagrama al que no se tiene acceso se abre con el error 404 y el texto que no revela si existe', async () => {
  const f = new SupabaseFalso({ tablas: { diagrams: [], diagram_members: [], diagram_ops: [] } });
  const { abierto } = await abrirConCola(f);
  f.ultimoCanal.emitirSistema(LISTO);
  const r = await abierto;
  assert.deepEqual([r.ok, r.error.status], [false, 404]);
  assert.equal(textoErrorApertura(r.error), 'No tienes acceso a este diagrama o no existe');
});

test('un gesto se envía con apply_ops y su eco por el canal lo da por confirmado', async () => {
  const f = new SupabaseFalso({ tablas: tablas(2) });
  const { colab, abierto } = await abrirConCola(f);
  f.ultimoCanal.emitirSistema(LISTO);
  await abierto;
  colab.local([op(9000)]);
  await turno();
  const [{ args }] = f.llamadasRpc;
  assert.equal(args.p_diagram_id, ID);
  assert.equal(args.p_ops.length, 1);
  assert.deepEqual(args.p_ops[0].op, op(9000));
  assert.equal(colab.visible().nodes.length, 3);
  f.ultimoCanal.emitirInsert({ diagram_id: ID, seq: 3, op_id: args.p_ops[0].op_id, op: op(9000) });
  assert.equal(colab.visible().nodes.length, 3);      // no se duplica
  assert.equal(colab.confirmed().nodes.length, 3);    // y ya está en el confirmado
});
