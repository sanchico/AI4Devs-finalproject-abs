# pen2mermaid

Nombre del producto: **pen2mermaid** (dominio previsto `pen2mermaid.app`); lema en la interfaz:
"Dibuja a mano, colabora y obtén Mermaid". Antes se llamaba "Trazo a Mermaid"; la carpeta local
y la skill `run-trazo-mermaid` conservan el nombre antiguo. El repositorio remoto en GitHub se llama
`AI4Devs-finalproject-abs` (requisito del curso).

Webapp para dibujar diagramas con lápiz (S Pen en tablet Android) y convertirlos en tiempo real
en un grafo de nodos y conexiones, generando código Mermaid al vuelo.

## Principios de diseño
- **Reconocimiento local y determinista**, sin IA por trazo: rápido, gratis y estable.
- **El tipo de diagrama restringe las formas**: el usuario elige "Flujo", "Estados UML"... y el
  reconocedor solo clasifica entre las formas de ese tipo.
- **Modelo de grafo, no de dibujo**: los conectores son aristas entre nodos. El Mermaid se genera
  recorriendo el grafo; no hace falta IA para eso.
- La IA (API de visión) queda para funciones opcionales: limpiar trazos ambiguos, importar fotos de bocetos.

## Estado actual
Prototipo en módulos ES nativos (carpeta `frontend/`), sin build ni dependencias salvo mermaid.js por CDN.
Los cinco primeros módulos son puros (no tocan el DOM) y se pueden importar desde Node:
- `geometry.js`: funciones geométricas (`dist`, `bbox`, `polyArea`, `borderPoint`…).
- `recognizer.js`: `recognize(pts, allowedShapes)` clasifica un trazo cerrado por dos métricas (área
  relativa a la caja y distancia media a las esquinas) → rect / rombo / elipse. Un trazo abierto entre
  dos nodos = conector.
- `kinds/`: `KINDS` (formas permitidas y sintaxis Mermaid de cada tipo: `flow.js`, `state.js`) y
  `mermaidCode(graph, kind, dir)`, que genera el código recorriendo el grafo; nombra los nodos `n1`, `n2`…
  por posición, no por su id.
- `ops.js`: todo cambio del diagrama es una operación JSON (`addNode`, `updateNode`, `removeNode`,
  `addEdge`, `updateEdge`, `removeEdge`, `setMeta`). `apply(state, op)` la aplica o la rechaza con un motivo
  sin cambiar nada; `inverse(state, op)` calcula cómo deshacerla; `newId()` da UUID v4 (con alternativa a
  `crypto.randomUUID`, que no existe en `http://<ip>` de la tablet). Es lo que F4 enviará por la red.
- `model.js`: estado del diagrama (`state`) y sus gestos (`addNode`, `addEdge`, `setLabel`, `moveNode`,
  `clear`…), que construyen operaciones y las pasan por `perform`. Deshacer saca de una pila de 60 grupos
  de inversas, solo con los cambios propios; `applyRemote(op)` aplica una ajena sin apilarla. Devuelve
  resultados en vez de mostrar avisos.
- `render.js` (lienzo, vista previa Mermaid, leyenda), `input.js` (Pointer Events: `pen` dibuja, `touch`
  mueve, ratón configurable; toque = editar etiqueta) y `main.js` (arranque, barra de herramientas, aviso).
- `test/`: `baseline.test.js` fija el código Mermaid del ejemplo y la clasificación de trazos sintéticos;
  `escape.test.js` comprueba que `<`, `>`, `&` y `|` de las etiquetas salen como entidades de Mermaid;
  `direccion.test.js` fija la dirección de la cabecera (Estados escribe `TB` donde el modelo guarda `TD`);
  `ops.test.js` cubre las operaciones (rechazos, serialización, determinismo), deshacer y los ids del código.
- La vista previa se renderiza con `securityLevel: 'strict'` y el error de Mermaid se muestra con
  `textContent`: una etiqueta nunca debe poder inyectar HTML.

## Cómo ejecutarlo
Los módulos ES no cargan desde `file://`: hay que servir la carpeta `frontend/` por HTTP:
`npx -y http-server -p 8000 -s -c-1 frontend` y abrir `http://localhost:8000`
(para probar en la tablet, abrir `http://<ip-del-pc>:8000` en la misma red).

Tests (Node ≥ 22, sin instalar nada): `node --test "frontend/**/*.test.js"`.
Prueba en el navegador real con la skill `run-trazo-mermaid`.

## Hoja de ruta (ideas, por orden aproximado)
1. ~~Separar `app.js` en módulos ES~~ (hecho en el cambio `modularizar-frontend`).
2. Tests del reconocedor con trazos grabados (fixtures JSON) y de la generación Mermaid.
3. Mejorar el reconocedor (p. ej. $P recognizer) y añadir formas: flechas de herencia/agregación UML.
4. Nuevos tipos: diagrama de clases UML, secuencia, ER.
5. Pan/zoom del lienzo, autolayout opcional, guardado/carga (JSON y Mermaid).
6. Reconocimiento de escritura a mano para etiquetas (ML Kit Digital Ink si se empaqueta como app Android).

## Convenciones
- Interfaz y textos en español.
- Mantener la app usable sin build (HTML + módulos ES nativos) mientras sea posible.
- Commits pequeños y descriptivos, en español, con formato conventional commits
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`…), p. ej. `docs: añade la sesión 2 a la bitácora`.
- Al terminar cada sesión de trabajo se escribe su entrada en `docs/bitacora.md` con la skill
  `/cerrar-sesion`.
- Una rama y una PR contra `develop` por bloque del PRD (F1, F2…), p. ej. `feat/f2-modelo-de-operaciones`.
  Los changes de OpenSpec de un bloque van en esa rama uno tras otro: cada uno se aplica y se archiva
  antes de proponer o rebasar el siguiente, porque el archivado reescribe `openspec/specs/` y el delta
  siguiente se escribe contra ese estado. Solo un arreglo urgente va en una rama y una PR aparte.
