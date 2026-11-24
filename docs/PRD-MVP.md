# PRD · MVP de pen2mermaid colaborativo, con el backend en Supabase

| | |
|---|---|
| Estado | Vigente: es el PRD de la entrega. Sustituye a la v0.6, que se conserva como mejora futura en [PRD-backend-java.md](PRD-backend-java.md) |
| Versión | 0.7.7 · 19 nov 2026 (resultado de la medida de latencia: se queda Postgres Changes, F4 lleva `apply_ops` y espera la confirmación de Postgres Changes al abrir). La 0.7.6, del mismo día, puso la cola de F4 por gestos y adelantó el proyecto remoto a la sesión 9. La 0.7.5, del mismo día, añadió `set_member_role` a F5. La 0.7.4, del 18 nov, ordenó las comprobaciones y la validación de `apply_op`, los errores de las funciones y las invitaciones reutilizables. La 0.7.3, del mismo día, fijó el tipo de diagrama al crear y puso tope a las etiquetas. La 0.7.2, del 17 nov, añadió el borrado lógico y el proyecto remoto en D1. La 0.7.1, del 16 nov, corrigió la regla de las operaciones pendientes. La 0.7, del 13 nov, adoptó la alternativa con todo el backend en Supabase; antes "Alternativa A, revisión 2", del 11 nov |
| Base | `develop` con F1 y F2 cerrados (sesión 4 de la [bitácora](bitacora.md), más F2) |
| Presupuesto | 29,25 h en total: 8 h gastadas hasta la sesión 4, 3 h previstas de F2 (ya hecho) y 18,25 h por hacer (16,5 h hasta la v0.7.4; `set_member_role` suma 0,5 h a F5 y `apply_ops` 1,25 h a F4) |
| Motivo | F1 costó 5,25 h frente a 3 h previstas y la sesión 4 fue un arreglo no planificado de 2,25 h; al plan v0.6 ya no le caben sus 32 h |

## Historial de cambios

Cada versión, qué cambió y por qué. El detalle de cada decisión está en la sesión de la [bitácora](bitacora.md)
indicada. Hasta la v0.6 el documento es el que hoy se conserva como [PRD-backend-java.md](PRD-backend-java.md).

