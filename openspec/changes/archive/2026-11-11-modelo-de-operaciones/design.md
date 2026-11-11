# Design

## Context

Ver proposal.md (Why). Estado de partida (`develop` tras F1):

- `model.js` muta `state` directamente: `addNode`, `addEdge`, `removeNode`, `removeEdge`, `setLabel`,
  `moveNode`, `clear`, `setKind`, `setDir`.
- Deshacer guarda hasta 60 instantáneas JSON de `{nodes, edges, seq}`. El tipo y la dirección no están en
  la instantánea, así que hoy no se deshacen.
- Los nodos se identifican con `'n' + seq`; las aristas no tienen identificador, `removeEdge` las busca
  por referencia de objeto.
- `input.js` llama a `model.snapshot()` al empezar un arrastre y a `moveNode` en cada `pointermove`.
- `mermaidCode` escribe `n.id` como identificador Mermaid.

## Goals / Non-Goals

**Goals:**
- Un único punto por el que pasan todos los cambios, y que F4 pueda reutilizar para operaciones remotas.
- `apply` puro y determinista, probado desde Node.
- Deshacer por operaciones inversas con el mismo comportamiento visible que las instantáneas.

**Non-Goals:**
- Notificar a nadie de las operaciones aplicadas (suscriptores, red): F4 añadirá el gancho en `perform`.
- Fixtures JSON compartidas y `apply` en Java (F3, B6).

## Decisions

### 1. `ops.js` puro con `apply(state, op)` e `inverse(state, op)`

`apply` recibe el estado explícitamente y devuelve `{ok:true}` o `{ok:false, reason}`. `inverse` se
calcula **antes** de aplicar, a partir del estado actual, y devuelve una lista de operaciones.

- *Alternativa:* `apply(op)` sobre el `state` global de `model.js`. Descartada: F3 necesita varios
  estados en el mismo proceso para el test de convergencia sin red.
- *Alternativa:* que `apply` devuelva su inversa. Descartada: mezcla aplicar con registrar, y las
  operaciones remotas no necesitan inversa.

**Impacto en Java (B6):** la firma `apply(state, op) → resultado` y los motivos de rechazo se traducen
uno a uno. `inverse` solo existe en el cliente, porque deshacer es local.

### 2. Formato de las operaciones

```js
{type:'addNode',    node:{id, shape, x, y, w, h, label}, at?}
{type:'updateNode', id, set:{x?, y?, w?, h?, label?}}
{type:'removeNode', id}
{type:'addEdge',    edge:{id, from, to, label}, at?}
{type:'updateEdge', id, set:{label}}
{type:'removeEdge', id}
{type:'setMeta',    set:{kind?, dir?}}
```

- `set` lleva solo los campos que cambian: es la unidad de *last-writer-wins* por campo de la sección 4
  del PRD.
- `at` (opcional) es la posición de inserción. Solo lo usan las inversas de un borrado, para que deshacer
  restaure el orden exacto y, con él, el código Mermaid. Sin `at`, se añade al final.
- `apply` copia los objetos que recibe (`{...op.node}`), para que el estado nunca comparta referencias
  con una operación que luego se serializa o se guarda en la pila.
- *Alternativa:* operaciones de campo único (`{type:'setLabel', id, value}`). Descartada: el arrastre
  cambia `x` e `y` a la vez y un cambio de tamaño cambiaría cuatro campos.

### 3. Reglas de validación de `apply`

| Operación | Se rechaza si | Motivo |
|---|---|---|
| `addNode` | ya existe un nodo con ese id | `duplicate` |
| `addEdge` | falta `from` o `to`, o ya hay una arista con el mismo origen y destino o el mismo id | `missing` / `duplicate` |
| `update*`, `remove*` | no existe el elemento | `missing` |
| `setMeta` | `kind` no está en `KINDS` o `dir` no es `TD`/`LR` | `invalid` |
| cualquier otro `type` | — | `unknown` |

`set` solo admite los campos de la tabla de formato; los demás se ignoran. Validar el tamaño de las
etiquetas (200 caracteres) y el máximo de nodos queda para el servidor (B4).

### 4. Identificadores: `crypto.randomUUID()` con alternativa

`crypto.randomUUID()` solo existe en contextos seguros (HTTPS o `localhost`). La tablet abre la app en
`http://<ip-del-pc>:8000`, que no lo es. `newId()` usa `randomUUID` si existe y, si no, construye un UUID
v4 con `crypto.getRandomValues`, que sí está disponible en contextos no seguros.

