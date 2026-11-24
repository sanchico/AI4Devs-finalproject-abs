# Design

## Context

- `model.js` guarda el diagrama en un único objeto `state` que `render.js` lee, y todos los gestos pasan por
  `perform(ops)`, que aplica con `apply` (ops.js), apila las inversas de lo aplicado para deshacer y devuelve los
  resultados. Hoy es un modelo de un solo usuario: no hay envío ni forma de aplicar lo ajeno salvo
  `applyRemote`, que aplica directamente sobre `state` y no se usa.
- `undo()` aplica las inversas con `apply` sin pasar por `perform` y no dice qué aplicó; `setDir()` usa
  `applyRemote` porque no se deshace, aunque sí es un cambio propio que habrá que enviar.
- `frontend/test/helpers/red-simulada.js` ya fija la regla de convergencia: `confirmado` (el registro aplicado
  en orden) y `pendientes`; `visible` se recalcula aplicando las pendientes sobre una copia del confirmado. El
  cliente real tiene hoy solo `visible`.
- El servidor ya tiene `apply_ops` (change `apply-ops`): un grupo atómico, reintento por `op_id`, 422 / 409 /
  403 / 404 / 410 y un máximo de 500 operaciones por grupo. El cliente no lo llama aún: ningún módulo de
  `frontend/` usa supabase-js ni se enlaza a `collab.js` en este change.
- Por qué `confirmado` y no solo `visible`: ver Decisión 2. Motivación y alcance: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Que la cola, la conciliación y el orden de apertura se prueben en Node, sin red, sin Docker y sin navegador.
- Que el modelo en solitario no cambie: los tests actuales pasan sin editarse.
- Que el adaptador de supabase-js del change siguiente solo tenga que cumplir un contrato pequeño.

**Non-Goals:**
- Tocar `main.js`, `input.js`, `render.js` o `index.html`: la app sigue abriendo con el ejemplo y sin colaboración.
- Reconectar el canal o pedir lo que falta tras un corte (fuera del MVP).
- Quitar de la pila de deshacer el gesto de un grupo rechazado (ver Riesgos).

## Decisions

### 1. El transporte se inyecta con tres funciones

`collab.js` recibe `transport` y no importa supabase-js:

```
transport.subscribe(onEntry, onClose) -> Promise<void>   // resuelve cuando la suscripción está lista
transport.load() -> Promise<{ kind, role, log }>         // log: [{seq, op_id, op}] ordenado por seq
transport.send(group) -> Promise<{ ok: true } | { ok: false, status: number|null, key?: string }>
```

`onEntry({seq, op_id, op})` entrega cada fila nueva del registro, propia o ajena. `status: null` es un fallo
sin respuesta del servidor (red). El adaptador del change siguiente traduce a esto: `subscribe` espera el mensaje
`system` de Postgres Changes con estado `ok` (no `SUBSCRIBED`) antes de resolver; `send` llama a `apply_ops`;
`load` lee `diagrams` y `diagram_ops`.

- *Descartado: importar supabase-js en `collab.js`.* No se probaría en Node sin red y el orden de apertura, que
  es el riesgo medido en la sesión 9, solo se vería en el navegador.
- *Descartado: un `EventTarget` o un emisor de eventos.* El contrato son tres llamadas con una promesa cada una;
  un emisor añade un orden de eventos que hay que probar.

### 2. Confirmado + pendientes → visible, y `model.state` es el visible

`collab.js` guarda `confirmed` (el registro aplicado en orden, una copia propia) y `pending` (grupos propios sin
ver en el registro). Tras cada cambio recalcula el visible (`clone(confirmed)` más las pendientes aplicadas en
orden) y lo entrega por `onVisible(snapshot)`; el modelo lo vuelca en el mismo objeto `state` con
`replaceState`, para que `render.js` no cambie.

- *Descartado: aplicar lo ajeno directamente sobre `state`.* Rompe la convergencia: si A tiene pendiente
  `label = "A"` y el servidor ordena antes `label = "B"` de otro cliente, aplicarla encima da "B" en A, y en
  el registro reproducido gana "A". La regla del PRD (último del registro por campo) exige reconstruir.
- *Descartado: deshacer lo pendiente y rehacerlo (rebase con inversas).* Más código y casos nuevos sin
  ganar nada con diagramas de decenas de nodos.
