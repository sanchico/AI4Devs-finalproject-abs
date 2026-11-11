# Tasks

Estimación total: 3 h (la del bloque F2 del PRD).

## 1. Tests primero (0,5 h)

- [x] 1.1 Escribir `frontend/test/ops.test.js` con los escenarios de `diagram-operations`: cada tipo de operación, rechazos (`missing`, `duplicate`, `invalid`, `unknown`) sin cambiar el estado, `removeNode` con sus aristas, operación serializada con `JSON.parse(JSON.stringify(op))`, dos réplicas con la misma secuencia y UUID v4 con y sin `crypto.randomUUID`. Verificación: `node --test "frontend/**/*.test.js"` falla solo porque `ops.js` no existe.
- [x] 1.2 Añadir a `ops.test.js` los tests de deshacer sobre `model.js`: grupo de "Limpiar" en un paso con el código Mermaid idéntico al deshacer, borrado de un nodo intermedio con orden restaurado, arrastre en un paso, inversa saltada tras un borrado ajeno (`applyRemote`), "Nada que deshacer" con solo cambios ajenos, `setMeta` fuera de la pila y límite de 60 grupos. Verificación: los tests nuevos fallan y los 23 existentes pasan.

## 2. Operaciones puras (1 h)

- [x] 2.1 Crear `frontend/ops.js` con `newId` (UUID v4 con alternativa por `getRandomValues`), `apply(state, op)` con las reglas de validación de design.md §3 y copia de los objetos recibidos, e `inverse(state, op)`, incluido `at` en las inversas de los borrados. Verificación: pasan los tests de 1.1.
- [x] 2.2 Reescribir `frontend/model.js` sobre `ops.js`: `perform`, `applyRemote`, pila de 60 grupos, `undo` que salta inversas rechazadas, y las funciones `addNode`, `addEdge`, `removeNode`, `removeEdge`, `setLabel`, `previewMove`, `moveNode`, `clear`, `setKind`, `setDir` y `loadExample` con ids; quitar `snapshot` y `seq`. Verificación: pasan los tests de 1.2.

## 3. Interfaz y generación de Mermaid (0,75 h)

- [x] 3.1 Cambiar `mermaidCode` en `frontend/kinds/index.js` para numerar los nodos `n1`… por posición y traducir las aristas por id; añadir a `ops.test.js` los dos escenarios de "Identificadores de nodo en el código". Verificación: `baseline.test.js` sigue pasando sin tocar `baseline-ejemplo.mmd`.
- [x] 3.2 Adaptar `frontend/input.js` (editor y borrado por id; arrastre con `previewMove` y una sola `moveNode` al soltar) y `frontend/main.js` (`setKind`, `setDir`). Verificación: `grep -n "snapshot\|\.seq" frontend/*.js` no devuelve nada y la app carga sin errores en la consola.

## 4. Verificación en el navegador (0,5 h)

- [x] 4.1 Ejecutar la skill `run-trazo-mermaid` y comparar con `frontend/test/baseline-skill.txt`: la única diferencia admitida es `n6…n9` → `n1…n4`. Actualizar la línea base en un commit propio que lo explique. Verificación: `diff` sin más diferencias, `ERRORS: []` y `OK`.
- [ ] 4.2 Comprobar en el navegador, con un guion de Playwright o a mano, cada escenario de "Deshacer y limpiar": nodo nuevo, limpiar, arrastre, borrado intermedio y tipo que no se deshace, comparando el código Mermaid antes y después. Verificación: código idéntico en cada caso y 0 errores en la consola.
- [ ] 4.3 Prueba manual del PO en la tablet desde `http://<ip-del-pc>:8000`: dibujar, conectar, arrastrar con el dedo, renombrar, borrar y deshacer cada gesto. Verificación: el PO lo confirma y la consola no muestra errores de `randomUUID`.

## 5. Cierre (0,25 h)

- [ ] 5.1 Actualizar `CLAUDE.md` (descripción de `ops.js`, `model.js` y del test `ops.test.js`) y el comentario de cabecera de `baseline.test.js` si hace falta. Verificación: `node --test "frontend/**/*.test.js"` en verde y `openspec validate modelo-de-operaciones --strict` válido.

## Workflow follow-up

- Archivar el change con `/opsx:archive` antes de proponer el siguiente change de F2 (si lo hay) o de pasar a F3.
- Abrir la PR de `feat/f2-modelo-de-operaciones` contra `develop` al cerrar el bloque.
