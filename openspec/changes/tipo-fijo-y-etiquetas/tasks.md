# Tasks

Bloque: prerrequisito de S2 (PRD v0.7.2). Estimación total: 2,75 h.

## 1. Operaciones: tipo fijo y etiquetas (0,75 h)

- [x] 1.1 En `frontend/ops.js`, hacer que `setMeta` rechace con `invalid` cualquier operación cuyo `set` incluya `kind` (sin aplicar ningún campo) y quitar `kind` de `META_FIELDS`. Verificar: `node --test frontend/test/ops.test.js` con los casos nuevos "setMeta con tipo", "tipo + título válido" y "dirección + título aceptados" en verde.
- [x] 1.2 En `ops.js`, añadir `validLabel` (texto de 200 caracteres como máximo, vacío válido) y aplicarla antes de modificar el estado en `addNode`, `updateNode`, `addEdge` y `updateEdge`, solo si el campo `label` está presente. Verificar: tests en `ops.test.js` de los escenarios de "Validación de las etiquetas" (200 válida, 201 rechazada en nodo y en conector, `42` rechazada, `""` aceptada, `x` válido con etiqueta inválida no aplica ninguno).
- [x] 1.3 Actualizar los tests que daban por bueno el cambio de tipo: `ops.test.js` (el caso de `setMeta` con `kind: 'state'` aceptado y los de reproducción del título), y el generador de `convergencia.test.js`, que debe seguir proponiendo `kind` (ahora siempre rechazado) y añadir etiquetas de 201 caracteres. Revisar también `test/fixtures/ops/*.json` por si alguna secuencia cambia de tipo. Verificar: `node --test "frontend/**/*.test.js"` completo en verde, y `convergencia.test.js` con la misma semilla.

## 2. Modelo: diagrama nuevo (0,5 h)

- [x] 2.1 En `frontend/model.js`, sustituir `setKind` por `newDiagram(kind)`: vacía nodos y aristas, título "Diagrama sin título", fija el tipo (rechaza uno que no esté en `KINDS`), vacía la pila de deshacer y conserva la dirección. Verificar: nuevo test en `ops.test.js` (o `model` si se crea) con los escenarios "Un diagrama nuevo no se deshace" y "Mismo tipo".
- [x] 2.2 Cambiar la prueba existente que usa `model.setKind('state')` (`ops.test.js`, sobre las formas del tipo) para que use `newDiagram('state')`. Verificar: `node --test frontend/test/ops.test.js` en verde.

## 3. Interfaz: selector de tipo con confirmación y tope en el editor (0,75 h)

- [x] 3.1 En `frontend/index.html`, poner `maxlength="200"` en `#editInput`. Verificar: el atributo está en el HTML y, al pegar 300 caracteres en el editor abierto, el campo conserva 200.
- [x] 3.2 En `frontend/main.js`, hacer que el selector `#kind` llame a `model.newDiagram`: con nodos en el lienzo pide antes `confirm()` con "… empieza un diagrama nuevo y borra el actual. Esta acción no se puede deshacer."; si se cancela, el selector vuelve al tipo actual; con el lienzo vacío cambia sin preguntar. Después actualiza leyenda y vista previa y avisa "Ahora solo se reconocen las formas de: <tipo>". Verificar con la skill `run-trazo-mermaid` en el navegador: con el ejemplo cargado, cancelar la confirmación (nada cambia y el selector vuelve a Flujo); aceptar (lienzo vacío, leyenda de Estados, "Deshacer" avisa "Nada que deshacer"); con el lienzo vacío, cambiar de tipo sin confirmación.
- [x] 3.3 Comprobar a mano en la tablet (`http://<ip>:8000`) que `confirm()` se muestra y responde bien al cambiar el tipo con nodos dibujados. Verificar: descripción en la bitácora.

## 4. Documentación (0,5 h)

- [x] 4.1 Actualizar `docs/PRD-MVP.md` a la v0.7.3: `create_diagram(kind)` sin `title`, `setMeta` sin tipo, etiquetas de 200 caracteres validadas también en el cliente y el tipo fijo en "Modelo de colaboración"; añadir la fila del historial con su motivo. Verificar: `grep -n "create_diagram" docs/PRD-MVP.md` no deja ninguna firma con `title`.
- [x] 4.2 Actualizar `CLAUDE.md` (descripción de `ops.js` y `model.js`: `setMeta` con dirección o título, validación de etiquetas, `newDiagram`). Verificar: la sección "Estado actual" coincide con el código.

## 5. Integración (0,25 h)

- [x] 5.1 Ejecutar `node --test "frontend/**/*.test.js"` y `openspec validate tipo-fijo-y-etiquetas --strict`. Verificar: todo en verde, y el ejemplo de `baseline.test.js` con el mismo código Mermaid de antes.

## Workflow follow-up

- Aplicar con `/opsx:apply` y archivar con `/opsx:archive` antes de proponer `funciones-servidor`: el archivado reescribe `openspec/specs/` y el delta de S2 se escribe contra ese estado.
- Al archivar, añadir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
