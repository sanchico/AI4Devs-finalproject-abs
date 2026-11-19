# Tasks

Bloque S2 del PRD (v0.7.3). Estimación total: 3,25 h (el PRD da 2 h; el exceso es de las pruebas de cada
función y del endurecimiento de `apply`). Los tests del backend necesitan Docker y `npx supabase start`.

## 1. Errores y ciclo de vida del diagrama (0,75 h)

- [x] 1.1 Crear `supabase/migrations/20261118120000_funciones_base.sql` con la función auxiliar `raise_api_error(estado, clave, texto)` (SQLSTATE `PT<estado>`, `message` = clave, `detail` = texto) y `create_diagram(kind)`, `delete_diagram(id)` y `restore_diagram(id)`, `security definer`, `search_path` vacío, `grant execute` solo a `authenticated` y sin `grant` en la auxiliar. Verificar: `npx supabase db reset` aplica todas las migraciones sin errores.
- [x] 1.2 Escribir `supabase/tests/ciclo-de-vida.test.js` con los escenarios de `diagram-lifecycle`: crear (valores por defecto, único dueño, correo como nombre visible), tipo `class` rechazado con 422, sin sesión con error de permisos, borrar y restaurar por el dueño, `forbidden` para un editor, `not_found` para un ajeno, repetir borrado y restauración sin error, y miembros, invitaciones y operaciones intactos tras restaurar. Verificar: `node --test supabase/tests/ciclo-de-vida.test.js` en verde.
- [x] 1.3 Documentar en `docs/PRD-MVP.md` (sección API y seguridad) la tabla de estados y claves de error de la decisión 2 y la firma `create_diagram(kind)`. Verificar: `grep -n "diagram_deleted" docs/PRD-MVP.md` encuentra la tabla.

## 2. `apply_op` (1,25 h)

- [x] 2.1 Crear `supabase/migrations/20261118120100_apply_op.sql` con `validate_op(op)` (tipo conocido, 2 kB sobre `op::text`, objeto e identificadores de texto que cada tipo necesita, etiquetas de texto de 200 caracteres o menos con `char_length`, `setMeta` sin `kind` y con título y dirección válidos) y `apply_op(diagram_id, op_id, op)` con el orden de la decisión 1 (rol sin bloqueo, validación, `FOR UPDATE`, borrado, reintento, tope de 5 000, `last_seq + 1`, inserción, copia de `setMeta` a `diagrams` y `updated_at`). Verificar: `npx supabase db reset` sin errores y una llamada manual con un editor devuelve la secuencia 1.
- [x] 2.2 Escribir `supabase/tests/apply-op.test.js`: roles (editor y dueño escriben; lector 403; ajeno y diagrama inexistente 404 con la misma respuesta; sin sesión con error de permisos); 20 operaciones simultáneas de dos usuarios dan exactamente las secuencias 1 a 20; un rechazo no deja huecos; el mismo `op_id` dos veces y a la vez devuelve la misma secuencia con una sola fila; reintento de la operación nº 5 000 correcto y una nueva con 409 (registro sembrado con la clave de servicio); `setMeta` copia título y dirección (gana la última) y las demás operaciones solo tocan `updated_at`; el servidor guarda un `updateNode` sobre un nodo inexistente; 410 tras borrar y la operación se guarda al restaurar. Verificar: `node --test supabase/tests/apply-op.test.js` en verde.
- [x] 2.3 Escribir `supabase/tests/validacion-op.test.js` con una tabla de casos de rechazo 422 y de aceptación: tipo desconocido, más de 2 kB, `addNode` sin `node`, `addEdge` sin `from`, `id` numérico, etiqueta de 201 y de 200 caracteres (también con emojis), `setMeta` con `kind`, con título de espacios y con dirección `XX`. Verificar: `node --test supabase/tests/validacion-op.test.js` en verde y el registro sin operaciones rechazadas.
- [x] 2.4 Actualizar la sección S2 de `docs/PRD-MVP.md` con el orden de comprobaciones y la validación mínima, y pasar el documento a la v0.7.4 con su fila en el historial. Verificar: la versión de la cabecera y la fila 0.7.4 existen.

## 3. Invitaciones (0,5 h)

- [x] 3.1 Crear `supabase/migrations/20261118120200_invitaciones.sql` con `create_invite(diagram_id, role)` (solo el dueño de un diagrama vivo, rol `editor` o `viewer`, token `encode(extensions.gen_random_bytes(32), 'hex')`, caducidad de 7 días) y `accept_invite(token)` (`insert ... on conflict do nothing`, nombre visible del JWT, rol del miembro intacto, `invite_invalid` igual para desconocido y caducado, 410 si el diagrama está borrado). Verificar: `npx supabase db reset` sin errores.
- [x] 3.2 Escribir `supabase/tests/invitaciones.test.js` con los escenarios de `diagram-sharing`: token de 64 caracteres hexadecimales y 7 días, dos tokens distintos, rol `owner` rechazado, `forbidden` para un editor y 410 con el diagrama borrado; aceptar como editor (lee y escribe) y como lector (lee y recibe 403 al escribir), enlace usado por dos usuarios, caducada (caducidad cambiada con la clave de servicio) y desconocida con el mismo error, sin sesión, el dueño que abre su enlace de lector sigue siendo dueño, un lector con un enlace de editor sigue siendo lector y aceptar dos veces no duplica. Verificar: `node --test supabase/tests/invitaciones.test.js` en verde.

## 4. Contrato con el cliente (0,6 h)

- [x] 4.1 En `frontend/ops.js`, rechazar con `invalid` (sin lanzar) las operaciones a las que les falte el objeto o los identificadores de texto que su tipo necesita, y añadir los casos a `frontend/test/ops.test.js` (incluida una réplica con una operación mal formada) y una fixture `frontend/test/fixtures/ops/forma.json` con operaciones mal formadas y resultado `invalid`. Verificar: `node --test "frontend/**/*.test.js"` en verde y sin excepciones en ningún caso.
- [x] 4.2 Escribir `supabase/tests/fixtures-ops.test.js`: envía a `apply_op` cada operación de `frontend/test/fixtures/ops/*.json` con un editor y exige que acepte las de resultado `ok`, `missing` y `duplicate` y rechace con 422 las `invalid` y `unknown`. Verificar: `node --test supabase/tests/fixtures-ops.test.js` en verde y, tras cambiar a mano una fixture de `invalid` a `ok`, en rojo.
- [x] 4.3 Actualizar `CLAUDE.md` (apartado `supabase/`: las seis funciones, los errores y los tests nuevos; `ops.js`: rechazo de operaciones mal formadas). Verificar: el apartado coincide con los archivos de `supabase/migrations/` y `supabase/tests/`.

## 5. Integración (0,15 h)

- [x] 5.1 Ejecutar `npx supabase db reset`, `npm run test:backend`, `node --test "frontend/**/*.test.js"` y `openspec validate funciones-servidor --strict`. Verificar: todo en verde y `npx supabase db reset` aplica las tres migraciones desde cero.

## Workflow follow-up

- Aplicar con `/opsx:apply`, comprobar con `/opsx:verify` si se desea y archivar con `/opsx:archive` antes de proponer el siguiente change del bloque (F4 es otro bloque y otra rama).
- Al archivar, añadir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
