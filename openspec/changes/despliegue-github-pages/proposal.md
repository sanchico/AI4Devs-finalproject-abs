# Proposal

## Why

La app colaborativa (F4 y F5) solo se puede probar hoy con `http-server` en local, y el criterio de aceptación de
D1 exige que dos dispositivos colaboren a través de una URL pública. Sin ella no se puede probar con la tablet
y el S Pen fuera de la red del PC, el enlace de confirmación del correo de Supabase Auth apunta a `localhost` y
quien corrija la entrega no puede abrir la app. Hace falta ahora porque P2 (documentación) necesita la URL real
y una captura de la app desplegada. Al automatizar la publicación se aprovecha para que los tests del backend
(RLS, funciones y el acuerdo de operaciones entre cliente y servidor) dejen de depender de que alguien arranque
Supabase en su equipo.

## What Changes

- Un workflow de GitHub Actions publica `frontend/` en GitHub Pages en cada push a `develop`, después de pasar
  `node --test "frontend/**/*.test.js"` (Node ≥ 22, sin `npm install`). Si un test falla, no se publica nada.
- Se publica solo lo que usa el navegador: `frontend/test/` (tests y muestras de trazos) se deja fuera.
- URL pública: `https://sanchico.github.io/AI4Devs-finalproject-abs/` (sin dominio propio; `pen2mermaid.app` queda
  como idea futura).
- Auth de Supabase: «Site URL» = la URL de Pages (con su subdirectorio y la barra final) y lista de redirecciones
  con esa misma URL y `http://localhost:8000/`, para seguir probando en local.
- Dos pasos manuales que no puede hacer el agente (el repositorio no guarda claves de administración): activar
  Pages con origen «GitHub Actions» en el repositorio y poner los ajustes de Auth en el panel de Supabase. Se
  documentan en el change y en `CLAUDE.md`.
- Comprobación en el subdirectorio: el enlace de invitación (`location.origin + location.pathname`), la
  navegación por hash y el retorno del enlace de confirmación del correo funcionan bajo
  `/AI4Devs-finalproject-abs/`. La lectura del código indica que no hace falta tocar `frontend/`; la prueba real
  lo confirma.
- Prueba de aceptación con dos usuarios desde la URL pública (PC y tablet), y repetir `npm run medir:latencia`
  apuntando al remoto como en la sesión 9.
- Un segundo workflow, de integración continua, ejecuta en cada PR contra `develop` y en cada push a `develop` los
  tests del frontend y los del backend (`npm ci`, Supabase local con Docker en el ejecutor y `npm run test:backend`),
  sin secretos ni permisos de escritura. **No bloquea la publicación:** el despliegue no publica el backend (las
  migraciones se suben a mano con `db push`) y un fallo de tiempos de Realtime no debe parar el frontend. Lo que sí
  hace es dejar visible en la PR, antes de fusionar, si se rompe la RLS, una función o el acuerdo entre `ops.js` y
  `validate_op` (`fixtures-ops.test.js`).

Bloque del PRD: **D1 · Despliegue**; criterio de la HU-02 (colaborar entre dos dispositivos). No cambia código de
`frontend/` ni de `supabase/`.

**Choca con el «fuera de alcance» del MVP:** la lista de exclusiones del proyecto incluye «CI». Este change
añade integración continua de verdad: el workflow de despliegue prueba el frontend antes de publicar y el de CI
prueba frontend y backend en cada PR. Se decide explícitamente (petición del PO en la sesión 12): el backend es
donde está la seguridad del MVP y hoy solo se prueba en la máquina de quien se acuerde de arrancar Supabase. Siguen
fuera el lint, la vista previa por PR y cualquier despliegue automático del backend.

## Capabilities

### New Capabilities
- `static-deployment`: la app se sirve por HTTPS desde una URL pública estable, solo se publica una versión que
  ha pasado los tests del frontend, y sus enlaces (invitación, confirmación del correo) funcionan bajo el
  subdirectorio de esa URL.
- `continuous-integration`: los tests del frontend y del backend se ejecutan solos en cada PR contra `develop` y en
  cada push a `develop`, contra un Supabase local creado desde las migraciones, y el resultado queda en la PR.

### Modified Capabilities
<!-- Ninguna: el comportamiento de la app no cambia; solo dónde y cómo se publica. -->

## Impact

- Nuevos archivos: `.github/workflows/pages.yml` y `.github/workflows/ci.yml`; nada en `frontend/` ni en `supabase/`.
- `CLAUDE.md`: sección de despliegue y de los dos pasos manuales; la lista de «fuera de alcance» de
  `openspec/config.yaml` ya no es cierta para «CI» y se anota allí.
- Sistemas externos: ajustes del repositorio de GitHub (Pages) y de Supabase Auth (URLs). Sin cambios de
  esquema ni migraciones.
- Dependencias: ninguna nueva; la app sigue cargando supabase-js, Mermaid y las fuentes por CDN.
- Riesgo: la caché de GitHub Pages (10 minutos) puede mezclar versiones de módulos ES justo después de
  desplegar; aceptable para una demo.
- Riesgo: arrancar Supabase en el ejecutor tarda unos minutos y `realtime.test.js` depende de tiempos; un fallo
  intermitente del CI se ve en la PR pero no impide publicar.
