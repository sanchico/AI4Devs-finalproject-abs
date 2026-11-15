# Design

## Context

Ver proposal.md (Why). Punto de partida (`develop` tras `meta-titulo`):

- `apply(state, op)` recibe el estado explícitamente, muta una copia de lo que entra y devuelve `{ok}` o
  `{ok:false, reason}`. F2 lo diseñó así para poder tener varios estados en el mismo proceso.
- Con el backend en Supabase (PRD v0.7) el servidor numera las operaciones y las guarda **sin interpretar
  el grafo**: `diagram_ops` puede contener una `updateNode` sobre un nodo que ya no existe. Todos los
  clientes la rechazan por igual al aplicar el registro.
- `mermaidCode` nombra los nodos `n1`, `n2`… **por posición**, así que el orden del array de nodos cambia
  el código aunque el grafo sea el mismo.
- Los tests viven en `frontend/test/*.test.js` y se lanzan con `node --test "frontend/**/*.test.js"`. Solo
  los archivos `*.test.js` se ejecutan, así que los ayudantes y los JSON pueden vivir en subcarpetas.
- Mermaid: el ejemplo de Flujo está fijado por `baseline.test.js`; Estados solo tiene tests de cabecera
  (`direccion.test.js`) y de escape. Ningún test usa `[*]` ni `<<choice>>`.

## Goals / Non-Goals

**Goals:**
- Un test automático del criterio de terminado 2 que no dependa de red, navegador ni Supabase.
- Que la estrategia de reconciliación probada sea una que de verdad converja, porque F4 la heredará.
- Fixtures de operaciones legibles que S3 pueda reutilizar.

**Non-Goals:**
- Código de aplicación nuevo. La red simulada es de test.
- Simular fallos de red (huecos, duplicados, reordenación): el PRD los trata como "solo lectura y recarga",
  y se prueban en F4 y S3.

## Decisions

### 1. Los clientes mantienen el estado confirmado y reaplican encima lo pendiente

Cada cliente simulado tiene:
- `confirmado`: el resultado de aplicar, en orden y sin saltarse ninguna, las entradas que ha recibido del
  registro, incluidas las propias.
- `pendientes`: las operaciones propias aún sin confirmar, en el orden en que se crearon.
- `visible`: `confirmado` clonado con las `pendientes` aplicadas encima. Es lo que dibuja el lienzo.

Al recibir una entrada se aplica a `confirmado`; si es propia (mismo `op_id`) sale de `pendientes`.
`visible` se recalcula siempre desde `confirmado`, nunca se actualiza en el sitio.

**Por qué:** observado con el `apply` real, la regla del PRD (aplicar lo propio al momento; las remotas
sobre el mismo campo no pisan lo pendiente; lo propio confirmado no se repite) **diverge** con dos
inserciones en la misma posición. Con `x` en el diagrama, A hace `addNode p at:0` y B `addNode q at:0`, y
el servidor ordena `q, p`: A queda con `q,p,x` y B con `p,q,x`. Es la misma regla "por campo", pero el orden
del array no es un campo, y el código Mermaid cambia (`n1` es `q` en un cliente y `p` en el otro). Con
`confirmado` + reaplicar, cuando no queda nada pendiente `visible` es `confirmado`, que es exactamente el
registro reproducido: converge por construcción y no hace falta razonar caso por caso.

- *Alternativa:* la regla del PRD, a nivel de campo. Descartada por lo anterior. Se deja una prueba de
  control negativo que la implementa y comprueba que diverge, para que el test no pase por casualidad.
- *Alternativa:* un CRDT o transformación de operaciones para el orden de nodos. Descartada: el PRD ya
  eligió "el servidor ordena, gana la última" y el problema desaparece al reproducir el registro.

**Consecuencias para F4** (no se implementan aquí):
- Una operación rechazada por el servidor (permiso, tamaño) no necesita inversa: basta sacarla de
  `pendientes` y `visible` se recalcula.
- Una pendiente que el registro deja sin efecto (su nodo lo borró otro) se descarta sola al reaplicar,
  igual que en `confirmado`.
- Deshacer sigue siendo local (`model.js`) y envía sus inversas como operaciones normales; cómo conviven con
  `visible` se decide en F4.

### 2. La red simulada es código de test, no un módulo de la aplicación

`frontend/test/helpers/red-simulada.js` exporta un `Servidor` (numera y guarda el registro) y un `Cliente`
(la estrategia anterior). No toca `model.js` ni su `state` global: trabaja con estados propios y `apply`.

