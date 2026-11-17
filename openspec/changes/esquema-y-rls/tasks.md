# Tasks

Estimación total: 2,5 h, las del bloque S1 del PRD. Cabe en una sesión, aunque la primera ejecución de
`supabase start` puede añadir unos minutos de descarga.

Requisito previo: Docker Desktop en marcha. No se modifica nada de `frontend/`.

## 1. Entorno local de Supabase (0,3 h)

- [x] 1.1 Añadir al `package.json` de la raíz las `devDependencies` `supabase` (CLI, versión estable fijada), `@supabase/supabase-js` y `postgres`, y el script `test:backend` = `node --test "supabase/tests/*.test.js"`. Verificación: `npm install` termina sin errores y `npx supabase --version` imprime la versión fijada.
- [x] 1.2 Ejecutar `npx supabase init` y revisar `supabase/config.toml` (nombre del proyecto `pen2mermaid`; sin claves ni contraseñas reales) y el `.gitignore` que genera. Verificación: `npx supabase start` arranca, `npx supabase status -o env` imprime `API_URL` y `DB_URL`, y `git status` no muestra archivos con secretos (`supabase/.temp`, `.env*` ignorados).

## 2. Arnés de tests del backend (0,3 h)

- [x] 2.1 Crear `supabase/tests/helpers/entorno.js` según design.md §9: lee URL, claves y `DB_URL` de `npx supabase status -o env` (admite `PUBLISHABLE_KEY`/`SECRET_KEY` y `ANON_KEY`/`SERVICE_ROLE_KEY`), y exporta `admin()` (clave de servicio), `anonimo()`, `usuario()` (crea un usuario con correo único y devuelve un cliente con sesión y su `id`) y `sql` (conexión `postgres`). Si Supabase no está en marcha, falla con el mensaje "Arranca Supabase local: npx supabase start". Verificación: `supabase/tests/entorno.test.js` crea un usuario y comprueba que su cliente tiene sesión; `npm run test:backend` pasa.
- [x] 2.2 Documentar en `CLAUDE.md` (sección "Cómo ejecutarlo") cómo arrancar Supabase local (`npm install`, `npx supabase start`, Docker en marcha) y ejecutar `npm run test:backend`, y en "Estado actual" la carpeta `supabase/`. Verificación: siguiendo esos pasos desde un clon limpio, `npm run test:backend` pasa.

## 3. Tablas, restricciones e índices (0,5 h)

- [x] 3.1 Escribir `supabase/migrations/<fecha>_tablas.sql` con `diagrams` (incluida `deleted_at`), `diagram_members`, `diagram_invites` y `diagram_ops`, con las restricciones de design.md §6, las claves ajenas y los `on delete` de §7 (`diagram_ops.user_id` nulable con `set null`), el índice único parcial de un solo dueño (§5) y los índices de §7. Verificación: `npx supabase db reset` aplica la migración sin errores.
- [x] 3.2 Crear `supabase/tests/integridad.test.js` (datos preparados con `admin()`) con los escenarios de "Integridad de los datos guardados": valores por defecto, `op_id` repetido, operación de más de 2 kB, `kind` `class`, dirección y rol desconocidos, títulos vacío y de 201 caracteres rechazados, y títulos que el cliente acepta (200 caracteres, emojis, espacios al principio) guardados sin cambios; un segundo dueño en el mismo diagrama rechazado. Verificación: `npm run test:backend` pasa.
- [x] 3.3 En el mismo archivo, el escenario "Eliminación física en cascada": con `admin()`, eliminar un diagrama con miembros, invitaciones y operaciones no deja filas suyas; y borrar un usuario deja sus operaciones con `user_id` nulo en los diagramas de otros. Verificación: `npm run test:backend` pasa.

## 4. Permisos, `member_role` y políticas (0,8 h)

