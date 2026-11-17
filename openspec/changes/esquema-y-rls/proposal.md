# Proposal

## Why

Bloque **S1 · Proyecto Supabase, esquema y RLS** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7.1),
base de las historias **HU-01** (dibujar juntos), **HU-02** (invitar) y **HU-03** (gestionar mis
diagramas), y del criterio de terminado 7: nadie accede a un diagrama sin ser miembro.

Hoy no hay backend: no existe la carpeta `supabase/`, ni tablas, ni permisos. S2 (funciones), S3 (tests
del backend), F4 (cliente colaborativo) y F5 (login y diagramas) se apoyan en este esquema, así que tiene
que estar antes que ellos, y su seguridad tiene que quedar probada desde el principio y no al final.

Además, en la exploración de la sesión 7 el PO decidió que **borrar un diagrama no lo elimina**: se marca
como borrado, deja de verse para los miembros y se puede recuperar. Eso cambia el modelo de datos y la
RLS, que son de S1, y tiene que decidirse ahora: pasar después de un borrado definitivo a uno lógico
obligaría a migrar datos.

## What Changes

- **Entorno local de Supabase** en `supabase/` con la CLI (`npx supabase init` y `npx supabase start`
  sobre Docker). Solo local: el proyecto remoto y `supabase db push` pasan a D1.
- **Migraciones SQL** de las cuatro tablas del PRD (`diagrams`, `diagram_members`, `diagram_invites`,
  `diagram_ops`) con sus restricciones e índices, y la columna nueva **`diagrams.deleted_at`** para el
  borrado lógico.
- **Función auxiliar `member_role(diagram_id)`** y **políticas de RLS de lectura**: solo los miembros leen
  un diagrama y sus filas; un diagrama en la papelera solo lo ve su dueño.
- **Ninguna escritura directa en ninguna tabla**: se revocan `INSERT`, `UPDATE` y `DELETE` a `anon` y
  `authenticated`, también el `DELETE` de `diagrams` que el PRD permitía al dueño. Todas las escrituras
  pasarán por las funciones de S2. La clave pública sin sesión no tiene ningún permiso sobre las tablas.
- **`diagram_ops` en la publicación `supabase_realtime`**.
- **Arnés de tests del backend** que S3 ampliará: `supabase/tests/*.test.js` con `node --test` y
  supabase-js como dependencia de desarrollo, contra el Supabase local. Prueba los permisos de este
  bloque.
- **PRD v0.7.2**: borrado lógico en las tablas de datos, RLS y API, en S2, S3 y en la sección 9; el
  proyecto remoto movido de S1 a D1.

## Fuera de alcance

- Las funciones `create_diagram`, `create_invite`, `accept_invite`, `apply_op` y las nuevas
  `delete_diagram` y `restore_diagram`: S2. Hasta entonces nadie puede escribir salvo con la clave de
  servicio, que solo usan los tests.
- La vista de papelera en la app y el borrado definitivo (purgado): fuera del MVP. Restaurar se podrá
  hacer con `restore_diagram` o desde el panel de Supabase.
- Comprobar que Realtime respeta la RLS de cada suscriptor: S3. Aquí solo se comprueba que la tabla está
  en la publicación.
- Crear el proyecto remoto, enlazarlo y aplicar las migraciones allí: D1.
- Login, lista de diagramas y cliente colaborativo: F4 y F5.
- **Choque con el "fuera de alcance" del MVP:** ninguno. La papelera no figura en él, y aquí solo entra
  la posibilidad de recuperar en la base de datos, sin interfaz; el "historial" que sí está fuera de
  alcance es otra cosa (versiones del diagrama).

## Capabilities

### New Capabilities

- `diagram-storage`: dónde y cómo se guardan los diagramas en el servidor y quién puede leerlos: tablas
  y sus restricciones, lectura solo para miembros, ninguna escritura directa, borrado lógico visible solo
  para el dueño y reparto del registro de operaciones por Realtime.

### Modified Capabilities

Ninguna. Las specs actuales describen el frontend; `diagram-operations` define qué es una operación y
cómo la aplica `apply`, y este change solo la guarda como `jsonb` sin interpretarla.

## Impact

- Nuevo `supabase/` (`config.toml`, `migrations/*.sql`, `tests/*.test.js` y su ayudante).
- `package.json` de la raíz: `@supabase/supabase-js` como dependencia de desarrollo y un script para los
  tests del backend. El frontend sigue sin build y sin dependencias instaladas.
- `docs/PRD-MVP.md` pasa a la v0.7.2.
- `CLAUDE.md`: cómo arrancar Supabase local y ejecutar los tests del backend.
- Requiere Docker en marcha para los tests del backend. Los del frontend no cambian.
- Sin cambios en `frontend/`.
