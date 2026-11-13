# PRD alternativo · MVP de pen2mermaid con todo el backend en Supabase

| | |
|---|---|
| Estado | Propuesta. No sustituye a [PRD-MVP.md](PRD-MVP.md) (v0.5) hasta que se decida |
| Versión | Alternativa A · 10 nov 2026 |
| Base | `develop` con F1 cerrado (sesión 3 de la [bitácora](bitacora.md)) |
| Presupuesto | 25,25 h en total: 5,75 h ya gastadas más 19,5 h por hacer |
| Motivo | F1 costó 5,25 h frente a 3 h previstas; al plan v0.5 ya no le caben sus 33 h |

## 1. Resumen

El producto y los criterios de terminado son los de la v0.5: una pizarra colaborativa en la que varios
usuarios dibujan con lápiz en el mismo diagrama y todos ven el mismo grafo y el mismo Mermaid. Cambia
dónde vive el backend:

- **Desaparece Spring Boot.** No hay servidor propio, ni contenedor, ni WebSocket propio.
- **La autoridad es PostgreSQL.** Una función `apply_op` comprueba el permiso, pone la operación en orden
  y la guarda. La seguridad de fila (RLS) decide quién lee qué.
- **Supabase Realtime reparte las operaciones** a los clientes conectados y lleva la presencia.
- **El frontend es estático** y se publica en un hosting de archivos (GitHub Pages o similar).
- **Solo hay una implementación de `apply`**, la de JavaScript. El servidor ordena y autoriza; no
  interpreta el grafo.

Los bloques F2, F3, F4, F5 y P2 se mantienen casi iguales. Los seis bloques de backend (B1–B6, 15 h) se
sustituyen por tres (S1–S3, 6,5 h) y el despliegue baja de 1,5 h a 0,5 h.

## 2. Comparación con la v0.5

### Horas

| | v0.5 (Spring Boot) | Alternativa (Supabase) |
|---|---:|---:|
| Gastado hasta la sesión 3 | 5,75 | 5,75 |
| Frontend por hacer (F2–F5) | 10 | 9,5 |
| Backend por hacer | 15 | 6,5 |
| Despliegue | 1,5 | 0,5 |
| Documentación (P2) | 3 | 3 |
| **Total previsto** | **35,25** | **25,25** |
| Margen hasta 33 h | −2,25 | +7,75 |
| Total si lo que queda se desvía como F1 (+75 %) | ≈ 57 | ≈ 40 |

El ahorro nominal es de **10 h**, un tercio de lo que queda. La alternativa absorbe una desviación del
40 % sobre el trabajo pendiente sin pasar de 33 h; la v0.5 ya está 2,25 h por encima sin desviarse más.

La última fila es un caso pesimista: parte del exceso de F1 vino de trabajo no planificado (actualizar
Mermaid, la dirección de Estados, decidir el flujo de ramas y PR), que no tiene por qué repetirse.
Las horas de la sesión actual (arreglo de `|`) no están contadas en ninguna de las dos columnas.

### Qué se gana además de horas

- Desaparece el riesgo principal de la v0.5: dos implementaciones de `apply` (JS y Java) que divergen.
- Desaparecen el contenedor, la elección de hosting con WebSocket y el plan gratuito que duerme el
  servicio.
- supabase-js renueva el JWT y reconecta el canal por su cuenta; no hay mensaje `auth` que implementar.
- Cualquier número de clientes pasa por la misma base de datos: no hay salas en memoria de una instancia.

### Qué se pierde

- **Un backend que enseñar en Java.** El backend pasa a ser SQL: cuatro tablas, políticas RLS, cuatro
  funciones y sus tests. La v0.5 descartó Supabase Realtime precisamente porque "dejaría el backend casi
  vacío". Si la evaluación del curso valora un servidor de aplicación propio, esta alternativa puntúa
  peor en las secciones 2, 4 y 6 de la plantilla. **Es la decisión que hay que tomar antes de adoptarla.**
