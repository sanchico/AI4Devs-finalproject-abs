# Design

## Context

Tras `modularizar-frontend`, la generación vive en `frontend/kinds/index.js` (`esc` sustituye `"` por
`#quot;` y `\n` por espacio) y el render en `frontend/render.js`, que hace
`mermaid.initialize({…, securityLevel: 'loose'})`, `box.innerHTML = svg` y, si falla,
`box.innerHTML = '<div class="err">…' + err.message`. El lienzo pinta con `fillText`, que ya es texto
plano. Motivo: ver proposal.md, "Why".

## Goals / Non-Goals

**Goals:**
- Que ninguna etiqueta, venga de quien venga, pueda crear elementos HTML en la vista previa.

**Non-Goals:**
- Sanitizar el SVG por nuestra cuenta: es trabajo de Mermaid en modo estricto.
- Límites de longitud o validación de etiquetas (B4, en el servidor).

## Decisions

### D1. Dos capas: `strict` y entidades en el código

`securityLevel: 'strict'` hace que Mermaid pase las etiquetas por su sanitizador (DOMPurify), que quita
los atributos peligrosos pero puede dejar etiquetas permitidas: lo previsible es que `<img src=x
onerror=…>` se vea como una imagen rota y `<b>` como negrita (supuesto sin comprobar; la tarea 2.2 lo
confirma). El PRD pide que se vea como texto, así que además se escapan `<`, `>` y `&` con las
entidades de Mermaid (`#lt;`, `#gt;`, `#amp;`), que Mermaid decodifica a texto al pintar.
- *Alternativa descartada:* solo `strict`. Cierra la ejecución de scripts pero no cumple "se muestra
  como texto".
- *Alternativa descartada:* entidades HTML (`&lt;`). Con `htmlLabels` el resultado depende de cómo
  decodifique cada tipo de diagrama; las entidades `#…;` son la vía que documenta Mermaid.
- *Alternativa descartada:* `securityLevel: 'sandbox'`. Renderiza en un iframe, lo que complica el
  tamaño de la vista previa y el tema oscuro, sin ganar nada sobre las dos capas.

El escape de `&` va primero, para no convertir el `#` de las demás entidades.

### D2. El error de Mermaid con `textContent`

Se construye el `div.err` con `createElement` y `textContent`. Es el único `innerHTML` con datos del
usuario; el SVG que devuelve Mermaid en modo estricto ya está sanitizado y los avisos fijos no llevan
datos.
- *Alternativa descartada:* escapar el mensaje a mano antes del `innerHTML`. Más código y fácil de
  olvidar en el siguiente aviso.

## Risks / Trade-offs

- [El código copiado lleva `#lt;` en lugar de `<`] → Es sintaxis estándar de Mermaid y se ve igual en
  cualquier renderizador; se acepta.
- [Las entidades podrían no decodificarse igual en `stateDiagram-v2` que en `flowchart`] → Hay un
  escenario específico para Estados y se comprueba en el navegador (tarea 2.2).
- [`strict` podría cambiar el aspecto del diagrama de ejemplo] → Comparar captura antes y después con
  la skill `run-trazo-mermaid`.
