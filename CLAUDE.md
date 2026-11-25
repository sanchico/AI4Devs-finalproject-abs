# pen2mermaid

Nombre del producto: **pen2mermaid** (dominio previsto `pen2mermaid.app`); lema en la interfaz:
"Dibuja a mano, colabora y obtén Mermaid". Antes se llamaba "Trazo a Mermaid"; la carpeta local
y la skill `run-trazo-mermaid` conservan el nombre antiguo. El repositorio remoto en GitHub se llama
`AI4Devs-finalproject-abs` (requisito del curso).

Webapp para dibujar diagramas con lápiz (S Pen en tablet Android) y convertirlos en tiempo real
en un grafo de nodos y conexiones, generando código Mermaid al vuelo.

PRD de la entrega: `docs/PRD-MVP.md` (v0.7, backend en Supabase). `docs/PRD-backend-java.md` (la v0.6,
con Spring Boot) es una posible mejora para después de la entrega.

## Principios de diseño
- **Reconocimiento local y determinista**, sin IA por trazo: rápido, gratis y estable.
- **El tipo de diagrama restringe las formas**: el usuario elige "Flujo", "Estados UML"... y el
  reconocedor solo clasifica entre las formas de ese tipo.
- **Modelo de grafo, no de dibujo**: los conectores son aristas entre nodos. El Mermaid se genera
  recorriendo el grafo; no hace falta IA para eso.
- La IA (API de visión) queda para funciones opcionales: limpiar trazos ambiguos, importar fotos de bocetos.

## Estado actual
Prototipo en módulos ES nativos (carpeta `frontend/`), sin build ni dependencias salvo mermaid.js por CDN.
Los cinco primeros módulos son puros (no tocan el DOM) y se pueden importar desde Node:
- `grabacion.js`: estado del modo de grabación `?grabar` (muestras de trazos por forma y formato del JSON que se descarga). Con `?grabar` la app guarda cada trazo como muestra de la forma elegida en vez de reconocerlo; las muestras del S Pen están en `frontend/test/fixtures/trazos/`.
- `geometry.js`: funciones geométricas (`dist`, `bbox`, `polyArea`, `borderPoint`…).
- `recognizer.js`: `recognize(pts, allowedShapes)` clasifica un trazo cerrado por dos métricas (área
  relativa a la caja y distancia media a las esquinas) → rect / rombo / elipse. Un trazo abierto entre
  dos nodos = conector.
- `kinds/`: `KINDS` (formas permitidas y sintaxis Mermaid de cada tipo: `flow.js`, `state.js`) y
  `mermaidCode(graph, kind, dir)`, que genera el código recorriendo el grafo; nombra los nodos `n1`, `n2`…
  por posición, no por su id.
- `ops.js`: todo cambio del diagrama es una operación JSON (`addNode`, `updateNode`, `removeNode`,
  `addEdge`, `updateEdge`, `removeEdge`, `setMeta` con dirección o `title`; el título se valida
  —texto de 1 a 200 caracteres, no solo espacios— pero se guarda sin transformar y no sale en el
  Mermaid). El tipo de diagrama se fija al crear: un `setMeta` con `kind` se rechaza. Las etiquetas de
  nodos y conectores son texto de 200 caracteres como máximo (vacío vale). Una operación sin el objeto o los
  identificadores de texto que necesita (`node`, `edge`, `id`, `set`) se rechaza como `invalid` en vez de lanzar:
  un registro con una operación así no puede hacer caer a un cliente. `apply(state, op)` la aplica o la rechaza con un motivo
  sin cambiar nada; `inverse(state, op)` calcula cómo deshacerla; `newId()` da UUID v4 (con alternativa a
  `crypto.randomUUID`, que no existe en `http://<ip>` de la tablet). Es lo que F4 enviará por la red.