- **Validación del grafo en el servidor.** El servidor no comprueba que un nodo referenciado exista; cada
  cliente descarta esa operación con la misma regla y todos convergen igual (ver sección 5).
- **Instantáneas.** Un cliente que entra reproduce el registro completo de operaciones. Se limita el
  registro a 5 000 operaciones por diagrama; compactarlo queda fuera de alcance.
- **Swagger UI.** La API es la de PostgREST, que publica su propio OpenAPI.
- **Independencia del proveedor.** La lógica queda atada a Supabase (RLS con `auth.uid()`, Realtime).

## 3. Criterios de terminado

Son los de la v0.5 con tres cambios:

- **7.** Nadie accede a un diagrama sin ser miembro: ni por la API REST de Supabase, ni llamando a las
  funciones, ni por Realtime. Lo comprueban tests automáticos con un usuario ajeno y con la clave pública
  sin sesión.
- **9.** `node --test` pasa, incluidos los tests de integración contra un Supabase local. Se elimina
  `mvn verify`. La precisión del reconocedor se mantiene en ≥ 90 % por forma.
- **6.** Al reconectar, el cliente pide las operaciones posteriores a la última que tiene. No hay
  instantánea.

El resto (1–5, 8, 10 y 11) no cambia.

## 4. Fuera de alcance

Todo lo de la v0.5, más:

- Compactar el registro de operaciones o guardar instantáneas.
- Validar en el servidor la coherencia del grafo (existencia de nodos, máximo de nodos).
- Edge Functions.

## 5. Arquitectura

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | HTML y JS en módulos ES, sin build; mermaid.js y supabase-js por CDN con SRI | Dibujo, reconocimiento, operaciones, `apply`, Mermaid, login, lista, presencia |
| Autenticación | Supabase Auth (email y contraseña) | Registro, sesión y JWT |
| Datos y permisos | PostgreSQL de Supabase con RLS | Diagramas, miembros, invitaciones y registro de operaciones; quién lee qué |
| Lógica de servidor | Funciones PL/pgSQL llamadas por RPC | Orden de las operaciones, permisos de escritura, invitaciones |
| Tiempo real | Supabase Realtime: Postgres Changes y Presence | Reparto de operaciones y usuarios conectados |
| Despliegue | Hosting estático para `frontend/`; migraciones con la CLI de Supabase | Una URL para la app; el backend es el proyecto de Supabase |

### Modelo de colaboración

- **Operaciones:** las mismas de la v0.5 (`addNode`, `updateNode`, `removeNode`, `addEdge`, `updateEdge`,
  `removeEdge`, `setMeta`), con identificadores UUID. F2 no cambia.
- **Orden:** el cliente llama a `apply_op(diagrama, id_de_operación, operación)`. La función incrementa
  `diagrams.last_seq` con un `UPDATE`, que bloquea la fila hasta el final de la transacción. Dos
  operaciones sobre el mismo diagrama nunca se numeran a la vez: es el equivalente a la cola por sala.
- **Reparto:** la función inserta la operación en `diagram_ops`. Realtime (Postgres Changes) envía cada
  fila nueva a los clientes suscritos a ese diagrama, y la RLS de la tabla se aplica a cada suscriptor.
- **Convergencia:** todos los clientes aplican el mismo registro, en el mismo orden, con el mismo código
  `apply`. Una operación sobre un elemento que ya no existe se descarta en todos por igual. Sobre el
  mismo campo gana la última en el orden del servidor.
- **Respuesta inmediata y deshacer:** como en la v0.5. La respuesta del RPC confirma la operación propia
  con su número de secuencia; un error la revierte con su inversa y muestra el aviso.
- **Reintentos:** `(diagram_id, op_id)` es único. Si se corta la red y el cliente reenvía una operación,
  la función devuelve la secuencia que ya tenía en vez de duplicarla.
- **Huecos:** si llega una secuencia mayor que la esperada, o al reconectar, el cliente pide por REST las
  operaciones con `seq` mayor que la última aplicada.