- *Coste:* clonar y reaplicar por cada operación recibida. Con decenas de nodos y pocas pendientes es
  despreciable; al abrir se aplica el registro entero en el confirmado y se recalcula el visible **una vez**.

### 3. Ganchos mínimos en `model.js` (identificadores en inglés, como el resto)

- `onChange(fn)`: `perform` llama a `fn(ops)` con las operaciones **aplicadas** (`r.ok`), una vez por gesto.
  Sin `fn`, no pasa nada: el modelo en solitario no cambia.
- `perform(ops, { undoable = true } = {})`: con `undoable: false` aplica y envía sin apilar inversas.
  `setDir` lo usa y deja de pasar por `applyRemote`, que se conserva sin cambios.
- `undo()` devuelve `{ok: true, ops}` con las inversas que sí se aplicaron (las saltadas no) y llama a
  `onChange(ops)`. No apila nada nuevo: no hay rehacer.
- `setReadOnly(reason | null)`: con un motivo, `perform`, `undo` y `setDir` devuelven `{ok: false, reason:
  'readonly'}` sin aplicar ni llamar a `onChange`.
- `replaceState(snapshot)`: copia `kind`, `dir`, `title`, `nodes` y `edges` al mismo objeto `state` y **no
  toca** la pila de deshacer. `reset()` y `newDiagram()` siguen vaciándola.

- *Descartado: que `collab.js` importe `model.js` y lo gobierne.* `model.js` es un singleton y los tests de
  convergencia necesitan varios clientes en un proceso. El enlace (`onChange(collab.local)`,
  `onVisible: replaceState`) es de dos líneas y lo prueba un test aparte con el modelo real.
- *Descartado: que el modelo devuelva siempre las operaciones aplicadas (cambiar `perform`).* Rompería a
  todos los llamadores por un dato que solo la cola necesita; `onChange` lo da sin tocarlos.

### 4. La cola: un grupo por gesto, uno en vuelo, tramos de 500

`local(ops)` (las operaciones que `perform` aplicó) crea un grupo con un `op_id` por operación (`newId`),
lo parte en tramos de 500 si hace falta y lo añade al final de `pending`. Si no hay ninguna llamada en vuelo,
envía el primer grupo que aún no se ha enviado. La siguiente llamada empieza al responder la anterior, **no** al
verla en el registro.

- Un tramo de 500 no es atómico respecto al siguiente (el servidor rechaza más de 500 por llamada). Un gesto
  de más de 500 operaciones es limpiar un diagrama de más de 500 nodos, que a mano no existe.
- *Descartado: enviar varios grupos a la vez.* Pierde el orden entre gestos si uno falla o se reintenta.

### 5. El registro se aplica por secuencia, una vez, y cierra cualquier hueco

`onEntry(e)`: si `e.seq <= last`, se ignora; si `e.seq !== last + 1`, es un hueco y el diagrama pasa a
`offline` (no se aplica); si no, se aplica al confirmado y se avanza `last`. Si `e.op_id` está en un grupo
pendiente, esa operación se quita de él (aunque la respuesta de la llamada no haya llegado); un grupo sin
operaciones y sin llamada en vuelo desaparece. Realtime entrega en orden de commit, que `apply_ops` hace igual
al orden de secuencia, así que un salto es una pérdida real y no un orden distinto.

- *Descartado: reordenar o pedir lo que falta.* Es la recuperación tras cortes, fuera del MVP; el PRD fija
  "solo lectura con el aviso" ante un hueco.

### 6. Apertura: suscribir, cargar, aplicar, vaciar la espera

`open()`: pone el modo `loading`; `subscribe` guardando en un búfer lo que llegue; al resolver, `load()`;
aplica el registro al confirmado (con la regla de la Decisión 5, sin recalcular el visible por cada entrada);
aplica el búfer con `seq > last`; recalcula el visible una vez; fija el modo `edit` o, si `role` es `viewer`,
`readonly` por rol. Si `subscribe` o `load` fallan, `offline`. Las entradas que llegan durante la carga se
guardan sin aplicar.

- El estado inicial de la reproducción es `{kind, dir: 'TD', title: UNTITLED, nodes: [], edges: []}` con el
  `kind` de la ficha: el resto lo ponen los `setMeta` del registro.

