# Tasks

Estimación total: 2,5 h (una sesión). El 0,5 h restante del bloque F1 es el cambio `vista-previa-segura`.

## 1. Línea base y movimiento de archivos (0,5 h)

- [x] 1.1 Ejecutar la skill `run-trazo-mermaid` sobre el código actual y guardar su salida y el código Mermaid del ejemplo (pestaña "Código Mermaid") en `frontend/test/baseline-ejemplo.mmd`; verificar que la skill imprime `OK`
- [x] 1.2 Mover `index.html`, `styles.css` y `app.js` a `frontend/` con `git mv` en un commit sin otros cambios; verificar con `git log --follow frontend/app.js` que conserva el historial
- [x] 1.3 Añadir `frontend/package.json` con `"private": true` y `"type": "module"`; verificar que `node -p "require('./frontend/package.json').type"` imprime `module`

## 2. Módulos sin DOM (1 h)

- [x] 2.1 Extraer `geometry.js` (funciones de la sección "Geometry helpers" que no usan `nodes`) y `recognizer.js` con `recognize(pts, allowedShapes)`; verificar que `node -e "import('./frontend/recognizer.js')"` no falla
- [x] 2.2 Extraer `kinds/flow.js`, `kinds/state.js` y `kinds/index.js` con `KINDS`, `shapeName`, `esc` y `mermaidCode(graph, kind, dir)`; verificar importándolo desde Node
- [x] 2.3 Extraer `model.js` con el estado, las funciones de cambio, deshacer por instantáneas, `nodeAt`, `edgeAt`, `edgeEnds` y `loadExample`, devolviendo resultados en lugar de llamar a `toast`; verificar importándolo desde Node
- [x] 2.4 Escribir `frontend/test/baseline.test.js` (`node --test`): el código del ejemplo es igual a `baseline-ejemplo.mmd`, y un rectángulo, un rombo y una elipse sintéticos se clasifican bien con las formas de Flujo y con las de Estados; verificar que `node --test "frontend/**/*.test.js"` pasa (con Node 24, `node --test frontend/` trata el directorio como un archivo y falla)

## 3. Módulos del navegador (0,5 h)

- [ ] 3.1 Extraer `render.js` (lienzo, vista previa, leyenda, estadísticas) e `input.js` (Pointer Events, toque, editor), y dejar en `main.js` el arranque (llamando a `update()` para que el código, las estadísticas y la vista previa salgan poblados al abrir), la barra y `toast`; borrar `app.js` y cargar `main.js` con `<script type="module">` después de mermaid.js; verificar que la app sirve desde `frontend/` sin errores en la consola
- [ ] 3.2 Comprobar a mano en la tablet (o con el ratón en modo mover) que el dedo mueve nodos y que Deshacer, Limpiar, el cambio de tipo y de dirección y la copia del código funcionan como antes

## 4. Verificación y documentación (0,5 h)

- [ ] 4.1 Actualizar la skill `run-trazo-mermaid`: servir `frontend/`, quitar el gotcha de la IIFE y añadir que los módulos no cargan desde `file://`; verificar que la skill imprime exactamente la salida guardada en 1.1 y `OK`
- [ ] 4.2 Actualizar `CLAUDE.md` ("Estado actual", "Cómo ejecutarlo" y cómo lanzar `node --test`); verificar que los comandos documentados funcionan tal cual
- [ ] 4.3 Revisar que ningún módulo de la sección 2 usa `window`, `document` ni el DOM (`grep -n "document\|window" frontend/geometry.js frontend/recognizer.js frontend/model.js frontend/kinds/*.js` sin resultados)

## Workflow follow-up

- Abrir la PR del bloque F1 contra `develop` cuando también esté aplicado `vista-previa-segura`, o una
  PR por cambio si se prefiere.
- Archivar el cambio con `/opsx:archive` y registrar la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
