# Tasks

Estimación total: 0,5 h (una sesión corta). No está en el presupuesto del PRD: corrige un defecto de F1.

## 1. Traducción de la dirección en Estados (0,3 h)

- [x] 1.1 Escribir `frontend/test/direccion.test.js` (`node --test`) con las cabeceras: Estados con `TD` genera `  direction TB` y no contiene `direction TD`, Estados con `LR` genera `  direction LR`, un valor como `BT` pasa tal cual, y Flujo sigue generando `flowchart TD` y `flowchart LR`; verificar que los de Estados fallan antes del arreglo y los de Flujo ya pasan
- [x] 1.2 Traducir la dirección en `header` de `frontend/kinds/state.js` (`TD` → `TB`, cualquier otro valor igual); verificar que `node --test "frontend/**/*.test.js"` pasa entero, incluido `baseline.test.js`
- [x] 1.3 Añadir `direccion.test.js` a la lista de `test/` de `CLAUDE.md`; verificar con `ls frontend/test` que la lista de `CLAUDE.md` nombra todos los tests que existen

## 2. Comprobación en el navegador (0,2 h)

- [x] 2.1 Con la skill `run-trazo-mermaid`, cambiar a "Estados (UML)", dibujar dos estados y una conexión, y comprobar con "Arriba → abajo" y con "Izquierda → derecha" que la vista previa solo dibuja los dos estados (ninguna caja "direction" ni "TD") y que el código tiene `direction TB` y `direction LR`; verificar en la captura, y repetir el mismo guion contra `develop` (sin el arreglo) para confirmar que ahí sí aparecen las dos cajas
- [x] 2.2 Verificar que la salida normal de la skill `run-trazo-mermaid` (Flujo) sigue siendo la de la línea base (`frontend/test/baseline-skill.txt`) y que no hay errores en la consola

## Workflow follow-up

- Abrir la PR contra `develop`. Convive con `vista-previa-segura`: ambos cambios modifican la spec
  `mermaid-generation` pero en requisitos distintos, así que se pueden archivar en cualquier orden.
- Archivar el cambio con `/opsx:archive` y registrar la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
