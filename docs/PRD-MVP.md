# PRD · MVP de Trazo a Mermaid en 30 horas

| | |
|---|---|
| Estado | Borrador para revisión |
| Versión | 0.4 · 30 sep 2026 (backend con Spring Boot y Supabase) |
| Base | commit `5ea5e8a` (prototipo de flujo y estados) |
| Presupuesto | 30 horas, una persona con Claude Code |
| Calendario | Más de un mes, en sesiones de 2–3 h |
| Propósito | Entrega de curso; se evalúa el uso del agente de IA en el proceso |

## 1. Resumen

El prototipo reconoce rectángulos, rombos, elipses y conectores dibujados con lápiz y genera Mermaid para
dos tipos de diagrama, todo en el navegador y sin guardar nada. El MVP lo convierte en una **aplicación
completa**:

- **Frontend:** el lienzo actual, modularizado, con tests del reconocedor y un tipo nuevo, **clases UML**.
- **Backend:** API REST en **Spring Boot** que guarda los diagramas de cada usuario en **PostgreSQL**.
- **Usuarios:** registro e inicio de sesión con **Supabase Auth**. La API valida el token de Supabase y
  solo devuelve los diagramas de su dueño.

El reconocimiento de trazos sigue en el navegador. Es el principio central del producto: tiene que ser
instantáneo y funcionar sin red. El backend solo guarda y sirve diagramas. Se puede dibujar sin haber
iniciado sesión; guardar y abrir diagramas requiere cuenta.

