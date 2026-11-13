# PRD alternativo · MVP de pen2mermaid con todo el backend en Supabase

| | |
|---|---|
| Estado | Propuesta. No sustituye a [PRD-MVP.md](PRD-MVP.md) (v0.6) hasta que se decida |
| Versión | Alternativa A, revisión 2 · 11 nov 2026 (alineada con la v0.6: gestión de diagramas; presencia y recuperación tras cortes pasan a la v2) |
| Base | `develop` con F1 y F2 cerrados (sesión 4 de la [bitácora](bitacora.md), más F2) |
| Presupuesto | 27,5 h en total: 8 h gastadas hasta la sesión 4, 3 h previstas de F2 (ya hecho) y 16,5 h por hacer |
| Motivo | F1 costó 5,25 h frente a 3 h previstas y la sesión 4 fue un arreglo no planificado de 2,25 h; al plan v0.6 ya no le caben sus 32 h |

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
  `removeEdge`, `setMeta`), con identificadores UUID. F2 no cambia.
- **Orden:** el cliente llama a `apply_op(diagrama, id_de_operación, operación)`. La función incrementa
  `diagrams.last_seq` con un `UPDATE`, que bloquea la fila hasta el final de la transacción. Dos
  operaciones sobre el mismo diagrama nunca se numeran a la vez: es el equivalente a la cola por sala.
- **Reparto:** la función inserta la operación en `diagram_ops`. Realtime (Postgres Changes) envía cada
  fila nueva a los clientes suscritos a ese diagrama, y la RLS de la tabla se aplica a cada suscriptor.
- **Convergencia:** todos los clientes aplican el mismo registro, en el mismo orden, con el mismo código
  `apply`. Una operación sobre un elemento que ya no existe se descarta en todos por igual. Sobre el
  mismo campo gana la última en el orden del servidor.
- **Respuesta inmediata y deshacer:** como en la v0.6. La respuesta del RPC confirma la operación propia
  con su número de secuencia; un error la revierte con su inversa y muestra el aviso.
- **Reintentos:** `(diagram_id, op_id)` es único. Si un cliente reenvía una operación, la función
  devuelve la secuencia que ya tenía en vez de duplicarla. El MVP no reenvía solo; es la base de la
  recuperación de la v2 y cuesta una restricción.
- **Cortes y huecos:** si el canal se cierra o llega una secuencia mayor que la esperada, el lienzo pasa
  a solo lectura con el aviso "Sin conexión: recarga la página". Al recargar se reproduce el registro.
  Las operaciones propias sin confirmar se pierden.
- **Título:** `apply_op` con `setMeta` lo copia a `diagrams.title`, y la lista lo lee de ahí.
- **Diagrama borrado:** el borrado elimina en cascada el registro. Quien lo tenga abierto recibe un error
  en su siguiente `apply_op`, o cero filas al recargar; el cliente muestra "Este diagrama se ha borrado"
  y vuelve a la lista.

### Modelo de datos

Cuatro tablas en `public`, relacionadas con `auth.users`:

| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `diagrams` | `id` uuid, `owner_id` uuid, `title` text, `kind` text, `direction` text, `last_seq` bigint, `created_at`, `updated_at` | PK `id`; FK `owner_id` → `auth.users`; `kind` en (`flow`, `state`) |
| `diagram_members` | `diagram_id` uuid, `user_id` uuid, `role` text, `display_name` text, `added_at` | PK (`diagram_id`, `user_id`); `role` en (`owner`, `editor`, `viewer`) |
| `diagram_invites` | `token` text, `diagram_id` uuid, `role` text, `created_by` uuid, `expires_at` | PK `token`; `role` en (`editor`, `viewer`) |
| `diagram_ops` | `diagram_id` uuid, `seq` bigint, `user_id` uuid, `op_id` uuid, `op` jsonb, `created_at` | PK (`diagram_id`, `seq`); único (`diagram_id`, `op_id`); `op` de 2 kB como máximo |

Respecto a la v0.6 desaparecen `content` y `snapshot_seq`, y se añaden `last_seq`, `op_id` y
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
| `rpc/create_diagram(title, kind)` | Crea el diagrama vacío ("Diagrama sin título", tipo flujo) y a su dueño como miembro |
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

- Carpeta `supabase/` con la CLI: `supabase start` levanta el entorno local en Docker y
  `supabase db push` aplica las migraciones al proyecto remoto.
- Migraciones SQL de las cuatro tablas, índices, `member_role` y las políticas de la sección 5.
- `diagram_ops` en la publicación `supabase_realtime`.
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
- **Diagramas:** un `setMeta` con título cambia `diagrams.title`; solo el dueño borra, y el borrado se
  lleva miembros, invitaciones y operaciones.
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
| Solución intermedia descartada | Spring Boot solo para la colaboración y PostgREST para el resto | Ahorra unas 4 h, pero conserva el contenedor, el despliegue con WebSocket y las dos implementaciones de `apply` |

## 10. Si se adopta

- Este documento pasa a ser `PRD-MVP.md` v0.7 y la v0.6 se conserva en el historial de git.
- `openspec/config.yaml` nombra hoy el servidor autoritativo en Spring Boot y la instancia única: hay que
  reescribir esas restricciones.
- `CLAUDE.md` y el readme describen `backend/` y `shared/`; pasan a `supabase/`.
- El hook previsto en P1 deja de ejecutar `mvn test`.
- F2 ya está hecho y sirve tal cual. F3 es el último bloque que no depende de esta decisión, salvo dónde
  viven las fixtures de operaciones (`shared/` o `frontend/test/`).
