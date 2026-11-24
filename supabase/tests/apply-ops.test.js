// apply_ops (F4): un gesto entero en una llamada. Mismas reglas que apply_op (roles, validación, reintento, tope)
// aplicadas al grupo: se guarda entero o no se guarda, con secuencias contiguas.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { anonimo, sql } from './helpers/entorno.js';
import { db, equipo, leer, nodo, meta, enviar, enviarGrupo, guardar } from './helpers/datos.js';

after(() => sql.end());

const PERMISO_DENEGADO = '42501';
const registro = async id => (await leer(db, 'diagram_ops', id)).sort((a, b) => a.seq - b.seq);
const secuencias = async id => (await registro(id)).map(o => o.seq);
const ficha = async id => (await leer(db, 'diagrams', id))[0];
const rango = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
const nodos = (n, prefijo = 'n') => Array.from({ length: n }, (_, i) => nodo(`${prefijo}${i}`));
const quitar = n => Array.from({ length: n }, (_, i) => ({ type: 'removeNode', id: `n${i}` }));
const rechazo = (r, estado, clave) => {
  assert.equal(r.status, estado);
  assert.equal(r.error?.code, `PT${estado}`);
  assert.equal(r.error?.message, clave);
  assert.equal(r.data, null);
};
const contiguas = seqs => { const o = [...seqs].sort((a, b) => a - b); return o.every((s, i) => i === 0 || s === o[i - 1] + 1); };

// ---------- Un grupo se guarda en una sola llamada ----------
test('un editor envía un grupo de tres operaciones: secuencias 1, 2 y 3 en el orden del grupo', async () => {
  const { editor, id } = await equipo();
  const ops = [nodo('a'), nodo('b'), nodo('c')];
  const opIds = ops.map(() => randomUUID());
  const r = await enviarGrupo(editor, id, ops, opIds);
  assert.equal(r.error, null);
  assert.deepEqual(r.data, [1, 2, 3]);
  const filas = await registro(id);
  assert.deepEqual(filas.map(o => o.op), ops);
  assert.deepEqual(filas.map(o => o.op_id), opIds);
  assert.ok(filas.every(o => o.user_id === editor.id));
  assert.equal((await ficha(id)).last_seq, 3);
});

test('un grupo deja el mismo registro que las mismas operaciones enviadas una a una', async () => {
  const [a, b] = [await equipo(), await equipo()];
  const ops = [nodo('a'), nodo('b'), meta({ title: 'Login' }), { type: 'updateNode', id: 'a', set: { x: 5 } }];
  const opIds = ops.map(() => randomUUID());
  assert.equal((await enviarGrupo(a.editor, a.id, ops, opIds)).error, null);
  for (const [i, op] of ops.entries()) await guardar(b.editor, b.id, op, opIds[i]);
  const forma = async id => (await registro(id)).map(o => [o.seq, o.op_id, o.op]);
  assert.deepEqual(await forma(a.id), await forma(b.id));
  const [fa, fb] = [await ficha(a.id), await ficha(b.id)];
  assert.deepEqual([fa.title, fa.direction, fa.last_seq], [fb.title, fb.direction, fb.last_seq]);
});

test('un gesto de 30 operaciones va en una llamada con 30 secuencias consecutivas', async () => {
  const { editor, id } = await equipo();
  const r = await enviarGrupo(editor, id, quitar(30));
  assert.equal(r.error, null);
  assert.deepEqual(r.data, rango(1, 30));
  assert.deepEqual(await secuencias(id), rango(1, 30));
});

test('un grupo de 500 operaciones se guarda', async () => {
  const { editor, id } = await equipo();
  const r = await enviarGrupo(editor, id, nodos(500));
  assert.equal(r.error, null);
  assert.deepEqual(r.data, rango(1, 500));
});

test('un setMeta del grupo copia título y dirección a la ficha, y gana el último de cada campo', async () => {
  const { editor, id } = await equipo('state');
  const r = await enviarGrupo(editor, id, [meta({ title: 'A', dir: 'LR' }), nodo('a'), meta({ title: 'Login' }), meta({ dir: 'TD' }), meta({ dir: 'LR' })]);
  assert.equal(r.error, null);
  const f = await ficha(id);
  assert.deepEqual([f.title, f.direction, f.kind, f.last_seq], ['Login', 'LR', 'state', 5]);
});

test('un grupo sin setMeta no cambia título ni dirección y sí la fecha de modificación', async () => {
  const { editor, id } = await equipo();
  await guardar(editor, id, meta({ title: 'Login', dir: 'LR' }));
  const antes = await ficha(id);
  assert.equal((await enviarGrupo(editor, id, [nodo('a'), nodo('b')])).error, null);
  const despues = await ficha(id);
  assert.deepEqual([despues.title, despues.direction], ['Login', 'LR']);
  assert.ok(new Date(despues.updated_at) > new Date(antes.updated_at));
});