| Versión | Fecha | Tipo | Cambio | Motivo y evidencia |
|---|---|---|---|---|
| 0.1 | 28 sep 2026 | Alcance | Primer PRD del MVP de 30 h: cinco tipos de diagrama, bloques B1–B8 con horas y plan de sesiones | Sesión 0 de la bitácora (no está en git) |
| 0.2 | 29 sep 2026 | Alcance | Añade la documentación de entrega (B9) y la publicación (B10); recorta otros bloques para seguir en 30 h | Requisitos del curso; sesión 0 (no está en git) |
| 0.3 | 29 sep 2026 | Alcance | Ajusta el documento a la plantilla de entrega del curso | Plantilla del proyecto de ejemplo; sesión 0, commit `e8a323f` |
| 0.4 | 30 sep 2026 | Arquitectura | App con backend: API en Spring Boot que valida el JWT de Supabase Auth y guarda en PostgreSQL; quita ER y mapa mental; 30 h | Decisión del PO: guardar en servidor y no en el navegador; sesión 0, commit `c9d8f48` |
| 0.5 | 30 sep 2026 | Alcance | Pizarra colaborativa en tiempo real: servidor WebSocket que ordena las operaciones, deshacer por usuario, invitaciones y presencia; quita clases UML; 33 h | Decisión del PO: un backend solo para guardar una tabla se desaprovecha; sesión 0, commit `669dcc0` |
| 0.6 | 11 nov 2026 | Alcance | Añade la gestión de diagramas (HU-03: crear, abrir, renombrar y borrar); presencia y recuperación tras cortes pasan a la v2; 32 h | Hueco detectado por el PO: ningún bloque creaba ni abría diagramas; sesión 5, commit `0f69709` |
| 0.7 | 13 nov 2026 | Arquitectura y plan | Todo el backend en Supabase (PostgreSQL con RLS, `apply_op` en PL/pgSQL y Realtime); mismo producto y criterios que la v0.6; 27,5 h | F1 costó 5,25 h frente a 3 y la sesión 4 añadió 2,25 h sin planificar: a la v0.6 no le caben sus 32 h; sesiones 5 y 6, commit `f2bc764` |
| 0.7.1 | 16 nov 2026 | Corrección | Reescribe la regla de respuesta inmediata: registro confirmado más operaciones pendientes aplicadas encima; un rechazo solo quita la pendiente. Alcance y horas sin cambios | La regla anterior diverge con dos inserciones en la misma posición; probado con un cliente de control en el change `convergencia-sin-red` (F3, sesión 6) |
| 0.7.2 | 17 nov 2026 | Arquitectura | Borrar un diagrama lo marca (`deleted_at`) en vez de eliminarlo y solo lo ve su dueño; borrar y restaurar son funciones (`delete_diagram`, `restore_diagram`) y no hay escrituras directas en ninguna tabla; el proyecto remoto de Supabase pasa de S1 a D1. Sin vista de papelera ni purgado en el MVP; horas sin cambios | Decisión del PO en la sesión 7: un borrado tiene que poder deshacerse; con borrado lógico, borrar es un `UPDATE` y una política por fila dejaría cambiar también `last_seq` o `title`; change `esquema-y-rls` (S1) |
| 0.7.3 | 18 nov 2026 | Arquitectura | El tipo de diagrama se fija al crear (`create_diagram(kind)`, sin `title`) y `setMeta` solo cambia dirección y título; las etiquetas de nodos y conectores se limitan a 200 caracteres también en el cliente. Alcance y horas sin cambios | Con tipos de formas distintas, cambiar el tipo con el diagrama dibujado deja nodos sin significado, y como operación dejaba la fila de `diagrams` y el registro diciendo cosas distintas; sesión 8, change `tipo-fijo-y-etiquetas` |
| 0.7.4 | 18 nov 2026 | Arquitectura | `apply_op` comprueba el rol y la forma de la operación antes de bloquear la fila y resuelve el reintento antes del tope; los errores son estados HTTP con una clave estable; una invitación se puede usar varias veces hasta que caduque; el servidor valida el título y las etiquetas con las mismas reglas que `ops.js` (UTF-16 y blancos de JavaScript). Alcance y plan sin cambios: el exceso de S2 sobre sus 2 h (unas 3,25 h reales, por las pruebas de cada función) se anota en la bitácora | Con el `UPDATE` primero un reintento gastaba una secuencia; con las reglas de longitud de PostgreSQL la ficha divergía del registro en títulos con emojis; sesión 8, change `funciones-servidor` |
| 0.7.5 | 19 nov 2026 | Alcance | F5 añade `set_member_role`: el dueño pasa a un miembro de editor a lector o al revés; quien pierde el permiso de escribir pasa a solo lectura al recibir el 403. El recorte "invitaciones solo como editor" ya no quita los lectores. F5 sube a 3,5 h y el total a 28 h | Preocupación del PO por el desorden con muchos editores. Se descartaron los turnos de edición (un único editor que se pide o se concede): no reducen la latencia, contradicen los criterios 1 a 3 y necesitan Presence, que está fuera del MVP; sesión 9, análisis en `notas/ideas.md` |
| 0.7.6 | 19 nov 2026 | Plan | La cola de pendientes de F4 guarda un grupo por gesto y deshacer también envía sus operaciones; si la latencia medida lo pide, `apply_ops` envía cada grupo en una llamada. La creación del proyecto remoto (parte de D1) pasa a la sesión 9 para medir la latencia antes de F4. Las operaciones `clear` y `restore` quedan fuera de alcance. Horas sin cambios: `apply_ops` es condicional | Vaciar un diagrama de 20 nodos son 20 llamadas en serie y deshacerlo 45; lo que se dibuja detrás llega a los demás con segundos de retraso y rompe el criterio 1. Medir en local no sirve: la latencia que cuenta es la de la red. `clear` y `restore` quitan la ráfaga de vaciar pero no la de borrar un nodo con conectores, y cambian el formato de operaciones de F2, F3 y S2; sesión 9 |
| 0.7.7 | 19 nov 2026 | Plan | Resultado de la medida contra el proyecto remoto (`eu-west-1`): p95 del reparto de 538 a 579 ms, así que se queda Postgres Changes; una ráfaga de 30 operaciones tarda 2,5–2,6 s, así que F4 lleva `apply_ops` (+1,25 h, F4 pasa a 3,25 h y el total a 29,25 h). Al abrir, F4 espera el mensaje `system` de Postgres Changes y no solo `SUBSCRIBED` | Tres ejecuciones sin perdidas de `supabase/scripts/medir-latencia.js`, tras cinco previas. Con solo `SUBSCRIBED` se perdían operaciones (4 de 5 en local, 3 en una ejecución remota). En local el reparto ya tarda de 0 a ~500 ms: más de la mitad de la latencia es de Realtime, no de la red; sesión 9, change `medir-latencia` |

## 1. Resumen

El producto y los criterios de terminado son los de la v0.6: una pizarra colaborativa en la que varios
usuarios dibujan con lápiz en el mismo diagrama y todos ven el mismo grafo y el mismo Mermaid. Cambia
dónde vive el backend:

- **Desaparece Spring Boot.** No hay servidor propio, ni contenedor, ni WebSocket propio.
- **La autoridad es PostgreSQL.** Una función `apply_op` comprueba el permiso, pone la operación en orden
  y la guarda. La seguridad de fila (RLS) decide quién lee qué.
- **Supabase Realtime reparte las operaciones** a los clientes conectados.
- **El frontend es estático** y se publica en un hosting de archivos (GitHub Pages o similar).
- **Solo hay una implementación de `apply`**, la de JavaScript. El servidor ordena y autoriza; no
  interpreta el grafo.

Los bloques F2, F3, F4, F5 y P2 se mantienen casi iguales. Los seis bloques de backend (B1–B6, 14 h) se
sustituyen por tres (S1–S3, 6,5 h) y el despliegue baja de 1,5 h a 0,5 h.

Como en la v0.6, el frontend cubre crear, abrir, renombrar y borrar diagramas, y la presencia y la
recuperación tras cortes quedan para una segunda versión.

## 2. Comparación con la v0.6

La v0.6, con Spring Boot, está en [PRD-backend-java.md](PRD-backend-java.md).

### Horas

