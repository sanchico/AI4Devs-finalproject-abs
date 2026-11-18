# Proposal

## Why

Bloque **S2 · Funciones de servidor** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7.3), que depende de
S1 (hecho) y del change `tipo-fijo-y-etiquetas` (archivado). Respalda **HU-01** (dibujar juntos), **HU-02**
(invitar) y **HU-03** (gestionar diagramas).

S1 dejó las cuatro tablas con RLS de lectura y **ninguna escritura directa**: hoy nadie, con ningún rol,
puede crear un diagrama, añadir una operación ni invitar a nadie. Todas las escrituras tienen que pasar por
funciones del servidor, y el servidor es la única barrera de seguridad: el cliente se puede modificar. Sin
S2 no hay colaboración (F4), ni login con diagramas e invitaciones (F5), ni tests de permisos completos (S3).

## What Changes

- **`apply_op(diagram_id, op_id, op)`** devuelve la secuencia de la operación. Comprueba el rol (dueño o
  editor), valida la forma de la operación, la numera bajo un bloqueo de la fila del diagrama (dos escrituras
  a la vez nunca se numeran juntas), la guarda en el registro y, si es `setMeta`, copia título y dirección a
  `diagrams`. Reenviar un `op_id` ya guardado devuelve la misma secuencia. El registro tiene un tope de
  5 000 operaciones.
- **`create_diagram(kind)`** crea el diagrama vacío ("Diagrama sin título", del tipo indicado) y a su dueño
  como miembro. **`delete_diagram`** y **`restore_diagram`** marcan y desmarcan el borrado lógico (solo el
  dueño; repetir la llamada no hace nada).
- **`create_invite(diagram_id, role)`** crea una invitación de editor o lector con token de 32 bytes y
  caducidad de 7 días (solo el dueño). **`accept_invite(token)`** añade al usuario como miembro con el correo
  de su sesión como nombre visible; no degrada ni cambia el rol de quien ya es miembro.
- **Errores distinguibles**: cada rechazo usa un estado HTTP y una clave estable (no es miembro o no existe:
  404; rol insuficiente: 403; diagrama borrado: 410; operación inválida: 422; tope del registro: 409), de modo
  que el cliente pueda mostrar "Este diagrama se ha borrado" o el aviso de una operación rechazada.
- **Las funciones solo las ejecuta `authenticated`**: son `security definer`, con `search_path` vacío, y la
  clave pública sin sesión recibe un error de permisos.
- **Operaciones mal formadas no rompen a los clientes** (`diagram-operations`): `apply` rechaza una operación
  sin su objeto `node` o `edge`, en vez de lanzar una excepción. El servidor comprueba esa misma forma, así que
  una operación que el servidor acepta nunca hace caer a un cliente al reproducir el registro.
- **Tests con `node --test`** contra el Supabase local: concurrencia, idempotencia, roles y borrado, y un test
  que pasa por el servidor las secuencias de `frontend/test/fixtures/ops/` para vigilar que cliente y
  servidor rechazan lo mismo.
- **PRD v0.7.4** con lo decidido aquí (orden de comprobaciones, errores, invitaciones reutilizables).

## Fuera de alcance

- El cliente colaborativo y la lectura del registro por Realtime: es F4. Aquí no se prueba la entrega por
  Realtime, solo que la inserción se hace dentro de `apply_op`; la prueba de entrega queda para S3.
- La matriz completa de permisos entre usuarios y roles sobre cada tabla y el entorno remoto: es S3 y D1.
  Este change prueba cada función con sus casos de aceptación y de rechazo, no todas las combinaciones.
- Validar el grafo en el servidor (que el nodo exista, aristas duplicadas…): `apply` solo existe en
  JavaScript, y el servidor guarda también las operaciones que los clientes descartarán por igual.
- Quitar miembros, revocar invitaciones, invitaciones de un solo uso, cambiar roles, purgar diagramas
  borrados o límites de frecuencia: no están en el MVP.
- Presupuesto: el PRD da 2 h a S2. Con las pruebas de cada función y el endurecimiento de `apply` serán
  unas 3,25 h; el exceso se anota en la bitácora y no mueve el alcance de S3.

## Capabilities

### New Capabilities
- `operation-log`: escribir en el registro de operaciones de un diagrama (`apply_op`): quién puede, qué se
  valida, orden consecutivo y sin huecos, reintentos que no duplican y tope de tamaño.
- `diagram-lifecycle`: crear un diagrama y borrarlo o restaurarlo (borrado lógico), solo por su dueño.
- `diagram-sharing`: invitar a un diagrama con un enlace de editor o lector y aceptarlo.

### Modified Capabilities
- `diagram-operations`: una operación mal formada (sin `node` o `edge`, o sin los campos que `apply` usa) se
  rechaza con motivo en lugar de lanzar una excepción.

## Impact

- Nuevas migraciones en `supabase/migrations/`: una función auxiliar de errores y las seis funciones.
- Nuevos tests en `supabase/tests/` (uno por función o grupo) y ajuste de `helpers/datos.js` para preparar
  datos por las funciones cuando convenga.
- `frontend/ops.js` (rechazo de operaciones mal formadas) y su test en `frontend/test/ops.test.js`.
- `docs/PRD-MVP.md` (v0.7.4) y `CLAUDE.md` (apartado `supabase/`).
- Requiere Docker y el Supabase local en marcha para los tests del backend; el frontend no cambia de
  comportamiento visible.