- **Presencia:** Realtime Presence en el canal del diagrama, con nombre y color. El canal es privado: una
  política sobre `realtime.messages` solo deja entrar a los miembros.

### Modelo de datos

Cuatro tablas en `public`, relacionadas con `auth.users`:

| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `diagrams` | `id` uuid, `owner_id` uuid, `title` text, `kind` text, `direction` text, `last_seq` bigint, `created_at`, `updated_at` | PK `id`; FK `owner_id` → `auth.users`; `kind` en (`flow`, `state`) |
| `diagram_members` | `diagram_id` uuid, `user_id` uuid, `role` text, `display_name` text, `added_at` | PK (`diagram_id`, `user_id`); `role` en (`owner`, `editor`, `viewer`) |
| `diagram_invites` | `token` text, `diagram_id` uuid, `role` text, `created_by` uuid, `expires_at` | PK `token`; `role` en (`editor`, `viewer`) |
| `diagram_ops` | `diagram_id` uuid, `seq` bigint, `user_id` uuid, `op_id` uuid, `op` jsonb, `created_at` | PK (`diagram_id`, `seq`); único (`diagram_id`, `op_id`); `op` de 2 kB como máximo |

Respecto a la v0.5 desaparecen `content` y `snapshot_seq`, y se añaden `last_seq`, `op_id` y
`display_name`. Borrar un diagrama borra en cascada sus miembros, invitaciones y operaciones.

### Seguridad de fila

RLS activado en las cuatro tablas. Ninguna admite escritura directa salvo el borrado de `diagrams`.

| Tabla | Lectura | Escritura |
|---|---|---|
| `diagrams` | Miembros | Crear: `create_diagram`. Borrar: el dueño. Título, tipo y dirección: `apply_op` con `setMeta` |
| `diagram_members` | Miembros del mismo diagrama | Solo `create_diagram` y `accept_invite` |
| `diagram_invites` | El dueño | Solo `create_invite` |
| `diagram_ops` | Miembros | Solo `apply_op` |

Las políticas usan una función auxiliar `member_role(diagram_id)`, `security definer`, para que la
política de `diagram_members` no se consulte a sí misma.

### API

| Llamada | Uso |
|---|---|
| `GET /rest/v1/diagrams` | Diagramas propios y compartidos (los filtra la RLS) |
| `GET /rest/v1/diagram_members?diagram_id=eq.{id}` | Miembros y roles |
| `GET /rest/v1/diagram_ops?diagram_id=eq.{id}&seq=gt.{n}&order=seq` | Operaciones desde una secuencia, de 1 000 en 1 000 |
| `DELETE /rest/v1/diagrams?id=eq.{id}` | Borra un diagrama (solo el dueño) |
| `rpc/create_diagram(title, kind)` | Crea el diagrama y a su dueño como miembro |
| `rpc/create_invite(diagram_id, role)` | Crea una invitación con token de 32 bytes y caducidad de 7 días |
| `rpc/accept_invite(token)` | Añade al usuario como miembro si la invitación no ha caducado |
| `rpc/apply_op(diagram_id, op_id, op)` | Autoriza, numera y guarda una operación; devuelve su secuencia |
| Canal Realtime `diagram:{id}` | `INSERT` de `diagram_ops` filtrado por diagrama, y presencia |

El frontend las usa a través de supabase-js. Un diagrama del que no se es miembro devuelve cero filas.

## 6. Bloques de trabajo

| Bloque | Horas | Sustituye a | Depende de |
|---|---:|---|---|
| F2 Modelo de operaciones | 3 | F2 (3) | F1 |
| F3 Tests del frontend | 1,5 | F3 (2) | F2 |
| S1 Proyecto Supabase, esquema y RLS | 2,5 | B1 y B2 (4,5) | — |
| S2 Funciones de servidor | 2 | B3, B4 y B5 (8) | S1 |
| S3 Tests del backend | 2 | B6 (2,5) | S2, F2 |
| F4 Cliente colaborativo | 2,5 | F4 (2,5) | F2, S2 |
| F5 Login, lista, invitaciones y presencia | 2,5 | F5 (2,5) | S2, F4 |
| D1 Despliegue | 0,5 | D1 (1,5) | F4 |
| P2 Documentación de entrega | 3 | P2 (3) | repartido |
| **Por hacer** | **19,5** | 29,5 | |