| | v0.6 (Spring Boot) | Alternativa (Supabase) |
|---|---:|---:|
| Gastado hasta la sesión 4 (P1, F1 y el arreglo de `\|`) | 8 | 8 |
| F2, ya hecho (horas previstas) | 3 | 3 |
| Frontend por hacer (F3–F5) | 7 | 6,5 |
| Backend por hacer | 14 | 6,5 |
| Despliegue | 1,5 | 0,5 |
| Documentación (P2) | 3 | 3 |
| **Total previsto** | **36,5** | **27,5** |
| Margen hasta 32 h | −4,5 | +4,5 |
| Total si lo que queda se desvía como F1 (+75 %) | ≈ 56 | ≈ 40 |

El ahorro nominal es de **9 h**, algo más de un tercio de las 25,5 h que le quedan a la v0.6. La
alternativa absorbe una desviación del 27 % sobre el trabajo pendiente sin pasar de 32 h; la v0.6 ya
está 4,5 h por encima sin desviarse más.

La última fila es un caso pesimista: parte del exceso de F1 vino de trabajo no planificado (actualizar
Mermaid, la dirección de Estados, decidir el flujo de ramas y PR), que no tiene por qué repetirse.
F2 cuenta con sus 3 h previstas en las dos columnas: sus horas reales aún no están en la bitácora.

### Qué se gana además de horas

- Desaparece el riesgo principal de la v0.6: dos implementaciones de `apply` (JS y Java) que divergen.
- Desaparecen el contenedor, la elección de hosting con WebSocket y el plan gratuito que duerme el
  servicio.
- supabase-js renueva el JWT por su cuenta; no hay mensaje `auth` que implementar.
- La recuperación tras cortes de la v2 sale más barata: supabase-js ya reconecta el canal y al cliente
  le basta con pedir las operaciones posteriores a la última que tiene.
- Cualquier número de clientes pasa por la misma base de datos: no hay salas en memoria de una instancia.

### Qué se pierde

- **Un backend que enseñar en Java.** El backend pasa a ser SQL: cuatro tablas, políticas RLS, cuatro
  funciones y sus tests. La v0.6 descartó Supabase Realtime precisamente porque "dejaría el backend casi
  vacío". Si la evaluación del curso valora un servidor de aplicación propio, esta alternativa puntúa
  peor en las secciones 2, 4 y 6 de la plantilla. **Es la decisión que hay que tomar antes de adoptarla.**
- **Validación del grafo en el servidor.** El servidor no comprueba que un nodo referenciado exista; cada
  cliente descarta esa operación con la misma regla y todos convergen igual (ver sección 5).
- **Instantáneas.** Un cliente que entra reproduce el registro completo de operaciones. Se limita el
  registro a 5 000 operaciones por diagrama; compactarlo queda fuera de alcance.
- **Swagger UI.** La API es la de PostgREST, que publica su propio OpenAPI.
- **Independencia del proveedor.** La lógica queda atada a Supabase (RLS con `auth.uid()`, Realtime).
- **Aviso inmediato al borrar un diagrama.** No hay sala que cerrar: quien lo tenga abierto se entera al
  enviar su siguiente operación o al recargar (ver sección 5).

## 3. Criterios de terminado

Son los de la v0.6 con dos cambios y un matiz:

- **7.** Nadie accede a un diagrama sin ser miembro: ni por la API REST de Supabase, ni llamando a las
  funciones, ni por Realtime. Lo comprueban tests automáticos con un usuario ajeno y con la clave pública
  sin sesión.
- **9.** `node --test` pasa, incluidos los tests de integración contra un Supabase local. Se elimina
  `mvn verify`. La precisión del reconocedor se mantiene en ≥ 90 % por forma.
- **6.** Se cumple igual, pero sin instantánea: al abrir o recargar, el cliente reproduce el registro
  completo de operaciones.

El resto (1–5, 8, 10 y 11) no cambia.

## 4. Fuera de alcance

Todo lo de la v0.6, incluidas la presencia y la recuperación tras cortes, que quedan para una segunda
versión (aquí serían Realtime Presence y pedir las operaciones que faltan al reconectar). Además:

- Avisar al momento a quien tiene abierto un diagrama que se borra.
- Compactar el registro de operaciones o guardar instantáneas.
- Operaciones `clear` y `restore` (vaciar y volver a poner el contenido en una sola fila) para acortar el
  registro, y reproducirlo desde el último `clear`. Con `clear` se borra también lo que otro añadió sin que
  quien vacía lo viera, y eso habría que fijarlo en la spec.
- Validar en el servidor la coherencia del grafo (existencia de nodos, máximo de nodos).
- Edge Functions.

## 5. Arquitectura

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | HTML y JS en módulos ES, sin build; mermaid.js y supabase-js por CDN con SRI | Dibujo, reconocimiento, operaciones, `apply`, Mermaid, login, gestión de diagramas |
| Autenticación | Supabase Auth (email y contraseña) | Registro, sesión y JWT |
| Datos y permisos | PostgreSQL de Supabase con RLS | Diagramas, miembros, invitaciones y registro de operaciones; quién lee qué |
| Lógica de servidor | Funciones PL/pgSQL llamadas por RPC | Orden de las operaciones, permisos de escritura, invitaciones |
| Tiempo real | Supabase Realtime: Postgres Changes | Reparto de operaciones |
| Despliegue | Hosting estático para `frontend/`; migraciones con la CLI de Supabase | Una URL para la app; el backend es el proyecto de Supabase |

### Modelo de colaboración

