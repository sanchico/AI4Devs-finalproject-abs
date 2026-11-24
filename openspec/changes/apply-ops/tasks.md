# Tasks

Estimación total: 1,25 h (el PRD da 1,25 h a `apply_ops` con sus tests). Requiere Docker y el Supabase local en
marcha (`npx supabase start`).

## 1. Migración y regresión de `apply_op` (0,5 h)

- [x] 1.1 Escribir `supabase/migrations/20261124120000_apply_ops.sql` con `write_ops` (rol, forma del grupo, `validate_op` por elemento, bloqueo, reintento por operación, tope sobre las nuevas, una `UPDATE` de `diagrams` y un `INSERT … SELECT` ordenado), sin `grant`; verificar con `npx supabase db reset` sin errores.
- [x] 1.2 Reescribir `apply_op` (`create or replace`, misma firma) como una llamada a `write_ops` con un grupo de un elemento, y añadir `apply_ops(p_diagram_id uuid, p_ops jsonb) returns bigint[]` con `revoke … from public, anon` y `grant execute … to authenticated`; verificar que `npx supabase db reset` aplica las seis migraciones.
- [x] 1.3 Antes de escribir tests nuevos, ejecutar la batería existente sin tocarla (`npm run test:backend`) y comprobar que `apply-op.test.js`, `validacion-op.test.js`, `fixtures-ops.test.js` y el resto pasan; si algo falla, se arregla `write_ops`, no el test.

## 2. Tests de `apply_ops` (0,5 h)

- [x] 2.1 Añadir `enviarGrupo(usuario, diagramaId, ops)` a `supabase/tests/helpers/datos.js` (genera un `op_id` por operación y llama a `apply_ops`) y crear `supabase/tests/apply-ops.test.js` con los casos de la requisito "Un grupo de operaciones se guarda en una sola llamada" (3 operaciones → 1, 2, 3; mismo registro que en serie; 30 `removeNode` en una llamada; `setMeta` copia título y dirección; `updateNode` sobre un nodo inexistente se guarda); verificar con `node --test supabase/tests/apply-ops.test.js`.
- [x] 2.2 Añadir los casos de roles y errores (lector 403, ajeno 404 igual que un diagrama inexistente, sin sesión, diagrama borrado 410 y 200 tras restaurar) y de atomicidad (operación inválida en medio → 422, registro vacío y la siguiente operación recibe la secuencia 1; grupo vacío, de 501, no lista, sin `op_id`, `op_id` repetido y `op_id` que no es UUID → 422); verificar que el archivo pasa.
- [x] 2.3 Añadir los casos de reintento (mismo grupo dos veces, a la vez, con operaciones ya guardadas y nuevas, un `setMeta` viejo reenviado no revierte el título, y reenvío con el registro lleno) y de tope (4 995 + 6 → 409 sin guardar nada; 4 995 + 5 → secuencias 4 996 a 5 000); verificar que el archivo pasa.
- [x] 2.4 Añadir los casos de concurrencia (dos grupos de 10 a la vez → secuencias 1 a 20 con 10 contiguas cada uno; un grupo de 10 y 5 sueltas a la vez → 1 a 15 sin repetidos ni huecos) y que `write_ops` no se puede llamar por PostgREST (`/rpc/write_ops` da permiso denegado, 403 con código 42501, a un usuario con sesión); verificar que el archivo pasa varias veces seguidas (3 ejecuciones) sin fallos intermitentes.

## 3. Contrato con las fixtures, tiempos y documentación (0,25 h)

- [x] 3.1 En `supabase/tests/apply-ops.test.js`, recorrer `frontend/test/fixtures/ops/*.json`: el grupo con las operaciones que el cliente acepta o descarta por el grafo se guarda entero con las secuencias 1…n y deja el mismo registro que el envío en serie; si la fixture trae operaciones que el cliente rechaza, el grupo completo da 422 y el registro queda vacío; verificar con `node --test supabase/tests/apply-ops.test.js`.
- [x] 3.2 Medir una vez en local la ráfaga de 30 `removeNode` en serie con `apply_op` y en un grupo con `apply_ops` (script suelto, sin aserciones), y anotar las dos cifras en `design.md` (Decisions, punto 6); verificar que las cifras están escritas.
- [x] 3.3 Actualizar `CLAUDE.md` (apartado `supabase/`: `apply_ops`, `write_ops` interna y el tope de 500) y `docs/PRD-MVP.md` (F4: `apply_ops` hecho, firma y tope de 500); verificar con `npm run test:backend` y `node --test "frontend/**/*.test.js"` en verde.

## Workflow follow-up

- Subir la migración al proyecto remoto con `npx supabase db push --remote` (con `--dry-run` antes): hecho por el PO el 24-11-2026 y comprobado con una llamada real a `apply_ops`.
- Archivar el change (`/opsx:archive`) antes de proponer `cola-colaborativa`, porque el archivado reescribe `openspec/specs/operation-log`.
- Repetir `npm run medir:latencia` con la app desplegada y un grupo, en D1 (la cifra de 188 ms del 24-11-2026 es de una sola ejecución).