- *Alternativa:* un módulo `frontend/replica.js` que F4 importe. Descartada de momento: sería código sin
  usar en la aplicación hasta F4, amplía F3 más allá de "tests" y el PRD asigna la cola de pendientes y la
  reconciliación a `collab.js`. F4 puede mover el ayudante si le sirve tal cual.

### 3. Entrega en orden pero con el reparto controlado por el test

El servidor mete cada entrada en la bandeja de cada cliente, y el test decide cuándo entrega cada una. Una
bandeja nunca se reordena (el PRD supone orden de Realtime por diagrama; un hueco es un error). Cada cliente
envía sus operaciones **de una en una**, como dice el PRD: no envía la siguiente hasta recibir la
confirmación de la anterior.

- *Alternativa:* entrega inmediata y síncrona. Descartada: sin retraso nunca hay operaciones pendientes y el
  test no probaría nada.

### 4. Ráfagas reproducibles con una semilla fija

Los clientes generan operaciones a partir de su `visible` (como un gesto real), con un generador
pseudoaleatorio con semilla (`mulberry32`, 6 líneas, sin dependencias) y ids deterministas (`c1-n3`), no
`newId()`. Se ejecutan, por ejemplo, 100 semillas con 3 clientes. Un fallo imprime la semilla para repetirlo.
Para que no pase de forma vacía, el test cuenta que entre todas las semillas hubo operaciones rechazadas en
el registro y operaciones de cada tipo.

- *Alternativa:* aleatoriedad real (`Math.random`). Descartada: un test que falla a veces no se puede
  depurar, y la spec de determinismo pide "sin depender del azar".

### 5. Fixtures: operaciones, resultado de cada una y diagrama final, escritos a mano

`frontend/test/fixtures/ops/*.json`, un archivo por secuencia:

```
{ "nombre", "descripcion", "inicial"?: {estado},
  "ops": [ { "op": {…}, "resultado": "ok" | "missing" | "duplicate" | "invalid" | "unknown" } ],
  "final": {estado}, "mermaid"?: "código esperado" }
```

El resultado esperado se escribe **desde la spec, a mano**, no pegando lo que devuelve `apply`; si el test
falla, se investiga cuál de los dos está mal antes de tocar nada. Van en `frontend/test/` y no en `shared/`
porque desde la v0.7 solo las ejecuta JavaScript.

- *Alternativa:* generar el `final` ejecutando `apply`. Descartada: el test comprobaría que `apply` es igual
  a sí mismo.

### 6. Mermaid por tipo: diagramas completos con el código exacto

`mermaid-tipos.test.js` compara el texto completo. Flujo ya está bien cubierto por el ejemplo del baseline,
así que se añade solo lo que falta (dirección `LR`, nodo sin etiqueta, las tres formas y las dos aristas).
Estados es el hueco: `[*]` a ambos lados, `state "t" as id`, `<<choice>>`, arista con etiqueta, y que una
elipse ocupa posición en la numeración aunque no se declare.

## Impacto en `ops.js` y en `apply_op`

- **`ops.js`:** ninguno.
- **`apply_op` (S2) y sus tests (S3):** el servidor guarda operaciones que `apply` rechazaría, y las fixtures
  con `resultado` distinto de `ok` lo documentan. S3 puede reutilizar `reproducir` (aplicar un registro sobre
  un diagrama vacío) como referencia del "mismo grafo que resulta de reproducir `diagram_ops`".

## Risks / Trade-offs

- [F4 reimplementa la reconciliación y se aparta de la probada aquí] → Las pruebas de la red simulada quedan
  como criterio de aceptación de F4: sus tests de `collab.js` deben incluir los casos a mano y las ráfagas.
- [El PRD describe la regla "por campo" para las pendientes (v0.6, sección 4, "Respuesta inmediata", que la
  v0.7 adopta "como en la v0.6")] → No se edita el PRD en este change. Se anota para corregirlo al empezar F4.
- [Las ráfagas no producen conflictos y el test pasa en vacío] → Contador de rechazos y de tipos de operación,
  y el control negativo de la decisión 1.
- [Un `final` de fixture que copia un error de `apply`] → Se escriben a mano (decisión 5).
- [El ayudante crece hasta ser una segunda implementación difícil de leer] → Tope orientativo de unas 120
  líneas; si no cabe, la estrategia es demasiado compleja para F4.