- **Operaciones:** las mismas de la v0.6 (`addNode`, `updateNode`, `removeNode`, `addEdge`, `updateEdge`,
  `removeEdge`, `setMeta`), con identificadores UUID. Desde la v0.7.3 `setMeta` solo cambia la dirección y el título: el tipo se fija al
  crear el diagrama. F2 cambia solo en eso y en el tope de 200 caracteres de las etiquetas.
- **Orden:** el cliente llama a `apply_op(diagrama, id_de_operación, operación)`. La función incrementa
  `diagrams.last_seq` con un `UPDATE`, que bloquea la fila hasta el final de la transacción. Dos
  operaciones sobre el mismo diagrama nunca se numeran a la vez: es el equivalente a la cola por sala.
- **Reparto:** la función inserta la operación en `diagram_ops`. Realtime (Postgres Changes) envía cada
  fila nueva a los clientes suscritos a ese diagrama, y la RLS de la tabla se aplica a cada suscriptor.
- **Convergencia:** todos los clientes aplican el mismo registro, en el mismo orden, con el mismo código
  `apply`. Una operación sobre un elemento que ya no existe se descarta en todos por igual. Sobre el
  mismo campo gana la última en el orden del servidor.
- **Respuesta inmediata:** el cliente dibuja sus operaciones al momento, sin esperar al servidor, y aun
  así acaba con el mismo grafo y el mismo Mermaid que los demás. Para eso guarda el registro confirmado
  (las operaciones numeradas, reproducidas en orden) y sus operaciones pendientes; el lienzo muestra el
  confirmado con las pendientes aplicadas encima y se recalcula cada vez que llega una entrada. Una
  entrada propia (mismo `op_id`) sale de las pendientes. Si el RPC rechaza una operación, se quita de
  las pendientes y se muestra el aviso, sin aplicar inversas. La regla de la v0.6 (las remotas sobre el
  mismo campo no pisan lo pendiente) diverge con dos inserciones en la misma posición: lo demuestra el
  change [convergencia-sin-red](../openspec/changes/archive/2026-11-14-convergencia-sin-red/design.md).
- **Deshacer:** como en la v0.6. Cada cliente guarda las inversas de sus operaciones y deshacer envía la
  inversa como una operación nueva; si otro usuario ya borró el elemento, se salta.
- **Reintentos:** `(diagram_id, op_id)` es único. Si un cliente reenvía una operación, la función
  devuelve la secuencia que ya tenía en vez de duplicarla. El MVP no reenvía solo; es la base de la
  recuperación de la v2 y cuesta una restricción.
- **Cortes y huecos:** si el canal se cierra o llega una secuencia mayor que la esperada, el lienzo pasa
  a solo lectura con el aviso "Sin conexión: recarga la página". Al recargar se reproduce el registro.
  Las operaciones propias sin confirmar se pierden.
- **Título:** `apply_op` con `setMeta` lo copia a `diagrams.title`, y la lista lo lee de ahí.
- **Tipo:** lo fija `create_diagram` y no cambia nunca; el cliente lo lee de `diagrams.kind` antes de reproducir
  el registro. Cambiar de tipo es crear otro diagrama (en modo local, el selector de la barra, con confirmación si hay nodos).
- **Diagrama borrado:** `delete_diagram` lo marca con `deleted_at` y conserva miembros, invitaciones y
  operaciones; `restore_diagram` quita la marca. Quien lo tenga abierto recibe un error en su siguiente
  `apply_op`, o cero filas al recargar (salvo el dueño); el cliente muestra "Este diagrama se ha borrado"
  y vuelve a la lista. El MVP no tiene vista de papelera ni purgado: solo el dueño ve el diagrama borrado
  y se restaura con la función o desde el panel de Supabase.

### Modelo de datos

Cuatro tablas en `public`, relacionadas con `auth.users`:

| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `diagrams` | `id` uuid, `owner_id` uuid, `title` text, `kind` text, `direction` text, `last_seq` bigint, `deleted_at` timestamptz, `created_at`, `updated_at` | PK `id`; FK `owner_id` → `auth.users`; `kind` en (`flow`, `state`); `deleted_at` nulo mientras el diagrama está vivo |
| `diagram_members` | `diagram_id` uuid, `user_id` uuid, `role` text, `display_name` text, `added_at` | PK (`diagram_id`, `user_id`); `role` en (`owner`, `editor`, `viewer`) |
| `diagram_invites` | `token` text, `diagram_id` uuid, `role` text, `created_by` uuid, `expires_at` | PK `token`; `role` en (`editor`, `viewer`) |
| `diagram_ops` | `diagram_id` uuid, `seq` bigint, `user_id` uuid, `op_id` uuid, `op` jsonb, `created_at` | PK (`diagram_id`, `seq`); único (`diagram_id`, `op_id`); `op` de 2 kB como máximo |

Respecto a la v0.6 desaparecen `content` y `snapshot_seq`, y se añaden `last_seq`, `op_id` y
`display_name`, `deleted_at`. Borrar un diagrama lo marca con `deleted_at` y conserva sus miembros, invitaciones y
operaciones; solo una eliminación física (mantenimiento) las borra en cascada.

### Seguridad de fila

RLS activado en las cuatro tablas. Ninguna admite escritura directa: `anon` no tiene permisos y `authenticated`
solo puede leer.

