import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from './helpers/entorno.js';

after(() => sql.end());

test('diagram_ops es la única tabla publicada por Realtime', async () => {
  const filas = await sql`select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime'`;
  assert.deepEqual(filas.map(f => `${f.schemaname}.${f.tablename}`), ['public.diagram_ops']);
});

test('Realtime solo publica inserciones', async () => {
  const [p] = await sql`select pubinsert, pubupdate, pubdelete, pubtruncate from pg_publication where pubname = 'supabase_realtime'`;
  assert.deepEqual({ ...p }, { pubinsert: true, pubupdate: false, pubdelete: false, pubtruncate: false });
});