- `model.js`: estado del diagrama (`state`: `kind`, `dir`, `title` —"Diagrama sin título" al empezar—,
  `nodes`, `edges`) y sus gestos (`addNode`, `addEdge`, `setLabel`, `moveNode`,
  `clear`…), que construyen operaciones y las pasan por `perform`. `newDiagram(kind)` empieza un diagrama
  vacío del tipo dado (lo que hace el selector de tipo, que pide confirmación si hay nodos) y vacía el historial. Deshacer saca de una pila de 60 grupos
  de inversas, solo con los cambios propios; `applyRemote(op)` aplica una ajena sin apilarla. Ganchos de la colaboración (apagados por defecto: en solitario
  no cambia nada): `onChange(fn)` pasa a la cola lo que aplica cada gesto, `undo()` devuelve las inversas aplicadas y las
  envía como un gesto, `setDir` se envía sin entrar en la pila, `setReadOnly(motivo)` rechaza los gestos con
  `{ok: false, reason: 'readonly'}` y `replaceState(estado)` vuelca el diagrama visible sin tocar la pila. Devuelve
  resultados en vez de mostrar avisos.
- `collab.js` (puro, F4): `createCollab({transport, onVisible, onMode, onNotice, wait})` mantiene el diagrama
  **confirmado** (el registro aplicado en orden de secuencia) y los grupos **pendientes**, y lo que se ve es siempre
  confirmado + pendiente (gana el último del orden del servidor). El transporte se inyecta con tres funciones
  (`subscribe`, `load`, `send`): el adaptador de supabase-js es del change siguiente. `open()` suscribe, guarda lo que
  llegue, carga y aplica el registro; `local(ops)` envía cada gesto como un grupo, en orden y de uno en uno (tramos de
  500), con `op_id` por operación. 422/409 descartan el grupo; 403/404/410 descartan todo y dejan solo lectura; sin
  respuesta se reintenta 3 veces con los mismos `op_id`; un hueco o un cierre del canal dejan sin conexión.
  `open()` devuelve también el error del transporte (con su `status`) si no se puede abrir.
- App compartida (F4 y el login mínimo de F5): la dirección `#/d/<uuid>` abre un diagrama compartido; **sin ruta la app
  es la de siempre** (ejemplo, un solo usuario, sin sesión ni red). `ruta.js` (puro) interpreta el hash (`solitario`,
  `diagrama` o `invalida`; cambiarlo recarga la página); `avisos.js` (puro) reúne los textos de rechazos, modos y errores
  de apertura; `transporte-supabase.js` (sin DOM, con el cliente de supabase-js inyectado) cumple el transporte de
  `collab.js`: `subscribe` espera el mensaje `system` de Postgres Changes con estado `ok`, `load` lee el registro **de
  1 000 en 1 000** (la API limita cada respuesta a 1 000 filas) y `send` llama a `apply_ops`; `colaboracion.js` (el único
  con DOM) pide sesión con correo y contraseña, abre el diagrama, enlaza el modelo con la cola, pinta el indicador de modo
  y bloquea la barra y el lienzo cuando no se puede editar. `config.js` lleva la URL y la clave pública del remoto (la
  barrera es la RLS); supabase-js 2.119.0 va por CDN con integridad (la UMD, que define `window.supabase`).
  `input.js` recibe `locked()`, comprueba el resultado de cada gesto y lee la posición final de un nodo arrastrado por su id.
- Gestión de diagramas (resto de F5, change `gestion-diagramas-minima`): `ruta.js` reconoce también `#/lista` (los
  diagramas del usuario) y `#/i/<64 hex>` (aceptar una invitación; otro token es `invalida`); las dos piden sesión, y sin
  ruta o con una desconocida la app sigue sin sesión ni red. `llevaSesion(hash)` (también en `ruta.js`) detecta el
  fragmento `#access_token=…&refresh_token=…` con el que vuelve el enlace de confirmación del correo, y `main.js` lo borra
  de la dirección con `history.replaceState` al arrancar (la app no usa esa sesión: el invitado entra con su contraseña).
  `gestion-supabase.js` (sin DOM, cliente inyectado; lo prueba
  `gestion-supabase.test.js` con el cliente falso, que ahora admite `is()`) hace `listarDiagramas` (los no borrados, por
  `updated_at` descendente; la RLS filtra los del miembro), `crearDiagrama`, `crearInvitacion` (siempre como editor) y
  `aceptarInvitacion`; sus errores llevan `status` y el que no lo lleva es una conexión perdida. `lista.js` (con DOM) pinta
  la lista con `textContent` y el botón «Nuevo» (desactivado mientras crea); «Compartir» copia el enlace
  `<origen>#/i/<token>` (si no hay portapapeles, lo muestra) y solo el dueño puede (403 → «Solo el dueño puede invitar»);
  aceptar entra con `location.replace` a `#/d/<id>`. Los textos están en `avisos.js` (`textoGestion`). Cada fila de la lista abre, «Renombrar»
  (`prompt()`; se guarda como `setMeta` con `apply_op`, el cliente valida 1 a 200 unidades UTF-16 y no solo blancos, y un
  editor también puede) y «Borrar» (`confirm()`; `delete_diagram`, borrado lógico, solo el dueño). **Recortado con
  tope de 2,5 h (decisión de la sesión 11):** `set_member_role` y la lista de miembros no tienen interfaz; el backend
  los soporta y está probado, y tampoco hay botón de restaurar. En el remoto Auth exige confirmar el correo: la «Site URL» de Auth debe ser la de la app
  desplegada (D1).