| Tabla | Lectura | Escritura |
|---|---|---|
| `diagrams` | Miembros; si está borrado, solo el dueño | Crear: `create_diagram`. Borrar y restaurar: `delete_diagram` y `restore_diagram` (el dueño). Título y dirección: `apply_op` con `setMeta`; el tipo se fija en `create_diagram` y no cambia |
| `diagram_members` | Miembros del mismo diagrama | Solo `create_diagram`, `accept_invite` y `set_member_role` |
| `diagram_invites` | El dueño | Solo `create_invite` |
| `diagram_ops` | Miembros | Solo `apply_op` |

Las políticas usan una función auxiliar `member_role(diagram_id)`, `security definer`, para que la
política de `diagram_members` no se consulte a sí misma. Esa función devuelve `null` a quien no es miembro y,
si el diagrama está borrado, a todos salvo al dueño; `apply_op`, `create_invite` y `accept_invite` rechazan
además un diagrama borrado.

### API

| Llamada | Uso |
|---|---|
| `GET /rest/v1/diagrams` | Diagramas propios y compartidos (los filtra la RLS) |
| `GET /rest/v1/diagram_members?diagram_id=eq.{id}` | Miembros y roles |
| `GET /rest/v1/diagram_ops?diagram_id=eq.{id}&seq=gt.{n}&order=seq` | Operaciones desde una secuencia, de 1 000 en 1 000 |
| `rpc/delete_diagram(diagram_id)` | Marca un diagrama como borrado (solo el dueño) |
| `rpc/restore_diagram(diagram_id)` | Quita la marca de borrado (solo el dueño) |
| `rpc/create_diagram(kind)` | Crea el diagrama vacío ("Diagrama sin título", del tipo indicado) y a su dueño como miembro |
| `rpc/create_invite(diagram_id, role)` | Crea una invitación con token de 32 bytes y caducidad de 7 días |
| `rpc/accept_invite(token)` | Añade al usuario como miembro si la invitación no ha caducado |
| `rpc/set_member_role(diagram_id, user_id, role)` | Cambia el rol de un miembro a `editor` o `viewer` (solo el dueño; el rol del dueño no cambia) |
| `rpc/apply_op(diagram_id, op_id, op)` | Autoriza, numera y guarda una operación; devuelve su secuencia |
| Canal Realtime `diagram:{id}` | `INSERT` de `diagram_ops` filtrado por diagrama |

El frontend las usa a través de supabase-js. Un diagrama del que no se es miembro devuelve cero filas.

Los parámetros de las funciones llevan el prefijo `p_` (`p_diagram_id`, `p_op_id`, `p_op`, `p_role`, `p_token`,
`p_kind`, `p_user_id`) para no chocar con los nombres de las columnas.

**Errores de las funciones.** Cada rechazo es un `RAISE` con SQLSTATE `PT<estado>`, que PostgREST devuelve como
ese estado HTTP con `code`, `message` (una clave estable), `details` y `hint`. El cliente decide por el estado y
la clave; el texto es para depurar. Sin sesión, la clave pública recibe un error de permisos (`42501`).

| Estado | Clave (`message`) | Cuándo |
|---|---|---|
| 401 | `no_session` | el JWT no trae identidad |
| 403 | `forbidden` | es miembro, pero su rol no basta (un lector escribe; un editor invita o borra) |
| 404 | `not_found` | el diagrama no existe **o** no es miembro: la misma respuesta, sin revelar que existe |
| 404 | `invite_invalid` | el token no existe o ha caducado |
| 409 | `op_limit` | el diagrama ya tiene 5 000 operaciones |
| 410 | `diagram_deleted` | el diagrama está borrado (lo dice a sus miembros; a un ajeno se le responde 404) |
| 422 | `invalid_op` | operación mal formada, tipo o rol no válidos |

## 6. Bloques de trabajo

| Bloque | Horas | Sustituye a | Depende de |
|---|---:|---|---|
| F3 Tests del frontend | 1,5 | F3 (2) | F2 |
| S1 Proyecto Supabase, esquema y RLS | 2,5 | B1 y B2 (4,5) | — |
| S2 Funciones de servidor | 2 | B3, B4 y B5 (7) | S1 |
| S3 Tests del backend | 2 | B6 (2,5) | S2, F2 |
| F4 Cliente colaborativo | 3,25 | F4 (2) | F2, S2 |
| F5 Login, diagramas e invitaciones | 3,5 | F5 (3) | S2, F4 |
| D1 Despliegue | 0,5 | D1 (1,5) | F4 |
| P2 Documentación de entrega | 3 | P2 (3) | repartido |
| **Por hacer** | **18,25** | 25,5 | |

P1, F1 y F2 están hechos. F2 no cambia con esta alternativa.

### F3 · Tests del frontend (1,5 h)

Igual que en la v0.6 (incluido `title` en `setMeta`), salvo que las fixtures de operaciones solo las ejecuta JavaScript y viven en
`frontend/test/`. Se añade un **test de convergencia sin red**: varios clientes simulados con
operaciones pendientes reciben el mismo registro ordenado y acaban con el mismo grafo.

### S1 · Proyecto Supabase, esquema y RLS (2,5 h)

- Carpeta `supabase/` con la CLI: `supabase start` levanta el entorno local en Docker. Solo local: el
  proyecto remoto y `supabase db push` van en D1.
- Migraciones SQL de las cuatro tablas (con `deleted_at`), índices, `member_role` y las políticas de la
  sección 5, sin ninguna escritura directa.
