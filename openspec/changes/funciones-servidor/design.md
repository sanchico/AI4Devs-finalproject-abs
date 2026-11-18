# Design

## Context

Motivación y alcance en [proposal.md](proposal.md); requisitos en los specs de `operation-log`,
`diagram-lifecycle`, `diagram-sharing` y el delta de `diagram-operations`.

Estado de partida, comprobado en el repositorio y en el Supabase local (PostgreSQL 17):

- S1 dejó cuatro tablas con RLS de lectura, ningún permiso de escritura para `anon` ni `authenticated`, y
  `member_role(diagram_id)`, que devuelve el rol y `null` a los miembros no dueños de un diagrama borrado. Los
  permisos por defecto de funciones nuevas ya están cerrados (`revoke execute ... from public`): cada función
  necesita su `grant execute ... to authenticated`.
- `pgcrypto` está en el esquema `extensions` (`extensions.gen_random_bytes` existe). Con `search_path = ''`
  hay que cualificarlo.
- Los CHECK de S1 ya acotan los datos (título, tipo, dirección, `op` de 2 kB medidos sobre `op::text`). S1
  decidió **no** reproducir en SQL la validación completa de `ops.js` y dejó a S2 el tipo de operación, el
  tamaño y las etiquetas.
- Las funciones `security definer` se ejecutan como el dueño y se saltan la RLS: **toda comprobación de
  permisos es manual** y es lo que prueban los tests.
- PostgREST convierte un `RAISE` con SQLSTATE `PTxyz` en una respuesta HTTP `xyz` con `message`, `details`,
  `hint` y `code` (comprobado en su documentación). Lo no capturado sale como 400.
- `ops.js` accede a `op.node.id` y a `op.edge` sin comprobar que existan: una operación sin ellos lanza una
  excepción en cada cliente que la reproduce.

## Goals / Non-Goals

**Goals:**
- Que el registro de cada diagrama sea la única fuente de verdad, con secuencias 1..n sin huecos y sin
  duplicados, también con escrituras simultáneas y reintentos.
- Que ninguna operación que el servidor acepte pueda hacer caer a un cliente.
- Que el cliente pueda distinguir cada rechazo sin leer texto.

**Non-Goals:**
- Interpretar el grafo en el servidor, ni repetir toda la validación de `ops.js`.
- Realtime, cliente, login, matriz completa de permisos y entorno remoto (F4, F5, S3, D1).

## Decisions

### 1. Orden de comprobaciones y bloqueo en `apply_op`

```
 1. sesión                 auth.uid() nulo            -> 401
 2. rol (sin bloqueo)      no es miembro              -> 404
                           lector                     -> 403
                           diagrama borrado           -> 410   (solo lo ven sus miembros)
 3. forma de la operación  invalida                   -> 422
 4. SELECT ... FOR UPDATE de la fila de diagrams      (aquí empieza la serialización)
 5. ¿borrado mientras esperaba?                       -> 410
 6. ¿existe (diagrama, op_id)?  -> devuelve su seq (fin, sin escribir)
 7. last_seq >= 5000                                  -> 409
 8. UPDATE diagrams SET last_seq = last_seq + 1, updated_at,
           [title, direction si es setMeta]  RETURNING last_seq
 9. INSERT en diagram_ops (user_id = auth.uid())      -> devuelve seq
```

Las comprobaciones baratas van antes del bloqueo, para que un ajeno, un lector o una operación inválida no
tomen la fila ni un instante. El bloqueo dura hasta el final de la transacción, así que las filas de un
diagrama se confirman en orden de `seq` y Realtime, que lee el WAL en orden de commit, las entrega en ese
orden (de lo que depende la regla de F4 de "un hueco = solo lectura").

| Alternativa | Por qué no |
|---|---|
| `UPDATE last_seq + 1` primero y `INSERT` después (texto literal del PRD) | Un reenvío ya habría gastado un número y solo se resolvería con una excepción, que no es "devuelve la misma secuencia" |
| Sin bloqueo, con la restricción única y reintento | Reintentos en el servidor y más estados que probar; el bloqueo es más simple con tan pocos escritores |
| Calcular `max(seq) + 1` | Dos transacciones leerían el mismo máximo; solo la restricción única evitaría el duplicado |

