// gestion-supabase.js: lo que la lista, «Nuevo», «Compartir» y las invitaciones piden a Supabase, con un cliente falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseFalso } from './helpers/supabase-falso.js';
import { listarDiagramas, crearDiagrama, crearInvitacion, aceptarInvitacion } from '../gestion-supabase.js';

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
