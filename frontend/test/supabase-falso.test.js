// El cliente falso de supabase-js es código de test, pero los tests del adaptador se apoyan en él: aquí se fija que se
// comporta como el real en lo que importa (filtrar, ordenar, paginar con el tope de 1 000 filas, canales y rpc).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseFalso } from './helpers/supabase-falso.js';

const filas = n => Array.from({ length: n }, (_, i) => ({ diagram_id: 'd1', seq: i + 1, op_id: `o${i + 1}`, op: {} }));

test('select con eq filtra por columna y order devuelve las filas ordenadas', async () => {
  const f = new SupabaseFalso({ tablas: { diagram_ops: [...filas(3).reverse(), { diagram_id: 'otro', seq: 1, op_id: 'x', op: {} }] } });
  const r = await f.from('diagram_ops').select('seq').eq('diagram_id', 'd1').order('seq', { ascending: true });
  assert.equal(r.error, null);
  assert.deepEqual(r.data.map(x => x.seq), [1, 2, 3]);
});

test('una respuesta devuelve como mucho 1 000 filas, igual que la API', async () => {
  const f = new SupabaseFalso({ tablas: { diagram_ops: filas(1500) } });
  const sin = await f.from('diagram_ops').select('seq').eq('diagram_id', 'd1').order('seq');
  assert.equal(sin.data.length, 1000);
  const rango = await f.from('diagram_ops').select('seq').eq('diagram_id', 'd1').order('seq').range(0, 4999);
  assert.equal(rango.data.length, 1000);
});

test('range devuelve la página pedida, con los dos extremos incluidos', async () => {
  const f = new SupabaseFalso({ tablas: { diagram_ops: filas(1500) } });
  const p2 = await f.from('diagram_ops').select('seq').eq('diagram_id', 'd1').order('seq').range(1000, 1999);
  assert.deepEqual([p2.data.length, p2.data[0].seq, p2.data.at(-1).seq], [500, 1001, 1500]);
  const pequena = await f.from('diagram_ops').select('seq').eq('diagram_id', 'd1').order('seq').range(0, 2);
  assert.deepEqual(pequena.data.map(x => x.seq), [1, 2, 3]);
});

test('maybeSingle da la primera fila o null, y las consultas quedan anotadas', async () => {
  const f = new SupabaseFalso({ tablas: { diagrams: [{ id: 'd1', kind: 'flow' }] } });
  assert.deepEqual((await f.from('diagrams').select('kind').eq('id', 'd1').maybeSingle()).data, { id: 'd1', kind: 'flow' });
  assert.equal((await f.from('diagrams').select('kind').eq('id', 'nada').maybeSingle()).data, null);
  assert.equal(f.consultas.length, 2);
  assert.deepEqual(f.consultas[0].filtros, { id: 'd1' });
});

test('un error programado para una tabla se devuelve como lo haría la API', async () => {
  const f = new SupabaseFalso();
  f.errores.diagrams = { message: 'boom', status: 500 };
  const r = await f.from('diagrams').select('kind').eq('id', 'd1').maybeSingle();
  assert.deepEqual([r.data, r.error.message, r.status], [null, 'boom', 500]);
});

test('rpc anota la llamada y devuelve la respuesta programada, o un éxito por defecto', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push({ data: null, error: { message: 'forbidden' }, status: 403 });
  assert.equal((await f.rpc('apply_ops', { p_diagram_id: 'd1', p_ops: [] })).status, 403);
  assert.equal((await f.rpc('apply_ops', { p_diagram_id: 'd1', p_ops: [] })).error, null);
  assert.deepEqual(f.llamadasRpc.map(l => l.nombre), ['apply_ops', 'apply_ops']);
});

test('la sesión da el id del usuario y el JWT, y setAuth anota lo que se le pasa', async () => {
  const f = new SupabaseFalso({ userId: 'u7', token: 'jwt-7' });
  const { data } = await f.auth.getSession();
  assert.deepEqual([data.session.user.id, data.session.access_token], ['u7', 'jwt-7']);
  await f.realtime.setAuth('jwt-8');
  assert.deepEqual(f.tokensRealtime, ['jwt-8']);
  const sin = new SupabaseFalso({ sesion: false });
  assert.equal((await sin.auth.getSession()).data.session, null);
});

test('un canal guarda sus manejadores y el test controla los estados y los mensajes', () => {
  const f = new SupabaseFalso();
  const vistos = { estados: [], sistema: [], filas: [] };
  const canal = f.channel('diagram:d1')
    .on('postgres_changes', { event: 'INSERT', table: 'diagram_ops' }, p => vistos.filas.push(p.new))
    .on('system', {}, m => vistos.sistema.push(m))
    .subscribe(estado => vistos.estados.push(estado));
  canal.emitirEstado('SUBSCRIBED');
  canal.emitirSistema({ extension: 'postgres_changes', status: 'ok' });
  canal.emitirInsert({ seq: 1 });
  assert.deepEqual(vistos, { estados: ['SUBSCRIBED'], sistema: [{ extension: 'postgres_changes', status: 'ok' }], filas: [{ seq: 1 }] });
  assert.equal(f.canales.length, 1);
  assert.equal(f.canales[0].nombre, 'diagram:d1');
  assert.deepEqual(canal.filtroPostgres, { event: 'INSERT', table: 'diagram_ops' });
  f.removeChannel(canal);
  assert.equal(f.canalesQuitados.length, 1);
});

test('is filtra por nulo (también las filas sin la columna) y la consulta recuerda columnas, filtros y orden', async () => {
  const f = new SupabaseFalso({ tablas: { diagrams: [
    { id: 'a', deleted_at: null, updated_at: 1 }, { id: 'b', deleted_at: '2026-11-24', updated_at: 2 }, { id: 'c', updated_at: 3 },
  ] } });
  const r = await f.from('diagrams').select('id, updated_at').is('deleted_at', null).order('updated_at', { ascending: false });
  assert.deepEqual(r.data.map(x => x.id), ['c', 'a']);
  assert.deepEqual(f.consultas[0], { tabla: 'diagrams', columnas: 'id, updated_at', filtros: {}, nulos: { deleted_at: null }, orden: { columna: 'updated_at', ascendente: false }, rango: null });
});