- Arnés de tests del backend (`supabase/tests/`, `node --test` con supabase-js y `postgres`) con los permisos
  de este bloque; S3 lo amplía.
- `diagram_ops` en la publicación `supabase_realtime`, solo con inserciones.
- Claves y contraseñas fuera del repositorio. La clave pública (`anon`) sí va en el frontend: la
  protección es la RLS.
- **Aceptación:** con la clave pública y sin sesión, `/rest/v1/diagrams` no da acceso (error de permisos);
  un `INSERT` directo en `diagram_ops` con sesión de editor se rechaza; un miembro no ve un diagrama
  borrado y su dueño sí.

### S2 · Funciones de servidor (2 h)

- `create_diagram(p_kind)`, `create_invite`, `accept_invite`, `apply_op`, `delete_diagram` y `restore_diagram`, en PL/pgSQL,
  `security definer` y con `search_path` vacío. Permiso de ejecución solo para `authenticated`. Cada rechazo es un
  estado HTTP con una clave estable (tabla de errores de la sección API).
- **Orden de `apply_op`:** sesión, rol y diagrama borrado (404, 403 y 410, sin bloqueo); forma de la operación
  (422); `SELECT ... FOR UPDATE` de la fila del diagrama; ¿se borró mientras esperaba? (410); ¿ya existe el
  `op_id`? (devuelve su secuencia); tope de 5 000 (409); y por fin `last_seq + 1`, la inserción con `user_id =
  auth.uid()` y, si es `setMeta`, la copia de título y dirección a `diagrams`. Cada operación guardada actualiza
  `updated_at`.
- **Validación de la forma:** tipo conocido, 2 kB sobre `op::text`, el objeto y los identificadores de texto que
  cada tipo necesita (para que ninguna operación guardada haga caer a un cliente), etiquetas de texto de 200
  unidades UTF-16 y, en `setMeta`, sin `kind` y con título y dirección válidos. El servidor **no** mira el grafo: guarda
  también lo que los clientes descartarán por igual. Las reglas de título y etiqueta son las de `ops.js`, no
  parecidas: la longitud se cuenta en unidades UTF-16 y «solo blancos» sigue a `trim` de JavaScript.
- `delete_diagram` y `restore_diagram` toman el mismo bloqueo, son solo del dueño y repetirlas no hace nada.
- `create_invite` es solo del dueño y de un diagrama vivo, con el rol `editor` o `viewer`. **La invitación es
  reutilizable hasta que caduque** (7 días) y `accept_invite` no cambia el rol de quien ya es miembro: el dueño que abre su propio
  enlace sigue siendo dueño. Guarda en `display_name` el correo del JWT.
- **Aceptación:** dos sesiones llaman a `apply_op` a la vez sobre el mismo diagrama y reciben secuencias
  consecutivas; un lector recibe 403; reenviar el mismo `op_id` (también a la vez) devuelve la misma secuencia.

### S3 · Tests del backend (2 h)

- `supabase/tests/*.test.js` con `node --test` y supabase-js como dependencia de desarrollo, contra el
  Supabase local.
- **Permisos:** un usuario ajeno y la clave pública sin sesión no leen ninguna tabla ni reciben nada por
  Realtime; un lector no escribe; una invitación caducada no se acepta.
- **Convergencia con red:** varios clientes envían operaciones concurrentes sobre los mismos elementos;
  al final todos tienen el mismo grafo que resulta de reproducir `diagram_ops`.
- **Diagramas:** un `setMeta` con título cambia `diagrams.title`; solo el dueño borra y restaura; borrar
  oculta el diagrama a los miembros y restaurarlo lo devuelve intacto, con sus operaciones.
- **Aceptación:** `node --test` en verde con el entorno local arrancado.

### F4 · Cliente colaborativo (3,25 h)

- `collab.js`: suscripción al canal, carga del registro, cola de operaciones pendientes, aplicación de
  las remotas y reconciliación por `op_id`.
- La cola guarda un grupo por gesto (las operaciones de un `perform`) y los envía en orden, sin empezar
  uno hasta que el anterior responde. Deshacer también es un gesto: hoy `undo()` aplica las inversas sin
  pasar por `perform`, y en colaboración tiene que enviarlas.
- **`apply_ops(p_diagram_id, p_ops)` (1,25 h, con sus tests).** La medida de la sesión 9 dio que una ráfaga
  de 30 operaciones en serie tarda 2,5–2,6 s en llegar entera (unos 70 ms por llamada), por encima de 1 s.
  Cada grupo va en una llamada, una transacción y un bloqueo, con secuencias consecutivas y una fila por
  operación en `diagram_ops` (el formato no cambia). El grupo se rechaza entero si una operación no es
  válida, cada `op_id` repetido devuelve su secuencia guardada y el tope de 5 000 cuenta el grupo entero. **Hecho** (change `apply-ops`): `p_ops` es `[{op_id, op}, …]` de 1 a
  500 operaciones, la respuesta es el array de secuencias y `apply_op` pasa a ser un grupo de uno sobre la función
  interna `write_ops`. En local, 30 operaciones tardan 129 ms en serie y 5 ms en un grupo; en el remoto (24-11-2026, una
  ejecución), 1 981 ms en serie y 188 ms en un grupo, y la migración ya está en el proyecto remoto.