El reintento se resuelve bajo el bloqueo, así que dos envíos simultáneos del mismo `op_id` quedan en cola y el
segundo ve la fila del primero. Se comprueba antes del tope, para que reenviar la operación nº 5 000 no falle.
Un `op_id` repetido con otra operación devuelve la secuencia ya guardada sin comparar el contenido: los
identificadores son UUID generados por el cliente y repetir uno con otro contenido es un fallo del cliente que
el servidor no tiene forma de resolver mejor.

### 2. Errores: SQLSTATE `PTxyz` y una clave estable en `message`

Una función auxiliar interna lanza `RAISE EXCEPTION USING ERRCODE = 'PT' || estado, MESSAGE = clave, DETAIL =
texto`. El cliente decide por el estado y la clave; el texto es para depurar.

| Estado | Clave | Cuándo |
|---|---|---|
| 401 | `no_session` | sin identidad en el JWT (no debería ocurrir con `authenticated`) |
| 403 | `forbidden` | miembro con rol insuficiente (lector escribe, editor invita o borra) |
| 404 | `not_found` | diagrama inexistente **o** el usuario no es miembro; también para un diagrama que no existe |
| 404 | `invite_invalid` | token desconocido o caducado, sin distinguirlos |
| 409 | `op_limit` | 5 000 operaciones |
| 410 | `diagram_deleted` | diagrama borrado, para sus miembros |
| 422 | `invalid_op` | operación mal formada, o argumentos inválidos (tipo, rol) |

Un ajeno y un diagrama inexistente reciben exactamente lo mismo (HU-02). A un miembro de un diagrama borrado
se le dice que está borrado: ya sabía que existía, y es lo que F4 muestra como "Este diagrama se ha borrado".
Para eso `apply_op` y las demás funciones leen **`diagram_members` directamente**, no `member_role`, que hace
invisible el diagrama borrado a los miembros no dueños.

| Alternativa | Por qué no |
|---|---|
| Errores genéricos (`P0001`, HTTP 400) | El cliente tendría que interpretar el texto |
| Códigos HTTP solo, sin clave | 404 se usa para dos motivos (diagrama e invitación) |

### 3. Validación mínima de la forma en SQL, y `apply` que no lanza

La función auxiliar `validate_op` comprueba solo lo que protege a los clientes y a las copias de `diagrams`:

- `op` es un objeto de tipo conocido y ocupa 2048 bytes o menos (medidos como `octet_length(op::text)`, igual
  que el CHECK de S1).
- Lleva el objeto que su tipo necesita (`node` con `id` de texto; `edge` con `id`, `from` y `to` de texto;
  `id` de texto en `updateNode`, `removeNode`, `updateEdge`, `removeEdge`; `set` objeto en los `update` y en
  `setMeta`) y las etiquetas presentes son texto de 200 unidades o menos.
- `setMeta`: ningún `kind`; título de texto que no sea solo blancos y de 200 unidades o menos; dirección `TD` o
  `LR`. Así la copia a `diagrams` no puede fallar a mitad de transacción ni tocar un CHECK.

**Mismas reglas que `ops.js`, no parecidas.** Como el título se copia a `diagrams`, un título que el servidor
 acepte y los clientes rechacen dejaría la ficha distinta del registro reproducido. Por eso la longitud se mide
 en unidades UTF-16 (`utf16_length`: un emoji cuenta 2, como en `String.length`; `char_length` contaría 1) y
 «solo blancos» sigue a `String.trim` (`is_blank`: tabuladores y espacios Unicode, no solo espacios como
 `btrim`; U+0085 no es un blanco en JavaScript y tampoco aquí). Los CHECK de S1 (`char_length`, `btrim`) siguen
 siendo más laxos, que es lo que S1 buscaba: la validación fina es esta.

Es el mismo criterio que fija `ops.js` y la decisión descartada por S1 (duplicar toda la lógica) sigue
descartada: el grafo no se mira. **Para que no pueda divergir en silencio**, un test envía al servidor las
secuencias de `frontend/test/fixtures/ops/*.json` y exige que acepte las que el cliente da por `ok`,
`missing` o `duplicate` (el grafo es cosa del cliente) y rechace las `invalid` y `unknown`.

`ops.js` pasa a rechazar con `invalid`, en vez de lanzar, las operaciones sin los objetos o identificadores que
`apply` necesita: es una defensa en profundidad, porque un registro envenenado haría caer a todos los clientes
y el servidor es la única barrera. Va en este change porque es la misma regla que la validación del servidor.

| Alternativa | Por qué no |
|---|---|
| Replicar en SQL toda la validación de `ops.js` | Dos lenguajes con la misma lógica; ya descartado en S1 |
| Confiar solo en el servidor | Cualquier hueco de `validate_op` rompería a todos los clientes |
| Solo `try/catch` en el cliente | Oculta el fallo en vez de impedir que el servidor lo acepte |