F1 y P1 están hechos (5,75 h).

### F2 · Modelo de operaciones (3 h)

Igual que en la v0.5.

### F3 · Tests del frontend (1,5 h)

Igual que en la v0.5, salvo que las fixtures de operaciones solo las ejecuta JavaScript y viven en
`frontend/test/`. Se añade un **test de convergencia sin red**: varios clientes simulados con
operaciones pendientes reciben el mismo registro ordenado y acaban con el mismo grafo.

### S1 · Proyecto Supabase, esquema y RLS (2,5 h)

- Carpeta `supabase/` con la CLI: `supabase start` levanta el entorno local en Docker y
  `supabase db push` aplica las migraciones al proyecto remoto.
- Migraciones SQL de las cuatro tablas, índices, `member_role` y las políticas de la sección 5.
- `diagram_ops` en la publicación `supabase_realtime`; política de `realtime.messages` para el canal
  privado.
- Claves y contraseñas fuera del repositorio. La clave pública (`anon`) sí va en el frontend: la
  protección es la RLS.
- **Aceptación:** con la clave pública y sin sesión, `/rest/v1/diagrams` no devuelve filas; un `INSERT`
  directo en `diagram_ops` con sesión de editor se rechaza.

### S2 · Funciones de servidor (2 h)

- `create_diagram`, `create_invite`, `accept_invite` y `apply_op`, en PL/pgSQL, `security definer` y
  con `search_path` fijo. Permiso de ejecución solo para `authenticated`.
- `apply_op` comprueba el rol (dueño o editor), el tipo de operación, el tamaño (2 kB; etiquetas de 200
  caracteres) y el tope de 5 000 operaciones. Con `setMeta` actualiza además título, tipo y dirección
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
- **Aceptación:** `node --test` en verde con el entorno local arrancado.

### F4 · Cliente colaborativo (2,5 h)

- `collab.js`: suscripción al canal, carga del registro, cola de operaciones pendientes (se envían de
  una en una), aplicación de las remotas y reconciliación por `op_id`.
- Al abrir: primero se suscribe y guarda en espera lo que llegue; después carga el registro y aplica lo
  que esté en espera con secuencia posterior.
- Al reconectar o detectar un hueco: pide las operaciones que faltan.
- Modo solo lectura para lectores.
- **Aceptación:** criterios de terminado 1, 2, 3 y 6.

### F5 · Login, lista, invitaciones y presencia (2,5 h)

Igual que en la v0.5, con las llamadas de la sección 5 y Realtime Presence para los avatares.

### D1 · Despliegue (0,5 h)

- Publicar `frontend/` en un hosting estático con HTTPS (GitHub Pages, Cloudflare Pages o Netlify, a
  decidir en la sesión).
- Configurar en Supabase Auth la URL del sitio y las de redirección.
- **Aceptación:** dos dispositivos colaboran a través de la URL pública.

### P2 · Documentación de entrega (3 h)

Como en la v0.5, con estos cambios en las secciones de la plantilla:

- **2. Arquitectura:** la sección 5 de este documento. En 2.5, RLS y funciones `security definer` en
  lugar de la validación del JWT en Spring.
- **4. API:** `apply_op`, `create_invite` y `accept_invite`, más el canal Realtime.
- **6. Tickets:** backend (S2, funciones de servidor), frontend (F4) y base de datos (S1, esquema y RLS).

## 7. Plan de sesiones