### 7. Rechazos, reintentos y modos

| Respuesta | Qué hace la cola |
|---|---|
| `ok` | El grupo sigue pendiente hasta verlo en el registro; envía el siguiente |
| 422 `invalid_op`, 409 `op_limit` | Descarta ese grupo, avisa, recalcula y sigue con el siguiente |
| 403, 404, 410 | Descarta **todos** los grupos, avisa del motivo y pasa a `readonly` |
| `status: null` (red) | Reintenta el mismo grupo con los mismos `op_id` a los 500, 1 000 y 2 000 ms (`wait` inyectable); si falla el cuarto intento, `offline` |
| Hueco, cierre del canal | `offline` |

Modos: `loading`, `edit`, `readonly` (con `reason`: `role`, `deleted`, `no-access`) y `offline` (con `reason`:
`gap`, `closed`, `network`, `load`). `onMode({mode, reason})` y `onNotice(key)` son funciones que pasa quien crea la
cola; el texto de los avisos es del change siguiente. En `readonly` por un rechazo (403, 404, 410) la cola
descarta lo pendiente y sigue aplicando el registro mientras el canal esté abierto (un lector ve lo que escriben
los editores). En `offline` deja de enviar y de aplicar y **conserva el diagrama que se veía, con lo pendiente
incluido**: no hay nada mejor que enseñar y el aviso pide recargar.

- *Descartado: reintentar sin límite.* Bloquea el diagrama sin avisar si el servidor no responde.
- *Descartado: no reintentar.* Un parpadeo de la red dejaría al usuario en solo lectura; el reintento es seguro
  porque `apply_ops` devuelve las secuencias guardadas al repetirse un `op_id`.

### 8. Impacto en `ops.js` y en `apply_op`

`ops.js` no cambia: `collab.js` usa `apply` y `newId`. `apply_op` y `apply_ops` no cambian: el cliente solo
llama a `apply_ops`, con grupos de 1 a 500 operaciones, y el servidor sigue sin interpretar el grafo. Un
`op_id` es un UUID nuevo de `newId()` por operación.

### 9. Tests: transporte simulado y harness sin modelo

`frontend/test/helpers/transporte-simulado.js` es un `ServidorSimulado` con la semántica de `apply_ops` (atómico,
reintento por `op_id`, secuencias contiguas, tope de 500, fallos programables) y un `TransporteSimulado` por
cliente con la entrega del canal y las respuestas bajo control del test (como `Cliente.entregar` de la red
simulada). La convergencia con varios clientes se prueba con un harness que aplica los gestos a su propio
estado y llama a `collab.local`, con semilla fija, sin el modelo singleton; el enlace con el modelo real tiene
su propio test.

## Risks / Trade-offs

- [Deshacer un gesto cuyo grupo se rechazó] → Las inversas van en la pila aunque el gesto se descarte; al
  deshacer se saltan porque su elemento ya no existe. No se limpia la pila: es un caso raro (422 solo con un
  cliente modificado) y limpiarla exige relacionar cada gesto del modelo con su grupo.
- [`input.js` no comprueba el resultado de `addNode`] → En `readonly` el modelo devuelve un fallo y
  `addShape` lo desestructura. No pasa aquí porque `collab.js` no está enlazado a la app; el change siguiente
  protege `input.js` y lo prueba en el navegador.
- [Un tramo de un gesto de más de 500 operaciones puede fallar solo] → Las operaciones del servidor son por
  elemento y los clientes descartan por igual lo que no se aplica; el resultado es el mismo en todos.
- [El canal entrega fuera de orden] → Se trata como hueco y se pasa a `offline`: conservador, sin datos
  inconsistentes. La medida de la sesión 9 no vio ningún desorden en 6 ejecuciones.
- [El visible se recalcula por cada operación] → Mide milisegundos con decenas de nodos; si hiciera falta, un
  atajo sin pendientes (aplicar a ambos) cambia solo `collab.js`.

## Migration Plan

Sin migración: son módulos nuevos y ganchos opcionales. La app no los usa hasta el change `colaboracion-en-la-app`.
Vuelta atrás: revertir el commit; los tests anteriores no dependen de nada de lo nuevo.
