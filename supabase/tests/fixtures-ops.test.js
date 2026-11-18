// Contrato entre cliente y servidor: las secuencias de operaciones de frontend/test/fixtures/ops/*.json, que
// ejecuta apply() de ops.js, se envían una a una a apply_op. El servidor no interpreta el grafo, así que:
//   - lo que el cliente da por `ok`, `missing` o `duplicate` (bien formado; el grafo decide) lo guarda;
//   - lo que el cliente rechaza por su forma o sus valores (`invalid`, `unknown`) lo rechaza con 422.
// Si una regla de validate_op y la de ops.js se separan, este test se pone en rojo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { sql } from './helpers/entorno.js';
import { db, equipo, leer, enviar } from './helpers/datos.js';

after(() => sql.end());

const dir = new URL('../../frontend/test/fixtures/ops/', import.meta.url);
const fixtures = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

const GUARDA = new Set(['ok', 'missing', 'duplicate']);
const RECHAZA = new Set(['invalid', 'unknown']);

test('las fixtures cubren las cuatro respuestas del cliente', () => {
  const vistas = new Set(fixtures.flatMap(fx => fx.ops.map(o => o.resultado)));
  for (const r of [...GUARDA, ...RECHAZA]) assert.ok(vistas.has(r), `ninguna fixture da "${r}"`);
});

for (const fx of fixtures) {
  test(`fixture ${fx.nombre}: el servidor guarda lo que el cliente acepta o descarta por el grafo y rechaza lo mal formado`, async () => {
    const { editor, id } = await equipo(fx.inicial?.kind ?? 'flow');
    let guardadas = 0;
    for (const [i, { op, resultado }] of fx.ops.entries()) {
      const nombre = `${fx.nombre}: operación ${i + 1} (${op?.type ?? JSON.stringify(op)}, cliente: ${resultado})`;
      const r = await enviar(editor, id, op);
      if (GUARDA.has(resultado)) {
        assert.equal(r.error, null, `${nombre}: el servidor la rechazó (${r.error?.message} ${r.error?.details ?? ''})`);
        assert.equal(r.data, ++guardadas, nombre);
      } else {
        assert.ok(RECHAZA.has(resultado), nombre);
        assert.equal(r.status, 422, `${nombre}: el servidor la guardó`);
        assert.equal(r.error?.message, 'invalid_op', nombre);
      }
    }
    assert.equal((await leer(db, 'diagram_ops', id)).length, guardadas);
  });
}