Es un recorte del PRD completo, que cubre los 22 tipos de Mermaid. Como el curso evalúa el uso del agente,
**el proceso de trabajo con Claude Code es un entregable más** (bloques B8 y B9). El formato de entrega
sigue la plantilla del [proyecto de ejemplo del curso](https://github.com/LIDR-academy/AI4Devs-finalproject-Example1/),
y con backend y base de datos sus secciones 3, 4 y 6 encajan sin adaptaciones (ver sección 8).

## 2. Criterios de terminado

El MVP está terminado cuando se cumple todo esto:

1. Flujo, estados y clases UML generan código que renderiza sin error en la vista previa (Mermaid 10.9.1).
2. Un diagrama de 5 clases con herencia, composición y asociación se dibuja con lápiz, usando el teclado
   solo para textos.
3. Un usuario se registra, inicia sesión, guarda un diagrama, lo ve en su lista desde otro dispositivo y
   lo sigue editando.
4. Un usuario no puede leer ni modificar diagramas de otro, ni a través de la API ni a través de la API
   pública de Supabase.
5. `node --test` y `mvn verify` pasan. La precisión del reconocedor sobre los trazos grabados es ≥ 90 %
   por forma.
6. La app está desplegada en una URL pública y funciona en la tablet.
7. Las etiquetas y los diagramas guardados no pueden inyectar HTML en la vista previa.
8. La ficha y las secciones 1–7 del curso y `prompts.md` están completas, con capturas y
   3 pull requests documentadas.
9. El total de horas registradas es ≤ 30.

## 3. Fuera de alcance

- Entidad-relación, mapa mental, secuencia y el resto de tipos del PRD completo.
- Pan y zoom con gestos: solo hay botones de zoom y "Encajar".
- Guardado sin conexión en el navegador. Sin red se puede dibujar y copiar el código, pero no guardar.
- Compartir diagramas entre usuarios.
- Importar código Mermaid al lienzo, escritura a mano, autolayout e IA de visión.
- Subir a Mermaid 11. Los tipos del MVP ya existen en 10.9.1.
- CI con GitHub Actions: los tests se ejecutan en local y con el hook de B8.
- Vídeo tutorial. La plantilla pide "imágenes y/o videotutorial"; se entregan capturas.

## 4. Arquitectura

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | HTML y JS en módulos ES, sin build; mermaid.js y supabase-js por CDN | Dibujo, reconocimiento, generación de Mermaid, login, lista de diagramas |
| Autenticación | Supabase Auth (email y contraseña) | Registro, sesión, contraseñas; emite el JWT |
| Backend | Java 21, Spring Boot 3, Spring Security (resource server), Spring Data JPA, Flyway, springdoc-openapi | Valida el JWT, aplica la propiedad de cada diagrama, guarda y sirve diagramas |
| Base de datos | PostgreSQL de Supabase; PostgreSQL en Docker para desarrollo y tests | Tabla `diagrams` |
| Despliegue | Un contenedor con Spring Boot que sirve también el frontend estático | Una sola URL, sin CORS |

**Flujo:** el frontend inicia sesión con supabase-js y recibe un token de acceso. Lo envía en cada llamada
como `Authorization: Bearer`. Spring Boot valida la firma con las claves públicas del proyecto de Supabase
(JWKS) y usa el `sub` del token como dueño del diagrama.

**Estructura del repositorio:** `frontend/` (el código actual, sin build) y `backend/` (proyecto Maven).
Maven copia `frontend/` como recursos estáticos al empaquetar. El principio de "usable sin build" pasa a
aplicarse solo al frontend, que se puede seguir probando solo con `python -m http.server`.

### Modelo de datos

Tabla `diagrams`, en el esquema `public`:

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, generado |
| `owner_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `title` | `text` | NOT NULL, 1–120 caracteres |
| `kind` | `text` | NOT NULL, `flow` \| `state` \| `class` |
| `direction` | `text` | NOT NULL, `TD` \| `LR` |
| `content` | `jsonb` | NOT NULL; nodos y aristas (`{version, nodes, edges}`) |
| `mermaid` | `text` | Código generado en el cliente, para la vista previa de la lista |
| `version` | `integer` | NOT NULL; bloqueo optimista (`@Version`) |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL |

Índice en `(owner_id, updated_at DESC)` para la lista. Los usuarios viven en `auth.users`, gestionada por
Supabase. En los tests con Testcontainers, una migración solo de test crea una tabla `auth.users` mínima.

### API

| Método y ruta | Uso |
|---|---|
| `GET /api/diagrams` | Lista los diagramas del usuario (sin `content`), ordenados por fecha |
| `POST /api/diagrams` | Crea un diagrama |
| `GET /api/diagrams/{id}` | Abre un diagrama |
| `PUT /api/diagrams/{id}` | Guarda cambios; responde 409 si la versión no coincide |
| `DELETE /api/diagrams/{id}` | Borra un diagrama |

Un diagrama de otro usuario responde 404, no 403, para no revelar que existe. El JSON de `content` se
valida en el servidor (esquema, versión, tamaño máximo de 1 MB).

## 5. Bloques de trabajo

| Bloque | Horas | Depende de |
|---|---:|---|
| B1 Modularizar el frontend | 3 | — |
| B2 Tests del reconocedor y de la generación | 2,5 | B1 |
| B3 Backend: proyecto, base de datos y modelo | 3 | — |
| B4 API de diagramas | 3 | B3 |
| B5 Autenticación con Supabase | 1,5 | B4 |
| B6 Frontend conectado: login, lista y guardado | 2,5 | B1, B5 |
| B7 Tests del backend | 2 | B4, B5 |
| B8 Despliegue | 1,5 | B6 |
| B9 Zoom con botones | 1 | B1 |
| B10 Clases UML | 6,5 | B1, B2 |
| B11 Configuración de Claude Code | 0,5 | repartido |
| B12 Documentación de entrega | 3 | repartido |
| **Total** | **30** | |

**No hay colchón.** El punto de control de la sección 6 es el único mecanismo de ajuste.

### B1 · Modularizar el frontend (3 h)

- Mover el código actual a `frontend/` y separarlo en módulos ES nativos: `geometry.js`,
  `recognizer.js`, `model.js`, `kinds/*.js`, `render.js`, `input.js`, `api.js` y `main.js`.
- `KINDS` pasa a ser un registro de tipos con un contrato común: formas, `generate(model)`, render
  específico y menú.
- La vista previa pasa de `securityLevel: 'loose'` a `'strict'`. Con diagramas guardados en un
  servidor, una etiqueta con HTML sería un XSS persistente.
- **Aceptación:** el comportamiento es idéntico al del commit base, comprobado con la skill
  `run-trazo-mermaid`. Una etiqueta `<img src=x onerror=alert(1)>` se muestra como texto.

### B2 · Tests del frontend (2,5 h)

- Test runner nativo de Node (`node --test`), sin dependencias.
- Modo de grabación (`?grabar` en la URL) que copia los trazos como JSON.
- Fixtures con al menos 10 trazos por forma (rectángulo, rombo, elipse, triángulo), dibujados con el
  S Pen.
- Tests de generación: un modelo de ejemplo por tipo y el texto Mermaid esperado.
- **Aceptación:** `node --test` en verde; precisión ≥ 90 % por forma.

### B3 · Backend: proyecto, base de datos y modelo (3 h)

- Proyecto Spring Boot 3 con Java 21 y Maven en `backend/`.
- PostgreSQL 16 en Docker (`docker compose`) para desarrollo; proyecto de Supabase para producción.
- Migraciones Flyway: tabla `diagrams`, índice y seguridad de fila (ver B5).
- Entidad JPA y repositorio.
- **Aceptación:** `mvn spring-boot:run` arranca contra el PostgreSQL local y aplica las migraciones.

### B4 · API de diagramas (3 h)

- Los cinco endpoints de la sección 4 con DTOs y validación (Bean Validation).
- Errores con formato común (`application/problem+json`).
- Documentación OpenAPI generada con springdoc y Swagger UI en `/docs`.
- **Aceptación:** los endpoints funcionan desde Swagger UI con un token de prueba.

### B5 · Autenticación con Supabase (1,5 h)

- Spring Security como resource server OAuth2: valida el JWT con el JWKS de Supabase
  (`https://<proyecto>.supabase.co/auth/v1/.well-known/jwks.json`), el emisor y la audiencia
  `authenticated`.
- El `sub` del token es el `owner_id`. Todas las consultas filtran por él.
- **Seguridad de fila (RLS):** Supabase expone las tablas de `public` a través de su propia API REST con
  la clave pública del proyecto. Se activa RLS en `diagrams` sin políticas, de modo que esa vía queda
  cerrada. Spring Boot se conecta con un rol de servidor que no está sujeto a RLS.
- Los secretos (URL y credenciales de la base de datos) van en variables de entorno, nunca en el
  repositorio.
- **Aceptación:** sin token, 401; con el token de otro usuario, 404; una consulta a
  `/rest/v1/diagrams` con la clave pública de Supabase no devuelve filas.

### B6 · Frontend conectado (2,5 h)

- supabase-js por CDN: registro, inicio y cierre de sesión con email y contraseña.
- Panel "Mis diagramas" con título, tipo, fecha y miniatura del código Mermaid; abrir, renombrar y borrar.
- Botón Guardar y autoguardado cada pocos segundos si hay cambios. Aviso si hay un conflicto de versión.
- Sin sesión se puede dibujar como ahora; al guardar se pide iniciar sesión.
- **Aceptación:** el criterio de terminado 3 de la sección 2.

### B7 · Tests del backend (2 h)

- Tests de controlador con MockMvc y tokens simulados (`spring-security-test`).
- Tests de repositorio y migraciones con Testcontainers (PostgreSQL real).
- Casos obligatorios: sin token, dueño correcto, otro usuario, conflicto de versión, JSON inválido.
- **Aceptación:** `mvn verify` en verde.

### B8 · Despliegue (1,5 h)

- `Dockerfile` multi-etapa: compila con Maven y ejecuta el JAR, que incluye el frontend.
- Servicio de contenedores con plan gratuito (Render, Railway o Fly.io, a decidir en la sesión).
  La base de datos y la autenticación ya están alojadas en Supabase.
- **Aceptación:** la URL pública carga en la tablet, permite iniciar sesión y guarda diagramas.

### B9 · Zoom con botones (1 h)

- Transformación de vista (desplazamiento y escala); el modelo guarda coordenadas de mundo.
- Botones de acercar, alejar y "Encajar". Sin gestos de dos dedos.
- **Aceptación:** dibujar, mover y editar funcionan igual a 50 % y a 200 %.

### B10 · Clases UML (6,5 h)

- **Clase:** rectángulo. El editor pasa a ser un área de texto: la primera línea es el nombre, las
  líneas con `(` son métodos y el resto son atributos. El lienzo dibuja los compartimentos.
- **Relaciones por marca dibujada en el extremo:** justo después de un conector, un trazo cerrado
  pequeño cerca de uno de sus extremos se interpreta como marca. Triángulo → herencia `<|--`.
  Rombo → composición `*--`. Sin marca → asociación `-->`.
- **Menú del conector:** agregación, dependencia y realización; cardinalidad en cada extremo; etiqueta.
- **Aceptación:** el criterio de terminado 2 de la sección 2.

### B11 · Configuración de Claude Code (0,5 h, repartido)

- **`CLAUDE.md`:** se actualiza al cerrar cada bloque. Incluye la estructura `frontend/` y `backend/`,
  cómo arrancar cada parte y cómo ejecutar sus tests.
- **Skill `run-trazo-mermaid`:** se versiona y se amplía para arrancar el backend y probar el flujo
  con sesión iniciada.
- **Hook:** ejecuta `node --test` si Claude ha modificado `.js`, y `mvn test` si ha modificado `.java`.

### B12 · Documentación de entrega (3 h, repartido)

- **Bitácora (`docs/bitacora.md`):** una entrada por sesión con prompts literales. Es la materia prima de
  `prompts.md` y el traspaso entre sesiones.
- **`prompts.md`:** un máximo de 3 prompts por sección, con el formato del ejemplo, y las
  conversaciones completas adjuntas.
- **Secciones de la plantilla:**
  - **0. Ficha:** 0.4, la URL del despliegue de B8; 0.5, la del repositorio.
  - **1. Producto:** 1.3 con capturas de flujo, estados, clases, login y lista.
  - **2. Arquitectura:** la sección 4 de este documento, más despliegue (2.4), seguridad (2.5: JWT,
    RLS, XSS, secretos) y tests (2.6).
  - **3. Modelo de datos:** la tabla `diagrams` y su relación con `auth.users`, en Mermaid `erDiagram`
    con PK y FK, como recomienda la plantilla.
  - **4. API:** OpenAPI de `GET /api/diagrams`, `POST /api/diagrams` y `PUT /api/diagrams/{id}`,
    exportado de springdoc.
  - **5. Historias de usuario:** dibujar un diagrama de clases, guardar y recuperar diagramas, y cuenta
    de usuario.
  - **6. Tickets:** uno de backend (B4 y B5), uno de frontend (B10) y uno de base de datos (B3).
  - **7. Pull requests:** 3 documentadas. Cada bloque entra por PR.

## 6. Plan de sesiones

Unas 12 sesiones de 2–3 h. Primero la base del frontend, después el backend completo y al final el tipo
nuevo. Así, si hay que recortar, el recorte cae sobre clases UML y no sobre la aplicación completa.

| Sesión | Trabajo | Acumulado |
|---|---|---:|
| 1 | B1 modularizar, más B11 (versionar la skill) | 3,5 h |
| 2 | B2 tests del frontend | 6 h |
| 3 | B3 proyecto Spring Boot, PostgreSQL local, Supabase y migraciones | 9 h |
| 4 | B4 API de diagramas y OpenAPI | 12 h |
| 5 | B5 autenticación y B7 tests del backend | 15,5 h |
| 6 | B6 frontend conectado | 18 h |
| 7 | B8 despliegue y B9 zoom con botones | 20,5 h |
| 8–10 | B10 clases UML | 27 h |
| 11 | B12 capturas, secciones, `prompts.md` y PR documentadas | 30 h |

La bitácora se escribe al final de cada sesión (unos 5 minutos, contados en B12).

**Punto de control tras la sesión 7.** La aplicación completa con flujo y estados ya es entregable. Si las
horas acumuladas superan 21,5, se recorta en este orden:

1. Zoom con botones.
2. En clases, la composición se elige por menú; solo se dibuja la herencia.
3. En clases, los compartimentos se muestran como texto en el lienzo, sin separadores dibujados.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| El plan gratuito de Supabase pausa el proyecto tras una semana sin actividad, y el evaluador encontraría la app caída | Reactivarlo y comprobar la URL justo antes de entregar; indicarlo en la ficha |
| El plan gratuito del servicio de contenedores duerme el servicio, y el primer acceso tarda | Indicarlo en el README; abrir la app antes de una demo |
| Cambios de Supabase en la firma de los JWT (claves asimétricas frente al secreto compartido) | Validar con JWKS; si el proyecto usa el secreto antiguo, cambiar a HS256 por configuración |
| La API REST de Supabase expone la tabla | RLS activado sin políticas y test de aceptación en B5 |
| Añadir Java supone un segundo lenguaje y más configuración | JDK 21, Maven y Docker ya están instalados; el hook ejecuta los tests de las dos partes |
| Las marcas pequeñas de extremo (triángulo y rombo) se confunden | Solo se evalúan cerca de un extremo y justo después del conector; menú como alternativa |
| Sin colchón, cualquier desvío retrasa la entrega | Punto de control tras la sesión 7 con recortes ya decididos |

## 8. Decisiones y encaje con la plantilla del curso

| Decisión | Motivo |
|---|---|
| Backend con Spring Boot y PostgreSQL | Hace la app completa y persistente entre dispositivos. Además, las secciones 3 (modelo de datos), 4 (API) y 6 (tickets de backend, frontend y base de datos) de la plantilla encajan sin adaptaciones |
| Login con Supabase Auth en lugar de implementarlo en Spring | Registro, sesiones y contraseñas los resuelve Supabase; la API solo valida el JWT. Ahorra unas 3,5 h |
| El reconocimiento sigue en el navegador | Principio central del producto: instantáneo y sin red |
| Un solo despliegue que sirve frontend y API | Una URL para la ficha (0.4), sin CORS ni un segundo hosting |
| Se quitan ER y mapa mental; pan y zoom queda en botones | Liberan el tiempo del backend |
| Publicar la app | La ficha pide la URL del proyecto aparte de la del repositorio |
| Capturas, no vídeo | La plantilla pide "imágenes y/o videotutorial" |

**Pendiente de decidir en la sesión 7:** el servicio de despliegue (Render, Railway o Fly.io) según sus
planes gratuitos en ese momento.