test('el servidor guarda una operación del grupo sobre un nodo inexistente', async () => {
  const { editor, id } = await equipo();
  const r = await enviarGrupo(editor, id, [{ type: 'updateNode', id: 'no-existe', set: { x: 1 } }, { type: 'removeEdge', id: 'tampoco' }]);
  assert.deepEqual(r.data, [1, 2]);
});

// ---------- Roles y errores ----------
test('el dueño también escribe grupos', async () => {
  const { dueno, id } = await equipo();
  assert.deepEqual((await enviarGrupo(dueno, id, [nodo('a'), nodo('b')])).data, [1, 2]);
});

test('un lector recibe 403 y el registro no cambia', async () => {
  const { lector, id } = await equipo();
  rechazo(await enviarGrupo(lector, id, [nodo('a'), nodo('b')]), 403, 'forbidden');
  assert.deepEqual(await secuencias(id), []);
  assert.equal((await ficha(id)).last_seq, 0);
});

test('un ajeno y un diagrama inexistente reciben exactamente el mismo 404', async () => {
  const { ajeno, id } = await equipo();
  const aDiagramaAjeno = await enviarGrupo(ajeno, id, [nodo('a')]);
  const aDiagramaInexistente = await enviarGrupo(ajeno, randomUUID(), [nodo('a')]);
  rechazo(aDiagramaAjeno, 404, 'not_found');
  rechazo(aDiagramaInexistente, 404, 'not_found');
  assert.deepEqual(aDiagramaAjeno.error, aDiagramaInexistente.error);
  assert.deepEqual(await secuencias(id), []);
});

test('sin sesión no se puede enviar un grupo', async () => {
  const { id } = await equipo();
  const { data, error } = await anonimo().rpc('apply_ops', { p_diagram_id: id, p_ops: [{ op_id: randomUUID(), op: nodo('a') }] });
  assert.equal(error?.code, PERMISO_DENEGADO);
  assert.equal(data, null);
  assert.deepEqual(await secuencias(id), []);
});

test('con el diagrama borrado, el editor y el dueño reciben 410 y, al restaurar, el grupo se guarda', async () => {
  const { dueno, editor, id } = await equipo();
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('a')])).data, [1]);
  assert.equal((await dueno.cliente.rpc('delete_diagram', { p_diagram_id: id })).error, null);
  rechazo(await enviarGrupo(editor, id, [nodo('b')]), 410, 'diagram_deleted');
  rechazo(await enviarGrupo(dueno, id, [nodo('b')]), 410, 'diagram_deleted');
  assert.deepEqual(await secuencias(id), [1]);
  assert.equal((await dueno.cliente.rpc('restore_diagram', { p_diagram_id: id })).error, null);
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('b')])).data, [2]);
});

// ---------- Se guarda entero o no se guarda ----------
test('una operación inválida en medio rechaza el grupo entero y no gasta secuencias', async () => {
  const { editor, id } = await equipo();
  rechazo(await enviarGrupo(editor, id, [nodo('a'), { type: 'moverNodo' }, nodo('c')]), 422, 'invalid_op');
  assert.deepEqual(await secuencias(id), []);
  assert.equal((await ficha(id)).last_seq, 0);
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('a')])).data, [1]);
});

test('un setMeta inválido del grupo no cambia la ficha ni guarda las operaciones anteriores', async () => {
  const { editor, id } = await equipo();
  rechazo(await enviarGrupo(editor, id, [meta({ title: 'Nuevo' }), meta({ title: '   ' })]), 422, 'invalid_op');
  assert.deepEqual(await secuencias(id), []);
  assert.equal((await ficha(id)).title, 'Diagrama sin título');
});

const grupoMalo = [
  ['un grupo vacío', []],
  ['un grupo de 501 operaciones', nodos(501).map(op => ({ op_id: randomUUID(), op }))],
  ['un objeto en vez de una lista', { op_id: randomUUID(), op: nodo('a') }],
  ['un valor nulo', null],
  ['un número', 42],
  ['un elemento que no es un objeto', [5]],
  ['un elemento sin op_id', [{ op: nodo('a') }]],
  ['un elemento con op_id nulo', [{ op_id: null, op: nodo('a') }]],
  ['un elemento con op_id que no es un UUID', [{ op_id: 'no-es-uuid', op: nodo('a') }]],
  ['un elemento con op_id numérico', [{ op_id: 7, op: nodo('a') }]],
  ['un elemento sin op', [{ op_id: randomUUID() }]],
  ['un elemento con op nula', [{ op_id: randomUUID(), op: null }]],
  ['dos elementos con el mismo op_id', (() => { const opId = randomUUID(); return [{ op_id: opId, op: nodo('a') }, { op_id: opId, op: nodo('b') }]; })()],
];
for (const [nombre, p_ops] of grupoMalo) {
  test(`se rechaza con 422 ${nombre}`, async () => {
    const { editor, id } = await equipo();
    rechazo(await editor.cliente.rpc('apply_ops', { p_diagram_id: id, p_ops }), 422, 'invalid_op');
    assert.deepEqual(await secuencias(id), []);
    assert.equal((await ficha(id)).last_seq, 0);
  });
}

