# Proposal

## Why

Bloque **F2 · Modelo de operaciones** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md), base de la historia
**HU-01** (dibujar juntos en tiempo real) y de **HU-03** (no perder el trabajo). Hoy el modelo se cambia
mutando `state` directamente, deshacer guarda instantáneas completas y los identificadores (`n1`, `n2`…)
salen de un contador local. Nada de eso se puede enviar por la red ni reproducir en otro cliente: los
contadores colisionan entre usuarios y una instantánea deshace también los cambios de los demás. F4
(cliente colaborativo) necesita que todo cambio sea una operación pequeña, serializable y con
identificadores únicos.

## What Changes

- Todo cambio del modelo pasa por `apply(op)` con siete tipos de operación: `addNode`, `updateNode`,
  `removeNode` (borra también sus aristas), `addEdge`, `updateEdge`, `removeEdge` y `setMeta` (tipo y
  dirección; el título llega con F5).
- Las operaciones son JSON plano. `apply` las valida: una operación que referencia un elemento que no
  existe, o una arista duplicada, se rechaza sin cambiar nada.
- Nodos **y aristas** tienen un identificador UUID. Las aristas no tenían identificador.
- Deshacer pasa de instantáneas a **operaciones inversas**, agrupadas por gesto (limpiar, arrastrar).
  Deshacer salta las inversas de elementos que ya no existen.
- Arrastrar un nodo genera una sola operación al soltar, no una por movimiento del puntero.
- **Cambio visible:** el código Mermaid numera los nodos por su orden en el diagrama (`n1`, `n2`…) en
  lugar de usar el contador interno. El ejemplo produce el mismo código; tras "Limpiar", los nodos nuevos
  empiezan en `n1` y no en `n6`. Se actualiza `frontend/test/baseline-skill.txt` y queda anotado como
  única excepción al "funciona igual que antes" del PRD.

## Fuera de alcance

- Enviar o recibir operaciones por red, cola de pendientes y confirmaciones: F4.
- Fixtures compartidas en `shared/fixtures/ops/` y `apply` en Java: F3 y B6. El invariante de
  `openspec/config.yaml` ("apply existe en JS y en Java") aún no aplica porque no hay backend; el formato
  de las operaciones se elige para que las fixtures de F3 se escriban sin cambios. Tampoco depende de la
  decisión pendiente entre la v0.5 y el [PRD alternativo con Supabase](../../../docs/PRD-MVP-supabase.md).
- Título del diagrama (F5) y deshacer de los cambios de tipo o dirección (hoy tampoco se deshacen).
- No choca con el "fuera de alcance" del MVP.

## Capabilities

### New Capabilities
- `diagram-operations`: formato de las operaciones sobre el grafo, sus reglas de validación,
  identificadores únicos, determinismo y deshacer por operaciones inversas.

### Modified Capabilities
- `canvas-editing`: el requisito "Deshacer y limpiar" precisa que deshacer restaura el orden exacto, que
  un arrastre es un solo paso y que no se deshacen los cambios de tipo ni de dirección.
- `mermaid-generation`: nuevo requisito sobre los identificadores de nodo en el código (`n1`… por orden).

## Impact

- Nuevo `frontend/ops.js` (puro): `apply`, `inverse`, `newId`.
- `frontend/model.js`: pierde `snapshot` y `seq`; sus funciones construyen operaciones y las aplican; la
  pila de deshacer guarda grupos de inversas.
- `frontend/input.js`: referencia nodos y aristas por id; el arrastre emite una operación al soltar.
- `frontend/main.js`: tipo y dirección con `setMeta`.
- `frontend/kinds/index.js`: identificadores `n1`… por orden al generar el código.
- Tests: nuevo `frontend/test/ops.test.js`; `baseline-skill.txt` actualizado.
- `CLAUDE.md`: descripción de `ops.js` y de `model.js`.