- `render.js` (lienzo, vista previa Mermaid, leyenda), `input.js` (Pointer Events: `pen` dibuja, `touch`
  mueve, ratón configurable; toque = editar etiqueta) y `main.js` (arranque, barra de herramientas, aviso).
- `test/`: `baseline.test.js` fija el código Mermaid del ejemplo y la clasificación de trazos sintéticos;
  `escape.test.js` comprueba que `<`, `>`, `&` y `|` de las etiquetas salen como entidades de Mermaid;
  `direccion.test.js` fija la dirección de la cabecera (Estados escribe `TB` donde el modelo guarda `TD`);
  `ops.test.js` cubre las operaciones (rechazos, serialización, determinismo), deshacer y los ids del código.
  `fixtures.test.js` ejecuta las secuencias de operaciones de `test/fixtures/ops/*.json` (cada operación con su resultado y el diagrama final);
  `convergencia.test.js` prueba con `helpers/red-simulada.js` (servidor que numera y clientes con operaciones pendientes, semilla fija) que todos acaban con el mismo grafo y Mermaid;
  `collab.test.js` prueba `collab.js` con `helpers/transporte-simulado.js` (servidor con la semántica de `apply_ops` y entregas y respuestas bajo el control del test; lo prueba `transporte-simulado.test.js`): apertura sin perder operaciones, conciliación, cola, rechazos, reintentos y la convergencia de tres clientes con gestos aleatorios (semillas 1 a 50);
  `modelo-colaborativo.test.js` fija los ganchos del modelo y `enlace-modelo.test.js` el enlace del modelo real con la cola; `ruta.test.js` y `avisos.test.js` las rutas y los textos; `transporte-supabase.test.js` el adaptador con un cliente falso (`helpers/supabase-falso.js`, que reproduce el tope de 1 000 filas por respuesta);
  `mermaid-tipos.test.js` fija el código completo de un diagrama de Flujo y uno de Estados;
  `grabacion.test.js` prueba el estado de la grabación y `reconocedor.test.js` exige ≥ 90 % por forma y tipo de diagrama con los trazos del S Pen, en cada archivo de `fixtures/trazos/` y en el conjunto; `abiertos.test.js` fija que una línea, una "L", una "U" y un arco siguen siendo trazos abiertos (conectores).
