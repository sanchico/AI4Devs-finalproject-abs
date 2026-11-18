// Invitaciones (S2): create_invite y accept_invite.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { anonimo, usuario, sql } from './helpers/entorno.js';
import { db, equipo, leer, nodo, enviar, guardar } from './helpers/datos.js';

after(() => sql.end());

const PERMISO_DENEGADO = '42501';
const DIA = 864e5;

const invitar = (u, id, rol) => u.cliente.rpc('create_invite', { p_diagram_id: id, p_role: rol });
const aceptar = (u, token) => u.cliente.rpc('accept_invite', { p_token: token });
// El dueño crea una invitación y exige que se cree; devuelve el token
async function token(dueno, id, rol = 'editor') {
  const { data, error } = await invitar(dueno, id, rol);
  assert.equal(error, null, error?.message);
  return data;
}
const rechazo = (r, estado, clave) => {
  assert.equal(r.status, estado);
  assert.equal(r.error?.code, `PT${estado}`);
  assert.equal(r.error?.message, clave);
  assert.equal(r.data, null);
};
const miembros = async id => (await leer(db, 'diagram_members', id)).map(m => [m.user_id, m.role]);

// ---------- create_invite ----------
test('el dueño invita como editor: token de 64 caracteres hexadecimales que caduca dentro de 7 días', async () => {
  const { dueno, id } = await equipo();
  const t = await token(dueno, id, 'editor');
  assert.match(t, /^[0-9a-f]{64}$/);
  const [inv] = await leer(db, 'diagram_invites', id);
  assert.deepEqual([inv.token, inv.role, inv.created_by], [t, 'editor', dueno.id]);
  const restante = new Date(inv.expires_at) - Date.now();
  assert.ok(restante > 7 * DIA - 60e3 && restante <= 7 * DIA, `caducidad ${restante}`);
});

test('el dueño también invita como lector, y dos invitaciones seguidas dan tokens distintos', async () => {
  const { dueno, id } = await equipo();
  const [a, b] = [await token(dueno, id, 'viewer'), await token(dueno, id, 'viewer')];
  assert.notEqual(a, b);
  assert.deepEqual((await leer(db, 'diagram_invites', id)).map(i => i.role), ['viewer', 'viewer']);
});

test('un rol que no se puede invitar se rechaza con 422 y no crea nada', async () => {
  const { dueno, id } = await equipo();
  for (const rol of ['owner', 'admin', '', null]) rechazo(await invitar(dueno, id, rol), 422, 'invalid_op');
  assert.deepEqual(await leer(db, 'diagram_invites', id), []);
});

test('un editor y un lector no pueden invitar (403) y un ajeno recibe 404', async () => {
  const { editor, lector, ajeno, id } = await equipo();
  rechazo(await invitar(editor, id, 'editor'), 403, 'forbidden');
  rechazo(await invitar(lector, id, 'viewer'), 403, 'forbidden');
  rechazo(await invitar(ajeno, id, 'editor'), 404, 'not_found');
  assert.deepEqual(await leer(db, 'diagram_invites', id), []);
});

test('no se puede invitar a un diagrama borrado: 410', async () => {
  const { dueno, id } = await equipo();
  await dueno.cliente.rpc('delete_diagram', { p_diagram_id: id });
  rechazo(await invitar(dueno, id, 'editor'), 410, 'diagram_deleted');
  assert.deepEqual(await leer(db, 'diagram_invites', id), []);
});

test('sin sesión no se puede crear ni aceptar una invitación', async () => {
  const { dueno, id } = await equipo();
  const t = await token(dueno, id);
  const crear = await anonimo().rpc('create_invite', { p_diagram_id: id, p_role: 'editor' });
  const aceptarSinSesion = await anonimo().rpc('accept_invite', { p_token: t });
  assert.equal(crear.error?.code, PERMISO_DENEGADO);
  assert.equal(aceptarSinSesion.error?.code, PERMISO_DENEGADO);
  assert.equal((await miembros(id)).length, 3);
});

// ---------- accept_invite ----------
test('aceptar como editor: es miembro con su correo, ve el diagrama y puede escribir', async () => {
  const { dueno, id } = await equipo();
  const nuevo = await usuario();
  const r = await aceptar(nuevo, await token(dueno, id, 'editor'));
  assert.equal(r.error, null);
  assert.equal(r.data, id);
  const fila = (await leer(db, 'diagram_members', id)).find(m => m.user_id === nuevo.id);
  assert.deepEqual([fila.role, fila.display_name], ['editor', nuevo.correo]);
  assert.equal((await leer(nuevo.cliente, 'diagrams', id)).length, 1);
  assert.equal(await guardar(nuevo, id, nodo('a')), 1);
  assert.equal((await leer(nuevo.cliente, 'diagram_ops', id)).length, 1);
});