// ---------- Reintentos ----------
test('reenviar el mismo grupo devuelve las mismas secuencias y guarda cada operación una sola vez', async () => {
  const { editor, id } = await equipo();
  const ops = [nodo('a'), nodo('b'), nodo('c')];
  const opIds = ops.map(() => randomUUID());
  const primera = await enviarGrupo(editor, id, ops, opIds);
  const segunda = await enviarGrupo(editor, id, ops, opIds);
  assert.deepEqual(segunda.data, primera.data);
  assert.deepEqual(await secuencias(id), [1, 2, 3]);
  assert.equal((await ficha(id)).last_seq, 3);
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('d')])).data, [4]);   // el reintento no gastó secuencias
});

test('el mismo grupo enviado a la vez varias veces da las mismas secuencias y una sola fila por operación', async () => {
  const { editor, id } = await equipo();
  const ops = [nodo('a'), nodo('b'), nodo('c')];
  const opIds = ops.map(() => randomUUID());
  const respuestas = await Promise.all(Array.from({ length: 5 }, () => enviarGrupo(editor, id, ops, opIds)));
  for (const r of respuestas) assert.deepEqual(r.data, [1, 2, 3]);
  assert.deepEqual(await secuencias(id), [1, 2, 3]);
});

test('un grupo con operaciones ya guardadas y nuevas repite las secuencias de las guardadas y numera las nuevas a continuación', async () => {
  const { editor, id } = await equipo();
  const opIds = [randomUUID(), randomUUID(), randomUUID()];
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('a'), nodo('b')], opIds.slice(0, 2))).data, [1, 2]);
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('a'), nodo('b'), nodo('c')], opIds)).data, [1, 2, 3]);
  assert.deepEqual(await secuencias(id), [1, 2, 3]);
});

test('un grupo mezcla una operación ya guardada entre dos nuevas', async () => {
  const { editor, id } = await equipo();
  const [b, ...otros] = [randomUUID(), randomUUID(), randomUUID()];
  assert.equal(await guardar(editor, id, nodo('b'), b), 1);
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('a'), nodo('b'), nodo('c')], [otros[0], b, otros[1]])).data, [2, 1, 3]);
  assert.deepEqual(await secuencias(id), [1, 2, 3]);
});

test('reenviar un grupo con un setMeta viejo no revierte el título ni toca la fecha de modificación', async () => {
  const { editor, id } = await equipo();
  const [g1, g2] = [{ ops: [meta({ title: 'A' })], opIds: [randomUUID()] }, { ops: [meta({ title: 'B' })], opIds: [randomUUID()] }];
  await enviarGrupo(editor, id, g1.ops, g1.opIds);
  await enviarGrupo(editor, id, g2.ops, g2.opIds);
  const antes = await ficha(id);
  assert.deepEqual((await enviarGrupo(editor, id, g1.ops, g1.opIds)).data, [1]);
  const despues = await ficha(id);
  assert.deepEqual([despues.title, despues.last_seq, despues.updated_at], ['B', 2, antes.updated_at]);
});

// ---------- Tope ----------
const llenar = async (id, n) => { const { error } = await db.from('diagrams').update({ last_seq: n }).eq('id', id); assert.equal(error, null); };

test('un grupo que no cabe en las 5 000 operaciones se rechaza entero con 409', async () => {
  const { editor, id } = await equipo();
  await llenar(id, 4995);
  rechazo(await enviarGrupo(editor, id, nodos(6)), 409, 'op_limit');
  assert.equal((await registro(id)).length, 0);
  assert.equal((await ficha(id)).last_seq, 4995);
});

test('un grupo que cabe justo recibe las secuencias 4 996 a 5 000 y reenviarlo con el registro lleno vale', async () => {
  const { editor, id } = await equipo();
  await llenar(id, 4995);
  const ops = nodos(5);
  const opIds = ops.map(() => randomUUID());
  assert.deepEqual((await enviarGrupo(editor, id, ops, opIds)).data, rango(4996, 5000));
  assert.deepEqual((await enviarGrupo(editor, id, ops, opIds)).data, rango(4996, 5000));
  rechazo(await enviarGrupo(editor, id, [nodo('z')]), 409, 'op_limit');
  assert.equal((await ficha(id)).last_seq, 5000);
});