- `supabase/` (backend, bloques S1 y S2): `config.toml`, `migrations/` y `tests/*.test.js` con `node --test` y
  supabase-js contra el Supabase local; `tests/helpers/entorno.js` lee las claves de `supabase status` y da
  `admin()`, `anonimo()`, `usuario()` y `sql`, y `helpers/datos.js` prepara datos (`escenario()` siembra con la clave
  de servicio; `equipo()` crea el diagrama con `create_diagram`, que es lo que hay que usar para probar escrituras).
  Ninguna escritura directa en las tablas: solo estas funciones, `security definer` con `search_path` vacío y
  ejecutables solo por `authenticated` (parámetros con prefijo `p_`): `create_diagram(p_kind)`, `delete_diagram` y
  `restore_diagram` (solo el dueño, idempotentes), `create_invite` y `accept_invite` (el enlace se puede reutilizar
  hasta que caduque y aceptar no cambia el rol de un miembro) y `apply_op(p_diagram_id, p_op_id, p_op)`, que
  devuelve la secuencia. `apply_op` comprueba el rol y la forma de la operación, bloquea la fila del diagrama
  (`FOR UPDATE`), devuelve la secuencia ya guardada si el `op_id` se repite, aplica el tope de 5 000 y copia el
  título y la dirección de `setMeta` a `diagrams`; no interpreta el grafo.
  `apply_ops(p_diagram_id, p_ops)` guarda un gesto entero (`[{op_id, op}, …]`, de 1 a 500 operaciones) en una llamada:
  una transacción y un bloqueo, secuencias contiguas, una fila por operación y la respuesta es el array de secuencias.
  Se rechaza entero si una operación no es válida, el reintento es por `op_id` (solo las operaciones nuevas copian
  título y dirección y cuentan para el tope de 5 000). `apply_op` y `apply_ops` llaman a `write_ops`, interna y sin
  grant (`tests/apply-ops.test.js`). `validate_op` usa las reglas de
  `ops.js` (longitud en UTF-16, blancos de `trim`). Cada rechazo es un `RAISE` con SQLSTATE `PT<estado>` y una clave
  en `message` (404 `not_found` o `invite_invalid`, 403 `forbidden`, 410 `diagram_deleted`, 422 `invalid_op`, 409
  `op_limit`), que PostgREST devuelve como ese estado HTTP; las auxiliares (`raise_api_error`,
  `diagram_role_or_fail`, `validate_op`…) no se exponen. `fixtures-ops.test.js` envía al servidor las fixtures de
  `frontend/test/fixtures/ops/` y exige que acepte lo que el cliente acepta o descarta por el grafo y rechace lo
  que el cliente rechaza por su forma. Borrar un diagrama lo marca con `deleted_at` y solo lo ve su dueño.
  `scripts/medir-latencia.js` (change `medir-latencia`) mide cuánto tarda una operación de `apply_op` en llegar
  por Realtime a otro miembro: dos usuarios en un proceso, 100 operaciones sueltas y una ráfaga de 30, con
  p50, p95 y máximo (`--json` para la salida en JSON). Usa la clave pública y la sesión de cada usuario,
  nunca la de servicio. Sus cálculos están en `scripts/medida.js` y los prueba `tests/medida.test.js`, sin Supabase.
  Lee el entorno de `supabase/.env.local` o `supabase/.env.remoto` (fuera de git; plantilla en `supabase/.env.ejemplo`).
- La vista previa se renderiza con `securityLevel: 'strict'` y el error de Mermaid se muestra con
  `textContent`: una etiqueta nunca debe poder inyectar HTML.

## Cómo ejecutarlo
Los módulos ES no cargan desde `file://`: hay que servir la carpeta `frontend/` por HTTP:
`npx -y http-server -p 8000 -s -c-1 frontend` y abrir `http://localhost:8000`
(para probar en la tablet, abrir `http://<ip-del-pc>:8000` en la misma red).

Tests (Node ≥ 22, sin instalar nada): `node --test "frontend/**/*.test.js"`.
Prueba en el navegador real con la skill `run-trazo-mermaid`.

Tests del backend (hace falta Docker en marcha; el frontend no instala nada, esto sí): `npm install`,
`npx supabase start` (la primera vez descarga imágenes) y `npm run test:backend`. `npx supabase db reset`
vuelve a aplicar las migraciones desde cero y `npx supabase stop` apaga el entorno. Los tests apuntan solo al
entorno local. El CI (`.github/workflows/ci.yml`) ejecuta los tests del frontend y los del backend en cada PR contra
`develop` y en cada push a `develop`, con un job por conjunto: `npm ci`, `npx supabase start -x …` (sin Storage,
Studio ni los demás servicios que los tests no usan) y `npm run test:backend`. No usa secretos y es informativo: no
bloquea la publicación.

Proyecto remoto (adelantado de D1 a la sesión 9): se enlaza con `npx supabase login` y
`npx supabase link --project-ref <ref>`, y las migraciones se suben con `npx supabase db push`. La contraseña de la
base de datos no se guarda en el repositorio.

