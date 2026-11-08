# Design

## Context

`app.js` (257 líneas) es una IIFE con estado global (`kind`, `dir`, `nodes`, `edges`, `seq`, `history`)
que leen directamente `recognize()`, `addNode()` y `mermaidCode()`. Carga con un `<script>` clásico
después de mermaid.js 10.9.1, que se expone como `window.mermaid`. La skill `run-trazo-mermaid` sirve la
raíz del repo y solo puede probar a través de trazos, porque nada es accesible desde fuera de la IIFE.
Motivo del cambio: ver proposal.md, "Why".

## Goals / Non-Goals

**Goals:**
- Que `geometry`, `recognizer`, `kinds` y `model` sean funciones puras o estado explícito, importables
  desde Node sin DOM, para que F2 y F3 trabajen sobre ellos.
- Mover el código sin reescribirlo: mismas fórmulas, mismos umbrales, mismos textos.

**Non-Goals:**
- Cambiar el formato del modelo (ids `n1`, `n2`… y deshacer por instantáneas se quedan hasta F2).
- Mejorar el reconocedor o el render.

## Decisions

### D1. Reparto en módulos y dirección de las dependencias

| Módulo | Contenido | Puede usar |
|---|---|---|
| `geometry.js` | `dist`, `bbox`, `polyArea`, `pathLen`, `minDistTo`, `segDist`, `center`, `inNode`, `borderPoint` | nada |
| `recognizer.js` | `recognize(pts, allowedShapes)` | `geometry` |
| `kinds/flow.js`, `kinds/state.js` | definición de cada tipo (formas, sintaxis, radio) | nada |
| `kinds/index.js` | `KINDS`, `shapeName`, `mermaidCode(graph, kind, dir)` y `esc` | `kinds/*` |
| `model.js` | estado del diagrama y sus cambios (`addNode`, `addEdge`, `removeNode`, `removeEdge`, `setLabel`, `moveNode`, `clear`, `undo`, `loadExample`, `nodeAt`, `edgeAt`, `edgeEnds`) | `geometry`, `kinds` |
| `render.js` | dibujo del lienzo, vista previa Mermaid, leyenda, estadísticas | `model`, `kinds`, DOM |
| `input.js` | Pointer Events, toque, editor de etiqueta | `model`, `recognizer`, `render`, DOM |
| `main.js` | arranque, barra de herramientas, aviso (`toast`), tema oscuro | todos |

Las dependencias van solo hacia arriba en la tabla: los cuatro primeros no importan nada que toque el
DOM. El modelo no muestra avisos: devuelve un resultado (`{ok:false, reason:'duplicate'}`) y es
`input.js` quien llama a `toast`.

- *Alternativa descartada:* un `store` reactivo con suscriptores. Es lo que necesitará F4, pero hoy
  añade una capa sin uso; F2 introduce `apply(op)` como único punto de cambio y ese es el sitio para el
  aviso de "algo cambió".
- *Alternativa descartada:* separar la generación de Mermaid en un `mermaid.js` propio. Se queda en
  `kinds/index.js`, como lista el PRD, porque cada línea depende de la sintaxis del tipo; además, un
  módulo llamado `mermaid.js` se confundiría con la librería.

### D2. El reconocedor recibe las formas permitidas

`recognize(pts, allowedShapes)` en lugar de leer `KINDS[kind]`. Así es puro, el principio "el tipo de
diagrama restringe las formas" queda en la firma, y los tests de F3 lo llaman sin montar el modelo.

### D3. No se crean `ops.js`, `api.js` ni `collab.js` en F1

El PRD los lista en F1, pero no tendrían contenido hasta F2 (`ops.js`), F5 (`api.js`) y F4
(`collab.js`).
- *Alternativa descartada:* crearlos vacíos para fijar la estructura. Un archivo vacío no aporta nada que
  no diga ya esta tabla y obliga a recordar que está pendiente. Cada bloque crea el suyo.

### D4. mermaid.js sigue como `<script>` clásico

`index.html` carga primero `mermaid.min.js` 10.9.1 del CDN y después `<script type="module"
src="main.js">`. Los módulos se ejecutan diferidos, así que `window.mermaid` ya existe; si el CDN falla,
`render.js` muestra el mismo aviso que ahora.
- *Alternativa descartada:* `import mermaid from '…/mermaid.esm.min.mjs'`. Es más limpio, pero si el CDN
  falla rompe el grafo de módulos entero y la app no arranca, en lugar de degradar solo la vista previa.

### D5. `frontend/package.json` con `"type": "module"`

Node trata los `.js` como CommonJS salvo que un `package.json` diga lo contrario. Un `package.json` de
dos líneas en `frontend/` (`"private": true`, `"type": "module"`) basta para que `node --test` importe
los módulos tal cual los carga el navegador. No es un build ni instala nada.
- *Alternativa descartada:* extensión `.mjs`. Funciona en Node, pero algunos servidores estáticos la
  sirven con un tipo MIME incorrecto y el navegador la rechaza.
- *Alternativa descartada:* `"type": "module"` en el `package.json` de la raíz. Afectaría a cualquier
  `.js` del repo, incluido el futuro código de herramientas.

### D6. Red de seguridad del refactor

Antes de mover nada se guarda la salida del commit base: el código Mermaid del ejemplo y la salida de la
skill `run-trazo-mermaid`. Después:
- `frontend/test/baseline.test.js` comprueba con `node --test` que `mermaidCode` del ejemplo es igual al
  guardado y que `recognize` clasifica un rectángulo, un rombo y una elipse sintéticos (los mismos que
  dibuja el driver de la skill).
- La skill `run-trazo-mermaid` debe imprimir exactamente la misma salida esperada que hoy.

## Risks / Trade-offs

- [Los módulos ES no cargan desde `file://`] → Se documenta en `CLAUDE.md` que hay que servir
  `frontend/`; en la tablet ya se usaba un servidor.
- [Un cambio de orden al mover código altera el comportamiento sin que se note] → Mover función a
  función sin reescribirlas, y comparar con la salida guardada del commit base (D6).
- [`git mv` + edición en el mismo commit hace que Git pierda el rastro de `app.js`] → Primer commit solo
  con los `git mv`; el troceado en commits posteriores.
- [El test de Node usa trazos sintéticos, no reales] → Aceptado: es solo una red de seguridad; la
  precisión con trazos del S Pen se mide en F3.

## Migration Plan

Sin datos que migrar. Quien tenga abierto `index.html` en la raíz pasa a servir `frontend/`. Para volver
atrás basta con revertir la PR.
