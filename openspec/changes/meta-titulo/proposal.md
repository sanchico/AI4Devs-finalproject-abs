# Proposal

## Why

Bloque **F3 · Tests del frontend** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7): "`setMeta`
acepta también `title`". Prepara la historia **HU-03** (gestionar mis diagramas: crear, abrir, renombrar
y borrar). Hoy el diagrama no tiene título y `setMeta` descarta en silencio cualquier campo que no sea
`kind` o `dir`. Tres bloques posteriores dependen del formato de esta operación: S2 (`apply_op` copia el
título a `diagrams.title`), F4 (la envía y, si el servidor la rechaza, la revierte con su inversa) y F5
(renombrar en la barra superior y mostrar el título en la lista). Como `apply` solo existe en JavaScript,
`ops.js` es el contrato y tiene que quedar fijado y probado antes de escribir S2.

## What Changes

- El estado del diagrama tiene un campo `title`, que empieza en "Diagrama sin título".
- `setMeta` acepta `title` además de `kind` y `dir`. `apply` rechaza con `invalid` un título que no sea
  texto, que esté vacío o solo tenga espacios, o que pase de 200 caracteres. Igual que con el tipo y la
  dirección, si un campo no es válido no se aplica ninguno.
- La inversa de un `setMeta` con título devuelve el título anterior.
- "Limpiar" no cambia el título.
- El título **no aparece en el código Mermaid**: cambiarlo no altera el código generado.

## Fuera de alcance

- Interfaz para ver o renombrar el título y el gesto `setTitle` del modelo: F5. Por eso tampoco se
  decide aquí si renombrar se puede deshacer.
- Copiar el título a `diagrams.title` en el servidor: S2.
- Enviar la operación por la red: F4.
- Resto de F3 (fixtures de operaciones, convergencia sin red, grabación de trazos): otros changes de la
  misma rama.
- Escribir el título en el código Mermaid (cabecera `title:` de Mermaid): descartado por ahora.
- No choca con el "fuera de alcance" del MVP.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `diagram-operations`: el requisito "Todo cambio del diagrama es una operación" incluye el título, y un
  requisito nuevo define el título del diagrama: valor inicial, validación, inversa, "Limpiar" y que no
  sale en el código Mermaid.

## Impact

- `frontend/ops.js`: `META_FIELDS` y la validación de `setMeta`; comentario de cabecera.
- `frontend/model.js`: `state` y `reset()` con `title`.
- `frontend/test/ops.test.js`: tests de título (aceptación, rechazos, inversa, serialización, Limpiar y
  código Mermaid sin cambios); el estado vacío de los tests incluye `title`.
- `CLAUDE.md`: la descripción de `ops.js` menciona el título.
- Sin cambios en la interfaz, en `kinds/` ni en el baseline del código Mermaid.
