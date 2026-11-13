# Tasks

Estimación total: 0,25 h (dentro de las 1,5 h del bloque F3 del PRD).

## 1. Tests primero (0,1 h)

- [x] 1.1 Añadir `title: 'Diagrama sin título'` a los estados `empty()` y `triangle()` de `frontend/test/ops.test.js`. Verificación: `node --test "frontend/**/*.test.js"` sigue en verde.
- [x] 1.2 Añadir a `ops.test.js` los escenarios de `diagram-operations` sobre el título: `setMeta` con título cambia solo el título; un `setMeta` con título y su copia serializada dan el mismo estado; la inversa calculada antes de aplicar devuelve el título anterior; `model.reset()` deja "Diagrama sin título"; "Limpiar" (`model.clear()`) conserva el título; el código Mermaid del ejemplo no cambia al renombrar. Añadir a la tabla `rechazos` los casos `invalid`: título `"   "`, título de 201 caracteres, título `42` y título válido con un tipo desconocido; y un test de que 200 caracteres se aceptan. Verificación: los tests nuevos fallan y los existentes pasan.

## 2. Implementación (0,1 h)

- [x] 2.1 En `frontend/ops.js`, añadir `'title'` a `META_FIELDS`, validar en `setMeta` que el título es un texto de 1 a 200 caracteres que no es solo espacios (si no, `invalid`, sin aplicar ningún campo), guardarlo sin transformar, y actualizar el comentario de cabecera a `setMeta {set:{kind?, dir?, title?}}`. Verificación: pasan los tests de rechazo, aceptación, serialización e inversa de 1.2.
- [x] 2.2 En `frontend/model.js`, añadir `title: 'Diagrama sin título'` al `state` inicial y a `reset()`. Verificación: pasan los tests de `reset`, "Limpiar" y código Mermaid de 1.2, y toda la suite está en verde.

## 3. Documentación y comprobación (0,05 h)

- [x] 3.1 Actualizar en `CLAUDE.md` la descripción de `ops.js` (`setMeta` con título) y de `model.js` (el estado incluye `title`). Verificación: `grep -n "title" CLAUDE.md` muestra las dos menciones.
- [x] 3.2 Ejecutar la skill `run-trazo-mermaid` y comparar con `frontend/test/baseline-skill.txt`. Verificación: sin diferencias, `ERRORS: []` y `OK` (la interfaz no cambia).

## Workflow follow-up

- Archivar el change antes de proponer el siguiente de F3 en esta rama (`convergencia-sin-red`), porque el archivado reescribe `openspec/specs/diagram-operations`.
- Escribir la entrada de la sesión con `/cerrar-sesion`.