test('aceptar como lector: ve el diagrama y recibe 403 al escribir', async () => {
  const { dueno, id } = await equipo();
  await guardar(dueno, id, nodo('a'));
  const nuevo = await usuario();
  assert.equal((await aceptar(nuevo, await token(dueno, id, 'viewer'))).error, null);
  assert.equal((await leer(nuevo.cliente, 'diagram_ops', id)).length, 1);
  rechazo(await enviar(nuevo, id, nodo('b')), 403, 'forbidden');
});

test('un mismo enlace sirve a varios usuarios hasta que caduca', async () => {
  const { dueno, id } = await equipo();
  const t = await token(dueno, id, 'editor');
  const [a, b] = [await usuario(), await usuario()];
  assert.equal((await aceptar(a, t)).error, null);
  assert.equal((await aceptar(b, t)).error, null);
  const roles = Object.fromEntries(await miembros(id));
  assert.equal(roles[a.id], 'editor');
  assert.equal(roles[b.id], 'editor');
});

test('una invitación caducada y un token desconocido dan el mismo error de invitación no válida', async () => {
  const { dueno, id } = await equipo();
  const t = await token(dueno, id, 'editor');
  const { error } = await db.from('diagram_invites').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('token', t);
  assert.equal(error, null);
  const nuevo = await usuario();
  const caducada = await aceptar(nuevo, t);
  const desconocida = await aceptar(nuevo, 'no-existe');
  rechazo(caducada, 404, 'invite_invalid');
  rechazo(desconocida, 404, 'invite_invalid');
  assert.deepEqual(caducada.error, desconocida.error);
  assert.equal((await miembros(id)).length, 3);
  assert.deepEqual(await leer(nuevo.cliente, 'diagrams', id), []);
});

test('el token nulo se trata como desconocido', async () => {
  const nuevo = await usuario();
  rechazo(await nuevo.cliente.rpc('accept_invite', { p_token: null }), 404, 'invite_invalid');
});

test('una invitación a un diagrama borrado da 410 y no añade a nadie', async () => {
  const { dueno, id } = await equipo();
  const t = await token(dueno, id, 'editor');
  await dueno.cliente.rpc('delete_diagram', { p_diagram_id: id });
  const nuevo = await usuario();
  rechazo(await aceptar(nuevo, t), 410, 'diagram_deleted');
  assert.equal((await miembros(id)).length, 3);
});

// ---------- Quien ya es miembro conserva su rol ----------
test('el dueño que abre su propio enlace de lector sigue siendo el único dueño', async () => {
  const { dueno, id } = await equipo();
  const r = await aceptar(dueno, await token(dueno, id, 'viewer'));
  assert.equal(r.error, null);
  assert.equal(r.data, id);
  const dueños = (await leer(db, 'diagram_members', id)).filter(m => m.role === 'owner');
  assert.deepEqual(dueños.map(m => m.user_id), [dueno.id]);
});

test('un lector que abre un enlace de editor sigue siendo lector, y un editor con uno de lector sigue siendo editor', async () => {
  const { dueno, editor, lector, id } = await equipo();
  assert.equal((await aceptar(lector, await token(dueno, id, 'editor'))).error, null);
  assert.equal((await aceptar(editor, await token(dueno, id, 'viewer'))).error, null);
  const roles = Object.fromEntries(await miembros(id));
  assert.equal(roles[lector.id], 'viewer');
  assert.equal(roles[editor.id], 'editor');
  rechazo(await enviar(lector, id, nodo('a')), 403, 'forbidden');
});

test('aceptar dos veces no da error ni duplica al miembro', async () => {
  const { dueno, id } = await equipo();
  const t = await token(dueno, id, 'editor');
  const nuevo = await usuario();
  const primera = await aceptar(nuevo, t), segunda = await aceptar(nuevo, t);
  assert.deepEqual([primera.error, segunda.error], [null, null]);
  assert.equal(segunda.data, id);
  assert.equal((await leer(db, 'diagram_members', id)).filter(m => m.user_id === nuevo.id).length, 1);
});

test('dos aceptaciones simultáneas del mismo usuario no fallan', async () => {
  const { dueno, id } = await equipo();
  const t = await token(dueno, id, 'editor');
  const nuevo = await usuario();
  const rs = await Promise.all([aceptar(nuevo, t), aceptar(nuevo, t), aceptar(nuevo, t)]);
  assert.deepEqual(rs.map(r => r.error), [null, null, null]);
  assert.equal((await leer(db, 'diagram_members', id)).filter(m => m.user_id === nuevo.id).length, 1);
});
