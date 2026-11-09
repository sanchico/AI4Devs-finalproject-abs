// Palabra clave de dirección de cada tipo en el código Mermaid (change direccion-estados).
// Mermaid solo admite TB, BT, RL y LR en stateDiagram-v2: con `direction TD` dibuja "direction" y "TD"
// como dos estados más. El modelo sigue guardando TD o LR; la traducción ocurre al generar el código.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mermaidCode } from '../kinds/index.js';

const graph = { nodes: [], edges: [] };
const lines = (kind, dir) => mermaidCode(graph, kind, dir).split('\n');

test('Estados de arriba a abajo escribe direction TB y nunca direction TD', () => {
  const code = mermaidCode(graph, 'state', 'TD');
  assert.equal(lines('state', 'TD')[0], 'stateDiagram-v2');
  assert.equal(lines('state', 'TD')[1], '  direction TB');
  assert.ok(!code.includes('direction TD'));
});

test('Estados de izquierda a derecha escribe direction LR', () => {
  assert.equal(lines('state', 'LR')[1], '  direction LR');
});

test('Estados deja pasar tal cual otra dirección que Mermaid admita (BT, RL)', () => {
  assert.equal(lines('state', 'BT')[1], '  direction BT');
  assert.equal(lines('state', 'RL')[1], '  direction RL');
});

test('Flujo no cambia: flowchart TD y flowchart LR', () => {
  assert.equal(lines('flow', 'TD')[0], 'flowchart TD');
  assert.equal(lines('flow', 'LR')[0], 'flowchart LR');
});

test('cambiar de dirección en Estados regenera la cabecera en los dos sentidos', () => {
  assert.equal(lines('state', 'LR')[1], '  direction LR');
  assert.equal(lines('state', 'TD')[1], '  direction TB');
});
