# Design

## Context

`frontend/` es estático y sin build: módulos ES nativos, supabase-js y Mermaid por CDN con `integrity`, fuentes de
Google, y todas las rutas por hash (`#/d/…`, `#/lista`, `#/i/…`). No hay `.github/` ni Pages activado. El
repositorio (`sanchico/AI4Devs-finalproject-abs`) es público; la rama por defecto es `main` y las PR se fusionan en
`develop`. Los tests del frontend corren con `node --test "frontend/**/*.test.js"` (Node ≥ 22) sin instalar nada. Lo
que se espera del despliegue está en `proposal.md` y `specs/static-deployment/spec.md`.

Lo que el código ya garantiza (leído, no probado en el subdirectorio):
- el enlace de invitación sale de `location.origin + location.pathname + '#/i/' + token` (`colaboracion.js:112`);
- `main.js:14` limpia la sesión del enlace de confirmación con `history.replaceState(null, '', location.pathname + location.search)`;
- `lista.js` y la aceptación de invitaciones solo cambian el hash;
- `signUp` no pasa `emailRedirectTo`, así que el enlace del correo vuelve a la «Site URL» de Auth.

Para el CI (`specs/continuous-integration/spec.md`): los tests del backend (`supabase/tests/*.test.js`, 13
archivos, uno de ellos `realtime.test.js`) necesitan Docker y `npx supabase start`. La CLI (`supabase` 3.2.0) está
en las `devDependencies` de la raíz con `package-lock.json`, y `tests/helpers/entorno.js` lee la URL y las claves de
`supabase status -o env`, así que no hace falta ningún secreto. En `config.toml`, Auth local no pide confirmar el
correo (`enable_confirmations = false`).

## Goals / Non-Goals

**Goals:**
- Una URL pública con HTTPS que se actualiza sola al integrar en `develop` y solo si los tests del frontend pasan.
- Que no haya que tocar `frontend/` para que funcione bajo un subdirectorio; si la prueba real lo desmiente, se arregla entonces. (Lo desmintió para el correo de confirmación: decisión 8.)
- Que los pasos manuales (que el agente no puede hacer) queden escritos y comprobables.
- Que los tests del backend corran en cada PR contra `develop` sin secretos y sin bloquear la publicación.

**Non-Goals:**
- Dominio propio (`pen2mermaid.app`), cabeceras HTTP, CSP, vistas previas por PR, lint.
- Desplegar el backend desde el CI (`db push` sigue siendo manual) o ejecutar algo contra el proyecto remoto.
- Hacer obligatorio el CI para fusionar (regla de protección de rama): lo decide el PO después, fuera del change.
- Ejecutar `scripts/medir-latencia.js` en el CI: mide la red real y necesita el remoto.
- Reconexión automática de Realtime o cualquier cambio de comportamiento de la app.
- Publicar desde `main`: se cambia el disparador al entregar, fuera de este change.

## Decisions

**1. GitHub Pages con un workflow de Actions.** El flujo queda entero en el repositorio, sin cuentas ni permisos
nuevos y con los tests antes de publicar en el mismo archivo. Alternativas descartadas: *Cloudflare Pages* y
*Netlify* (permiten `_headers`, CSP y vistas previas por PR, pero la configuración vive en un panel externo, hay
que conceder una app de GitHub y los tests no gobiernan el despliegue sin más pasos); *Pages desde una rama
`gh-pages`* (obliga a un commit de artefactos en el historial); *publicar `frontend/` directamente con el origen
«Deploy from a branch»* (solo admite la raíz o `/docs`, no `frontend/`).

**2. Disparador: `push` a `develop` y `workflow_dispatch`.** El push es lo que da «se publica al integrar»; el
disparo manual permite republicar sin un commit vacío. No se dispara con `pull_request`: no hay vista previa
(fuera de alcance) y un workflow con permiso de despliegue no debe correr con código de forks. Alternativa
descartada: `main`. Obligaría a fusionar `develop → main` en cada prueba con la tablet; el disparador pasa a `main`
al entregar.

