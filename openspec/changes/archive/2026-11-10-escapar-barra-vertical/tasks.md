# Tasks

Estimación total: 0,5 h. Arreglo urgente: rama `fix/escapar-barra-vertical` y PR aparte contra `develop`.

## 1. Escape en el generador (0,25 h)

- [x] 1.1 Añadir a `frontend/test/escape.test.js` tests que fallen antes del arreglo: conector de Flujo con `a|b` genera `n1 -->|a#124;b| n2`, conector de Estados genera `n1 --> n2 : a#124;b`, y `esc('a|b')` es `a#124;b`; verificar que fallan con `node --test "frontend/**/*.test.js"`
- [x] 1.2 Añadir la sustitución de `|` por `#124;` a `esc` en `frontend/kinds/index.js`; verificar que los tests nuevos y la línea base (`baseline.test.js`) pasan con el mismo comando

## 2. Comprobación en el navegador (0,25 h)

- [x] 2.1 Con la skill `run-trazo-mermaid`, poner la etiqueta `a|b` a un conector de Flujo y a uno de Estados; verificar en la captura que el diagrama se dibuja completo, que no hay mensaje de error y que se lee `a|b`
- [x] 2.2 Verificar que la salida de la skill con el ejemplo sigue siendo la de `frontend/test/baseline-skill.txt`

## Workflow follow-up

- Archivar el change en la misma rama, antes de abrir la PR, sincronizando `openspec/specs/mermaid-generation/`.
- Abrir la PR contra `develop` con el código, el change archivado y la spec sincronizada, y fusionarla.
