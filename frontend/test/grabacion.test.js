// Estado del modo de grabación `?grabar` y formato del archivo que exporta.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crear, añadir, descartarUltimo, contar, total, aJSON, FORMAS } from '../grabacion.js';

const pts = [{ x: 1.26, y: 2.04 }, { x: 10, y: 20.55 }];

test('una grabación nueva tiene los contadores a cero', () => {
  assert.deepEqual(contar(crear()), { rect: 0, diamond: 0, ellipse: 0 });
});

test('añadir sube el contador de su forma y redondea a un decimal', () => {
  const g = crear();
  assert.equal(añadir(g, 'diamond', 'pen', pts), true);
  assert.deepEqual(contar(g), { rect: 0, diamond: 1, ellipse: 0 });
  assert.deepEqual(aJSON(g).formas.diamond[0].pts, [{ x: 1.3, y: 2 }, { x: 10, y: 20.6 }]);
});

test('añadir rechaza una forma desconocida y un trazo sin puntos', () => {
  const g = crear();
  assert.equal(añadir(g, 'triangulo', 'pen', pts), false);
  assert.equal(añadir(g, 'rect', 'pen', []), false);
  assert.equal(total(g), 0);
});

test('descartarUltimo quita la última muestra añadida, de cualquier forma', () => {
  const g = crear();
  añadir(g, 'rect', 'pen', pts); añadir(g, 'ellipse', 'pen', pts); añadir(g, 'rect', 'pen', pts);
  assert.equal(descartarUltimo(g), true);
  assert.deepEqual(contar(g), { rect: 1, diamond: 0, ellipse: 1 });
  descartarUltimo(g);
  assert.deepEqual(contar(g), { rect: 1, diamond: 0, ellipse: 0 });
});

test('descartarUltimo sin muestras no cambia nada', () => {
  const g = crear();
  assert.equal(descartarUltimo(g), false);
  assert.deepEqual(contar(g), { rect: 0, diamond: 0, ellipse: 0 });
});

test('el JSON tiene las tres formas, trazos {tipo, pts} y sobrevive a serializarse', () => {
  const g = crear();
  añadir(g, 'rect', 'pen', pts);
  const j = aJSON(g, 'tablet');
  assert.equal(j.dispositivo, 'tablet');
  assert.deepEqual(Object.keys(j.formas), FORMAS);
  assert.deepEqual(Object.keys(j.formas.rect[0]), ['tipo', 'pts']);
  assert.equal(j.formas.rect[0].tipo, 'pen');
  assert.deepEqual(JSON.parse(JSON.stringify(j)), j);
});
