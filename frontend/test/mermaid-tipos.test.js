// Código Mermaid completo de un diagrama de cada tipo, con todas sus formas y aristas con y sin etiqueta.
// El texto esperado está escrito a mano desde la spec `mermaid-generation`, no copiado de la salida.
// Lanzar con: node --test "frontend/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mermaidCode } from '../kinds/index.js';

const nodo = (id, shape, label) => ({ id, shape, x: 0, y: 0, w: 80, h: 40, label });
const arista = (id, from, to, label = '') => ({ id, from, to, label });

test('Flujo de izquierda a derecha: tres formas, nodo sin etiqueta y aristas con y sin etiqueta', () => {
  const graph = {
    nodes: [nodo('a', 'rect', 'Proceso'), nodo('b', 'diamond', '¿Listo?'), nodo('c', 'ellipse', 'Fin'), nodo('d', 'rect', '')],
    edges: [arista('e1', 'a', 'b'), arista('e2', 'b', 'c', 'sí'), arista('e3', 'b', 'd', 'no')],
  };
  assert.equal(mermaidCode(graph, 'flow', 'LR'), [
    'flowchart LR',
    '  n1["Proceso"]',
    '  n2{"¿Listo?"}',
    '  n3(["Fin"])',
    '  n4[" "]',
    '  n1 --> n2',
    '  n2 -->|sí| n3',
    '  n2 -->|no| n4',
  ].join('\n'));
});

test('Estados: [*] para las elipses, <<choice>> para el rombo y las elipses ocupan número aunque no se declaren', () => {
  const graph = {
    nodes: [nodo('i', 'ellipse', ''), nodo('s', 'rect', 'Activo'), nodo('c', 'diamond', 'x'), nodo('t', 'rect', 'Cerrado'), nodo('f', 'ellipse', '')],
    edges: [arista('e1', 'i', 's'), arista('e2', 's', 'c', 'falla'), arista('e3', 'c', 't'), arista('e4', 't', 'f')],
  };
  assert.equal(mermaidCode(graph, 'state', 'TD'), [
    'stateDiagram-v2',
    '  direction TB',
    '  state "Activo" as n2',
    '  state n3 <<choice>>',
    '  state "Cerrado" as n4',
    '  [*] --> n2',
    '  n2 --> n3 : falla',
    '  n3 --> n4',
    '  n4 --> [*]',
  ].join('\n'));
});