| Sesión | Trabajo | Acumulado |
|---|---|---:|
| 1–3 | Hecho: P1 y F1 | 5,75 h |
| 4 | F2 modelo de operaciones | 8,75 h |
| 5 | F3 tests del frontend y convergencia sin red | 10,25 h |
| 6 | S1 proyecto Supabase, esquema y RLS | 12,75 h |
| 7 | S2 funciones de servidor | 14,75 h |
| 8 | F4 cliente colaborativo, con el login mínimo de F5 | 17,75 h |
| 9 | D1 despliegue, prueba con dos dispositivos y lista de F5 | 19,25 h |
| 10 | Resto de F5 (invitaciones y presencia) y S3 tests del backend | 22,25 h |
| 11 | P2 capturas, secciones, `prompts.md` y PR documentadas | 25,25 h |

**Punto de control tras la sesión 9.** Dos dispositivos ya colaboran a través de la URL pública. Si el
acumulado supera 23 h, se recorta en este orden: presencia (−0,5 h), invitaciones solo como editor
(−0,5 h) y fixtures del reconocedor sin grabar nuevos (−1 h).

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| El curso espera un backend de aplicación y este se ve escaso | Confirmarlo con el tutor antes de adoptar la alternativa; documentar RLS, funciones y tests como backend |
| Un error en una política RLS expone diagramas ajenos; la RLS es la única barrera | Tests de permisos en S3 con usuario ajeno y sin sesión; ninguna escritura directa en las tablas |
| Recursión entre políticas de `diagrams` y `diagram_members` | Función auxiliar `member_role` con `security definer` |
| Lógica en PL/pgSQL, más incómoda de depurar que Java | Funciones cortas, sin interpretar el grafo; tests de integración contra el entorno local |
| La latencia de Postgres Changes se acerca a 1 s | Medirla en la sesión 8; si no basta, `apply_op` emite la operación con `realtime.send` (Broadcast) |
| Límites del plan gratuito de Realtime (conexiones y mensajes) | Comprobarlos en S1; el uso de una demo queda muy por debajo |
| El plan gratuito pausa el proyecto tras una semana sin actividad, y ahora se lleva toda la app | Reactivarlo y comprobar la URL justo antes de entregar |
| El correo de confirmación de Supabase tiene un cupo bajo por hora | Desactivar la confirmación por correo en el proyecto de la demo |
| Un diagrama llega a 5 000 operaciones y deja de admitir cambios | Aviso en la interfaz; compactar el registro queda como trabajo futuro |

## 9. Decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Todo el backend en Supabase | Spring Boot con WebSocket (v0.5) | 10 h menos y sin contenedor que desplegar; la v0.5 ya no cabe en 33 h |
| El servidor ordena y autoriza, pero no interpreta el grafo | `apply` en PL/pgSQL sobre un `jsonb`; Edge Function que reutilice `ops.js` | Una sola implementación de `apply`. PL/pgSQL repetiría el riesgo de divergencia de la v0.5; la Edge Function añade arranque en frío, conexión propia a la base de datos y empaquetado |
| Registro de operaciones sin instantáneas | Tablas `nodes` y `edges` con Postgres Changes sobre ellas | Solo hay `INSERT`, que Realtime filtra por diagrama y somete a RLS; los `DELETE` no se pueden filtrar ni pasan por RLS. Mantiene F2 y la recuperación por secuencia |
| Postgres Changes para repartir | Broadcast desde la base de datos | Menos piezas; queda como plan B si la latencia no basta |
| Frontend en hosting estático | Servirlo desde Supabase Storage | Storage no está pensado para servir páginas HTML |
| Solución intermedia descartada | Spring Boot solo para la colaboración y PostgREST para el resto | Ahorra unas 4 h, pero conserva el contenedor, el despliegue con WebSocket y las dos implementaciones de `apply` |

## 10. Si se adopta

- Este documento pasa a ser `PRD-MVP.md` v0.6 y la v0.5 se conserva en el historial de git.
- `openspec/config.yaml` nombra hoy el servidor autoritativo en Spring Boot y la instancia única: hay que
  reescribir esas restricciones.
- `CLAUDE.md` y el readme describen `backend/` y `shared/`; pasan a `supabase/`.
- El hook previsto en P1 deja de ejecutar `mvn test`.
- F2 puede empezar ya: no depende de esta decisión.
