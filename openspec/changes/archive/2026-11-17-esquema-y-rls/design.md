# Design

## Context

No hay backend todavía: ni `supabase/`, ni la CLI instalada (Docker 29.5 sí está). El `package.json` de la
raíz solo tiene `openspec`; `node_modules/` ya está en `.gitignore`. El frontend valida las operaciones en
`frontend/ops.js`: `kind` en `KINDS` (`flow`, `state`), `dir` en `['TD', 'LR']` y el título como texto
con `t.trim() !== ''` y `t.length <= 200` (unidades UTF-16), guardado sin transformar.

El modelo de datos, la RLS y la API de partida son los de la sección 5 del PRD v0.7.1. Este diseño cambia
dos cosas de ese punto de partida (borrado lógico y ningún `DELETE` directo) y concreta lo que el PRD deja
abierto. Motivación en proposal.md; comportamiento en `specs/diagram-storage/spec.md`.

## Goals / Non-Goals

**Goals:**
- Que la seguridad no dependa de una sola capa: permisos de tabla (`GRANT`) y RLS, cada uno suficiente
  por sí solo para negar las escrituras directas.
- Que las restricciones de la base de datos nunca rechacen algo que `apply` acepta: el servidor guarda
  operaciones y títulos que todos los clientes ya han validado igual.
- Dejar el arnés de tests listo para que S3 solo añada archivos.

**Non-Goals:**
- Validar en SQL la estructura de cada operación (campos de `addNode`, etc.): es de `apply_op` en S2, y
  la coherencia del grafo queda fuera del MVP.
- Rendimiento con muchos diagramas o registros largos: el tope de 5 000 operaciones de S2 lo acota.

## Decisions

### 1. Borrado lógico con `diagrams.deleted_at timestamptz`

Nulo = vivo; con valor = en la papelera desde ese momento. Las filas de miembros, invitaciones y
operaciones no se tocan.

- *Descartado:* `DELETE` en cascada (PRD v0.7.1). Decisión del PO en la sesión 7: un borrado tiene que
  poder deshacerse.
- *Descartado:* columna `deleted boolean`. La fecha cuesta lo mismo y la necesitará un purgado futuro
  ("borrar lo que lleve 30 días en la papelera").
- *Descartado:* mover el diagrama a tablas de papelera. Restaurar sería copiar filas de vuelta, con
  riesgo de perder operaciones por el camino, y duplicaría el esquema.

### 2. Ninguna escritura directa: `REVOKE` además de RLS sin políticas de escritura

