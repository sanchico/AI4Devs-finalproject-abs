# Design

## Context

- **Lo que ya está hecho:** `apply_ops` en el servidor (también en el remoto) y `collab.js`, que recibe un
  *transporte* de tres funciones (`subscribe`, `load`, `send`) y los ganchos del modelo (`onChange`,
  `setReadOnly`, `replaceState`). Nada de eso está enlazado a la app: `main.js` abre con el ejemplo, sin
  supabase-js ni sesión.
- **El servidor limita las respuestas a 1 000 filas** (`max_rows = 1000` en `supabase/config.toml`, el valor por
  defecto del remoto) y un registro puede llegar a 5 000 operaciones: un `select` sin paginar abriría un
  diagrama incompleto sin dar ningún error.
- **La suscripción a Postgres Changes** no está lista cuando Realtime dice `SUBSCRIBED`, sino cuando manda el
  mensaje `system` con `extension: 'postgres_changes'` y `status: 'ok'` (medido en la sesión 9;
  `supabase/scripts/medir-latencia.js` ya lo implementa).
- **`input.js` guarda referencias a objetos de `state`** durante un arrastre (`pointer.node`), y `replaceState`
  los sustituye por copias nuevas: leer `pt.node.x` al soltar daría la posición antigua.
- **Dependencias:** la app no tiene build; las bibliotecas van por CDN con versión exacta e integridad (mermaid.js
  hoy). El CDN usado ya sirve la UMD de supabase-js 2.119.0, que define el global `supabase`.
- Motivación y alcance: ver proposal.md. Reglas exigibles: specs delta de este change.

## Goals / Non-Goals

**Goals:**
- Que dos dispositivos colaboren en el navegador contra el proyecto remoto y que todo lo que se pueda probar sin
  navegador (el adaptador, las rutas, los textos, la apertura que falla) se pruebe en Node.
- Que el modo solitario no cambie: sin ruta de diagrama no hay sesión, ni red, ni cambios visibles.

**Non-Goals:**
- Lista, "Nuevo", renombrar, borrar, invitar con enlace y roles (resto de F5), y el despliegue (D1).
- Un framework, un enrutador o un gestor de estado: `main.js` sigue siendo un script de arranque.

## Decisions

### 1. Solitario por defecto; compartido solo con `#/d/<uuid>`

`ruta.js` (puro) convierte `location.hash` en `{tipo: 'solitario'}`, `{tipo: 'diagrama', id}` o `{tipo: 'invalida'}`
(empieza por `#/d/` pero no es un UUID). Cualquier cambio de `hash` recarga la página (`location.reload()`).

- *Descartado: cambiar de diagrama sin recargar.* Habría que desmontar el canal, vaciar la cola, la pila de
  deshacer y los controladores del lienzo, y probar cada caso; recargar cuesta un segundo y no deja estado
  del diagrama anterior.
- *Descartado: pedir sesión siempre.* Rompe el uso en una tablet sin red y el requisito de la spec de
  `canvas-editing` sobre el ejemplo al abrir.

### 2. supabase-js por CDN con integridad: la UMD por `<script>`

`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js" integrity="sha384-uteMfOloLDGt042uDz+xHGF3ym63/WQ6rFq7murQRG8Ih7QrXGEGNtWd8688sb4O" crossorigin="anonymous">`
(hash calculado el 24-11-2026 sobre el archivo servido por jsDelivr) antes del módulo `main.js`. Se usa el global
`window.supabase.createClient`. Un comentario junto a la etiqueta recuerda recalcular el hash al cambiar de versión,
como hace el de mermaid.js.

- *Descartado: `import` desde un CDN de módulos ES.* La integridad no se puede exigir a un `import`, y la spec de
  `canvas-editing` exige que el navegador no ejecute un archivo distinto del esperado.
- *Descartado: copiar el archivo (220 KB) al repositorio.* Elimina la dependencia del CDN, pero pesa en cada
  clon y rompe la convención de "dependencias solo por CDN" del proyecto.
- Si el script no carga (red, hash distinto), `window.supabase` no existe: el modo solitario no lo necesita y, con
  ruta de diagrama, la app avisa y bloquea el lienzo.

### 3. `config.js` con la URL y la clave pública del remoto

