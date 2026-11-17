// Borrado lógico. Hasta S2 no existen delete_diagram ni restore_diagram: se marca deleted_at con la
// clave de servicio, que es lo que harán esas funciones.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from './helpers/entorno.js';
import { db, escenario, leer } from './helpers/datos.js';

after(() => sql.end());

const marcar = (diagrama, valor) => db.from('diagrams').update({ deleted_at: valor }).eq('id', diagrama.id).then(({ error }) => assert.equal(error, null));

test('los miembros dejan de ver un diagrama borrado', async () => {
  const { editor, lector, diagrama } = await escenario();
  await marcar(diagrama, new Date().toISOString());
  for (const miembro of [editor, lector]) {
    for (const tabla of ['diagrams', 'diagram_members', 'diagram_ops']) {
      assert.deepEqual(await leer(miembro.cliente, tabla, diagrama.id), [], tabla);
    }
    const { data } = await miembro.cliente.from('diagrams').select('id');
    assert.ok(!data.some(d => d.id === diagrama.id));
  }
});

test('el dueño sigue viendo su diagrama borrado, con la fecha, y sus operaciones', async () => {
  const { dueno, diagrama } = await escenario();
  await marcar(diagrama, new Date().toISOString());
  const { data } = await dueno.cliente.from('diagrams').select('id, deleted_at');
  const borrado = data.find(d => d.id === diagrama.id);
  assert.ok(borrado?.deleted_at);
  assert.equal((await leer(dueno.cliente, 'diagram_ops', diagrama.id)).length, 2);
  assert.equal((await leer(dueno.cliente, 'diagram_members', diagrama.id)).length, 3);
});

test('restaurar devuelve el diagrama intacto', async () => {
  const { editor, diagrama } = await escenario();
  const antes = await leer(editor.cliente, 'diagram_ops', diagrama.id);
  const miembrosAntes = await leer(editor.cliente, 'diagram_members', diagrama.id);
  await marcar(diagrama, new Date().toISOString());
  assert.deepEqual(await leer(editor.cliente, 'diagram_ops', diagrama.id), []);
  await marcar(diagrama, null);
  const despues = await leer(editor.cliente, 'diagram_ops', diagrama.id);
  const ordenar = filas => [...filas].sort((a, b) => a.seq - b.seq);
  assert.deepEqual(ordenar(despues), ordenar(antes));
  assert.deepEqual(ordenar(despues).map(o => o.seq), [1, 2]);
  const miembrosDespues = await leer(editor.cliente, 'diagram_members', diagrama.id);
  assert.deepEqual(miembrosDespues.map(m => m.user_id).sort(), miembrosAntes.map(m => m.user_id).sort());
});