En las cuatro tablas, `anon` y `authenticated` pierden `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
`REFERENCES` y `TRIGGER`; `authenticated` conserva solo `SELECT`. No se crea ninguna política de
escritura. Además, `ALTER DEFAULT PRIVILEGES` para que las tablas de migraciones futuras nazcan cerradas.

- *Descartado:* confiar solo en que no haya políticas de escritura. Funciona para `INSERT/UPDATE/DELETE`,
  pero `TRUNCATE` no pasa por la RLS y Supabase lo concede por defecto; y una política añadida por error
  en el futuro abriría la tabla sin que nada más lo impida.
- *Descartado:* `DELETE` directo del dueño con política de RLS (PRD v0.7.1). Con borrado lógico, borrar
  es un `UPDATE`, y una política de `UPDATE` por fila dejaría al dueño cambiar también `last_seq`, `kind`
  o `title` sin pasar por `apply_op`. Borrar y restaurar serán funciones de S2.

### 3. Sin sesión: sin ningún permiso de tabla

`anon` no tiene ningún privilegio sobre las cuatro tablas, así que la API responde con un error de
permisos (`42501`) en vez de una lista vacía.

- *Descartado:* conceder `SELECT` a `anon` y dejar que la RLS devuelva cero filas, que es lo que dice
  literalmente la aceptación de S1. Es una capa menos, y la app sin sesión no lee tablas (funciona como el
  prototipo, sin servidor). El criterio del PRD ("no devuelve filas") se cumple igual; la v0.7.2 lo
  redacta como "no accede".

### 4. `member_role(diagram_id)` decide la visibilidad, papelera incluida

Función `security definer`, `stable`, con `search_path = ''`. Devuelve el rol del usuario actual en el
diagrama, o `null` si no es miembro **o si el diagrama está en la papelera y su rol no es `owner`**. Todas
las políticas de lectura son `member_role(diagram_id) is not null`, salvo la de invitaciones:
`member_role(diagram_id) = 'owner'`. `EXECUTE` se revoca a `public` y `anon` y se concede a
`authenticated`.

- *Descartado:* subconsultas a `diagram_members` en cada política. La política de `diagram_members`
  se consultaría a sí misma (recursión infinita en PostgreSQL); es el motivo del PRD para la función.
- *Descartado:* repetir la condición de `deleted_at` en cada política. Cuatro sitios que mantener
  iguales; con la regla en la función, una sola.
- *Descartado:* una segunda función `can_read`. `apply_op` necesita el rol de todas formas.

**Impacto en S2 (`apply_op`):** con un diagrama en la papelera, `member_role` ya devuelve `null` a
editores y lectores, pero devuelve `owner` al dueño, así que `apply_op` MUST comprobar `deleted_at` por su
cuenta antes de numerar. Igual `create_invite` y `accept_invite`. **Impacto en `ops.js`:** ninguno.

Como cualquier función de `public`, `member_role` queda expuesta como `rpc/member_role`; solo revela el
rol del propio usuario, que ya puede leer en `diagram_members`.

### 5. El dueño es la fila `owner` de `diagram_members`; `owner_id` es informativo

La RLS usa solo `diagram_members`. `diagrams.owner_id` se mantiene (lo pide el PRD y facilita listar "mis
diagramas" frente a "compartidos"), y un índice único parcial en `diagram_members (diagram_id) where role =
'owner'` garantiza un solo dueño por diagrama. Que ambos coincidan lo garantiza `create_diagram` (S2),
la única que los escribe.

- *Descartado:* decidir la propiedad por `owner_id`. Habría dos fuentes de verdad en las políticas.

### 6. Restricciones nunca más estrictas que `ops.js`

| Columna | Restricción |
|---|---|
| `diagrams.kind` | `in ('flow', 'state')`, por defecto `'flow'` |
| `diagrams.direction` | `in ('TD', 'LR')`, por defecto `'TD'` |
| `diagrams.title` | `char_length between 1 and 200` y `btrim(title) <> ''`, por defecto `'Diagrama sin título'` |
| `diagrams.last_seq` | `>= 0`, por defecto 0 |
| `diagram_members.role` | `in ('owner', 'editor', 'viewer')` |
| `diagram_invites.role` | `in ('editor', 'viewer')` |
| `diagram_ops.op` | `octet_length(op::text) <= 2048` y `jsonb_typeof(op) = 'object'` |

`char_length` cuenta puntos de código y JavaScript unidades UTF-16, así que un título con emojis que
`ops.js` acepta siempre cabe. `btrim` solo quita espacios, mientras que `trim()` quita cualquier blanco:
la base de datos es más permisiva, nunca menos.

El tamaño de la operación se mide sobre el texto que PostgreSQL genera del `jsonb`, que no coincide byte a
byte con `JSON.stringify` (añade espacios). La medida del servidor es la que manda; `apply_op` aplicará la
misma en S2. Con etiquetas de 200 caracteres, una operación real ronda los 400 bytes.

- *Descartado:* reproducir en SQL la validación exacta de `ops.js`. Repetiría la lógica en dos lenguajes,
  que es lo que el PRD v0.7 quiso evitar, y cualquier diferencia dejaría a un cliente con una operación
  aplicada que el servidor rechaza.

### 7. Claves ajenas y qué pasa al borrar un usuario

`diagram_members`, `diagram_invites` y `diagram_ops` apuntan a `diagrams` con `on delete cascade`.
`diagrams.owner_id` y `diagram_members.user_id` apuntan a `auth.users` con `on delete cascade`;
`diagram_invites.created_by` también. **`diagram_ops.user_id` es nulable con `on delete set null`**: si un
usuario se da de baja, sus operaciones siguen en el registro de los diagramas compartidos, que sin ellas
dejarían de reproducirse igual en los demás clientes.

Índices: `diagram_members (user_id)` para la lista de diagramas de un usuario y `diagram_invites
(diagram_id)`. `diagram_ops` ya tiene la clave primaria `(diagram_id, seq)` y el único `(diagram_id,
op_id)`.

### 8. Realtime: solo `diagram_ops` y solo inserciones

`alter publication supabase_realtime add table public.diagram_ops` y `set (publish = 'insert')` sobre la
publicación.

- *Por qué solo inserciones:* Realtime no aplica la RLS a los `DELETE` ni los filtra por diagrama. Una
  eliminación física en cascada emitiría la clave `(diagram_id, seq)` de cada operación a cualquier
  suscriptor. Como la publicación solo contiene `diagram_ops`, que solo crece, no se pierde nada.
- *Descartado:* publicar también `diagrams` para avisar del borrado: el PRD ya lo descartó en la sección 9.

### 9. Arnés de tests: `node --test`, supabase-js y `postgres` contra el entorno local

- `package.json` de la raíz con `devDependencies`: la CLI `supabase` (versión fijada, se usa como
  `npx supabase`), `@supabase/supabase-js` y `postgres`. Script `test:backend` =
  `node --test "supabase/tests/*.test.js"`. Los tests del frontend no cambian y siguen sin instalar nada.
- `supabase/tests/helpers/entorno.js` lee URL y claves de `npx supabase status -o env` (admite
  `PUBLISHABLE_KEY`/`SECRET_KEY` y los antiguos `ANON_KEY`/`SERVICE_ROLE_KEY`), y crea usuarios con
  `auth.admin.createUser` y clientes con sesión mediante `signInWithPassword`.
- Hasta S2 no hay funciones de escritura, así que los datos de cada test se preparan con la clave de
  servicio (que se salta la RLS). Cada test crea sus usuarios con correos únicos; no hace falta
  `db reset` entre ejecuciones.
- `postgres` (conexión directa a `DB_URL`) solo para lo que la API no expone: la lista de tablas de la
  publicación y los privilegios de cada tabla.

- *Descartado:* un `package.json` propio en `supabase/`. Dos instalaciones para un solo proyecto.
- *Descartado:* tests en SQL con pgTAP (`supabase test db`). S3 ya fija `node --test` con supabase-js, y
  pgTAP probaría la base de datos pero no la API que usará el cliente.
- *Descartado:* comprobar la publicación con una suscripción real de Realtime. Es una prueba de S3
  (también tiene que demostrar que un ajeno no recibe nada); aquí basta con el catálogo.

### 10. Migraciones

Dos archivos en `supabase/migrations/`: tablas, restricciones e índices; y permisos, `member_role`,
políticas y publicación. Así el diff de seguridad se revisa aparte.

### 11. PRD v0.7.2

En `docs/PRD-MVP.md`: fila en el historial; `deleted_at` en el modelo de datos; en la RLS, borrar pasa a
`delete_diagram` y restaurar a `restore_diagram`, y la papelera solo la ve el dueño; en la API,
`DELETE /rest/v1/diagrams` se sustituye por las dos RPC; S1 sin `db push` y con el arnés de tests; S2 con
las dos funciones y el rechazo de diagramas en la papelera; S3 con "borrar oculta y restaurar devuelve
intacto" en lugar de la cascada; D1 con el proyecto remoto; la decisión en la sección 9. HU-03 no
cambia: "desaparece de la lista de todos los miembros" se cumple igual.

## Risks / Trade-offs

- [La primera vez, `supabase start` descarga varias imágenes y en Windows tarda] → Se hace una vez al
  principio de la sesión; los tests no lo arrancan solos, solo comprueban que está en marcha y si no lo
  está lo dicen con un mensaje claro.
- [Supabase cambia sus permisos por defecto o sus nombres de claves] → Los permisos se fijan
  explícitamente en la migración, un test comprueba los privilegios reales de cada tabla, y el ayudante
  admite los dos nombres de claves.
- [`owner_id` y la fila `owner` pueden no coincidir si alguien escribe con la clave de servicio] → Solo
  `create_diagram` las escribe; S3 añade un test.
- [Los diagramas en la papelera se quedan para siempre] → Aceptado en el MVP (sin purgado). Un usuario
  que espera un borrado definitivo no lo tiene; queda anotado para después de la entrega.
- [`publish = 'insert'` vale para toda la publicación `supabase_realtime`, no solo para `diagram_ops`]
  → Hoy `diagram_ops` es la única tabla publicada y solo crece, así que no se pierde nada. Si más
  adelante se publica otra tabla que necesite enviar actualizaciones o borrados (por ejemplo, la
  presencia de la v2), habrá que revisar la decisión 8 o crear una publicación aparte; el test de
  `realtime.test.js` que comprueba las tablas publicadas fallará y lo recordará.
- [Un título o una operación que el cliente acepta y la base de datos no] → La decisión 6 deja la base
  de datos siempre igual o más permisiva, y un test guarda los casos límite (200 caracteres, emojis,
  espacios al principio).

## Migration Plan

Solo local. `npx supabase start` aplica las migraciones al arrancar; `npx supabase db reset` las vuelve a
aplicar desde cero y es la vuelta atrás. No hay datos que migrar. El proyecto remoto y `db push` quedan
para D1.

## Open Questions

- Versión exacta de la CLI de Supabase que se fija en `devDependencies`: la estable del momento de
  instalarla.
