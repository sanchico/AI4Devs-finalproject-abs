# Design

## Context

La cabecera de cada tipo de diagrama vive en `frontend/kinds/flow.js` y `frontend/kinds/state.js`
(`header: dir => …`), y `mermaidCode` se la pide al tipo con la dirección tal cual está en el modelo
(`TD` o `LR`, valores del selector). Flujo escribe `flowchart ${dir}` y Estados `stateDiagram-v2\n  direction
${dir}`. Mermaid acepta `TD` en `flowchart`, pero en `stateDiagram-v2` solo admite `TB`, `BT`, `RL` y `LR`.
Comprobado de dos formas: el lexer del bundle solo tiene reglas `direction` para `TB`, `BT`, `LR` y `RL`
(en 11.17.2 aparece además `TD`, pero solo en la gramática de flowchart, para subgrafos), y al renderizar
`stateDiagram-v2` con `direction TD` tanto 10.9.1 como 11.17.2 dibujan "direction" y "TD" como estados,
mientras que con los otros cuatro valores solo dibujan los del usuario. Motivo del cambio: ver
proposal.md, "Why".

## Goals / Non-Goals

**Goals:**
- Que el código de Estados use una palabra clave de dirección válida sin tocar el modelo ni la interfaz.
- Que cada tipo siga siendo el único que conoce su sintaxis.

**Non-Goals:**
- Ofrecer `BT` o `RL` en el selector (ver proposal.md, "Queda fuera").
- Validar el código Mermaid generado de forma general.

## Decisions

### D1. La traducción vive en `header` de `kinds/state.js`

`header` de Estados convierte la dirección del modelo a la palabra clave de Mermaid: `TD` → `TB`, y
cualquier otro valor pasa tal cual (`LR`; también `BT` o `RL`, que Mermaid ya admite, si algún día se
ofrecen). Es una línea y mantiene la regla de `modularizar-frontend` D1: cada tipo conoce su sintaxis y
`mermaidCode` no sabe de direcciones.
- *Alternativa descartada:* un caso especial en `mermaidCode` (`kind==='state' && dir==='TD'`). Pone
  sintaxis de un tipo en el generador común y obliga a recordarlo al añadir tipos nuevos.
- *Alternativa descartada:* traducir en el selector o al leer la dirección. Mezcla presentación con
  sintaxis y haría que el modelo dependiera del tipo activo.

### D2. El modelo sigue guardando `TD` y `LR`

El valor que conservan `model.state.dir`, el selector y, desde F2, la operación `setMeta` y la columna
`diagrams.direction` es el mismo para todos los tipos: `TD` o `LR`. Cambiar de tipo no obliga a convertir
la dirección guardada.
- *Alternativa descartada:* guardar `TB` en lugar de `TD`. `flowchart TB` también es válido, pero
  cambiaría el código del ejemplo de Flujo (la línea base `frontend/test/baseline-ejemplo.mmd` y el
  escenario "Diagrama de ejemplo" exigen `flowchart TD`) y habría que migrar lo que F2 persista.
- *Alternativa descartada:* un valor por tipo en el modelo (`dir` distinto para Flujo y Estados). Duplica
  el estado y complica `setMeta` y el cambio de tipo.

### D3. Impacto en JS y en Java

Ninguno en operaciones: `apply(op)`, `shared/fixtures/ops` y el backend no se tocan, porque la dirección
que viaja y se guarda no cambia (`TD` o `LR`) y la traducción ocurre solo al generar el código, en el
navegador. El servidor no necesita conocer `TB`.

### D4. Cómo se comprueba

Un test de `node --test` fija las dos cabeceras de Estados (y que Flujo no cambia). Como Node no ejecuta
Mermaid, la comprobación de que desaparecen las cajas "direction" y "TD" se hace en el navegador real con
la skill `run-trazo-mermaid`, y se contrasta con el comportamiento anterior.

## Risks / Trade-offs

- [Un valor de dirección desconocido llega a Mermaid tal cual] → Hoy el selector solo ofrece `TD` y `LR`;
  pasar el resto sin traducir deja abierto `BT`/`RL` sin código extra y un valor inválido se vería en la
  vista previa como hoy.
- [El código copiado de Estados cambia en una línea] → `direction TB` es el valor documentado por
  Mermaid; no hay datos guardados que migrar.
- [Otra versión de mermaid.js podría tratar `TD` de forma distinta en Estados] → Comprobado que 11.17.2
  tampoco lo admite; se fija `TB`, el valor de la gramática, válido en todas las versiones. Actualizar
  mermaid.js es otro cambio (`actualizar-mermaid`) y no afecta a este.