**3. Dos jobs: `test` y `deploy` con `needs: test`.** `test` usa `actions/checkout`, `actions/setup-node` con
Node 22 y ejecuta `node --test "frontend/**/*.test.js"`, sin `npm install` (la raíz tiene dependencias, pero solo
del backend y no hacen falta). `deploy` prepara `_site/` con el contenido de `frontend/` sin `test/` y lo sube con
`actions/upload-pages-artifact` y `actions/deploy-pages`. Con `needs`, un test en rojo impide el despliegue
(spec: «Solo se publica una versión que pasa los tests»). Alternativa descartada: un solo job; separar deja
permisos de escritura de Pages (`pages: write`, `id-token: write`) solo en el job que publica y los tests con
`contents: read`.

**4. Se excluye `frontend/test/` de lo publicado.** Cuesta una línea (`cp -r frontend/. _site` y `rm -rf
_site/test`), reduce el despliegue y evita servir muestras del S Pen sin necesidad. Alternativa descartada: publicar
`frontend/` entero; funciona, pero sirve tests y fixtures que nadie necesita. El `package.json` de `frontend/`
(`"type": "module"`) se queda: el navegador lo ignora.

**5. Sin Jekyll.** El artefacto de `upload-pages-artifact` se despliega tal cual; no se añade `.nojekyll`. Si en
la prueba real faltara algún archivo con guion bajo inicial, se añade entonces.

**6. `concurrency: group: pages, cancel-in-progress: false`.** Dos pushes seguidos no deben pisarse a mitad de
despliegue ni cancelar uno que ya publica. Alternativa: sin `concurrency`; arriesga dos despliegues simultáneos.

**7. Versiones de las acciones fijadas por etiqueta mayor, comprobadas al implementar.** Las de GitHub
(`actions/*`) se fijan a la mayor vigente en la sesión de apply, mirándolo en su repositorio y no de memoria.
Alternativa descartada: fijar por SHA; es más estricto pero costoso de mantener en un proyecto de curso con
acciones oficiales de GitHub. Vigentes el 26 nov 2026 (`gh api repos/actions/<nombre>/releases/latest`):
`checkout@v7` (7.0.1), `setup-node@v7` (7.1.0), `configure-pages@v6` (6.0.0), `upload-pages-artifact@v5` (5.0.0) y
`deploy-pages@v5` (5.0.1).

**8. Ajustes de Auth: «Site URL» = `https://sanchico.github.io/AI4Devs-finalproject-abs/` y redirecciones con esa
URL y `http://localhost:8000/`; `signUp` pasa `emailRedirectTo` con la dirección de la app sin `#` ni consulta.**
Antes la «Site URL» era `http://localhost:3000` (el valor por defecto de Supabase), donde no hay nada.

*Cómo elige Supabase la vuelta* (`GetReferrer` en `internal/utilities/request.go` de `supabase/auth`, leído el 26
nov): primero el `redirect_to` que manda el cliente, si es válido; si no, **la cabecera `Referer` de la petición**,
si es válida; y solo al final la «Site URL». Es válida cualquier URL con el mismo esquema y host que la «Site URL»
(el puerto da igual en `localhost`) y las de la lista de redirecciones.

*Historia de la decisión.* La primera versión no pasaba `emailRedirectTo` y daba por hecho que se volvería a la
«Site URL», con la vuelta a local en la spec. Al ver que nada la hacía posible se cambió la spec para que el enlace
llevara siempre a la app desplegada (decisión del PO, sesión 12). La prueba real (tarea 4.3) lo desmintió también:
una cuenta creada en la URL pública volvió a `https://sanchico.github.io/#access_token=…`, un 404. La petición de
`signUp` va a otro dominio y el navegador manda como `Referer` solo el origen (política por defecto
`strict-origin-when-cross-origin`); ese origen tiene el mismo host que la «Site URL», así que Supabase lo da por
bueno y se pierde el subdirectorio. El error de fondo fue suponer el comportamiento de Supabase sin leerlo.

