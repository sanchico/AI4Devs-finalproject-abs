# PRD · MVP de pen2mermaid colaborativo

| | |
|---|---|
| Estado | Borrador para revisión |
| Versión | 0.5 · 30 sep 2026 (colaboración en tiempo real) |
| Base | commit `5ea5e8a` (prototipo de flujo y estados) |
| Presupuesto | 33 horas, una persona con Claude Code (30 h si se aplican los recortes de la sección 6) |
| Calendario | Más de un mes, en sesiones de 2–3 h |
| Propósito | Entrega de curso; se evalúa el uso del agente de IA en el proceso |

## 1. Resumen

El prototipo reconoce rectángulos, rombos, elipses y conectores dibujados con lápiz y genera Mermaid para
diagramas de flujo y de estados, en un solo navegador y sin guardar nada. El MVP lo convierte en una
**pizarra colaborativa**: varios usuarios dibujan con lápiz en el mismo diagrama a la vez, cada uno desde
su dispositivo, y todos ven el mismo grafo y el mismo código Mermaid.

- **Frontend:** el lienzo actual, modularizado. Cada trazo se sigue reconociendo en el dispositivo de
  quien dibuja y se convierte en una **operación** sobre el grafo ("añadir nodo", "conectar", "cambiar
  etiqueta"). Lo que viaja por la red son esas operaciones, no los trazos.
- **Backend:** Spring Boot con un servidor de colaboración por **WebSocket** que autentica, comprueba
  permisos, ordena las operaciones, las reenvía y las guarda en **PostgreSQL**. Una API REST gestiona la
  lista de diagramas, los miembros y las invitaciones.
- **Usuarios:** registro e inicio de sesión con **Supabase Auth**. El backend valida el token de Supabase
  tanto en la API como en el WebSocket.

El principio de reconocimiento local se mantiene y ahora es una ventaja: los mensajes son pequeños y no
hay ambigüedad, porque cada cliente envía el resultado ya interpretado. El Mermaid se genera en cada
cliente a partir del mismo grafo.

Es un recorte del PRD completo, que cubre los 22 tipos de Mermaid: el MVP no añade tipos nuevos y dedica
el tiempo a la colaboración. Como el curso evalúa el uso del agente, **el proceso de trabajo con Claude
Code es un entregable más** (P1 y P2). El formato sigue la plantilla del
[proyecto de ejemplo del curso](https://github.com/LIDR-academy/AI4Devs-finalproject-Example1/).

## 2. Criterios de terminado

1. Dos usuarios dibujan a la vez en el mismo diagrama desde dos dispositivos y cada uno ve los cambios
   del otro en menos de 1 s con la app desplegada.
2. Las ediciones simultáneas convergen: tras una ráfaga de operaciones concurrentes, todos los clientes
   muestran el mismo grafo y el mismo código Mermaid. Lo comprueba un test automático.
3. Deshacer solo deshace las operaciones propias.
4. El dueño invita por enlace como editor o como lector. El servidor rechaza las operaciones de un lector.
5. Se ve quién está conectado al diagrama.
6. Si se corta la red, al reconectar el cliente recupera los cambios que se ha perdido. Al volver otro
   día, el diagrama está intacto.
7. Nadie accede a un diagrama sin ser miembro: ni por la API, ni por el WebSocket, ni por la API pública
   de Supabase.
8. Las etiquetas no pueden inyectar HTML en la vista previa de ningún usuario.
9. `node --test` y `mvn verify` pasan. La precisión del reconocedor sobre los trazos grabados es ≥ 90 %
   por forma.
10. La app está desplegada en una URL pública y funciona en la tablet.
11. La ficha y las secciones 1–7 del curso y `prompts.md` están completas, con capturas y 3 pull
    requests documentadas.

## 3. Fuera de alcance

- Tipos nuevos: clases UML, ER, mapa mental, secuencia y el resto del PRD completo.
- Pan y zoom.
- Ver el cursor o el trazo en curso de otros usuarios; solo se ve el resultado reconocido.
- Edición simultánea de una misma etiqueta letra a letra: gana el último que la confirma.
- Varias instancias del servidor: las salas viven en memoria de una sola instancia.
- Edición sin conexión con fusión posterior. Sin red se puede dibujar un diagrama nuevo sin guardar.
- Historial de versiones navegable.
- Importar Mermaid, escritura a mano, autolayout e IA de visión.
- CI con GitHub Actions y vídeo tutorial.

## 4. Arquitectura

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | HTML y JS en módulos ES, sin build; mermaid.js y supabase-js por CDN | Dibujo, reconocimiento, operaciones, generación de Mermaid, login, lista, presencia |
| Autenticación | Supabase Auth (email y contraseña) | Registro, sesión, contraseñas; emite el JWT |
| Backend | Java 21, Spring Boot 3, Spring WebSocket, Spring Security (resource server), Spring Data JPA, Flyway, springdoc-openapi | Salas de colaboración, orden y validación de operaciones, permisos, API REST |
| Base de datos | PostgreSQL de Supabase; PostgreSQL en Docker para desarrollo y tests | Diagramas, miembros, invitaciones y registro de operaciones |
| Despliegue | Un contenedor con Spring Boot que sirve también el frontend | Una sola URL para la API, el WebSocket y la app |

### Modelo de colaboración

- **Operaciones:** todo cambio del modelo pasa por `apply(op)`: `addNode`, `updateNode` (campos
  concretos: posición, tamaño, etiqueta), `removeNode` (borra también sus aristas), `addEdge`,
  `updateEdge`, `removeEdge` y `setMeta` (título, tipo, dirección). Los identificadores pasan a ser UUID,
  porque los actuales (`n1`, `n2`…) colisionarían entre usuarios.
- **Servidor como autoridad:** cada diagrama abierto es una sala en memoria. El servidor procesa sus
  operaciones de una en una, las valida (esquema, permisos, que los elementos referenciados existan), les
  asigna un número de secuencia, las guarda y las reenvía a todos.
- **Conflictos:** operaciones sobre elementos distintos no chocan. Sobre el mismo campo gana la última en
  el orden del servidor (*last-writer-wins*). Una actualización de un elemento borrado se descarta.
- **Respuesta inmediata:** el cliente aplica sus operaciones al momento, sin esperar al servidor. Mientras
  una operación propia está pendiente de confirmación, las remotas sobre ese mismo campo no la pisan. Al
  confirmarse, el estado converge con el del servidor. Es el enfoque que describe Figma para su editor
  multijugador.
- **Deshacer:** cada cliente guarda las operaciones inversas de las suyas. Deshacer envía la inversa; si
  otro usuario ya borró el elemento, se salta.
- **Presencia:** al entrar y salir de una sala, el servidor difunde la lista de usuarios conectados, cada
  uno con un color.

### Protocolo WebSocket

Mensajes JSON sobre `/ws/diagrams`:

| Sentido | Mensaje | Contenido |
|---|---|---|
| Cliente → servidor | `hello` | JWT, id del diagrama y último número de secuencia conocido |
| Cliente → servidor | `op` | Operación con un id generado en el cliente |
| Cliente → servidor | `auth` | JWT renovado, antes de que caduque el anterior |
| Servidor → cliente | `snapshot` | Estado completo y su número de secuencia (al entrar, o si el cliente está muy atrasado) |
| Servidor → cliente | `ops` | Operaciones con número de secuencia y autor; incluye la confirmación de las propias |
| Servidor → cliente | `presence` | Usuarios conectados |
| Servidor → cliente | `error` | Operación rechazada y motivo |

El JWT va en el primer mensaje y no en la URL, porque el navegador no permite cabeceras en WebSocket y
las URL acaban en los logs.

### Modelo de datos

Cuatro tablas en el esquema `public`, relacionadas con `auth.users` de Supabase:

| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `diagrams` | `id` uuid, `owner_id` uuid, `title` text, `kind` text, `direction` text, `content` jsonb, `snapshot_seq` bigint, `created_at`, `updated_at` | PK `id`; FK `owner_id` → `auth.users`; `kind` en (`flow`, `state`) |
| `diagram_members` | `diagram_id` uuid, `user_id` uuid, `role` text, `added_at` | PK (`diagram_id`, `user_id`); FK a `diagrams` y `auth.users`; `role` en (`owner`, `editor`, `viewer`) |
| `diagram_invites` | `token` text, `diagram_id` uuid, `role` text, `created_by` uuid, `expires_at` | PK `token`; FK a `diagrams`; `role` en (`editor`, `viewer`) |
| `diagram_ops` | `diagram_id` uuid, `seq` bigint, `user_id` uuid, `op` jsonb, `created_at` | PK (`diagram_id`, `seq`); FK a `diagrams` y `auth.users` |

`content` guarda una instantánea del grafo cada 50 operaciones y al vaciarse la sala. `diagram_ops`
permite reconstruir el estado desde la última instantánea y enviar a un cliente reconectado solo lo que
se ha perdido.

### API REST

| Método y ruta | Uso |
|---|---|
| `GET /api/diagrams` | Diagramas propios y compartidos, con el rol del usuario |
| `POST /api/diagrams` | Crea un diagrama |
| `DELETE /api/diagrams/{id}` | Borra un diagrama (solo el dueño) |
| `GET /api/diagrams/{id}/members` | Miembros y roles |
| `POST /api/diagrams/{id}/invites` | Crea un enlace de invitación con rol y caducidad |
| `POST /api/invites/{token}/accept` | Acepta una invitación y añade al usuario como miembro |

La edición del contenido va siempre por WebSocket. Un diagrama del que no se es miembro responde 404.

## 5. Bloques de trabajo

| Bloque | Horas | Depende de |
|---|---:|---|
| F1 Modularizar el frontend | 3 | — |
| F2 Modelo de operaciones | 3 | F1 |
| F3 Tests del frontend | 2 | F2 |
| B1 Backend: proyecto, base de datos y migraciones | 3 | — |
| B2 Autenticación con Supabase | 1,5 | B1 |
| B3 API REST: diagramas, miembros e invitaciones | 2,5 | B2 |
| B4 Servidor de colaboración | 3,5 | B2, F2 |
| B5 Persistencia de operaciones y reconexión | 2 | B4 |
| B6 Tests del backend | 2,5 | B3, B5 |
| F4 Cliente colaborativo | 2,5 | F2, B4 |
| F5 Login, lista, invitaciones y presencia | 2,5 | B3, F4 |
| D1 Despliegue | 1,5 | F4 |
| P1 Configuración de Claude Code | 0,5 | repartido |
| P2 Documentación de entrega | 3 | repartido |
| **Total** | **33** | |

### F1 · Modularizar el frontend (3 h)

- Mover el código a `frontend/` y separarlo en módulos ES nativos: `geometry.js`, `recognizer.js`,
  `model.js`, `ops.js`, `kinds/*.js`, `render.js`, `input.js`, `api.js`, `collab.js` y `main.js`.
- La vista previa pasa de `securityLevel: 'loose'` a `'strict'`. En un diagrama compartido, una etiqueta
  con HTML se ejecutaría en el navegador de todos los miembros.
- **Aceptación:** el comportamiento es idéntico al del commit base, comprobado con la skill
  `run-trazo-mermaid`. Una etiqueta `<img src=x onerror=alert(1)>` se muestra como texto.

### F2 · Modelo de operaciones (3 h)

- Todo cambio del modelo pasa por `apply(op)`, con los tipos de operación de la sección 4.
- Identificadores UUID (`crypto.randomUUID()`).
- Deshacer por usuario con operaciones inversas, en lugar de las instantáneas actuales.
- **Aceptación:** la app funciona igual que antes en modo local, pero todo cambio es una operación
  serializable.

### F3 · Tests del frontend (2 h)

- `node --test`, sin dependencias.
- Modo de grabación de trazos (`?grabar`) y fixtures de rectángulo, rombo y elipse (10 por forma,
  dibujados con el S Pen).
- Tests de generación de Mermaid por tipo.
- **Fixtures de operaciones compartidas** en `shared/fixtures/ops/*.json`: una secuencia de operaciones y
  el grafo esperado. Las ejecutan tanto los tests de JS como los de Java (B6), para que las dos
  implementaciones de `apply` no diverjan.
- **Aceptación:** `node --test` en verde; precisión ≥ 90 % por forma.

### B1 · Backend: proyecto, base de datos y migraciones (3 h)

- Proyecto Spring Boot 3 con Java 21 y Maven en `backend/`.
- PostgreSQL 16 en Docker para desarrollo; proyecto de Supabase para producción.
- Migraciones Flyway de las cuatro tablas, índices y seguridad de fila (ver B2).
- Entidades JPA y repositorios.
- **Aceptación:** `mvn spring-boot:run` arranca contra el PostgreSQL local y aplica las migraciones.

### B2 · Autenticación con Supabase (1,5 h)

- Spring Security como resource server OAuth2: valida el JWT con el JWKS de Supabase, el emisor y la
  audiencia `authenticated`. El mismo decodificador valida el JWT del mensaje `hello` y del `auth` del
  WebSocket.
- **Seguridad de fila (RLS):** Supabase expone las tablas de `public` en su propia API REST con la clave
  pública del proyecto. Se activa RLS en las cuatro tablas sin políticas, de modo que esa vía queda
  cerrada. Spring Boot se conecta con un rol de servidor que no está sujeto a RLS.
- Secretos en variables de entorno, nunca en el repositorio.
- **Aceptación:** sin token, 401; sin ser miembro, 404; una consulta a `/rest/v1/diagrams` con la clave
  pública de Supabase no devuelve filas.

### B3 · API REST (2,5 h)

- Los endpoints de la sección 4 con DTOs, Bean Validation y errores `application/problem+json`.
- Invitaciones con token aleatorio de 32 bytes, rol y caducidad de 7 días.
- OpenAPI con springdoc y Swagger UI en `/docs`.
- **Aceptación:** los endpoints funcionan desde Swagger UI con un token de prueba.

### B4 · Servidor de colaboración (3,5 h)

- `WebSocketHandler` de Spring con el protocolo de la sección 4.
- Una sala por diagrama abierto, en memoria. Las operaciones de cada sala se procesan de una en una
  (una cola por sala), así que no hay carreras entre ellas.
- Validación de cada operación: esquema, tamaño (etiquetas de 200 caracteres como máximo, 500 nodos por
  diagrama), rol de editor y existencia de los elementos referenciados.
- La operación se guarda antes de confirmarla y reenviarla.
- Presencia al entrar y salir.
- Cierra la conexión si el JWT caduca sin renovarse.
- **Aceptación:** dos clientes de prueba conectados al mismo diagrama reciben las operaciones del otro
  en orden, y un lector recibe `error` al enviar una.

### B5 · Persistencia de operaciones y reconexión (2 h)

- Registro en `diagram_ops`; instantánea en `diagrams.content` cada 50 operaciones y al vaciarse la sala.
- Al abrir una sala, el estado se reconstruye desde la última instantánea y las operaciones posteriores.
- En `hello`, si el cliente trae un número de secuencia, recibe solo las operaciones que le faltan; si
  está demasiado atrasado, una instantánea.
- **Aceptación:** reiniciar el servidor no pierde nada confirmado; un cliente que pierde la red 30 s
  recupera los cambios al reconectar.

### B6 · Tests del backend (2,5 h)

- MockMvc con tokens simulados (`spring-security-test`) para la API.
- Testcontainers (PostgreSQL real) para migraciones y repositorios.
- Tests de `apply` en Java con las fixtures compartidas de F3.
- **Test de convergencia:** varios clientes WebSocket envían operaciones concurrentes sobre los mismos
  elementos; al final todos tienen el mismo estado que el servidor.
- **Aceptación:** `mvn verify` en verde.

### F4 · Cliente colaborativo (2,5 h)

- `collab.js`: conexión, `hello`, cola de operaciones pendientes, aplicación de operaciones remotas y
  reconciliación con las confirmaciones.
- Reconexión automática con espera creciente; renovación del JWT con supabase-js.
- Modo solo lectura para lectores.
- **Aceptación:** criterios de terminado 1, 2 y 3 de la sección 2.

### F5 · Login, lista, invitaciones y presencia (2,5 h)

- Registro, inicio y cierre de sesión con supabase-js.
- Panel "Mis diagramas" con los propios y los compartidos, y el rol de cada uno.
- Botón "Invitar" que crea y copia un enlace de editor o de lector; abrir un enlace de invitación la
  acepta tras iniciar sesión.
- Avatares con iniciales y color de los usuarios conectados.
- **Aceptación:** criterios de terminado 4 y 5 de la sección 2.

### D1 · Despliegue (1,5 h)

- `Dockerfile` multi-etapa que compila con Maven y ejecuta el JAR, que incluye el frontend.
- Servicio de contenedores con plan gratuito y soporte de WebSocket (Render, Railway o Fly.io, a decidir
  en la sesión).
- **Aceptación:** dos dispositivos colaboran a través de la URL pública.

### P1 · Configuración de Claude Code (0,5 h, repartido)

- **`CLAUDE.md`:** se actualiza al cerrar cada bloque: estructura `frontend/`, `backend/` y `shared/`,
  cómo arrancar cada parte y cómo ejecutar sus tests.
- **Skill `run-trazo-mermaid`:** se versiona y se amplía para abrir dos navegadores contra el mismo
  diagrama y comprobar que convergen.
- **Hook:** ejecuta `node --test` si Claude ha modificado `.js`, y `mvn test` si ha modificado `.java`.

### P2 · Documentación de entrega (3 h, repartido)

- **Bitácora (`docs/bitacora.md`):** una entrada por sesión con los prompts literales.
- **`prompts.md`:** un máximo de 3 prompts por sección, con el formato del ejemplo, y las conversaciones
  completas adjuntas.
- **Secciones de la plantilla:**
  - **0. Ficha:** 0.4, la URL del despliegue; 0.5, la del repositorio.
  - **1. Producto:** 1.3 con capturas de dos dispositivos editando el mismo diagrama, la invitación y
    la lista.
  - **2. Arquitectura:** la sección 4 de este documento, más despliegue (2.4), seguridad (2.5: JWT,
    RLS, permisos por operación, XSS, secretos) y tests (2.6, con el de convergencia).
  - **3. Modelo de datos:** las cuatro tablas en Mermaid `erDiagram` con PK y FK.
  - **4. API:** OpenAPI de `GET /api/diagrams`, `POST /api/diagrams/{id}/invites` y
    `POST /api/invites/{token}/accept`, más el protocolo WebSocket.
  - **5. Historias de usuario:** dibujar juntos en tiempo real, invitar a un diagrama y recuperar el
    trabajo tras un corte.
  - **6. Tickets:** backend (B4, servidor de colaboración), frontend (F4, cliente colaborativo) y base
    de datos (B1 y B5, esquema y registro de operaciones).
  - **7. Pull requests:** 3 documentadas; cada bloque entra por PR.

## 6. Plan de sesiones

Unas 13 sesiones de 2–3 h. Primero se consigue que dos dispositivos colaboren a través de la URL pública;
después se completan persistencia, invitaciones y tests.

| Sesión | Trabajo | Acumulado |
|---|---|---:|
| 1 | F1 modularizar, más P1 (versionar la skill) | 3,5 h |
| 2 | F2 modelo de operaciones | 6,5 h |
| 3 | F3 tests del frontend y fixtures compartidas | 8,5 h |
| 4 | B1 backend, PostgreSQL local, Supabase y migraciones | 11,5 h |
| 5 | B2 autenticación y B3 API REST | 15,5 h |
| 6 | B4 servidor de colaboración | 19 h |
| 7 | F4 cliente colaborativo y el login de F5 | 22,5 h |
| 8 | D1 despliegue y prueba con dos dispositivos | 24 h |
| 9 | B5 persistencia de operaciones y reconexión | 26 h |
| 10 | Resto de F5: lista, invitaciones y presencia | 27,5 h |
| 11 | B6 tests del backend | 30 h |
| 12–13 | P2 capturas, secciones, `prompts.md` y PR documentadas | 33 h |

La bitácora se escribe al final de cada sesión (unos 5 minutos, contados en P2).

**Punto de control tras la sesión 8.** Dos dispositivos ya colaboran a través de la URL pública. Si las
horas acumuladas superan 25, o si el límite de 30 horas resulta ser estricto, se recorta en este orden:

1. Presencia (−1 h).
2. Reconexión: al volver, siempre se recarga la instantánea completa (−0,5 h).
3. Invitaciones: solo como editor, sin rol de lector (−0,5 h).
4. Tests de reconocedor limitados a los fixtures existentes, sin grabar nuevos (−1 h).

Con los cuatro recortes, el total queda en 30 h.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Las dos implementaciones de `apply` (JS y Java) divergen y los clientes dejan de converger | Fixtures de operaciones compartidas que ejecutan ambos lados; test de convergencia en B6 |
| Errores de concurrencia en el servidor | Una cola por sala: las operaciones de un diagrama nunca se procesan en paralelo |
| El plan gratuito del hosting duerme el servicio y corta los WebSocket | Reconexión automática con recuperación de operaciones (B5, F4); abrir la app antes de una demo |
| El plan gratuito de Supabase pausa el proyecto tras una semana sin actividad | Reactivarlo y comprobar la URL justo antes de entregar |
| El JWT caduca durante una sesión larga de dibujo | Renovación con supabase-js y mensaje `auth`; el servidor cierra la conexión si caduca |
| La API REST de Supabase expone las tablas | RLS activado sin políticas y test de aceptación en B2 |
| Varias instancias del servidor romperían las salas en memoria | Fuera de alcance: se despliega una sola instancia y se documenta |
| El presupuesto supera las 30 h de referencia | Recortes ya decididos en el punto de control tras la sesión 8 |

## 8. Decisiones

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Colaboración en tiempo real en lugar de clases UML | Solo persistencia (v0.4); compartir sin tiempo real | Da al backend un papel real (autoridad, permisos, orden, persistencia) y diferencia el producto |
| Operaciones sobre el grafo con servidor autoritativo y *last-writer-wins* por campo | CRDT (Yjs); transformación operacional | El modelo es un grafo con campos discretos, no texto largo; basta con ordenar y resolver por campo. Yjs está pensado para servidores en JavaScript |
| WebSocket propio en Spring Boot | Supabase Realtime; STOMP | Supabase Realtime dejaría el backend casi vacío. Un protocolo JSON propio es más simple de documentar que STOMP |
| Supabase Auth y PostgreSQL de Supabase | Login propio en Spring | Registro, sesiones y contraseñas resueltos; la API solo valida el JWT |
| El reconocimiento sigue en el navegador | — | Principio central del producto, y ahora reduce la colaboración a mensajes pequeños y sin ambigüedad |
| Un solo despliegue para frontend, API y WebSocket | Frontend en GitHub Pages | Una URL para la ficha (0.4), sin CORS |

**Pendiente de decidir en la sesión 8:** el servicio de despliegue (Render, Railway o Fly.io), según sus
planes gratuitos y su soporte de WebSocket en ese momento.
