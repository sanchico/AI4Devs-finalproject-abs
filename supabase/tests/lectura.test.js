import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from './helpers/entorno.js';
import { db, escenario, leer } from './helpers/datos.js';

after(() => sql.end());

test('un lector lee el diagrama, sus operaciones y sus miembros', async () => {
  const { lector, diagrama } = await escenario();
  assert.equal((await leer(lector.cliente, 'diagrams', diagrama.id)).length, 1);
  const ops = await leer(lector.cliente, 'diagram_ops', diagrama.id);
  assert.deepEqual(ops.map(o => o.seq).sort(), [1, 2]);
  const miembros = await leer(lector.cliente, 'diagram_members', diagrama.id);
  assert.deepEqual(miembros.map(m => m.role).sort(), ['editor', 'owner', 'viewer']);
  assert.ok(miembros.every(m => m.display_name));
});

test('un usuario ajeno recibe cero filas de las cuatro tablas', async () => {
  const { ajeno, diagrama } = await escenario();
  for (const tabla of ['diagrams', 'diagram_members', 'diagram_invites', 'diagram_ops']) {
    assert.deepEqual(await leer(ajeno.cliente, tabla, diagrama.id), [], tabla);
  }
});

test('la lista mezcla los diagramas propios y los compartidos, y no los ajenos', async () => {
  const { dueno, editor, diagrama } = await escenario();
  // El usuario "editor" es además dueño de un segundo diagrama; "dueno" no es miembro de él.
  const { data: propio } = await db.from('diagrams').insert({ owner_id: editor.id, title: 'Propio' }).select().single();
  await db.from('diagram_members').insert({ diagram_id: propio.id, user_id: editor.id, role: 'owner' });
  const { data: ajeno } = await db.from('diagrams').insert({ owner_id: dueno.id, title: 'Ajeno al editor' }).select().single();
  await db.from('diagram_members').insert({ diagram_id: ajeno.id, user_id: dueno.id, role: 'owner' });

  const { data, error } = await editor.cliente.from('diagrams').select('id');
  assert.equal(error, null);
  assert.deepEqual(data.map(d => d.id).sort(), [diagrama.id, propio.id].sort());
});

test('el dueño ve las invitaciones de su diagrama y el editor y el lector no', async () => {
  const { dueno, editor, lector, diagrama, token } = await escenario();
  const delDueno = await leer(dueno.cliente, 'diagram_invites', diagrama.id);
  assert.equal(delDueno.length, 1);
  assert.equal(delDueno[0].token, token);
  assert.equal(delDueno[0].role, 'editor');
  assert.ok(delDueno[0].expires_at);
  assert.deepEqual(await leer(editor.cliente, 'diagram_invites', diagrama.id), []);
  assert.deepEqual(await leer(lector.cliente, 'diagram_invites', diagrama.id), []);
});
