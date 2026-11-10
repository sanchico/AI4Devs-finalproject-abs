// Escape de etiquetas en el código Mermaid generado (change vista-previa-segura).
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, mermaidCode } from '../kinds/index.js';

const graph = (label, shape = 'rect', edgeLabel = '') => ({
  nodes: [{ id: 'n1', shape, x: 0, y: 0, w: 100, h: 50, label }, { id: 'n2', shape: 'rect', x: 0, y: 100, w: 100, h: 50, label: 'B' }],
  edges: [{ from: 'n1', to: 'n2', label: edgeLabel }],
});

test('una etiqueta con < > & se escribe con entidades de Mermaid', () => {
  assert.ok(mermaidCode(graph('a<b & c>d'), 'flow', 'TD').includes('n1["a#lt;b #amp; c#gt;d"]'));
});

test('el & se escapa primero y no rompe las demás entidades', () => {
  assert.equal(esc('&<>'), '#amp;#lt;#gt;');
  assert.equal(esc('#lt;'), '#lt;'); // un texto que ya parece una entidad no se toca
  assert.equal(esc('&lt;'), '#amp;lt;');
});

test('las comillas y los saltos de línea se siguen escapando', () => {
  assert.ok(mermaidCode(graph('Leer "x"'), 'flow', 'TD').includes('["Leer #quot;x#quot;"]'));
  assert.equal(esc('a\nb'), 'a b');
  assert.equal(esc(''), '');
  assert.equal(esc(undefined), '');
});

test('la etiqueta de un conector de flujo también se escapa', () => {
  assert.ok(mermaidCode(graph('A', 'rect', '<b>sí</b>'), 'flow', 'TD').includes('n1 -->|#lt;b#gt;sí#lt;/b#gt;| n2'));
});

test('en Estados la etiqueta de un estado y la de una arista se escapan', () => {
  const code = mermaidCode(graph('<script>alert(1)</script>', 'rect', '<i>x</i>'), 'state', 'TD');
  assert.ok(code.includes('state "#lt;script#gt;alert(1)#lt;/script#gt;" as n1'));
  assert.ok(code.includes('n1 --> n2 : #lt;i#gt;x#lt;/i#gt;'));
});

test('con etiquetas hostiles no queda ningún < ni > fuera de las flechas', () => {
  const code = mermaidCode(graph('<img src=x onerror=alert(1)>'), 'flow', 'TD');
  assert.equal(/[<>]/.test(code.replaceAll('-->', '')), false);
});

test('la barra vertical se escribe como entidad para no cerrar la etiqueta del conector', () => {
  assert.equal(esc('a|b'), 'a#124;b');
  assert.ok(mermaidCode(graph('A', 'rect', 'a|b'), 'flow', 'TD').includes('n1 -->|a#124;b| n2'));
});

test('en Estados la barra vertical de la etiqueta de una arista también se escribe como entidad', () => {
  assert.ok(mermaidCode(graph('A', 'rect', 'a|b'), 'state', 'TD').includes('n1 --> n2 : a#124;b'));
});

test('la línea de un conector de flujo con barra solo tiene las dos barras delimitadoras', () => {
  const line = mermaidCode(graph('A', 'rect', 'a|b|c'), 'flow', 'TD').split('\n').find(l => l.includes('-->'));
  assert.equal(line.split('|').length - 1, 2);
});
