# Proposal

## Why

Bloque **F3 · Tests del frontend** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7), base de la
historia **HU-01** (dibujar juntos en tiempo real) y del criterio de terminado 2: "tras una ráfaga de
operaciones concurrentes, todos los clientes muestran el mismo grafo y el mismo código Mermaid. Lo
comprueba un test automático".

Hoy nada lo comprueba. `ops.test.js` cubre `apply` operación a operación y dos réplicas con una sola
secuencia, pero no hay ningún test con varios clientes que apliquen cambios propios antes de recibir los
ajenos, que es lo que ocurrirá en F4. Además, desde la v0.7 `apply` solo existe en JavaScript y el
servidor ordena sin interpretar el grafo, así que estos tests son la única garantía de que los clientes
convergen. Conviene tenerlos antes de escribir S1, S2 y F4.

Comprobado con el `apply` real: la regla de la v0.6 para las operaciones pendientes ("las remotas sobre ese
mismo campo no la pisan", en [PRD-backend-java.md](../../../docs/PRD-backend-java.md), que la v0.7 adopta
"como en la v0.6") **no basta**. Si dos clientes insertan a la vez un nodo en la misma posición,
cada uno acaba con los nodos en distinto orden (`q,p,x` y `p,q,x`) y por tanto con distinto código
Mermaid, que numera los nodos por posición. El test tiene que usar una estrategia que sí converja (ver
design.md) y F4 debe heredarla.

## What Changes

- **Fixtures de operaciones** en `frontend/test/fixtures/ops/*.json`: cada archivo es una secuencia de
  operaciones, el resultado esperado de cada una (`ok` o el motivo del rechazo) y el diagrama final. Un
  test las ejecuta todas. Incluyen operaciones que `apply` rechaza, porque con el backend en Supabase el
  servidor las guarda igualmente y todos los clientes tienen que descartarlas igual.
- **Red simulada** en `frontend/test/helpers/`: un servidor que numera las operaciones en un registro y
  clientes con operaciones pendientes, para probar la convergencia sin red ni navegador.
- **Test de convergencia**: varios clientes con operaciones pendientes reciben el mismo registro ordenado
  y acaban con el mismo grafo y el mismo código Mermaid, que además coinciden con reproducir el registro
  sobre un diagrama vacío. Incluye casos escritos a mano (inserción en la misma posición, edición del
  mismo campo, borrar y editar a la vez) y ráfagas generadas con una semilla fija.
- **Tests de Mermaid por tipo**: un diagrama completo de cada tipo (Flujo y Estados) con todas sus formas y
  aristas con y sin etiqueta. Hoy ningún test cubre `[*]` ni `<<choice>>` en Estados.
- Ningún cambio en el código de la aplicación: no se toca `ops.js`, `model.js`, `kinds/` ni la interfaz.

## Fuera de alcance

- El cliente colaborativo real (`collab.js`: canal, cola de envío, reconciliación por `op_id`): F4. La red
  simulada es código de test; F4 puede promoverla a módulo.
- Escribir la spec de la convergencia con operaciones pendientes: se escribe en F4, cuando exista ese
  comportamiento en la aplicación. Por eso este change no lleva deltas de specs (`skip_specs`).
- Convergencia de **deshacer** entre usuarios (criterio 3): también F4.
- Permisos, tamaño de las operaciones y numeración en el servidor: S2 y S3.
- Grabar trazos con el S Pen y medir la precisión del reconocedor: otro change de F3 (`grabar-trazos`).
- Corregir la regla de reconciliación del PRD: se deja anotada en design.md, no se edita el PRD aquí.
- No choca con el "fuera de alcance" del MVP.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Los tests de Mermaid fijan requisitos que ya están en la spec `mermaid-generation` (código de un
diagrama de estados) y los de convergencia comprueban la "Aplicación determinista" de `diagram-operations`;
ninguno cambia el comportamiento del sistema.

## Impact

- Nuevo `frontend/test/fixtures/ops/*.json` y `frontend/test/fixtures.test.js`.
- Nuevo `frontend/test/helpers/red-simulada.js` y `frontend/test/convergencia.test.js`.
- Nuevo `frontend/test/mermaid-tipos.test.js`.
- `CLAUDE.md`: descripción de los tests nuevos y de dónde viven las fixtures.
- Sin cambios en `frontend/*.js`, en `kinds/`, en el baseline del código Mermaid ni en la interfaz.