test('las operaciones ya guardadas de un grupo no cuentan para el tope', async () => {
  const { editor, id } = await equipo();
  await llenar(id, 4998);
  const ya = [randomUUID(), randomUUID()];
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('a'), nodo('b')], ya)).data, [4999, 5000]);
  assert.deepEqual((await enviarGrupo(editor, id, [nodo('a'), nodo('b')], ya)).data, [4999, 5000]);
});

// ---------- Concurrencia ----------
test('dos grupos de 10 a la vez dan las secuencias 1 a 20 y cada grupo ocupa 10 consecutivas', async () => {
  const { dueno, editor, id } = await equipo();
  const [a, b] = await Promise.all([enviarGrupo(dueno, id, nodos(10, 'd')), enviarGrupo(editor, id, nodos(10, 'e'))]);
  assert.equal(a.error, null);
  assert.equal(b.error, null);
  assert.ok(contiguas(a.data) && contiguas(b.data));
  assert.deepEqual([...a.data, ...b.data].sort((x, y) => x - y), rango(1, 20));
  assert.deepEqual(await secuencias(id), rango(1, 20));
  const filas = await registro(id);
  assert.equal(new Set(filas.map(o => o.op_id)).size, 20);
  assert.equal((await ficha(id)).last_seq, 20);
});

test('un grupo de 10 y 5 operaciones sueltas a la vez dan 1 a 15 sin repetidos ni huecos y el grupo es contiguo', async () => {
  const { dueno, editor, id } = await equipo();
  const [grupo, ...sueltas] = await Promise.all([
    enviarGrupo(dueno, id, nodos(10, 'g')),
    ...Array.from({ length: 5 }, (_, i) => enviar(editor, id, nodo(`s${i}`))),
  ]);
  assert.equal(grupo.error, null);
  assert.ok(contiguas(grupo.data));
  assert.deepEqual([...grupo.data, ...sueltas.map(r => r.data)].sort((x, y) => x - y), rango(1, 15));
  assert.deepEqual(await secuencias(id), rango(1, 15));
});

// ---------- Superficie ----------
test('la función interna write_ops no se puede llamar desde la API', async () => {
  const { editor, id } = await equipo();
  const r = await editor.cliente.rpc('write_ops', { p_diagram_id: id, p_items: [{ op_id: randomUUID(), op: nodo('a') }] });
  assert.equal(r.error?.code, PERMISO_DENEGADO);   // PostgREST la ve, pero authenticated no tiene EXECUTE
  assert.equal(r.status, 403);
  assert.equal(r.data, null);
  assert.deepEqual(await secuencias(id), []);
});

// ---------- Contrato con las fixtures del cliente ----------
const dir = new URL('../../frontend/test/fixtures/ops/', import.meta.url);
const fixtures = readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const GUARDA = new Set(['ok', 'missing', 'duplicate']);

for (const fx of fixtures) {
  const guardables = fx.ops.filter(o => GUARDA.has(o.resultado)).map(o => o.op);
  if (guardables.length) {
    test(`fixture ${fx.nombre}: lo que el cliente acepta o descarta por el grafo se guarda como grupo y deja el mismo registro que en serie`, async () => {
      const [g, s] = [await equipo(fx.inicial?.kind ?? 'flow'), await equipo(fx.inicial?.kind ?? 'flow')];
      const opIds = guardables.map(() => randomUUID());
      const r = await enviarGrupo(g.editor, g.id, guardables, opIds);
      assert.equal(r.error, null, `${r.error?.message} ${r.error?.details ?? ''}`);
      assert.deepEqual(r.data, rango(1, guardables.length));
      for (const [i, op] of guardables.entries()) await guardar(s.editor, s.id, op, opIds[i]);
      const forma = async id => (await registro(id)).map(o => [o.seq, o.op_id, o.op]);
      assert.deepEqual(await forma(g.id), await forma(s.id));
      const [fg, fs] = [await ficha(g.id), await ficha(s.id)];
      assert.deepEqual([fg.title, fg.direction, fg.last_seq], [fs.title, fs.direction, fs.last_seq]);
    });
  }
  if (fx.ops.some(o => !GUARDA.has(o.resultado))) {
    test(`fixture ${fx.nombre}: el grupo con las operaciones que el cliente rechaza por su forma se rechaza entero`, async () => {
      const { editor, id } = await equipo(fx.inicial?.kind ?? 'flow');
      rechazo(await enviarGrupo(editor, id, fx.ops.map(o => o.op)), 422, 'invalid_op');
      assert.deepEqual(await secuencias(id), []);
    });
  }
}
