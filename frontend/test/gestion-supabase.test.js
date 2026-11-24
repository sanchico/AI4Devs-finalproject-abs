// gestion-supabase.js: lo que la lista, «Nuevo», «Compartir» y las invitaciones piden a Supabase, con un cliente falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseFalso } from './helpers/supabase-falso.js';
import { listarDiagramas, crearDiagrama, crearInvitacion, aceptarInvitacion, renombrarDiagrama, borrarDiagrama } from '../gestion-supabase.js';

const ID = '3f2b8a1c-9d4e-4b7a-8c11-0a1b2c3d4e5f';
const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const ok = data => ({ data, error: null, status: 200 });
const fallo = (status, message) => ({ data: null, error: { message }, status });

// ---------- listarDiagramas ----------
test('la lista pide id, título, tipo y fecha de los diagramas no borrados, del más reciente al más antiguo', async () => {
  const f = new SupabaseFalso({ tablas: { diagrams: [
    { id: 'a', title: 'Viejo', kind: 'flow', updated_at: '2026-11-20T10:00:00Z', deleted_at: null },
    { id: 'b', title: 'Borrado', kind: 'flow', updated_at: '2026-11-23T10:00:00Z', deleted_at: '2026-11-24T00:00:00Z' },
    { id: 'c', title: 'Nuevo', kind: 'state', updated_at: '2026-11-22T10:00:00Z', deleted_at: null },
  ] } });
  const lista = await listarDiagramas(f);
  assert.deepEqual(lista.map(d => d.id), ['c', 'a']);
  assert.equal(f.consultas.length, 1);
  assert.deepEqual(f.consultas[0], { tabla: 'diagrams', columnas: 'id, title, kind, updated_at', filtros: {}, nulos: { deleted_at: null },
    orden: { columna: 'updated_at', ascendente: false }, rango: null });
});

test('una lista vacía es un array vacío', async () => {
  assert.deepEqual(await listarDiagramas(new SupabaseFalso({ tablas: { diagrams: [] } })), []);
});

test('un error de la API al listar se relanza con su estado', async () => {
  const f = new SupabaseFalso();
  f.errores.diagrams = { message: 'boom', status: 500 };
  await assert.rejects(listarDiagramas(f), e => e.status === 500 && e.message === 'boom');
});

// ---------- crearDiagrama ----------
test('crear llama a create_diagram con el tipo y devuelve el id', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push(ok(ID));
  assert.equal(await crearDiagrama(f, 'state'), ID);
  assert.deepEqual(f.llamadasRpc, [{ nombre: 'create_diagram', args: { p_kind: 'state' } }]);
});

test('crear con un tipo que no es flow ni state se rechaza sin llamar al servidor', async () => {
  const f = new SupabaseFalso();
  for (const tipo of ['sequence', '', undefined, null]) await assert.rejects(crearDiagrama(f, tipo), /tipo/i, String(tipo));
  assert.equal(f.llamadasRpc.length, 0);
});

test('crear: un rechazo del servidor llega con su estado', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push(fallo(422, 'invalid_op'));
  await assert.rejects(crearDiagrama(f, 'flow'), e => e.status === 422);
});

// ---------- crearInvitacion ----------
test('compartir llama a create_invite como editor y devuelve el token', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push(ok(TOKEN));
  assert.equal(await crearInvitacion(f, ID), TOKEN);
  assert.deepEqual(f.llamadasRpc, [{ nombre: 'create_invite', args: { p_diagram_id: ID, p_role: 'editor' } }]);
});

test('compartir: quien no es dueño (403) y un diagrama borrado (410) llegan con su estado', async () => {
  for (const status of [403, 410]) {
    const f = new SupabaseFalso();
    f.rpcRespuestas.push(fallo(status, 'x'));
    await assert.rejects(crearInvitacion(f, ID), e => e.status === status, String(status));
  }
});

// ---------- aceptarInvitacion ----------
test('aceptar llama a accept_invite con el token y devuelve el id del diagrama', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push(ok(ID));
  assert.equal(await aceptarInvitacion(f, TOKEN), ID);
  assert.deepEqual(f.llamadasRpc, [{ nombre: 'accept_invite', args: { p_token: TOKEN } }]);
});

