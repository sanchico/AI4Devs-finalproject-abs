# Proposal

## Why

Todo el frontend vive en un único `app.js` dentro de una IIFE: nada se puede importar ni probar por
separado, y los bloques siguientes (F2 operaciones, F3 tests con `node --test`, F4 cliente colaborativo)
necesitan piezas sueltas. Es el bloque **F1 · Modularizar el frontend** del PRD (sección 5), sin
dependencias, y por eso va primero. No implementa ninguna historia por sí mismo: es la base de HU-01
(dibujar juntos en tiempo real), que se apoya en F2 y F4.

El bloque F1 del PRD tiene dos partes: la modularización y el paso de la vista previa a
`securityLevel: 'strict'`. Esta propuesta cubre solo la modularización; la seguridad de la vista
previa va en el cambio `vista-previa-segura`, que se aplica después de este.

## What Changes

- El frontend se mueve a `frontend/` (`index.html`, `styles.css` y los módulos), conservando el
  historial con `git mv`.
- `app.js` se separa en módulos ES nativos sin build: `geometry.js`, `recognizer.js`, `model.js`,
  `kinds/` (definición de cada tipo y generación de Mermaid), `render.js`, `input.js` y `main.js`.
- El reconocedor, la geometría, los tipos de diagrama, la generación de Mermaid y el modelo dejan de
  depender del DOM y del estado global, para poder importarlos desde Node.
- Un test mínimo con `node --test` fija el código Mermaid del diagrama de ejemplo y la clasificación de
  trazos sintéticos, como red de seguridad del refactor (los fixtures grabados llegan en F3).
- **BREAKING (para el desarrollo, no para el usuario):** los módulos ES no cargan desde `file://`; la
  app hay que servirla por HTTP desde `frontend/`. Se actualizan `CLAUDE.md` y la skill
  `run-trazo-mermaid`.
- El comportamiento visible queda idéntico al del commit base `5ea5e8a`.

Queda fuera:
- `ops.js`, `api.js` y `collab.js`, que el PRD lista en F1, no se crean todavía: no tendrían
  contenido hasta F2, F5 y F4 (ver design.md).
- UUID, `apply(op)` y deshacer por operaciones inversas (F2).
- Fixtures grabados y tests de precisión del reconocedor (F3).
- `securityLevel: 'strict'` y escape de etiquetas (cambio `vista-previa-segura`).

Nada de esto choca con el "fuera de alcance" del MVP.

## Capabilities

### New Capabilities

Aún no hay specs en `openspec/specs/`. Como el refactor no debe cambiar el comportamiento, este cambio
deja escrito el comportamiento actual como contrato, para que la verificación de "idéntico al commit
base" tenga escenarios concretos y para que F2 y F3 puedan modificarlos.

- `shape-recognition`: clasificación local y determinista de un trazo en forma, conector o trazo
  descartado, restringida por el tipo de diagrama.
- `mermaid-generation`: generación del código Mermaid a partir del grafo de nodos y aristas, según el
  tipo de diagrama y la dirección.
- `canvas-editing`: interacción en el lienzo: lápiz dibuja, dedo mueve, toque edita, deshacer, limpiar,
  diagrama de ejemplo y forma de servir la app.

### Modified Capabilities

Ninguna.

## Impact

- Código: `app.js` desaparece; `index.html` y `styles.css` pasan a `frontend/`. Sin cambios en
  `styles.css` ni en el marcado salvo la etiqueta `<script type="module">`.
- Dependencias: ninguna nueva. mermaid.js 10.9.1 sigue por CDN.
- Herramientas: `frontend/package.json` mínimo con `"type": "module"` para que Node trate los `.js`
  como módulos ES; skill `run-trazo-mermaid` (ruta servida y apartado de gotchas); `CLAUDE.md`
  (estructura y cómo arrancar y testear).
- Operaciones: no afecta a `apply(op)` ni a Java, que aún no existen.
