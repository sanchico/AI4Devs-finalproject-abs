// El ayudante transporte-simulado.js es código de test, pero los tests de collab.js se apoyan en él: aquí se
// fija que el servidor simulado se comporta como apply_ops (grupo atómico, reintento por op_id, contiguas,
// máximo de 500, tope) y que las entregas y las respuestas dependen solo del test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServidorSimulado, TransporteSimulado } from './helpers/transporte-simulado.js';

const nodo = id => ({ type: 'addNode', node: { id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: id } });
const grupo = (...ids) => ids.map(id => ({ op_id: `op-${id}`, op: nodo(id) }));

test('numera de forma contigua y devuelve una secuencia por operación, en orden', () => {
  const s = new ServidorSimulado();
  assert.deepEqual(s.guardar(grupo('a', 'b')), { ok: true, seqs: [1, 2] });
  assert.deepEqual(s.guardar(grupo('c')), { ok: true, seqs: [3] });
  assert.deepEqual(s.registro.map(e => e.seq), [1, 2, 3]);
});

test('un grupo con una operación inválida se rechaza entero con 422', () => {
  const s = new ServidorSimulado();
  const malo = [...grupo('a'), { op_id: 'op-x', op: { type: 'moverNodo' } }, ...grupo('c')];
  assert.deepEqual(s.guardar(malo), { ok: false, status: 422, key: 'invalid_op' });
  assert.equal(s.registro.length, 0);
});

test('reenviar un op_id devuelve su secuencia y no duplica; las nuevas van a continuación', () => {
  const s = new ServidorSimulado();
  s.guardar(grupo('a', 'b'));
  assert.deepEqual(s.guardar(grupo('a', 'b', 'c')), { ok: true, seqs: [1, 2, 3] });
  assert.equal(s.registro.length, 3);
});

test('rechaza con 422 un grupo vacío, de más de 500, no lista o con un op_id repetido', () => {
  const s = new ServidorSimulado();
  const grande = Array.from({ length: 501 }, (_, i) => ({ op_id: `g${i}`, op: nodo(`g${i}`) }));
  for (const g of [[], grande, null, { op_id: 'x' }, [...grupo('a'), ...grupo('a')], [{ op: nodo('z') }]]) {
    assert.equal(s.guardar(g).status, 422);
  }
  assert.equal(s.registro.length, 0);
});

test('el tope rechaza con 409 el grupo que no cabe y no guarda ninguna operación', () => {
  const s = new ServidorSimulado();
  s.maximo = 3;
  s.guardar(grupo('a', 'b'));
  assert.deepEqual(s.guardar(grupo('c', 'd')), { ok: false, status: 409, key: 'op_limit' });
  assert.equal(s.registro.length, 2);
  assert.deepEqual(s.guardar(grupo('a', 'b')), { ok: true, seqs: [1, 2] });   // lo ya guardado no cuenta
});

test('las filas nuevas llegan a la bandeja de los suscritos, el autor incluido, y no a los demás', async () => {
  const s = new ServidorSimulado();
  const [a, b, c] = [new TransporteSimulado(s), new TransporteSimulado(s), new TransporteSimulado(s)];
  await a.subscribe(() => {}, () => {});
  await b.subscribe(() => {}, () => {});
  await a.send(grupo('x', 'y'));
  assert.deepEqual(a.bandeja.map(e => e.seq), [1, 2]);
  assert.deepEqual(b.bandeja.map(e => e.seq), [1, 2]);
  assert.deepEqual(c.bandeja, []);
});

test('entregar pasa las entradas al cliente una a una y en orden', async () => {
  const s = new ServidorSimulado();
  const t = new TransporteSimulado(s);
  const vistas = [];
  await t.subscribe(e => vistas.push(e.seq), () => {});
  await t.send(grupo('a', 'b', 'c'));
  assert.equal(t.entregar(), true);
  assert.deepEqual(vistas, [1]);
  t.entregarTodo();
  assert.deepEqual(vistas, [1, 2, 3]);
  assert.equal(t.entregar(), false);
});

test('los fallos programados se aplican a las siguientes llamadas, en orden', async () => {
  const s = new ServidorSimulado();
  const t = new TransporteSimulado(s);
  t.fallos.push({ status: 403, key: 'forbidden' }, { status: null }, { status: null, guardado: true });
  assert.deepEqual(await t.send(grupo('a')), { ok: false, status: 403, key: 'forbidden' });
  assert.deepEqual(await t.send(grupo('a')), { ok: false, status: null });
  assert.equal(s.registro.length, 0);                                     // ni el 403 ni el fallo de red guardaron nada
  assert.deepEqual(await t.send(grupo('a')), { ok: false, status: null });
  assert.equal(s.registro.length, 1);                                     // la respuesta se perdió, pero se guardó
  assert.deepEqual(await t.send(grupo('a')), { ok: true });              // el reintento no duplica
  assert.equal(s.registro.length, 1);
  assert.equal(t.envios.length, 4);
});

test('con retener, la respuesta espera a responder()', async () => {
  const s = new ServidorSimulado();
  const t = new TransporteSimulado(s);
  t.retener = true;
  let respuesta = null;
  const promesa = t.send(grupo('a')).then(r => { respuesta = r; });
  await new Promise(r => setImmediate(r));
  assert.equal(respuesta, null);
  assert.equal(t.responder(), true);
  await promesa;
  assert.deepEqual(respuesta, { ok: true });
  assert.equal(t.responder(), false);
});

test('load da el tipo, el rol y una copia del registro, y ejecuta antesDeCargar', async () => {
  const s = new ServidorSimulado({ kind: 'state' });
  s.guardar(grupo('a'));
  const t = new TransporteSimulado(s, { rol: 'viewer' });
  let antes = false;
  t.antesDeCargar = async () => { antes = true; s.guardar(grupo('b')); };
  const r = await t.load();
  assert.equal(antes, true);
  assert.deepEqual([r.kind, r.role, r.log.map(e => e.seq)], ['state', 'viewer', [1, 2]]);
  r.log[0].seq = 99;
  assert.equal(s.registro[0].seq, 1);
});

test('despuesDeCargar se ejecuta tras leer el registro: lo que guarda no está en lo cargado', async () => {
  const s = new ServidorSimulado();
  s.guardar(grupo('a'));
  const t = new TransporteSimulado(s);
  t.despuesDeCargar = async () => { s.guardar(grupo('b')); };
  const r = await t.load();
  assert.deepEqual(r.log.map(e => e.seq), [1]);
  assert.equal(s.registro.length, 2);
});

test('las suscripciones y las cargas pueden fallar, y el canal se puede cerrar', async () => {
  const s = new ServidorSimulado();
  const t = new TransporteSimulado(s);
  t.fallaSuscripcion = true;
  await assert.rejects(t.subscribe(() => {}, () => {}));
  t.fallaSuscripcion = false;
  let cerrado = false;
  await t.subscribe(() => {}, () => { cerrado = true; });
  t.cerrarCanal();
  assert.equal(cerrado, true);
  t.fallaCarga = true;
  await assert.rejects(t.load());
});
