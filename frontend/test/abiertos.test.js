// Guardas del reconocedor: los trazos abiertos (conectores) no deben convertirse en formas.
// Importan sobre todo si se cambia el umbral con el que un trazo se considera cerrado.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS } from '../kinds/index.js';
import { recognize } from '../recognizer.js';

const along = (pts, steps = 8) => {
  const out = [{ x: pts[0][0], y: pts[0][1] }];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    for (let s = 1; s <= steps; s++) out.push({ x: x0 + (x1 - x0) * s / steps, y: y0 + (y1 - y0) * s / steps });
  }
  return out;
};
const arco = (cx, cy, r, desde, hasta) => Array.from({ length: 41 }, (_, i) => {
  const a = desde + (hasta - desde) * i / 40;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
});

const abiertos = {
  'una línea de 200 px': along([[0, 0], [200, 0]]),
  'una L': along([[0, 0], [0, 150], [150, 150]]),
  'una U de ancho igual a su alto': along([[0, 0], [0, 150], [150, 150], [150, 0]]),
  'un arco de media circunferencia': arco(100, 100, 80, Math.PI, 2 * Math.PI),
};

for (const kind of Object.keys(KINDS)) {
  const permitidas = Object.keys(KINDS[kind].shapes);
  for (const [nombre, pts] of Object.entries(abiertos)) {
    test(`${KINDS[kind].name}: ${nombre} sigue siendo un trazo abierto`, () => {
      assert.equal(recognize(pts, permitidas).type, 'open');
    });
  }
}