*Decisión (PO, sesión 12): pasar `emailRedirectTo` en `signUp`* con `origin + pathname` de la página. Así gana el
primer punto del orden: desde Pages es válida por el host y desde `localhost:8000` por la lista. Se quita el `#`
(la ruta del diagrama o el token de una invitación, que es un secreto y no debe viajar por correo; además Supabase
añade su propio `#access_token=…`) y la consulta. La URL se calcula en una función pura de `ruta.js`, probada con
`node --test`, y `colaboracion.js` solo la usa. La barra final y el subdirectorio importan porque la lista
compara la URL completa. Alternativas descartadas: *solo la «Site URL», sin `emailRedirectTo`* (es lo que falló: el
`Referer` gana); *`Referrer-Policy: unsafe-url` en `index.html`* (mandaría a Supabase la ruta completa y la consulta en
todas las peticiones, y depende de un efecto secundario del navegador en vez de pedir la vuelta de forma explícita); *conservar el `#` para volver al diagrama* (sacaría el token de invitación
en el correo; volver al diagrama tras confirmar queda como mejora, ya en los pendientes).

**9. Los dos pasos manuales y su comprobación.** (a) En el repositorio: Settings → Pages → Source «GitHub
Actions»; y, en Settings → Environments → `github-pages`, permitir desplegar desde `develop` (ver riesgos).
(b) En Supabase: Authentication → URL Configuration. El agente no puede hacerlos (no hay claves de
administración en el repositorio, por diseño); los comprueba después: el workflow termina en verde, la URL
responde 200 y el correo de confirmación de una cuenta nueva apunta a la URL pública.

**10. La aceptación se prueba con el driver de la skill `run-trazo-mermaid` y a mano con la tablet.** El driver
(`driver-colaborativo.cjs`, Playwright con dos contextos) acepta una URL base: se ejecuta contra la URL pública
para el criterio de dos usuarios y se completa con la tablet y el S Pen reales, que el driver no puede cubrir.
La latencia se mide con `npm run medir:latencia`: el backend es el mismo, así que solo confirma que no empeora.

**11. El CI va en un workflow aparte, `ci.yml`, que no bloquea la publicación.** El despliegue no publica el
backend (las migraciones las sube `db push` a mano), así que hacerle esperar al backend no protege nada y añade
unos 5 minutos a cada publicación; además, un fallo de tiempos de `realtime.test.js` pararía el frontend sin motivo
(spec `continuous-integration`: «El CI no bloquea la publicación del frontend»). Alternativas descartadas: *un job
`backend` dentro de `pages.yml` con `needs`* (acopla dos cosas que se publican por caminos distintos); *el mismo
workflow sin `needs`* (un workflow con permisos de Pages no debe correr en PR, y el CI sí debe).

**12. Disparadores del CI: `pull_request` contra `develop` y `push` a `develop`.** La PR es donde un fallo sirve
(antes de fusionar); el push deja el estado de la rama tras cada fusión. `pull_request` es seguro aquí porque el
workflow no tiene secretos ni permisos de escritura (`permissions: contents: read`); no se usa
`pull_request_target`, que sí los tendría. Alternativa descartada: solo en push, que avisa cuando el fallo ya está en
`develop`.

**13. Dos jobs en el CI, `frontend` y `backend`, sin dependencia entre ellos.** Así la PR muestra un resultado por
conjunto (spec: «El resultado de cada conjunto MUST verse por separado»). En un push a `develop` los tests del
frontend corren dos veces (aquí y en `pages.yml`); son unos segundos y se acepta para no mezclar los dos workflows.
Alternativa descartada: solo el backend en `ci.yml`; entonces una PR no mostraría si rompe el frontend hasta fusionarla.

**14. Job `backend`: `npm ci`, `npx supabase start` con los servicios que los tests no usan excluidos, y
`npm run test:backend`.** Se usa la CLI del `package-lock.json` (la misma versión que en local) y no la acción
`supabase/setup-cli`, para no tener dos versiones. Los tests necesitan base de datos, Auth, PostgREST, Realtime y la
pasarela; se excluyen con `-x` al menos Studio, imgproxy, Storage, edge-runtime y los de logs, y la lista exacta se
fija al implementar con `npx supabase start --help` y la primera ejecución. `supabase start` aplica las migraciones
desde cero, que es lo que pide la spec. **Lista fijada (26 nov):** `-x
storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` (nombres de `npx supabase
start --help` en la 3.2.0); quedan la base de datos, gotrue, realtime, postgrest y kong. Por decisión del PO no se
probó antes en local (Docker parado) sino en la PR #15: aplicó las 6 migraciones y pasó los 146 tests de los 13
archivos, sin saltados, con el job entero en 1 min 39 s. Alternativas descartadas: *`supabase db start` solo* (no arranca Auth ni
Realtime, que los tests usan); *cachear las imágenes de Docker* (ahorra un minuto a cambio de complejidad; se
reconsidera si el job pasa de 8 minutos).

