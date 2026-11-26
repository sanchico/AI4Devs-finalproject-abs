# Tasks

Estimación total: 2,25 h (el PRD da 0,5 h a D1 sin contar la prueba con dos dispositivos, que ya figuraba aparte; el
CI del grupo 1b, 0,5 h, es una decisión del PO de la sesión 12 que no estaba en el PRD, y el grupo 3b, 0,5 h, se
añadió cuando la prueba de la 4.3 dio un 404). Salvo el grupo 3b, que sigue TDD, no hay código de `frontend/` que
escribir en rojo primero: el comportamiento se comprueba con los propios tests del frontend, con órdenes que se
pueden repetir y con la prueba real en la URL pública. Necesita Node ≥ 22, `gh` con
sesión, el proyecto remoto con los usuarios A y B de la medida (`supabase/.env.remoto`) y Playwright (skill
`run-trazo-mermaid`). Los pasos del grupo 3 los hace el PO: el agente no tiene acceso a esos paneles.

## 1. El workflow (0,25 h)

- [x] 1.1 Comprobar en los repositorios de `actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact` y `actions/deploy-pages` cuál es la versión mayor vigente y anotarla en `design.md` (decisión 7); verificar con `gh api repos/actions/<nombre>/releases/latest`.
- [x] 1.2 Escribir `.github/workflows/pages.yml` con el disparador de la decisión 2 (`push` a `develop` y `workflow_dispatch`), `concurrency` de la decisión 6, el job `test` (`contents: read`, Node 22, `node --test "frontend/**/*.test.js"` sin `npm install`) y el job `deploy` (`needs: test`, permisos `pages: write` e `id-token: write`, entorno `github-pages`, `_site/` sin `test/`); verificar que el YAML parsea con `node -e "…"` o con `gh workflow view` tras subirlo, y que el job `deploy` no se ejecuta si `test` falla (revisar `needs`).
- [x] 1.3 Repetir en local lo que hace el job: `node --test "frontend/**/*.test.js"` en verde, y construir `_site/` con las dos órdenes del workflow; verificar con `ls _site` que están `index.html`, `main.js` y `kinds/` y que no está `test/`, y borrar `_site/` después. Comprobar también con `grep -rnE "(src|href)=\"/[^/]|from '/'" frontend --include=*.html --include=*.js --exclude-dir=test` que no hay rutas absolutas que se romperían bajo un subdirectorio (salida vacía).

## 1b. El CI (0,5 h)

- [x] 1b.1 Escribir `.github/workflows/ci.yml` según las decisiones 11 a 14: disparadores `pull_request` y `push` contra `develop`, `permissions: contents: read`, sin secretos; job `frontend` (Node 22, `node --test "frontend/**/*.test.js"`) y job `backend` sin `needs` entre ellos (Node 22, `npm ci`, `npx supabase start -x …`, `npm run test:backend`, `timeout-minutes`); verificar que el archivo no usa `pull_request_target` ni `secrets.` (`grep` vacío) y que ningún job de `pages.yml` depende de él.
- [x] 1b.2 Fijar la lista de servicios excluidos: comprobar con `npx supabase start --help` los nombres que admite `-x` en la 3.2.0 y, en local con Docker, que `npx supabase stop` seguido de `npx supabase start -x <lista>` y `npm run test:backend` pasan entero (13 archivos); anotar la lista en `design.md` (decisión 14).
- [x] 1b.3 Comprobarlo en la PR real (tras 3.1): las ejecuciones `frontend` y `backend` aparecen por separado en la PR y acaban en verde (`gh pr checks`); anotar la duración del job `backend`. Si `realtime.test.js` falla por tiempos, anotarlo en `design.md` (Risks) y ajustar su espera con su motivo, sin desactivarlo.
- [x] 1b.4 Comprobar el escenario «Un test del backend falla»: en un commit temporal de la rama, cambiar una aserción de un test del backend para que falle, ver que el job `backend` queda en rojo con su salida y que `frontend` sigue en verde, y revertir el commit; verificar con `gh pr checks` antes y después.

## 2. Documentación (0,25 h)

- [x] 2.1 En `CLAUDE.md`, añadir bajo «Cómo ejecutarlo» una sección «Despliegue» con la URL pública, el disparador, que no se publica `frontend/test/`, los dos pasos manuales (Pages con origen «GitHub Actions» y rama `develop` permitida en el entorno `github-pages`; «Site URL» y redirecciones de Auth) y que al entregar el disparador pasa a `main`; y, junto a los tests del backend, que `ci.yml` los ejecuta en cada PR y push a `develop` sin bloquear la publicación. Verificar leyéndola contra `design.md` (decisiones 8, 9 y 11 a 14) y que cada orden o ruta que nombra existe.
- [x] 2.2 En `openspec/config.yaml`, cambiar «CI» de la lista de fuera de alcance por una nota que diga que existen el workflow de despliegue (tests del frontend antes de publicar) y el de CI (frontend y backend en cada PR, informativo), y que siguen fuera el lint, las vistas previas y el despliegue automático del backend; verificar con `openspec validate despliegue-github-pages` y que `openspec list --specs` sigue funcionando.
- [x] 2.3 En la skill `run-trazo-mermaid`, anotar que `driver-colaborativo.cjs` acepta la URL pública como primer argumento (con subdirectorio y sin barra final) y que `preparar:diagrama -- --url` debe llevar la misma; verificar que el ejemplo del `SKILL.md` coincide con la línea 7 del driver.