Un módulo con `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. Son valores públicos por diseño (el PRD y la
seguridad descansan en la RLS, que prueban los tests de S1 y S2); no incluye la clave de servicio ni contraseñas.
Los valores salen de `supabase/.env.remoto` al implementar, sin imprimir el resto del archivo.

- *Descartado: leerlos de parámetros de la URL.* Cualquiera podría apuntar la app a otro proyecto con un enlace.
- *Descartado: variables de entorno.* No hay build donde sustituirlas.

### 4. El adaptador recibe el cliente de supabase-js: se prueba en Node

`crearTransporte({client, diagramId, plazo = 10000})` devuelve `{subscribe, load, send}` y no toca `window`.
Los tests le pasan un cliente falso (`helpers/supabase-falso.js`) con `channel`, `from(...).select().eq().order().range()`,
`rpc`, `auth.getSession` y `realtime.setAuth`.

- **`subscribe(onEntry, onClose)`**: fija el JWT del canal (`client.realtime.setAuth`), crea el canal
  `diagram:<id>` con un `postgres_changes` `INSERT` sobre `diagram_ops` filtrado por `diagram_id` y un manejador
  `system`; resuelve con el mensaje `postgres_changes` con estado `ok`. Rechaza si el canal da
  `CHANNEL_ERROR`/`TIMED_OUT` antes de estar listo o pasa el `plazo`. Ya listo, un `CLOSED`, `CHANNEL_ERROR` o
  `TIMED_OUT` llama a `onClose` una vez. Cada fila nueva llega como `{seq, op_id, op}`.
- **`load()`**: lee `diagrams` (tipo y `deleted_at`), el rol propio en `diagram_members` y el registro ordenado por
  `seq`, **de 1 000 en 1 000** con `range` hasta que una página trae menos. Sin fila de diagrama (no existe o no es
  miembro: la RLS no distingue) rechaza con un error de `status` 404; con `deleted_at` (solo lo ve su dueño),
  con `status` 410. Un error de la API se relanza con su `status`; sin respuesta, sin `status`.
- **`send(grupo)`**: `rpc('apply_ops', {p_diagram_id, p_ops: grupo})`. Sin error, `{ok: true}`. Con error,
  `{ok: false, status, key: error.message}`; si no hay respuesta del servidor (`status` 0 o ausente), `status: null`,
  que `collab.js` reintenta con los mismos `op_id`.

- *Descartado: leer el registro con una función RPC que devuelva todo.* Habría que escribir y probar otra función
  del servidor y mover el límite de 1 000 a una función; paginar en el cliente cuesta cinco llamadas como máximo.
- *Descartado: mostrar un diagrama a medias si falla una página.* `load` rechaza entero y `collab.js` lo deja
  sin conexión.

### 5. `collab.open()` devuelve la causa del fallo

`{ok: false, reason, error}`: `error` es lo que lanzó el transporte, con su `status`. La app traduce: 404 → "No
tienes acceso a este diagrama o no existe", 410 → "Este diagrama se ha borrado", otro → "Sin conexión: recarga la
página". Un cambio de una línea en `collab.js` con su test; no cambia ningún comportamiento ya especificado.

- *Descartado: que `collab.js` conozca los estados HTTP.* Es un módulo sin red; el significado de 404 es del adaptador
  y de la app.

### 6. Módulos nuevos y quién toca el DOM

| Módulo | Contenido | Prueba |
|---|---|---|
| `ruta.js` | `parseRuta(hash)` | Node |
| `avisos.js` | Textos de avisos, de modos y de errores de apertura | Node |
| `transporte-supabase.js` | El adaptador | Node, con cliente falso |
| `colaboracion.js` | Sesión, panel de entrada, apertura, enlace modelo-cola, indicador de modo y bloqueo de la barra | Navegador |
| `config.js` | URL y clave pública | — |

`main.js` decide el modo al arrancar: sin ruta, hace lo de hoy (`loadExample`); con ruta, **no carga el ejemplo** y
delega en `colaboracion.js`. `colaboracion.js` es el único módulo nuevo con DOM y la única lógica que no se prueba
en Node; se mantiene fina para que lo que se prueba sea lo que importa.

### 7. Textos y avisos

| Origen | Texto |
|---|---|
| `invalid_op` | "Un cambio fue rechazado por el servidor y se ha deshecho" |
| `op_limit` | "El diagrama alcanzó el límite de 5 000 operaciones" |
| `forbidden` | "Tu rol ya no permite editar este diagrama" |
| `not_found` | "Ya no tienes acceso a este diagrama" |
| `diagram_deleted` | "Este diagrama se ha borrado" |
| `gap`, `closed`, `network`, `load` | "Sin conexión: recarga la página" |

Modos: "Conectando…", "Editando", "Solo lectura: tu rol no permite editar" (o "…este diagrama se ha borrado", "…ya
no tienes acceso") y "Sin conexión: recarga la página". Los avisos pasan por `toast` y los modos de bloqueo se
quedan escritos en un indicador de la barra hasta recargar. Todo se escribe con `textContent`.

### 8. Bloqueo de la interfaz

`onMode` de la cola hace tres cosas: `model.setReadOnly(...)`, escribe el indicador y activa o desactiva
"Deshacer", "Limpiar" y los selectores de tipo y dirección. `input.js` recibe una función `locked()` y, si devuelve
un motivo, no empieza trazos ni arrastres, no abre el editor y avisa con el motivo; además comprueba el resultado
de `addNode`/`addEdge` en vez de desestructurarlo, y expone `cancelInteraction()` para cerrar el editor y
abandonar el gesto en curso cuando el modo cambia a mitad (por ejemplo, un 403).

### 9. Los controles siguen al diagrama; el repintado se agrupa

`onVisible` vuelca el estado con `replaceState` y programa **un** repintado por fotograma (`requestAnimationFrame`):
`update()` más sincronizar `#dir` y `#kind` con `state.dir` y `state.kind` y repintar la leyenda si el tipo cambió.
`input.js` lee la posición final de un nodo arrastrado **por su id** en `state`, no por la referencia guardada al
empezar, porque `replaceState` la sustituye si llega una operación ajena a mitad del arrastre.

