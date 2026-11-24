# Proposal

## Why

Primera parte del bloque **F4 · Cliente colaborativo** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7.7):
`apply_ops`, la función de servidor que guarda **un gesto entero** en una sola llamada. Respalda **HU-01**
(dibujar juntos). Depende de S2 (hecho: `apply_op`).

La medida de latencia de la sesión 9 dio que 30 operaciones enviadas en serie con `apply_op` tardan 2,5-2,6 s
(unos 70 ms por llamada), por encima del segundo que fija el criterio de terminado. Ocurre en los gestos que
generan muchas operaciones a la vez: **vaciar el lienzo y deshacer un vaciado** (una `removeNode` o `addNode`
por nodo). Mientras la cola de F4 los envía en serie, lo que el usuario dibuja después llega tarde a los demás.

Se hace antes de `collab.js` y no después para que la cola del cliente se escriba una sola vez, contra la
llamada definitiva, en lugar de escribir un envío en serie y reescribirlo.

## What Changes

- **`apply_ops(p_diagram_id, p_ops)`**: recibe un array JSON de `{ "op_id": <uuid>, "op": <operación> }` y
  devuelve el array de sus secuencias, en el mismo orden. Hace en una transacción y con un solo bloqueo de la
  fila del diagrama lo que `apply_op` hace por operación: comprueba el rol (dueño o editor), valida la forma de
  cada operación, las numera de forma consecutiva y guarda **una fila por operación** en `diagram_ops`
  (el formato del registro no cambia). Copia título y dirección de los `setMeta` a `diagrams` como `apply_op`.
- **El grupo es atómico**: si una operación no es válida, se rechaza el grupo entero con 422 y no se guarda
  ninguna ni se consume ninguna secuencia.
- **Reintentos**: cada `op_id` que ya está en el registro devuelve su secuencia guardada y no se vuelve a
  guardar, también si el grupo llega repetido o a la vez desde dos llamadas.
- **Tope de 5 000**: cuenta el grupo entero. Si las operaciones nuevas del grupo hacen que el registro
  supere 5 000, se rechaza el grupo entero con 409.
- **Mismos errores y roles que `apply_op`**: sin sesión, 404 (ajeno o inexistente), 403 (lector),
  410 (diagrama borrado), 422 (operación inválida) y 409 (límite alcanzado).
- **Migración nueva** (las existentes ya están en el proyecto remoto y no se editan). El cuerpo de `apply_op`
  pasa a una función interna que llaman `apply_op` y `apply_ops`, para no duplicar el bloqueo, el reintento
  y el tope. `apply_op` conserva su firma y su comportamiento.
- **Tests con `node --test`** contra el Supabase local: roles y errores, atomicidad, reintento, tope,
  concurrencia entre grupos y entre `apply_op` y `apply_ops`, las secuencias de `frontend/test/fixtures/ops/`
  enviadas como grupo, y una comparación de tiempos con la ráfaga de 30 operaciones.
- Se actualizan `CLAUDE.md` (apartado `supabase/`) y el PRD (los criterios de F4 pasan a "hecho" para esta parte).

## Fuera de alcance

- **El cliente**: `collab.js`, la cola por gestos, el cambio de `perform` y `undo()` y el uso de `apply_ops`
  desde la app son el change siguiente (`cola-colaborativa`). Este change no toca `frontend/`.
- Validar el grafo en el servidor: `apply` solo existe en JavaScript, y `apply_ops` guarda también lo que los
  clientes descartarán por igual (un `updateNode` sobre un nodo que no existe).
- Operaciones de un grupo que dependan unas de otras en el servidor (p. ej. que un `addEdge` exija que su
  `addNode` esté en el mismo grupo): el servidor no mira el grafo.
- `clear` y `restore` (vaciar en una sola fila): sigue siendo trabajo futuro del PRD; `apply_ops` solo
  reduce las llamadas, no el número de filas.
- No choca con el "fuera de alcance" del MVP: Edge Functions, presencia y compactar el registro siguen fuera.
- Presupuesto: el PRD da 1,25 h a `apply_ops` con sus tests.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities
- `operation-log`: se añade escribir un grupo de operaciones en una llamada (`apply_ops`): atomicidad del
  grupo, secuencias consecutivas, reintento por `op_id`, tope de 5 000 sobre el grupo entero y los mismos
  errores y roles que la escritura de una operación suelta.

## Impact

- Nueva migración en `supabase/migrations/` (función interna, `apply_ops`, y `apply_op` reescrita sobre la
  interna con el mismo comportamiento) y sus `grant` solo para `authenticated`.
- Nuevo test `supabase/tests/apply-ops.test.js` y, si hace falta, un ayudante de grupos en
  `supabase/tests/helpers/datos.js`. Los tests de `apply_op` existentes no cambian y deben seguir pasando:
  son la red de seguridad de la reescritura.
- `docs/PRD-MVP.md` y `CLAUDE.md`.
- Requiere Docker y el Supabase local en marcha; `npx supabase db reset` aplica la migración desde cero y
  `npx supabase db push` la sube al remoto cuando se despliegue.
- El frontend no cambia.
