# PRD · MVP de pen2mermaid colaborativo, con el backend en Supabase

| | |
|---|---|
| Estado | Vigente: es el PRD de la entrega. Sustituye a la v0.6, que se conserva como mejora futura en [PRD-backend-java.md](PRD-backend-java.md) |
| Versión | 0.7.3 · 18 nov 2026 (el tipo de diagrama se fija al crear y las etiquetas tienen tope). La 0.7.2, del 17 nov, añadió el borrado lógico y el proyecto remoto en D1. La 0.7.1, del 16 nov, corrigió la regla de las operaciones pendientes. La 0.7, del 13 nov, adoptó la alternativa con todo el backend en Supabase; antes "Alternativa A, revisión 2", del 11 nov |
| Base | `develop` con F1 y F2 cerrados (sesión 4 de la [bitácora](bitacora.md), más F2) |
| Presupuesto | 27,5 h en total: 8 h gastadas hasta la sesión 4, 3 h previstas de F2 (ya hecho) y 16,5 h por hacer |
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
| `diagram_members` | Miembros del mismo diagrama | Solo `create_diagram` y `accept_invite` |
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
| `rpc/apply_op(diagram_id, op_id, op)` | Autoriza, numera y guarda una operación; devuelve su secuencia |
| Canal Realtime `diagram:{id}` | `INSERT` de `diagram_ops` filtrado por diagrama |

El frontend las usa a través de supabase-js. Un diagrama del que no se es miembro devuelve cero filas.

## 6. Bloques de trabajo

| Bloque | Horas | Sustituye a | Depende de |
|---|---:|---|---|
| F3 Tests del frontend | 1,5 | F3 (2) | F2 |
| S1 Proyecto Supabase, esquema y RLS | 2,5 | B1 y B2 (4,5) | — |
| S2 Funciones de servidor | 2 | B3, B4 y B5 (7) | S1 |
| S3 Tests del backend | 2 | B6 (2,5) | S2, F2 |
| F4 Cliente colaborativo | 2 | F4 (2) | F2, S2 |
| F5 Login, diagramas e invitaciones | 3 | F5 (3) | S2, F4 |
| D1 Despliegue | 0,5 | D1 (1,5) | F4 |
| P2 Documentación de entrega | 3 | P2 (3) | repartido |
| **Por hacer** | **16,5** | 25,5 | |

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

- `create_diagram`, `create_invite`, `accept_invite`, `apply_op`, `delete_diagram` y `restore_diagram`, en PL/pgSQL, `security definer` y
  con `search_path` fijo. Permiso de ejecución solo para `authenticated`.
- `apply_op` comprueba el rol (dueño o editor), el tipo de operación, el tamaño (2 kB; etiquetas de 200
  caracteres) y el tope de 5 000 operaciones. Con `setMeta` (que no admite el tipo) actualiza además título y dirección
  en `diagrams`.
- `accept_invite` guarda en `display_name` el correo del JWT.
- **Aceptación:** dos sesiones llaman a `apply_op` a la vez sobre el mismo diagrama y reciben secuencias
  consecutivas; un lector recibe un error; reenviar el mismo `op_id` devuelve la misma secuencia.

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

### F4 · Cliente colaborativo (2 h)

- `collab.js`: suscripción al canal, carga del registro, cola de operaciones pendientes (se envían de
  una en una), aplicación de las remotas y reconciliación por `op_id`.
- Al abrir: primero se suscribe y guarda en espera lo que llegue; después carga el registro y aplica lo
  que esté en espera con secuencia posterior.
- Si el canal se cierra o se detecta un hueco: solo lectura con el aviso "Sin conexión: recarga la
  página".
- Modo solo lectura para lectores.
- **Aceptación:** criterios de terminado 1, 2 y 3.

### F5 · Login, diagramas e invitaciones (3 h)

Igual que en la v0.6 (lista, nuevo, abrir por ruta `#/d/<id>`, renombrar, borrar e invitar), con las
llamadas de la sección 5. Única diferencia: quien tiene abierto un diagrama que se borra ve el aviso al
enviar su siguiente operación o al recargar, no al momento.

### D1 · Despliegue (0,5 h)

- Publicar `frontend/` en un hosting estático con HTTPS (GitHub Pages, Cloudflare Pages o Netlify, a
  decidir en la sesión).
- Crear el proyecto remoto de Supabase, enlazarlo (`supabase link`) y aplicar las migraciones con
  `supabase db push`; la contraseña de la base de datos y las claves de servicio no entran en el repositorio.
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
| 9 | F4 cliente colaborativo, con el login mínimo de F5 | 19,5 h |
| 10 | D1 despliegue, prueba con dos dispositivos, y lista, nuevo y abrir de F5 | 21 h |
| 11 | Resto de F5 (renombrar, borrar e invitaciones) y S3 tests del backend | 24,5 h |
| 12 | P2 capturas, secciones, `prompts.md` y PR documentadas | 27,5 h |

**Punto de control tras la sesión 10.** Dos dispositivos ya colaboran a través de la URL pública. Si el
acumulado supera 22 h, se recorta en este orden: invitaciones solo como editor (−0,5 h) y fixtures del
reconocedor sin grabar nuevos (−1 h). La presencia ya está fuera del MVP.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| El curso espera un backend de aplicación y este se ve escaso | Confirmarlo con el tutor antes de adoptar la alternativa; documentar RLS, funciones y tests como backend |
| Un error en una política RLS expone diagramas ajenos; la RLS es la única barrera | Tests de permisos en S3 con usuario ajeno y sin sesión; ninguna escritura directa en las tablas |
| Recursión entre políticas de `diagrams` y `diagram_members` | Función auxiliar `member_role` con `security definer` |
| Lógica en PL/pgSQL, más incómoda de depurar que Java | Funciones cortas, sin interpretar el grafo; tests de integración contra el entorno local |
| La latencia de Postgres Changes se acerca a 1 s | Medirla en la sesión 9; si no basta, `apply_op` emite la operación con `realtime.send` (Broadcast) |
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