### 4. Ciclo de vida: `create_diagram`, `delete_diagram` y `restore_diagram`

- `create_diagram(kind)` devuelve el `uuid`. Inserta la ficha (el título y la dirección toman los valores por
  defecto) y la fila de miembro dueño con `display_name` = `auth.jwt() ->> 'email'`, en una transacción. Un
  tipo fuera de `flow` y `state` da `invalid_op` en vez del error del CHECK.
- `delete_diagram` y `restore_diagram` toman el bloqueo de la fila (como `apply_op`) y marcan o desmarcan
  `deleted_at`. El bloqueo ordena el borrado respecto a una escritura en curso: la operación se guarda antes o
  recibe `diagram_deleted`. Ambas son idempotentes: si ya están en ese estado, no hacen nada.
- Solo el dueño: un miembro con otro rol da `forbidden`, quien no es miembro `not_found`.

### 5. Invitaciones: `create_invite` y `accept_invite`

- El token es `encode(extensions.gen_random_bytes(32), 'hex')` (64 caracteres) y la invitación caduca a los 7
  días. Solo el dueño del diagrama vivo puede crearla.
- `accept_invite` es **reutilizable hasta que caduque**: no se consume. Es lo más simple para un enlace que se
  comparte con un equipo y es lo que describe HU-02; una invitación de un solo uso queda para la v2.
- Añade al miembro con `insert ... on conflict (diagram_id, user_id) do nothing`: quien ya es miembro
  conserva su rol (el dueño que abre su propio enlace de lector sigue siendo dueño) y repetir la aceptación no
  falla ni duplica. Devuelve siempre el identificador del diagrama.
- Un token desconocido y uno caducado dan el mismo `invite_invalid`, sin distinguirlos.

| Alternativa | Por qué no |
|---|---|
| Un solo uso | Obliga a crear un enlace por persona, y HU-02 habla de un enlace que se comparte |
| `insert ... on conflict do update` del rol | Degradaría a un dueño o subiría a un lector sin que lo decida el dueño |

### 6. Permisos y estructura de las migraciones

Todas las funciones son `security definer`, con `set search_path = ''` y todo cualificado (`public.`, `auth.`,
`extensions.`), y se declaran con `revoke all ... from public, anon` y `grant execute ... to authenticated`
aunque los permisos por defecto ya las cierran. Las auxiliares (`raise_api_error`, `validate_op`) no reciben
`grant`: PostgREST no las expone. Tres migraciones nuevas, una por grupo de funciones, con la marca de tiempo
siguiente a las de S1.

### 7. Tests

Con `node --test` y supabase-js contra el Supabase local, como en S1 (`npm run test:backend`). El helper de
datos sigue sembrando con la clave de servicio cuando necesita estados imposibles por la API (un registro de
5 000 operaciones). Los casos de aceptación del PRD (dos sesiones a la vez, un lector rechazado, el mismo
`op_id` dos veces) y uno por cada requisito de rechazo van en este change; la matriz completa entre usuarios,
roles y tablas, y la entrega por Realtime, son de S3.

## Risks / Trade-offs

- [Una función `security definer` con un `search_path` mal fijado o una referencia sin cualificar] → `set
  search_path = ''` en todas y un test que ejecuta cada función con cada rol y un usuario ajeno.
- [El bloqueo serializa a todos los escritores de un diagrama] → Con operaciones de unos cientos de bytes y
  equipos pequeños es despreciable; las comprobaciones caras van antes del bloqueo.
- [Se llega a las 5 000 operaciones antes de lo previsto] → El tope lo fija el PRD; se mide en F4
  y se revisa con él. El cliente envía un arrastre como una sola operación.
- [`validate_op` y `ops.js` divergen] → El test de las fixtures compartidas y el rechazo sin excepción en el
  cliente.
- [Quien pierde un `op_id` ya guardado cree que su operación nueva se aplicó] → Los identificadores son
  UUID v4 del cliente; es un fallo del cliente, no de red, y se documenta.
- [El presupuesto de 2 h de S2 se queda corto] → Se anota el exceso; S3 conserva su alcance.

## Migration Plan

Las migraciones son aditivas (solo funciones) y se aplican con `npx supabase db reset`. No hay datos que
migrar. Para deshacer, un `drop function` de cada una; no hay otra dependencia.