test('aceptar: invitación inválida (404) y diagrama borrado (410) llegan con su estado', async () => {
  for (const status of [404, 410]) {
    const f = new SupabaseFalso();
    f.rpcRespuestas.push(fallo(status, 'x'));
    await assert.rejects(aceptarInvitacion(f, TOKEN), e => e.status === status, String(status));
  }
});

// ---------- sin respuesta del servidor ----------
test('si el servidor no responde, el error no lleva estado (ni se confunde con un rechazo)', async () => {
  const lanza = { rpc: async () => { throw new TypeError('Failed to fetch'); }, from: () => { throw new TypeError('Failed to fetch'); } };
  for (const llamada of [() => crearDiagrama(lanza, 'flow'), () => crearInvitacion(lanza, ID), () => aceptarInvitacion(lanza, TOKEN), () => listarDiagramas(lanza)]) {
    await assert.rejects(llamada(), e => e instanceof Error && e.status === undefined);
  }
  const f = new SupabaseFalso();
  f.rpcRespuestas.push(fallo(0, 'network'));    // supabase-js da status 0 cuando no hubo respuesta
  await assert.rejects(crearDiagrama(f, 'flow'), e => e.status === undefined);
});

// ---------- renombrarDiagrama ----------
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('renombrar guarda el título con una operación setMeta, sin transformarlo', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push(ok(7));
  await renombrarDiagrama(f, ID, '  Pedidos <b>y</b> ñ  ');
  assert.equal(f.llamadasRpc.length, 1);
  const { nombre, args } = f.llamadasRpc[0];
  assert.equal(nombre, 'apply_op');
  assert.equal(args.p_diagram_id, ID);
  assert.match(args.p_op_id, UUID_V4);
  assert.deepEqual(args.p_op, { type: 'setMeta', set: { title: '  Pedidos <b>y</b> ñ  ' } });
});

test('cada renombrado usa un op_id distinto', async () => {
  const f = new SupabaseFalso();
  await renombrarDiagrama(f, ID, 'Uno'); await renombrarDiagrama(f, ID, 'Dos');
  assert.notEqual(f.llamadasRpc[0].args.p_op_id, f.llamadasRpc[1].args.p_op_id);
});

test('un título de 200 caracteres vale; de 201, vacío, solo espacios o que no es texto se rechaza con 422 sin llamar al servidor', async () => {
  const f = new SupabaseFalso();
  await renombrarDiagrama(f, ID, 'x'.repeat(200));
  assert.equal(f.llamadasRpc.length, 1);
  for (const titulo of ['x'.repeat(201), '', '   ', '\t\n', undefined, null, 42, {}]) {
    await assert.rejects(renombrarDiagrama(f, ID, titulo), e => e.status === 422, JSON.stringify(titulo));
  }
  assert.equal(f.llamadasRpc.length, 1);
});

test('el límite cuenta en UTF-16, como el servidor: 100 emojis son 200 unidades y 101 son 202', async () => {
  const f = new SupabaseFalso();
  await renombrarDiagrama(f, ID, '😀'.repeat(100));
  await assert.rejects(renombrarDiagrama(f, ID, '😀'.repeat(101)), e => e.status === 422);
});

test('renombrar: un lector (403) y un diagrama borrado (410) llegan con su estado', async () => {
  for (const status of [403, 410]) {
    const f = new SupabaseFalso();
    f.rpcRespuestas.push(fallo(status, 'x'));
    await assert.rejects(renombrarDiagrama(f, ID, 'Nuevo'), e => e.status === status, String(status));
  }
});

// ---------- borrarDiagrama ----------
test('borrar llama a delete_diagram con el id', async () => {
  const f = new SupabaseFalso();
  await borrarDiagrama(f, ID);
  assert.deepEqual(f.llamadasRpc, [{ nombre: 'delete_diagram', args: { p_diagram_id: ID } }]);
});

test('borrar: quien no es dueño (403) llega con su estado', async () => {
  const f = new SupabaseFalso();
  f.rpcRespuestas.push(fallo(403, 'forbidden'));
  await assert.rejects(borrarDiagrama(f, ID), e => e.status === 403);
});

test('renombrar y borrar sin respuesta del servidor: error sin estado', async () => {
  const lanza = { rpc: async () => { throw new TypeError('Failed to fetch'); } };
  await assert.rejects(renombrarDiagrama(lanza, ID, 'x'), e => e instanceof Error && e.status === undefined);
  await assert.rejects(borrarDiagrama(lanza, ID), e => e instanceof Error && e.status === undefined);
});
