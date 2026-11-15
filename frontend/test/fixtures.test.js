// Secuencias de operaciones con el resultado de cada una y el diagrama final (frontend/test/fixtures/ops).
// Las fixtures están escritas a mano desde la spec; si un test falla, se investiga qué lado está mal.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { apply } from '../ops.js';
import { mermaidCode } from '../kinds/index.js';

const dir = new URL('./fixtures/ops/', import.meta.url);
const vacio = () => ({ kind: 'flow', dir: 'TD', title: 'Diagrama sin título', nodes: [], edges: [] });
const fixtures = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

test('hay fixtures de operaciones', () => {
  assert.ok(fixtures.length >= 5);
});

for (const fx of fixtures) {
  for (const [modo, prepara] of [['directa', op => op], ['serializada', op => JSON.parse(JSON.stringify(op))]]) {
    test(`fixture ${fx.nombre} (${modo})`, () => {
      const s = structuredClone(fx.inicial ?? vacio());
      fx.ops.forEach(({ op, resultado }, i) => {
        const r = apply(s, prepara(op));
        const obtenido = r.ok ? 'ok' : r.reason;
        assert.equal(obtenido, resultado, `${fx.nombre}: operación ${i + 1} (${op.type})`);
      });
      assert.deepEqual(s, fx.final, `${fx.nombre}: diagrama final`);
      if (fx.mermaid !== undefined) assert.equal(mermaidCode(s, s.kind, s.dir), fx.mermaid, `${fx.nombre}: Mermaid`);
    });
  }
}