- [ ] 4.1 Escribir `supabase/migrations/<fecha>_permisos.sql` según design.md §2–§4: `revoke` de todo a `anon` y de todo salvo `SELECT` a `authenticated` en las cuatro tablas, `alter default privileges` para las tablas futuras, RLS activada, `member_role` (`security definer`, `stable`, `search_path = ''`, con la regla de la papelera) con `EXECUTE` solo para `authenticated`, y las políticas de lectura. Verificación: `npx supabase db reset` aplica las dos migraciones sin errores.
- [ ] 4.2 Crear `supabase/tests/lectura.test.js` con los escenarios de "Solo los miembros leen un diagrama" y "Solo el dueño lee las invitaciones": el lector lee diagrama, operaciones y miembros; el ajeno recibe cero filas en las cuatro tablas; la lista con uno propio, uno compartido y uno ajeno devuelve exactamente dos; el dueño ve la invitación y el editor no. Verificación: `npm run test:backend` pasa.
- [ ] 4.3 Crear `supabase/tests/escritura.test.js` con "Sin sesión no hay acceso" y "Ninguna escritura directa": `anonimo()` recibe error `42501` al leer cada tabla y al insertar una operación; un editor que inserta en `diagram_ops`, un dueño que actualiza título, tipo o `last_seq` y que borra su diagrama, y un usuario que se inserta como miembro reciben error de permisos, y con `admin()` se comprueba que nada cambió. Añadir una comprobación con `sql` de que `anon` no tiene ningún privilegio en las cuatro tablas y `authenticated` solo `SELECT`. Verificación: `npm run test:backend` pasa.
- [ ] 4.4 Crear `supabase/tests/papelera.test.js` con "Borrado lógico", marcando y quitando `deleted_at` con `admin()` (las RPC llegan en S2): el editor deja de ver diagrama, operaciones y miembros; el dueño lo sigue viendo con la fecha y lee sus operaciones; al quitar la marca el editor vuelve a ver las mismas operaciones en el mismo orden y los mismos miembros. Verificación: `npm run test:backend` pasa.

## 5. Publicación de Realtime (0,15 h)

- [ ] 5.1 Añadir a la migración de permisos `alter publication supabase_realtime add table public.diagram_ops` y `set (publish = 'insert')` (design.md §8). Crear `supabase/tests/realtime.test.js`, que con `sql` comprueba en `pg_publication_tables` que `diagram_ops` está en la publicación y las otras tres tablas no, y en `pg_publication` que solo se publican inserciones. Verificación: `npx supabase db reset` y `npm run test:backend` pasan.

## 6. PRD v0.7.2 (0,35 h)

- [ ] 6.1 Actualizar `docs/PRD-MVP.md` según design.md §11: fila 0.7.2 en el historial (borrado lógico y remoto a D1, decisión del PO en la sesión 7); `deleted_at` en el modelo de datos; RLS con la papelera visible solo para el dueño y sin `DELETE` directo; API con `delete_diagram` y `restore_diagram` en lugar de `DELETE /rest/v1/diagrams`; S1 sin `db push` y con el arnés; aceptación de S1 "no accede" en lugar de "no devuelve filas"; S2 con las dos funciones y el rechazo de diagramas en la papelera; S3 con "borrar oculta y restaurar devuelve intacto"; D1 con el proyecto remoto; la decisión en la sección 9 con sus alternativas descartadas. Verificación: `grep -n "deleted_at\|delete_diagram\|restore_diagram\|0.7.2" docs/PRD-MVP.md` muestra cada punto, y no queda `DELETE /rest/v1/diagrams`.

## 7. Comprobación final (0,1 h)

- [ ] 7.1 Desde cero, `npx supabase db reset`, `npm run test:backend` y `node --test "frontend/**/*.test.js"` pasan con 0 fallos, y `git status -s frontend` no devuelve nada. Verificación: la salida de los tres comandos.
- [ ] 7.2 Buscar secretos antes del commit: `git diff --cached` no contiene claves `sb_secret_`, `service_role` con valor, ni contraseñas de base de datos. Verificación: `git grep -n "sb_secret_\|eyJhbGci" -- supabase package.json` no devuelve nada.

## Workflow follow-up

- Archivar el change con `/opsx:archive` antes de proponer el primero de S2, porque el archivado crea
  `openspec/specs/diagram-storage/` y los deltas de S2 se escriben contra ella.
- Abrir la PR de `feat/s1-proyecto-supabase-y-rls` contra `develop` al terminar el bloque S1.
- Cerrar la sesión con `/cerrar-sesion`.