## Risks / Trade-offs

- **[El entorno `github-pages` solo admite desplegar desde la rama por defecto]** Al activar Pages con Actions,
  GitHub crea el entorno con una regla de ramas que puede dejar fuera `develop` y el despliegue falla con un
  mensaje de protección de entorno → paso manual 9a: añadir `develop` a las ramas permitidas. **Confirmado el 26
  nov:** el entorno se creó con una regla de ramas propia; el PO añadió `develop` y `gh api
  …/environments/github-pages/deployment-branch-policies` devuelve `develop` y `main`.
- **[Caché de 10 minutos de GitHub Pages]** Justo después de desplegar pueden mezclarse módulos ES de dos
  versiones y la app romper unos minutos → se acepta para el curso; si molesta, recargar sin caché. No se
  versionan los módulos con `?v=` para no tocar `frontend/`.
- **[Dependencia de CDN y Google Fonts]** Sin red a esos dominios la app no arranca. Ya era así; no cambia.
- **[Un workflow con permiso de escritura en un repositorio público]** Solo corre con `push` a `develop` y
  `workflow_dispatch`, no con PR de forks; los permisos se declaran por job.
- **[La «Site URL» mal escrita]** Un correo de confirmación llevaría a una página inexistente → se comprueba con
  una cuenta nueva (spec: «Crear cuenta desde la app desplegada»).
- **[Choca con «CI» fuera de alcance]** Se acepta de forma explícita (proposal); se anota en `openspec/config.yaml`
  al cerrar el change, para que la lista no mienta.
- **[`realtime.test.js` intermitente en el ejecutor]** Sus esperas están pensadas para una máquina local; en un
  ejecutor compartido y recién arrancado pueden quedarse cortas → no bloquea nada (decisión 11); si falla de forma
  intermitente, se mira la salida y se sube la espera de ese test con su motivo, sin desactivarlo (política TDD).
  Visto en la PR #15: sus dos tests consultan el catálogo (qué tabla y qué eventos publica Realtime), no tiempos de
  entrega, así que el riesgo es bajo hasta que S3 añada pruebas de suscripción reales.
- **[`supabase start` lento o roto en el ejecutor]** La primera descarga de imágenes y el arranque pueden llevar
  varios minutos, o fallar por un puerto o una imagen → `timeout-minutes` en el job y la tarea de comprobarlo en una
  PR real antes de dar el grupo por hecho.
- **[El CI es solo informativo]** Sin regla de protección de rama, se puede fusionar una PR en rojo → se acepta; hacerlo
  obligatorio es decisión del PO (Non-Goals).
- **[Subdirectorio]** La lectura del código dice que funciona; si la prueba real encuentra una ruta absoluta o un
  `location.origin` solo, se corrige en `frontend/` en el mismo change y se añade a las tareas.

## Migration Plan

1. Rama `feat/d1-despliegue` desde `develop` con los dos workflows; la PR contra `develop`. Al abrirla, `ci.yml`
   ya se ejecuta sobre ella (un workflow con `pull_request` corre desde la rama de la PR), lo que sirve de primera prueba.
2. Antes de fusionar, el PO activa Pages (origen «GitHub Actions») y permite `develop` en el entorno.
3. Al fusionar, el push a `develop` dispara el primer despliegue.
4. El PO pone la «Site URL» y las redirecciones en Supabase; se comprueba con una cuenta nueva y con las dos
   pruebas de aceptación.
5. Retirada: desactivar Pages en el repositorio y borrar los workflows; la app local no depende de nada de esto.
   Volver a una versión anterior es revertir el commit en `develop` (el push republica).

## Open Questions

- ¿Hace falta nombrar la URL en el readme con un acortador o un dominio al entregar? Se decide en P2; no cambia
  nada de este change.
