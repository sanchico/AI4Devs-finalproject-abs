# Design

## Context

`frontend/index.html` carga `https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js` con un
`<script>` clásico, sin `integrity`, antes de `main.js` (módulo). `render.js` usa `window.mermaid`,
`mermaid.initialize` y `mermaid.render`, y si `window.mermaid` no existe muestra "No se pudo cargar
mermaid.js; el código sigue disponible en la pestaña Código." (decisión D4 de `modularizar-frontend`).
Motivo del cambio: ver proposal.md, "Why".

Datos comprobados al preparar el cambio:
- `npm audit`: 10.9.1 tiene 10 avisos de Mermaid; 10.9.8, 11.17.2 y 12.3.0 no tienen ninguno (en 10.9.8 y
  11.17.2 queda uno bajo de KaTeX).
- 10.9.8 conserva `initialize` y `render`, renderiza el ejemplo de Flujo idéntico píxel a píxel a 10.9.1 y
  renderiza Estados.
- cdnjs publica para 10.9.8 el hash `sha512-W44v4BgrfdCXnfKNCPLIa8yzpMbB5761jGLoi9UKSkAP5rveS4LqWnnBQV4n7hArLoGHijukXIpCxxbzqAX/Vg==`,
  que coincide con el calculado sobre el archivo descargado, y sirve con `Access-Control-Allow-Origin: *`.

## Goals / Non-Goals

**Goals:**
- Quitar los avisos de seguridad de Mermaid sin cambiar el aspecto ni la API.
- Que un mermaid.js alterado en el CDN no llegue a ejecutarse.

**Non-Goals:**
- Migrar a Mermaid 11 o 12 (ver proposal.md, "Queda fuera").
- Detectar automáticamente versiones nuevas o avisos futuros (no hay CI en el MVP).

## Decisions

### D1. 10.9.8, el último parche de la rama 10

Resuelve todos los avisos de Mermaid de 10.9.1 con un cambio de parche: misma API, mismo SVG.
- *Alternativa descartada:* 11.17.2. Sin avisos de Mermaid, pero es una versión mayor: puede cambiar el
  SVG (la línea base del ejemplo es píxel a píxel), el sanitizado y el arranque. Merece su propio cambio.
- *Alternativa descartada:* 12.3.0. Además de lo anterior, se publicó el 03-11-2026; conviene dejar que
  madure antes de adoptarla.

### D2. SRI con el hash SHA-512 que publica cdnjs, y `crossorigin="anonymous"`

`integrity="sha512-…"` hace que el navegador compare el archivo con el hash antes de ejecutarlo;
`crossorigin="anonymous"` es obligatorio para que la comprobación funcione con un origen distinto. Se usa
el hash de la API de cdnjs, contrastado con uno calculado sobre el archivo (`openssl dgst -sha512`).
- *Alternativa descartada:* sin SRI, confiando en la URL versionada. cdnjs marca los archivos como
  inmutables, pero eso no protege de un compromiso del CDN.
- *Alternativa descartada:* copiar mermaid.min.js dentro de `frontend/`. Quita la dependencia del CDN pero
  rompe la invariante "dependencias solo por CDN", añade 3,3 MB al repositorio y hay que actualizarlo a
  mano igualmente.
- *Alternativa descartada:* SHA-384. Igual de válido; se usa el algoritmo que publica cdnjs para poder
  copiar y contrastar el valor sin calcularlo.

### D3. Si la integridad falla, se degrada como si el CDN no respondiera

No se añade código: con un hash que no coincide el navegador no ejecuta el script, `window.mermaid` no
existe y `render.js` ya muestra su aviso, mientras el lienzo y el código siguen funcionando (escenario
"Archivo de mermaid.js alterado").
- *Alternativa descartada:* un aviso específico de "integridad fallida". El navegador no expone la causa
  al script de forma fiable y el usuario no puede hacer nada distinto en un caso u otro.

### D4. Cómo se comprueba

- Línea base: la skill `run-trazo-mermaid` debe dar la salida de `frontend/test/baseline-skill.txt` y el
  ejemplo verse igual que con 10.9.1.
- Integridad: con Playwright se intercepta la petición del CDN y se sirve el archivo con un byte
  cambiado; la página debe mostrar el aviso sin errores de `main.js`. Sin interceptar, la consola no debe
  tener ningún error de integridad.
- `node --test` no cubre esto (Node no carga el `<script>`), así que la verificación es en navegador.

### D5. Impacto en JS y en Java

Ninguno en operaciones: `apply(op)`, `shared/fixtures/ops` y el backend no se tocan. Mermaid solo se usa
en el navegador para la vista previa.

## Risks / Trade-offs

- [Al subir de versión hay que acordarse de cambiar también el hash] → Si no, el navegador bloquea el
  script y la vista previa muestra el aviso: el fallo es visible y no rompe la app. Se documenta junto a
  la etiqueta y en el readme.
- [Quedan avisos futuros sin detectar] → Sin CI no hay `npm audit` automático; se anota como seguimiento
  revisar la versión al pasar a Mermaid 11/12.
- [10.9.8 cambia algo sutil en Estados que la línea base de Flujo no ve] → La tarea de verificación
  incluye un diagrama de Estados y compara capturas antes y después.
