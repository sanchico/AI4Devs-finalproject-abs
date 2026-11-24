# Proposal

## Why

Segunda parte del bloque **F4 · Cliente colaborativo** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7.7),
tras el change `apply-ops` (archivado). Respalda **HU-01** (dibujar juntos) y los criterios de terminado 1, 2 y 3.

Hoy cada gesto se aplica solo en el modelo local: no hay forma de enviarlo a nadie ni de aplicar lo que
llega de otros. El diseño del PRD exige que todos los clientes lleguen al mismo diagrama aunque dos
personas editen lo mismo a la vez, y eso solo se cumple si el cliente distingue lo **confirmado** (el
registro del servidor aplicado en orden) de lo **pendiente** (lo propio aún sin confirmar), y recalcula lo
que se ve a partir de las dos cosas. Los tests de convergencia del frontend ya prueban esa regla con
una red simulada; falta llevarla al código del cliente.

Se separa de lo que toca el navegador (supabase-js, sesión, interfaz) para poder probar la cola, la
conciliación y el orden de apertura en Node, sin red y sin Docker, que es lo que el PRD marca como riesgo.

## What Changes

- **`frontend/collab.js`** (módulo puro, sin DOM ni red): recibe un *transporte* (suscribir, cargar el registro
  y enviar un grupo) y mantiene el estado `confirmado`, la lista de grupos `pendientes` y la secuencia
  aplicada. Cada gesto es un grupo; se envían **en orden y de uno en uno**, con un `op_id` por operación y los
  gestos de más de 500 operaciones en tramos.
- **Conciliación por `op_id` y por secuencia:** lo que llega del registro (propio o ajeno) se aplica una sola
  vez y en orden de secuencia; lo propio se da por confirmado al verlo; lo que se ve es siempre el confirmado
  más lo pendiente. Un hueco en la secuencia o el cierre del canal deja el diagrama en solo lectura.
- **Apertura sin perder operaciones:** suscribirse, guardar en espera lo que llegue, cargar el registro,
  aplicarlo y después lo que estaba en espera con secuencia posterior. La suscripción se da por hecha cuando
  el transporte lo confirma (el adaptador de supabase-js esperará el mensaje `system` de Postgres Changes).
- **Rechazos del servidor:** 422 y 409 descartan el gesto con un aviso; 403, 404 y 410 dejan el diagrama en
  solo lectura con el motivo; un fallo de red se reintenta con los mismos `op_id` (no duplica) y, si persiste,
  deja el diagrama sin conexión.
- **`frontend/model.js`:** `perform` pasa lo aplicado a un destino (`alCambio`) cuando hay colaboración;
  **`undo()` devuelve las inversas aplicadas y las envía como un gesto más**; `setDir` se envía aunque no se
  deshaga; un indicador de solo lectura rechaza los gestos; `reemplazar(estado)` deja que la cola ponga el
  diagrama visible sin tocar la pila de deshacer. Sin colaboración el modelo se comporta como hasta ahora.
- **Tests con `node --test`** (sin servidor): un transporte simulado con la semántica de `apply_ops`
  (grupo atómico, reintento por `op_id`, secuencias contiguas) y casos de la cola, la conciliación, la apertura,
  los rechazos, el deshacer y la convergencia de varios clientes con ráfagas.

## Fuera de alcance

- **El adaptador de supabase-js, la sesión, el selector de diagrama, el aviso "Sin conexión: recarga la
  página" y el bloqueo visual del lienzo** son el change siguiente (`colaboracion-en-la-app`). Aquí `collab.js`
  solo informa de su modo y del motivo por una función.
- Reconexión automática del canal, presencia, edición sin conexión con fusión y pedir las operaciones que
  faltan tras un corte: siguen fuera del MVP (documento de alcance del PRD).
- Cambiar `apply_ops` o cualquier función del servidor: ya están hechas y en el remoto.
- No choca con el "fuera de alcance" del MVP.
- Presupuesto: el PRD da 2 h al resto de F4 tras `apply_ops`; este change son unas 2 h y la parte de la app
  se suma, así que F4 acaba por encima del PRD. Con 6 h al día hay margen; la desviación se anota en la
  bitácora.

## Capabilities

### New Capabilities
- `collaborative-editing`: cómo el cliente envía los gestos propios, aplica los ajenos y llega al mismo diagrama
  que los demás: envío por gestos en orden, conciliación del confirmado con lo pendiente, apertura sin
  pérdidas, deshacer como gesto, rechazos del servidor, solo lectura y pérdida de la sincronía.

### Modified Capabilities

Ninguna. Los requisitos de `canvas-editing` (deshacer y limpiar) y `diagram-operations` (deshacer con
operaciones inversas) siguen valiendo tal cual: en solitario el comportamiento no cambia.

## Impact

- Nuevo `frontend/collab.js`; cambios en `frontend/model.js` (hooks, solo lectura, `undo` y `setDir`).
- Nuevos tests en `frontend/test/` (`modelo-colaborativo.test.js`, `collab.test.js`) y un ayudante
  `frontend/test/helpers/transporte-simulado.js`. Los tests actuales no cambian y son la red de seguridad.
- `CLAUDE.md` (estado actual) y `docs/PRD-MVP.md` (F4).
- Sin dependencias nuevas, sin build y sin tocar `supabase/`. No hace falta Docker.
