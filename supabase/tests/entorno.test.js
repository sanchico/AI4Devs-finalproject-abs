import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { usuario, anonimo, sql } from './helpers/entorno.js';

after(() => sql.end());

test('un usuario nuevo tiene sesión y su propio id', async () => {
  const u = await usuario();
  const { data } = await u.cliente.auth.getUser();
  assert.equal(data.user.id, u.id);
});

test('el cliente anónimo no tiene sesión', async () => {
  const { data } = await anonimo().auth.getSession();
  assert.equal(data.session, null);
});