- *Alternativa:* servir por HTTPS en desarrollo. Descartada: obliga a certificados en la tablet y el PRD
  lo arranca con `http-server` en claro.
- *Alternativa:* identificadores `cliente:contador`. Descartada: el PRD pide UUID y hay que gestionar el
  id de cliente.

### 5. Identificadores Mermaid por posición

`mermaidCode` asigna `n1`… según el índice del nodo en `nodes` y traduce las aristas con un mapa
`id → nombre`. Los UUID tienen guiones y pueden empezar por dígito, lo que Mermaid no siempre admite como
identificador, y además harían ilegible el código que el usuario copia.

- *Alternativa:* guardar en cada nodo un número corto además del UUID. Descartada: dos usuarios
  asignarían el mismo número a la vez; resolverlo es trabajo del servidor y no compensa.
- *Coste aceptado:* al borrar un nodo, los siguientes cambian de número en el código. El ejemplo produce
  exactamente el mismo código; la línea base de la skill pasa de `n6…n9` a `n1…n4`.

### 6. Pila de deshacer por grupos en `model.js`

`perform(ops)` calcula la inversa de cada operación, las aplica en orden y, si al menos una se aplica,
apila un grupo con las inversas de las aplicadas. `undo()` desapila un grupo y aplica sus inversas en
orden contrario, sin apilar nada; las que se rechazan se saltan. Si no se aplica ninguna, pasa al grupo
siguiente; si no queda ninguno, devuelve `{ok:false, reason:'empty'}`. Máximo 60 grupos.

- `clear()` es un solo `perform` con un `removeNode` por nodo, de modo que "Limpiar" es un solo paso.
- Las inversas de un borrado incluyen `at`; aplicadas en orden contrario, nodos y aristas vuelven a su
  posición original.
- `applyRemote(op)` aplica sin apilar. En F2 solo lo usan los tests; F4 lo llamará con las operaciones
  de otros usuarios.
- `setKind` y `setDir` aplican `setMeta` sin apilar, como `applyRemote`, para conservar el
  comportamiento actual.
- *Alternativa:* conservar las instantáneas en local y añadir operaciones solo para la red. Descartada:
  una instantánea deshace también los cambios ajenos, que es lo que el criterio 3 del PRD prohíbe.

### 7. Arrastre como una sola operación

Al empezar el arrastre, `input.js` guarda la posición inicial. Durante el arrastre mueve el nodo en el
estado como vista previa (`previewMove`, que no es una operación ni apila nada). Al soltar, si el nodo se
ha movido, `model.moveNode(id, from, to)` devuelve el nodo a `from` y hace `perform` de un `updateNode`
con `to`, de modo que la inversa recoge la posición de antes del arrastre.

- *Alternativa:* una operación por `pointermove`. Descartada: decenas de pasos de deshacer por arrastre y,
  en F4, decenas de mensajes por segundo.

### 8. `input.js` y `main.js` trabajan con identificadores

El editor de etiquetas y el borrado guardan el `id` y el tipo de elemento, no la referencia: tras
deshacer, los objetos del estado se sustituyen y una referencia antigua dejaría de apuntar al diagrama.
La API de `model.js` que usan (`addNode`, `addEdge`, `removeNode`, `removeEdge`, `setLabel`, `clear`,
`undo`, `setKind`, `setDir`) se mantiene con los mismos nombres y recibe ids.

## Risks / Trade-offs

- [El refactor cambia sin querer el comportamiento visible] → `baseline.test.js` sigue fijando el código
  del ejemplo; la salida de la skill solo puede cambiar en los números de nodo; comprobación manual de
  deshacer tras crear, conectar, arrastrar, renombrar, borrar y limpiar.
- [`getRandomValues` también falta en un navegador muy antiguo] → La tablet y Node 22 lo tienen; no se
  añade otra alternativa.
- [El `at` de una inversa queda fuera de rango si otro usuario ha borrado elementos entre medias (F4)] →
  `apply` limita `at` a la longitud de la lista; el orden puede diferir del original, pero sigue siendo
  determinista en todos los clientes.
- [Los números `n1`… del código cambian al borrar nodos] → Aceptado (decisión 5); el código se regenera
  entero en cada cambio.
- [El formato de `set` no encaja con el que necesite Java] → El formato es JSON plano y las fixtures de
  F3 lo fijarán antes de B6.

## Migration Plan

No hay datos guardados: el estado vive en memoria y se pierde al recargar. `loadExample` crea los nodos y
aristas del ejemplo con ids nuevos sin pasar por la pila de deshacer.