- *Descartado: repintar por cada operación recibida.* Una ráfaga remota de 30 operaciones lanzaría 30 renders de
  Mermaid.

### 10. Sesión

`colaboracion.js` usa `client.auth.getSession()` al arrancar y `signInWithPassword` / `signUp` desde el panel; si
`signUp` no devuelve sesión (el proyecto exige confirmar el correo), el panel dice "Cuenta creada: confirma tu
correo y entra". `onAuthStateChange` vuelve a fijar el JWT del canal con `realtime.setAuth` al renovarse el
token. "Salir" llama a `signOut()`, quita la ruta y recarga. El panel escribe los errores con `textContent`.

- *Descartado: magic link o OAuth.* El PRD fija correo y contraseña, y la tablet abre la app por `http://<ip>`,
  donde OAuth con PKCE no funciona (sin contexto seguro).

### 11. Un script para tener un diagrama que abrir

`supabase/scripts/preparar-diagrama.js`: A inicia sesión, crea el diagrama (`--tipo flow|state`), crea una
invitación (`--rol editor|viewer`) y B la acepta; escribe el id y el enlace `#/d/<id>`. `--borrar <id>` lo borra
(`delete_diagram`). Usa el entorno de `supabase/.env.remoto` y no imprime credenciales. Sustituye al botón "Nuevo"
y a las invitaciones, que son del resto de F5.

**Resultado de la prueba en el navegador (24-11-2026).** `driver-colaborativo.cjs` abre dos contextos de Chromium (A y
B) contra el proyecto remoto, con la app servida por `http-server` en local, y comprueba 23 puntos: entrar y abrir el
mismo diagrama, el tipo fijado, dibujar y verlo en el otro, renombrar, cambiar la dirección, recargar sin volver a
entrar, deshacer, un lector que no dibuja pero ve, un diagrama sin acceso, "Salir" y consola sin errores. Pasó las tres
veces que se ejecutó. El tiempo de A a B, medido desde que A suelta el trazo hasta que el contador de B marca el nodo
(incluye el repintado de B), fue de **311, 709 y 244 ms**. Es una medida de navegador a navegador desde casa, tres
muestras y no un percentil: el p95 de 100 operaciones con la app desplegada sigue siendo el de D1. Se comprobó que el
driver detecta fallos rompiendo a propósito el filtro de Realtime del adaptador (B no vio el nodo y el escenario falló).
Los diagramas de prueba se borran solos al terminar: no queda ninguno vivo en el remoto.

### 12. Impacto en `ops.js` y en `apply_op`

`ops.js` no cambia. `apply_op` y `apply_ops` no cambian: el cliente solo llama a `apply_ops`.

## Risks / Trade-offs

- [Gestos sin confirmar al recargar o cerrar] → Se pierden los que aún no están en el registro (menos de 1 s
  de trabajo). No hay aviso al cerrar: sería ruido casi siempre.
- [Dos pestañas, una sesión] → La sesión vive en `localStorage`: dos pestañas del mismo navegador son el mismo
  usuario. Para probar con dos usuarios se usan dos contextos del navegador.
- [Parpadeo de un nodo mientras se arrastra y llega una operación ajena] → `replaceState` lo coloca donde lo deja
  el registro y el siguiente movimiento del dedo lo vuelve a poner. Se acepta.
- [El 404 no distingue "no existe" de "no eres miembro"] → Es lo que exige la spec de seguridad: no revelar que el
  diagrama existe. El 410 solo lo ve su dueño.
- [Si jsDelivr cambia el archivo servido] → Las versiones de npm son inmutables; si el hash dejara de coincidir,
  el navegador no ejecuta el script y la app cae al modo solitario con aviso en rutas compartidas.
- [La clave pública en el repositorio] → Es pública por diseño; si hay un fallo de RLS, el repositorio no cambia
  su alcance. Los tests de permisos de S1, S2 y S3 son la barrera.
- [`signUp` con correo de confirmación y cupo bajo por hora] → Las cuentas de la demo se crean en el panel con
  "Auto confirm" o se desactiva la confirmación en D1.

## Migration Plan

Sin migración de datos. El orden de trabajo es el de las tareas: primero lo que se prueba en Node (rutas, textos,
adaptador, causa del fallo), después la app y por último el navegador real. Vuelta atrás: revertir los commits; sin
ruta de diagrama la app se comporta como antes, y los tests anteriores no dependen de nada nuevo.

## Open Questions

- La prueba en el navegador escribirá en el panel de entrada las credenciales de los usuarios A y B de la medida
  (las de `supabase/.env.remoto`), sin imprimirlas. Se confirma con el PO al empezar esa tarea.
