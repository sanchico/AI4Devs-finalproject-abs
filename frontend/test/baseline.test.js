// Red de seguridad del refactor (F1): fija el comportamiento del commit base.
// Lanzar con: node --test frontend/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINDS, mermaidCode } from '../kinds/index.js';
import { recognize } from '../recognizer.js';
import * as model from '../model.js';

// Git en Windows puede convertir los saltos de línea del fixture a CRLF
const baseline = readFileSync(new URL('./baseline-ejemplo.mmd', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el código Mermaid del ejemplo es el del commit base', () => {
  model.loadExample();
  assert.equal(mermaidCode(model.state, 'flow', 'TD'), baseline);
});

// Trazos sintéticos: los mismos que dibuja el driver de la skill run-trazo-mermaid
const along = (pts, steps = 8) => {
  const out = [{ x: pts[0][0], y: pts[0][1] }];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    for (let s = 1; s <= steps; s++) out.push({ x: x0 + (x1 - x0) * s / steps, y: y0 + (y1 - y0) * s / steps });
  }
  return out;
};
const rect = (x, y, w, h) => along([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + 2]]);
const diamond = (cx, cy, rx, ry) => along([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry + 2]]);
const ellipse = (cx, cy, rx, ry) => Array.from({ length: 41 }, (_, i) => {
  const a = i / 40 * 2 * Math.PI;
  return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
});

const strokes = { rect: rect(130, 180, 140, 70), diamond: diamond(200, 380, 90, 60), ellipse: ellipse(200, 80, 70, 35) };

for (const kind of Object.keys(KINDS)) {
  const allowed = Object.keys(KINDS[kind].shapes);
  for (const [shape, pts] of Object.entries(strokes)) {
    test(`${KINDS[kind].name}: el trazo de ${shape} se clasifica como ${shape}`, () => {
      const r = recognize(pts, allowed);
      assert.equal(r.type, 'shape');
      assert.equal(r.shape, shape);
    });
  }
}

test('el reconocedor es determinista y respeta las formas permitidas', () => {
  const allowed = Object.keys(KINDS.flow.shapes);
  assert.deepEqual(recognize(strokes.rect, allowed), recognize(strokes.rect, allowed));
  assert.equal(recognize(strokes.diamond, ['rect', 'ellipse']).shape !== 'diamond', true);
});

test('descarta trazos diminutos y detecta los abiertos', () => {
  const allowed = Object.keys(KINDS.flow.shapes);
  assert.equal(recognize(along([[0, 0], [10, 0]]), allowed).type, 'none');
  assert.equal(recognize(along([[0, 0], [200, 0]]), allowed).type, 'open');
});