- **Hecha la cola del cliente** (change `cola-colaborativa`, probada en Node con un transporte simulado):
  `collab.js` con el diagrama confirmado más los grupos pendientes, la apertura (suscribir, cargar, aplicar lo
  guardado en espera), el envío por gestos en orden y de uno en uno, los rechazos, los reintentos de red, los
  huecos y el solo lectura; y en el modelo `onChange`, `undo()` que devuelve y envía sus inversas, `setDir` que se
  envía, `setReadOnly` y `replaceState`. **Hecha la app** (change `colaboracion-en-la-app`): el adaptador de
  supabase-js (con la espera al mensaje `system` de Postgres Changes), la sesión mínima, abrir un diagrama por id,
  los avisos y el bloqueo visual (con `input.js` protegido) y la prueba en el navegador con dos usuarios contra el
  remoto (311, 709 y 244 ms de A a B en tres ejecuciones). El diagrama se abre con `#/d/<id>`; sin ruta la app es la de
  un solo usuario. **Pendiente:** el resto de F5 (lista, «Nuevo», renombrar, borrar, invitar y roles), D1 (despliegue
  y prueba con dos dispositivos reales) y el test de Realtime de S3.
- Al abrir: primero se suscribe y guarda en espera lo que llegue; después carga el registro y aplica lo
  que esté en espera con secuencia posterior. La suscripción se da por hecha cuando llega el mensaje
  `system` de Postgres Changes con estado `ok`, no con `SUBSCRIBED`: en la medida, lo enviado entre los
  dos (hasta 250 ms en remoto) se perdía, y no estaría ni en el registro cargado ni en el canal.
- Si el canal se cierra o se detecta un hueco: solo lectura con el aviso "Sin conexión: recarga la
  página".
- Modo solo lectura para lectores.
- **Aceptación:** criterios de terminado 1, 2 y 3.

### F5 · Login, diagramas e invitaciones (3,5 h)

Igual que en la v0.6 (lista, nuevo, abrir por ruta `#/d/<id>`, renombrar, borrar e invitar), con las
llamadas de la sección 5. Diferencias:

- Quien tiene abierto un diagrama que se borra ve el aviso al enviar su siguiente operación o al recargar,
  no al momento.
- **Cambiar el rol de un miembro (0,5 h).** `set_member_role(p_diagram_id, p_user_id, p_role)`, del mismo
  estilo que las de S2: solo el dueño (403 a los demás, 410 si el diagrama está borrado), 404 si el usuario
  no es miembro, 422 si el rol no es `editor` ni `viewer` o si se intenta cambiar el del dueño, e idempotente.
  `apply_op` ya comprueba el rol en cada llamada, así que el cambio vale desde la siguiente operación. En la
  lista de miembros, el dueño cambia el rol de cada uno.
- Quien pasa a lector se entera al enviar su siguiente operación: el 403 `forbidden` lleva a solo lectura
  con un aviso, y sus pendientes se descartan con la regla de siempre (un rechazo solo quita la pendiente).
  Al recargar, abre directamente en solo lectura.

### D1 · Despliegue (0,5 h)

- Publicar `frontend/` en un hosting estático con HTTPS (GitHub Pages, Cloudflare Pages o Netlify, a
  decidir en la sesión).
- Crear el proyecto remoto de Supabase, enlazarlo (`supabase link`) y aplicar las migraciones con
  `supabase db push` (se adelanta a la sesión 9 para medir la latencia); la contraseña de la base de datos y las claves de servicio no entran en el repositorio.
- Configurar en Supabase Auth la URL del sitio y las de redirección.
- **Aceptación:** dos dispositivos colaboran a través de la URL pública.

### P2 · Documentación de entrega (3 h)

Como en la v0.6, con estos cambios en las secciones de la plantilla:

- **2. Arquitectura:** la sección 5 de este documento. En 2.5, RLS y funciones `security definer` en
  lugar de la validación del JWT en Spring.
- **4. API:** `apply_op`, `create_invite` y `accept_invite`, más el canal Realtime.
- **6. Tickets:** backend (S2, funciones de servidor), frontend (F4) y base de datos (S1, esquema y RLS).

## 7. Plan de sesiones

| Sesión | Trabajo | Acumulado |
|---|---|---:|
| 1–4 | Hecho: P1, F1 y el arreglo de `\|` | 8 h |
| 5 | Hecho: F2 modelo de operaciones (horas previstas) | 11 h |
| 6 | F3 tests del frontend y convergencia sin red | 12,5 h |
| 7 | S1 proyecto Supabase, esquema y RLS | 15 h |
| 8 | S2 funciones de servidor | 17 h |
| 9 | Proyecto remoto (parte de D1: crear, enlazar y `db push`) y medida de latencia; después F4 cliente colaborativo, con el login mínimo de F5 | 19,5 h |
| 10 | `apply_ops` (resto de F4), D1 despliegue, prueba con dos dispositivos, y lista, nuevo y abrir de F5 | 22,25 h |
| 11 | Resto de F5 (renombrar, borrar, invitaciones y `set_member_role`) y S3 tests del backend | 26,25 h |
| 12 | P2 capturas, secciones, `prompts.md` y PR documentadas | 29,25 h |

