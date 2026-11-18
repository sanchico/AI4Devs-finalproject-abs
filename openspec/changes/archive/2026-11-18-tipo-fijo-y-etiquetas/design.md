# Design

## Context

Motivación y alcance en [proposal.md](proposal.md); requisitos en los deltas de `diagram-operations` y
`canvas-editing`.

Estado actual:

- `state` (`model.js`) guarda `kind`, `dir`, `title`, `nodes` y `edges`. `apply` acepta `setMeta` con
  `kind`, `dir` y `title`; el título ya se valida, el tipo solo contra `KINDS`.
- El selector `#kind` de la barra llama a `model.setKind` (un `applyRemote` de `setMeta`), así que el
  cambio de tipo no entra en la pila de deshacer y no se puede revertir.
- `ops.js` no mira las etiquetas. El editor (`#editInput`) no tiene `maxlength`; `commitEditor` ignora el
  resultado de `setLabel`.
- El servidor (S2) copia título y dirección de `setMeta` a `diagrams`, y el tipo viene de `create_diagram`.
  La fuente de verdad del diagrama es el registro de operaciones; el tipo no puede ser una operación sin
  que `create_diagram(title, kind)` deje la fila y el registro diciendo cosas distintas.

## Goals / Non-Goals

**Goals:**
- Que el tipo sea una propiedad del diagrama que se elige una vez, en un único sitio de la interfaz.
- Que ninguna etiqueta pase de 200 caracteres en ninguna capa del cliente, con la misma medida que el título.
- Dejar `ops.js` listo para que `apply_op` repita las mismas reglas sin ser más estricto.

**Non-Goals:**
- Nada de servidor ni de F4: ni `create_diagram` ni leer `diagrams.kind`.
- No se rediseña la barra de herramientas: el selector de tipo sigue donde está.

## Decisions

### 1. El tipo se fija al crear (no es una operación)

`setMeta` solo lleva `dir` y `title`. El tipo sigue en `state.kind`, pero lo pone quien crea el diagrama
(el selector en modo local; la fila de `diagrams` en modo colaborativo).

| Alternativa | Por qué no |
|---|---|
| Cambiable solo con el lienzo vacío | El servidor no ve el grafo y no puede validarlo; dos clientes lo harían a la vez y la operación se descartaría en todos según un orden que ninguno controla |
| Cambiable solo hacia tipos compatibles | Hay que decidir y probar la compatibilidad de cada par de tipos, y `addNode` también tendría que comprobarla |
| Libre, como ahora | Con tipos de formas distintas el Mermaid resultante sería falso |
| `create_diagram` mete un `setMeta` inicial en el registro | Resuelve la discrepancia fila/registro pero deja el cambio de tipo en medio del diagrama |

### 2. `setMeta` con `kind` se rechaza entero

`apply` mira `'kind' in op.set` antes de aplicar nada y devuelve `{ok:false, reason:'invalid'}`. No se
ignora en silencio como los campos desconocidos, porque `apply_op` también lo rechazará: así cliente y
servidor dicen lo mismo y una operación con `kind` nunca entra en el registro. Sigue la regla de "si un
campo no vale, no se aplica ninguno".

### 3. Cambiar de tipo es empezar un diagrama nuevo: `newDiagram(kind)`

`model.js` exporta `newDiagram(kind)` en lugar de `setKind`: vacía nodos y aristas, pone
`title = UNTITLED`, fija `kind` y vacía la pila de deshacer. **Conserva la dirección**: el selector de
dirección sigue mostrando lo mismo y no hay que sincronizarlo. Rechaza un tipo que no esté en `KINDS`.
`setKind` desaparece (su único llamador era el selector) y `reset()` se queda para los tests.

Vaciar la pila no es opcional: sin ello, "Deshacer" tras el cambio devolvería los nodos del diagrama anterior
dentro de uno de otro tipo.

### 4. Confirmación solo si hay nodos, con `confirm()`

El selector `#kind` sigue en la barra. Al cambiarlo, `main.js` llama a `newDiagram`; si el lienzo tiene
nodos, antes pide confirmación con `confirm()`: "Cambiar a <tipo> empieza un diagrama nuevo y borra el
actual. Esta acción no se puede deshacer." Si se cancela, el selector vuelve a `state.kind`. Con el lienzo
vacío no hay nada que perder y cambia al momento.

| Alternativa | Por qué no |
|---|---|
| Confirmar siempre | Estorba al elegir el tipo antes de empezar a dibujar |
| Un `<dialog>` propio | `confirm()` basta para un mensaje y dos botones, funciona en la tablet y no añade HTML ni CSS |
| Cambiar sin avisar | El cambio destruye el diagrama y no se puede deshacer |

### 5. Validación de etiquetas en `apply`, antes de tocar el estado

`const validLabel = l => typeof l === 'string' && l.length <= 200`, con la misma medida (unidades UTF-16)
que el título. Se aplica solo si el campo `label` está presente: `node.label` en `addNode`, `set.label` en
`updateNode`, `edge.label` en `addEdge` y `set.label` en `updateEdge`. Se valida antes de `Object.assign`,
así una operación con `x` válido y `label` inválido no aplica ninguno de los dos. La etiqueta vacía vale
(las elipses de Estados la tienen).

Como la regla está en `apply`, una operación ajena con una etiqueta larga se rechaza igual en todos los
clientes: la convergencia no cambia. Con 200 caracteres una operación honrada ronda 600 bytes como mucho
(200 caracteres de 3 bytes), lejos de los 2 kB del servidor; el límite de 2 kB queda como protección ante
clientes manipulados.

| Alternativa | Por qué no |
|---|---|
| Solo `maxlength` y confiar en el servidor | Un fixture o una operación remota pintaría algo que el servidor rechaza |
| Truncar en `apply` | El servidor tendría que truncar igual, y `apply` dejaría de ser "aceptar o rechazar sin cambiar nada" |

El `maxlength="200"` del `#editInput` es solo comodidad. `commitEditor` sigue ignorando el resultado de
`setLabel`: con el tope en el campo no puede fallar por longitud.

### 6. Impacto en `apply_op` (change `funciones-servidor`)

`apply_op` rechazará `setMeta` con `kind` y las etiquetas de más de 200 caracteres (`char_length`, que
cuenta puntos de código: nunca más estricto que `ops.js`). `create_diagram(kind)` pierde el parámetro
`title`. La descripción de S2 y de la API del PRD se actualiza aquí (v0.7.3).

## Risks / Trade-offs

- [Un toque más al cambiar el tipo con nodos dibujados] → Es lo que se quiere: cambiar de tipo destruye el
  diagrama y no se puede deshacer.
- [`confirm()` bloqueado o con otro aspecto en el navegador de la tablet] → Se prueba en la tablet; si no
  sirviera, el plan B es un diálogo propio.
- [Quien tenga el estado antiguo en memoria al recargar] → La app no guarda nada entre recargas y no hay
  registros con `setMeta` de tipo todavía.
- [Quedan llamadas a `setKind`] → `grep` de `setKind` en las tareas.

## Migration Plan

No hay datos que migrar (sin servidor ni persistencia). Rollback: revertir la rama; el change se archiva
antes de proponer `funciones-servidor`, porque este reescribe `openspec/specs/`.
