import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { anonimo, usuario, sql } from './helpers/entorno.js';
import { db, escenario, operacion, leer } from './helpers/datos.js';

after(() => sql.end());

const TABLAS = ['diagrams', 'diagram_members', 'diagram_invites', 'diagram_ops'];
const PERMISO_DENEGADO = '42501';

test('sin sesión, la lectura de cada tabla termina en un error de permisos', async () => {
  await escenario();
  for (const tabla of TABLAS) {
    const { data, error } = await anonimo().from(tabla).select('*');
    assert.equal(error?.code, PERMISO_DENEGADO, tabla);
    assert.equal(data, null, tabla);
  }
});

test('sin sesión no se puede insertar una operación', async () => {
  const { diagrama } = await escenario();
  const { error } = await anonimo().from('diagram_ops').insert(operacion(diagrama.id, 3));
  assert.equal(error?.code, PERMISO_DENEGADO);
  assert.equal((await leer(db, 'diagram_ops', diagrama.id)).length, 2);
});

test('un editor no puede insertar una operación directamente', async () => {
  const { editor, diagrama } = await escenario();
  const { error } = await editor.cliente.from('diagram_ops').insert(operacion(diagrama.id, 3, { user_id: editor.id }));
  assert.equal(error?.code, PERMISO_DENEGADO);
  assert.equal((await leer(db, 'diagram_ops', diagrama.id)).length, 2);
});

test('el dueño no puede cambiar el título, el tipo ni la secuencia directamente', async () => {
  const { dueno, diagrama } = await escenario();
  for (const cambio of [{ title: 'Otro' }, { kind: 'state' }, { direction: 'LR' }, { last_seq: 99 }, { deleted_at: new Date().toISOString() }]) {
    const { error } = await dueno.cliente.from('diagrams').update(cambio).eq('id', diagrama.id);
    assert.equal(error?.code, PERMISO_DENEGADO, JSON.stringify(cambio));
  }
  const [actual] = await leer(db, 'diagrams', diagrama.id);
  assert.equal(actual.title, 'De prueba');
  assert.equal(actual.kind, 'flow');
  assert.equal(actual.last_seq, diagrama.last_seq);
  assert.equal(actual.deleted_at, null);
});

test('el dueño no puede borrar su diagrama directamente', async () => {
  const { dueno, diagrama } = await escenario();
  const { error } = await dueno.cliente.from('diagrams').delete().eq('id', diagrama.id);
  assert.equal(error?.code, PERMISO_DENEGADO);
  assert.equal((await leer(db, 'diagrams', diagrama.id)).length, 1);
});

test('un usuario no puede añadirse como miembro de un diagrama ajeno', async () => {
  const { ajeno, diagrama } = await escenario();
  const { error } = await ajeno.cliente.from('diagram_members').insert({ diagram_id: diagrama.id, user_id: ajeno.id, role: 'editor' });
  assert.equal(error?.code, PERMISO_DENEGADO);
  assert.deepEqual(await leer(ajeno.cliente, 'diagrams', diagrama.id), []);
});

test('nadie puede escribir en invitaciones ni vaciar tablas', async () => {
  const { dueno, diagrama } = await escenario();
  const { error } = await dueno.cliente.from('diagram_invites').insert({
    token: randomUUID(), diagram_id: diagrama.id, role: 'editor', created_by: dueno.id, expires_at: new Date(Date.now() + 1e6).toISOString(),
  });
  assert.equal(error?.code, PERMISO_DENEGADO);
});

test('anon no tiene ningún privilegio y authenticated solo SELECT en las cuatro tablas', async () => {
  const privilegios = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  for (const tabla of TABLAS) {
    for (const privilegio of privilegios) {
      const [{ anon, autenticado }] = await sql`
        select has_table_privilege('anon', ${'public.' + tabla}, ${privilegio}) as anon,
               has_table_privilege('authenticated', ${'public.' + tabla}, ${privilegio}) as autenticado`;
      assert.equal(anon, false, `anon ${privilegio} ${tabla}`);
      assert.equal(autenticado, privilegio === 'SELECT', `authenticated ${privilegio} ${tabla}`);
    }
  }
});

test('la RLS está activada en las cuatro tablas', async () => {
  const filas = await sql`select relname, relrowsecurity from pg_class
    where relnamespace = 'public'::regnamespace and relname in ${sql(TABLAS)}`;
  assert.equal(filas.length, 4);
  assert.ok(filas.every(f => f.relrowsecurity), JSON.stringify(filas));
});

test('anon no puede ejecutar member_role', async () => {
  const { error } = await anonimo().rpc('member_role', { p_diagram_id: randomUUID() });
  assert.equal(error?.code, PERMISO_DENEGADO);
  const u = await usuario();
  const { data, error: errorUsuario } = await u.cliente.rpc('member_role', { p_diagram_id: randomUUID() });
  assert.equal(errorUsuario, null);
  assert.equal(data, null);
});