**Punto de control tras la sesión 10.** Dos dispositivos ya colaboran a través de la URL pública. Si el
acumulado supera 22 h, se recorta en este orden: invitaciones solo como editor (−0,5 h) y fixtures del
reconocedor sin grabar nuevos (−1 h). Con `set_member_role` el primer recorte no quita los lectores: se
invita siempre como editor y el dueño pasa a lector a quien quiera. La presencia ya está fuera del MVP.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| El curso espera un backend de aplicación y este se ve escaso | Confirmarlo con el tutor antes de adoptar la alternativa; documentar RLS, funciones y tests como backend |
| Un error en una política RLS expone diagramas ajenos; la RLS es la única barrera | Tests de permisos en S3 con usuario ajeno y sin sesión; ninguna escritura directa en las tablas |
| Recursión entre políticas de `diagrams` y `diagram_members` | Función auxiliar `member_role` con `security definer` |
| Lógica en PL/pgSQL, más incómoda de depurar que Java | Funciones cortas, sin interpretar el grafo; tests de integración contra el entorno local |
| La latencia de Postgres Changes se acerca a 1 s | Medida en la sesión 9 contra el proyecto remoto (`eu-west-1`): p95 de 538–579 ms, así que se queda Postgres Changes. Más de la mitad es el intervalo de revisión de Realtime (también en local, de 0 a ~500 ms); si con la app desplegada se acerca a 1 s, el plan B sigue siendo que `apply_op` emita con `realtime.send` (Broadcast). Se repite la medida con `npm run medir:latencia` antes de la demo |
| Bloqueo en cabeza tras una ráfaga: vaciar o deshacer el vaciado envía decenas de operaciones en serie y lo que se dibuja después llega tarde a los demás | Medido: 30 operaciones en serie tardan 2,5–2,6 s. La cola de F4 va por gestos y `apply_ops` envía cada gesto en una llamada |
| Operaciones perdidas al abrir: lo enviado entre `SUBSCRIBED` y la confirmación de Postgres Changes no llega por el canal | F4 espera el mensaje `system` de Postgres Changes con estado `ok` antes de cargar el registro; comprobado en la medida (sin perdidas en 6 de 6 ejecuciones) |
| Límites del plan gratuito de Realtime (conexiones y mensajes) | Comprobarlos en S1; el uso de una demo queda muy por debajo |
| El plan gratuito pausa el proyecto tras una semana sin actividad, y ahora se lleva toda la app | Reactivarlo y comprobar la URL justo antes de entregar |
| El correo de confirmación de Supabase tiene un cupo bajo por hora | Desactivar la confirmación por correo en el proyecto de la demo |
| Un diagrama llega a 5 000 operaciones y deja de admitir cambios | Aviso en la interfaz; compactar el registro queda como trabajo futuro |

## 9. Decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Todo el backend en Supabase | Spring Boot con WebSocket (v0.6) | 9 h menos y sin contenedor que desplegar; la v0.6 ya no cabe en 32 h |
| El servidor ordena y autoriza, pero no interpreta el grafo | `apply` en PL/pgSQL sobre un `jsonb`; Edge Function que reutilice `ops.js` | Una sola implementación de `apply`. PL/pgSQL repetiría el riesgo de divergencia de la v0.6; la Edge Function añade arranque en frío, conexión propia a la base de datos y empaquetado |
| Registro de operaciones sin instantáneas | Tablas `nodes` y `edges` con Postgres Changes sobre ellas | Solo hay `INSERT`, que Realtime filtra por diagrama y somete a RLS; los `DELETE` no se pueden filtrar ni pasan por RLS. Mantiene F2 y la recuperación por secuencia |
| Postgres Changes para repartir | Broadcast desde la base de datos | Menos piezas; queda como plan B si la latencia no basta |
| Frontend en hosting estático | Servirlo desde Supabase Storage | Storage no está pensado para servir páginas HTML |
| El borrado de un diagrama se detecta en la siguiente operación o al recargar | Suscribirse a los `DELETE` de `diagrams`; un RPC de borrado que avise por Broadcast | Los `DELETE` no se filtran ni pasan por RLS, y Broadcast exige un canal privado con su política. No compensa para un caso raro |
| Borrar un diagrama lo marca con `deleted_at`, mediante `delete_diagram` y `restore_diagram` | Eliminarlo en cascada con `DELETE` directo y política de RLS para el dueño; borrado lógico con `UPDATE` directo | La papelera permite deshacer un borrado. Con borrado lógico, borrar es un `UPDATE` y una política por fila dejaría cambiar también `last_seq` o `title`; con funciones no hay ninguna escritura directa. Sin vista de papelera ni purgado en el MVP |
| Solución intermedia descartada | Spring Boot solo para la colaboración y PostgREST para el resto | Ahorra unas 4 h, pero conserva el contenedor, el despliegue con WebSocket y las dos implementaciones de `apply` |

## 10. Adopción

Adoptado el 13 nov 2026:

- Este documento pasa a ser `PRD-MVP.md` v0.7. La v0.6 se renombra a `PRD-backend-java.md` y queda como
  posible mejora tras la entrega.
- `openspec/config.yaml` deja de nombrar el servidor en Spring Boot, la instancia única y `mvn verify`.
- El readme sigue describiendo el diseño con Spring Boot en las secciones 2, 3, 4 y 6; se reescriben en P2.
- El hook previsto en P1 deja de ejecutar `mvn test`.
- F2 ya está hecho y sirve tal cual. F3 es el último bloque que no depende de esta decisión, salvo dónde
  viven las fixtures de operaciones (`shared/` o `frontend/test/`).
