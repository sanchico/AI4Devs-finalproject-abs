# Proposal

## Why

Prerrequisito de **S2 · Funciones de servidor** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7.2), que
vuelve a abrir F2 en dos puntos. Respalda **HU-01** (dibujar) y **HU-03** (crear y abrir diagramas) sin
cambiar su alcance.

1. **El tipo de diagrama no puede cambiar con el diagrama ya dibujado.** Hoy `setMeta` cambia `kind` y el
   cambio solo reinterpreta las mismas tres formas (`rect`, `diamond`, `ellipse`), que Flujo y Estados
   comparten. En cuanto entre un tipo con formas propias (clases, ER, secuencia) habrá nodos sin
   significado en el tipo nuevo. Con colaboración, además, un editor cambiaría las reglas del lápiz de los
   demás a mitad de sesión. Y si el tipo es una operación, `create_diagram(title, kind)` deja un diagrama
   cuya fila dice una cosa y cuyo registro (la fuente de verdad) dice otra.
2. **Las etiquetas no tienen tope.** `ops.js` solo valida el título. El PRD exige que `apply_op` rechace
   etiquetas de más de 200 caracteres: el servidor rechazaría algo que el cliente ya ha pintado.

## What Changes

- **El tipo se fija al crear el diagrama.** `setMeta` solo cambia `dir` y `title`; con `kind` se rechaza
  como inválido (y entero: no se aplica ningún campo). El tipo sigue en el estado del cliente, pero entra
  desde fuera (modo local: el selector de la barra; modo colaborativo: la fila de `diagrams`, en F4).
- **Cambiar el tipo en el selector empieza un diagrama nuevo**: vacío, "Diagrama sin título" y sin
  historial de deshacer. Si hay nodos en el lienzo, antes pide confirmación con el aviso "Esta acción no se
  puede deshacer"; si se cancela, el selector vuelve al tipo actual.
- **Tope de 200 caracteres en las etiquetas** de nodos y conectores, en la interfaz (`maxlength` del
  editor) y en `ops.js` (`addNode`, `updateNode`, `addEdge` y `updateEdge` rechazan una etiqueta que no sea
  texto o pase de 200). El tercer sitio, `apply_op`, llega con el change `funciones-servidor`.
- **PRD v0.7.3:** `create_diagram(kind)` sin `title` (el diagrama nace "Diagrama sin título"), `setMeta`
  sin tipo y la regla de las etiquetas.

## Fuera de alcance

- Las funciones de servidor (`create_diagram`, `apply_op`…): son el change `funciones-servidor`, que se
  escribe contra los specs ya actualizados por este.
- Cargar el tipo desde `diagrams.kind` al abrir un diagrama colaborativo: es de F4.
- Nuevos tipos de diagrama y sus formas. Este change es la condición para añadirlos sin romper diagramas
  guardados, pero no añade ninguno. No choca con el "fuera de alcance" del MVP.
- Rediseñar la barra de herramientas: el selector de tipo sigue donde está.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities
- `diagram-operations`: `setMeta` deja de cambiar el tipo (se rechaza); las etiquetas de nodos y conectores
  se validan (texto de 200 caracteres como máximo).
- `canvas-editing`: el cambio de tipo pasa a ser empezar un diagrama nuevo, con confirmación si hay nodos,
  y vacía el historial; el editor de etiquetas limita la longitud.

## Impact

- `frontend/ops.js` (`setMeta` y validación de etiquetas), `frontend/model.js` (`setKind` se sustituye
  por una función que empieza un diagrama del tipo dado), `frontend/main.js` (el selector) y
  `frontend/index.html` (`maxlength`).
- Tests: `ops.test.js` (casos con `kind` en `setMeta`, etiquetas, diagrama nuevo), `convergencia.test.js`
  (etiquetas largas) y los fixtures de `test/fixtures/ops/` que cambian el tipo.
- `docs/PRD-MVP.md` (v0.7.3), `CLAUDE.md` (descripción de `ops.js` y `model.js`) y `openspec/specs/`.
- **BREAKING** para quien envíe `setMeta` con `kind`: no hay registros guardados todavía (S2 no existe),
  así que no hay datos que migrar.