Medir la latencia: copiar `supabase/.env.ejemplo` como `supabase/.env.local` o `supabase/.env.remoto` y
rellenarlo. En local, `node --env-file=supabase/.env.local supabase/scripts/medir-latencia.js` (registra los
usuarios si no existen). En remoto, `npm run medir:latencia` (los dos usuarios se crean antes en el panel con
"Auto confirm").

Probar la colaboración (escribe en el proyecto remoto con los usuarios A y B de la medida): `npm run preparar:diagrama`
crea un diagrama, lo comparte con B y escribe el enlace `http://localhost:8000/#/d/<id>` (`-- --rol viewer`, `-- --tipo state`,
`-- --url http://<ip>:8000` para la tablet y `-- --borrar <id>` para borrarlo). Con `frontend/` servido, se abre ese enlace
en dos navegadores (dos usuarios) o se ejecuta `driver-colaborativo.cjs` de la skill `run-trazo-mermaid`, que lo recorre
con dos contextos de Playwright.

## Despliegue
URL pública: `https://sanchico.github.io/AI4Devs-finalproject-abs/` (GitHub Pages, sin dominio propio). La publica
`.github/workflows/pages.yml` en cada push a `develop` (o a mano con «Run workflow»): primero
`node --test "frontend/**/*.test.js"` y, solo si pasa, sube `frontend/` sin `frontend/test/`. Al entregar, el
disparador pasa de `develop` a `main`.

Pasos manuales (el agente no puede hacerlos: no hay claves de administración en el repositorio):
- GitHub: Settings → Pages → Source «GitHub Actions», y Settings → Environments → `github-pages` → permitir la rama
  `develop` (si solo admite la rama por defecto, el despliegue falla por la protección del entorno).
- Supabase: Authentication → URL Configuration → «Site URL» `https://sanchico.github.io/AI4Devs-finalproject-abs/`
  (con la barra final) y, en las redirecciones, esa misma URL y `http://localhost:8000/`. `signUp` no pasa
  `emailRedirectTo`, así que el enlace de confirmación del correo vuelve a la «Site URL».

La app funciona bajo el subdirectorio porque no hay rutas absolutas y los enlaces salen de `location.pathname`. La
caché de Pages es de 10 minutos: justo después de publicar, recargar sin caché si algo no cuadra.

## Hoja de ruta (ideas, por orden aproximado)
1. ~~Separar `app.js` en módulos ES~~ (hecho en el cambio `modularizar-frontend`).
2. Tests del reconocedor con trazos grabados (fixtures JSON) y de la generación Mermaid.
3. Mejorar el reconocedor (p. ej. $P recognizer) y añadir formas: flechas de herencia/agregación UML.
4. Nuevos tipos: diagrama de clases UML, secuencia, ER.
5. Pan/zoom del lienzo, autolayout opcional, guardado/carga (JSON y Mermaid).
6. Reconocimiento de escritura a mano para etiquetas (ML Kit Digital Ink si se empaqueta como app Android).

## Convenciones
- Interfaz y textos en español.
- Mantener la app usable sin build (HTML + módulos ES nativos) mientras sea posible.
- Commits pequeños y descriptivos, en español, con formato conventional commits
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`…), p. ej. `docs: añade la sesión 2 a la bitácora`.
- Al terminar cada sesión de trabajo se escribe su entrada en `docs/bitacora.md` con la skill
  `/cerrar-sesion`.
- Una rama y una PR contra `develop` por bloque del PRD (F3, S1, S2…), p. ej. `feat/f2-modelo-de-operaciones`.
  Los changes de OpenSpec de un bloque van en esa rama uno tras otro: cada uno se aplica y se archiva
  antes de proponer o rebasar el siguiente, porque el archivado reescribe `openspec/specs/` y el delta
  siguiente se escribe contra ese estado. Solo un arreglo urgente va en una rama y una PR aparte.

# TDD Policy
- Always follow Red → Green → Refactor.
- Write the simplest failing test first.
- Never delete or disable failing tests to make the suite pass.
- Implement the minimum code needed. Refactor only when green.