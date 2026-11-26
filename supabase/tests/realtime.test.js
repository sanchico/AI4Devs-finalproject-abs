import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as esperar } from 'node:timers/promises';
import { sql, anonimo, usuario } from './helpers/entorno.js';
import { equipo, nodo, enviar, enviarGrupo } from './helpers/datos.js';
import { suscribir, autenticarRealtime, cerrar } from './helpers/realtime.js';

after(() => sql.end());

test('diagram_ops es la única tabla publicada por Realtime', async () => {
  const filas = await sql`select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime'`;
  assert.deepEqual(filas.map(f => `${f.schemaname}.${f.tablename}`), ['public.diagram_ops']);
});

test('Realtime solo publica inserciones', async () => {
  const [p] = await sql`select pubinsert, pubupdate, pubdelete, pubtruncate from pg_publication where pubname = 'supabase_realtime'`;
  assert.deepEqual({ ...p }, { pubinsert: true, pubupdate: false, pubdelete: false, pubtruncate: false });
});

// ---------- Quién recibe las operaciones ----------
// Cuatro clientes con el mismo canal y el mismo filtro: el dueño (que escribe), un editor (miembro), un usuario con
// sesión que no es miembro y la clave pública sin sesión. Los tres con sesión se suscriben; el anónimo no puede:
// Realtime valida el filtro contra las columnas que el suscriptor puede leer y anon no tiene SELECT. «No recibe
// nada» no se mide con una pausa: la última operación enviada hace de centinela y, cuando el editor ya la tiene,
// Realtime ha tenido tiempo de repartirla a todos los suscriptores.
const PLAZO_RECEPCION_MS = 10000;

/** Prepara el diagrama y los clientes: los tres con sesión, suscritos y confirmados, y el anónimo, rechazado. */
async function montar() {
  const { dueno, editor, id } = await equipo();
  const ajeno = await usuario();
  const publico = { cliente: anonimo() };
  const oyentes = { dueno, editor, ajeno };
  const recibido = { dueno: [], editor: [], ajeno: [], publico: [] };
  const todos = [...Object.values(oyentes), publico];
  const cerrarTodo = () => cerrar(...todos.map(o => o.cliente));
  try {
    for (const o of Object.values(oyentes)) await autenticarRealtime(o.cliente);
    // Un canal que no llegó a unirse no probaría nada: los tres con sesión tienen que confirmar Postgres Changes.
    await Promise.all(Object.entries(oyentes).map(([nombre, o]) => suscribir(o.cliente, id, recibido[nombre])));
    // El anónimo no puede ni suscribirse; se exige este rechazo y no cualquier error, para que un fallo de red no valga.
    await assert.rejects(suscribir(publico.cliente, id, recibido.publico, { plazoMs: 8000 }), /invalid column for filter diagram_id/);
  } catch (e) {
    await cerrarTodo(); // sin esto, los canales abiertos dejan colgado a node --test
    throw e;
  }
  return { dueno, id, recibido, cerrarTodo };
}

/** Espera hasta que `recibidas` contenga todos los op_id esperados; si no llegan a tiempo, falla. */
async function esperarA(recibidas, opIds) {
  const limite = Date.now() + PLAZO_RECEPCION_MS;
  while (!opIds.every(id => recibidas.some(r => r.opId === id))) {
    if (Date.now() > limite) assert.fail(`El miembro no recibió todas las operaciones en ${PLAZO_RECEPCION_MS / 1000} s: ${recibidas.length} de ${opIds.length}`);
    await esperar(50);
  }
}

test('Realtime entrega las operaciones de apply_op a los miembros y no a quien no lo es', async () => {
  const { dueno, id, recibido, cerrarTodo } = await montar();
  try {
    const ids = [randomUUID(), randomUUID()];
    for (const opId of ids) {
      const { error } = await enviar(dueno, id, nodo(randomUUID()), opId);
      assert.equal(error, null);
    }
    await esperarA(recibido.editor, ids);
    assert.deepEqual(recibido.editor.map(r => r.opId), ids, 'el editor las recibe en orden');
    assert.deepEqual(recibido.dueno.map(r => r.opId), ids, 'el dueño también las recibe');
    assert.deepEqual(recibido.ajeno, [], 'un usuario con sesión que no es miembro no recibe nada');
    assert.deepEqual(recibido.publico, [], 'la clave pública sin sesión no recibe nada');
  } finally {
    await cerrarTodo();
  }
});

test('Realtime entrega un gesto de apply_ops a los miembros y no a quien no lo es', async () => {
  const { dueno, id, recibido, cerrarTodo } = await montar();
  try {
    const ops = [nodo(randomUUID()), nodo(randomUUID()), nodo(randomUUID())];
    const ids = ops.map(() => randomUUID());
    const { data: secuencias, error } = await enviarGrupo(dueno, id, ops, ids);
    assert.equal(error, null);
    await esperarA(recibido.editor, ids);
    assert.deepEqual(recibido.editor.map(r => r.opId), ids, 'el editor recibe el gesto entero y en orden');
    assert.deepEqual(recibido.editor.map(r => r.seq), secuencias, 'con las secuencias que devolvió el servidor');
    assert.deepEqual(recibido.ajeno, [], 'un usuario con sesión que no es miembro no recibe nada');
    assert.deepEqual(recibido.publico, [], 'la clave pública sin sesión no recibe nada');
  } finally {
    await cerrarTodo();
  }
});