## 3. Pasos manuales del PO y primer despliegue (0,25 h)

- [x] 3.1 Subir la rama `feat/d1-despliegue` y abrir la PR contra `develop` (pedir confirmación al PO antes de publicar); verificar con `gh pr view` que existe y que no tiene conflictos.
- [x] 3.2 El PO activa Pages (Settings → Pages → Source «GitHub Actions») y permite `develop` en Settings → Environments → `github-pages`; verificar con `gh api repos/sanchico/AI4Devs-finalproject-abs/pages` que devuelve la configuración y con `gh api repos/sanchico/AI4Devs-finalproject-abs/environments/github-pages` las ramas permitidas.
- [x] 3.3 Fusionar la PR (la fusiona el PO) y vigilar la ejecución con `gh run watch`; verificar que `test` y `deploy` acaban en verde y que `curl -sI https://sanchico.github.io/AI4Devs-finalproject-abs/` da 200. Si el despliegue falla por la protección del entorno, anotar el motivo en `design.md` (Risks) y repetir 3.2.
- [x] 3.4 El PO pone en Supabase (Authentication → URL Configuration) la «Site URL» `https://sanchico.github.io/AI4Devs-finalproject-abs/` y las redirecciones con esa URL y `http://localhost:8000/`; verificar en el punto 4.3.

## 3b. La vuelta del correo de confirmación (0,5 h, añadido tras el 404 de la 4.3)

- [ ] 3b.1 Añadir en rojo a `frontend/test/ruta.test.js` los casos de `urlDeVuelta({origin, pathname})` (decisión 8): la URL pública con su subdirectorio y barra final; `http://localhost:8000/`; el resultado no lleva el `#` ni la consulta de la página (por ejemplo desde `#/i/<token>` o `?grabar`); y una ruta sin barra final se devuelve tal cual. Verificar con `node --test frontend/test/ruta.test.js` que fallan porque la función no existe.
- [ ] 3b.2 Implementar `urlDeVuelta` en `frontend/ruta.js` y pasarla como `options.emailRedirectTo` en el `signUp` de `frontend/colaboracion.js` (solo al crear cuenta, no al entrar); verificar con `node --test "frontend/**/*.test.js"` en verde y con `grep -n emailRedirectTo frontend/colaboracion.js` que solo está en `signUp`.
- [ ] 3b.3 Corregir `CLAUDE.md` (sección «Despliegue»: la vuelta es a la dirección desde la que se creó la cuenta; quitar el punto 7 de la hoja de ruta, que pasa a estar hecho) y abrir la PR de `feat/d1-enlace-de-confirmacion` contra `develop` (con la confirmación del PO); verificar que el CI de la PR queda en verde y, tras fusionarla, que el despliegue de Pages acaba en verde.

## 4. Aceptación en la URL pública (0,5 h)

- [x] 4.1 Comprobar los escenarios de contenido: `curl -s -o /dev/null -w "%{http_code}"` da 404 para `…/test/ruta.test.js`, 200 para `…/main.js`, y `http://…` redirige a `https://`; verificar con las tres salidas anotadas en la bitácora.
- [x] 4.2 Ejecutar `driver-colaborativo.cjs` contra la URL pública (dos contextos de Playwright, usuarios A y B); verificar que acaba sin fallos, que el Mermaid de los dos coincide y que el enlace de invitación que genera «Compartir» empieza por la URL pública con su subdirectorio. Si algún enlace falla por la ruta, corregir `frontend/` con su test y repetir.
- [ ] 4.3 (Tras 3b.3.) Crear una cuenta nueva desde la URL pública y pulsar el enlace del correo de confirmación; verificar que abre la URL pública con su subdirectorio (no la raíz del dominio ni `localhost`), que la dirección no conserva `access_token` ni `refresh_token` y que aparece el panel de entrada. Repetir desde `http://localhost:8000/` con otra cuenta y comprobar que el enlace vuelve a `http://localhost:8000/`. Primer intento, antes de 3b: la cuenta creada en la URL pública volvió a `https://sanchico.github.io/#access_token=…` (404); ver decisión 8.
- [ ] 4.4 Prueba con dos dispositivos reales: PC y tablet con S Pen, usuarios distintos, mismo diagrama por `#/d/<id>` desde la URL pública; verificar que un nodo dibujado en uno aparece en el otro y que el Mermaid coincide. Anotar el resultado y lo que no se pudo probar.
- [x] 4.5 Ejecutar `npm run medir:latencia` y anotar p50, p95 y máximo; verificar que el p95 de las operaciones sueltas queda por debajo de 1 s (como en la sesión 9: 538 a 579 ms).
- [x] 4.6 Hacer una captura de la app desplegada con la skill `run-trazo-mermaid` para el readme (P2) y guardarla en `docs/`; verificar que el archivo existe y se ve el diagrama.

## Workflow follow-up

- Archivar el change tras fusionar la PR (`/opsx:archive`); se sincronizan `static-deployment` y `continuous-integration` en `openspec/specs/`.
- Decidir (el PO) si el CI pasa a ser obligatorio para fusionar en `develop` con una regla de protección de rama.
- Actualizar la bitácora con `/cerrar-sesion` y, en P2, el readme (secciones 2.x, 3 y 4) con la URL pública y los pasos para probar con dos usuarios.
- Al entregar, cambiar el disparador del workflow de `develop` a `main`.
