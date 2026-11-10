# Proposal

## Why

Una etiqueta de conector con el carácter `|` (por ejemplo `a|b`) genera `n1 -->|a|b| n2`, que Mermaid
no puede interpretar: la vista previa muestra el error de sintaxis y desaparece todo el diagrama, no solo
ese conector. Se anotó como fuera de alcance en la sesión 3 y es un fallo que el usuario puede provocar
escribiendo una etiqueta normal.

## What Changes

- El generador escribe `|` como la entidad de Mermaid `#124;` en las etiquetas, igual que ya hace con
  `&`, `<`, `>` y `"`. La línea `n3 -->|sí| n4` no cambia, así que la línea base sigue igual.
- Tests nuevos: etiqueta de conector con `|` en Flujo y en Estados, y etiqueta de nodo con `|`.
- Comprobación en el navegador real de que la vista previa dibuja el `|` como texto.

Es un arreglo urgente y de tamaño pequeño, no un bloque del PRD (F1..F5, B1..B6, D1) ni una historia
(HU-01..03). Sale en una rama y una PR aparte contra `develop`, como indica CLAUDE.md para los arreglos
urgentes.

Fuera de alcance: cualquier otro carácter con significado en Mermaid (`#`, `;`, `[`, `]`, `(`, `)`);
tipos nuevos de diagrama; cambiar el formato de la línea de arista (por ejemplo, poner comillas siempre).
No choca con el "fuera de alcance" del MVP.

## Capabilities

### New Capabilities
<!-- Ninguna -->

### Modified Capabilities
- `mermaid-generation`: el requisito de escape de etiquetas pasa a incluir `|`.

## Impact

- Código: `esc` en `frontend/kinds/index.js` (una sustitución más).
- Tests: `frontend/test/escape.test.js`.
- No afecta a `apply(op)` ni a Java: el escape ocurre al generar el código, no en el modelo.
- Sin dependencias nuevas; Mermaid sigue en 10.9.8 con `securityLevel: 'strict'`.
