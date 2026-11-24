# Tasks

Estimación total: 3,5 h (el PRD da 2 h al resto de F4 y 0,5 h al login de F5). Necesita Node, el proyecto remoto con
los usuarios A y B de la medida (`supabase/.env.remoto`) y, para el último grupo, Playwright (ver la skill
`run-trazo-mermaid`). Los grupos 1 y 2 siguen la política TDD del proyecto: primero los tests en rojo, después el
código mínimo, sin editar los tests anteriores. Los grupos 3 a 5 son código de navegador, que no se puede probar en
Node: cada tarea dice cómo se verifica.

## 1. Rutas, textos y causa del fallo al abrir (0,5 h)

- [x] 1.1 Escribir en rojo `frontend/test/ruta.test.js` (sin hash y `#/` son solitario; `#/d/<uuid>` en minúsculas y mayúsculas es diagrama con su id; `#/d/`, `#/d/xyz` y un UUID con caracteres de más son inválida; otras rutas son solitario) y `frontend/test/avisos.test.js` (el texto de cada aviso, de cada modo y de cada error de apertura 404, 410 y otro, según el diseño); verificar que fallan porque los módulos no existen.
- [x] 1.2 Implementar `frontend/ruta.js` y `frontend/avisos.js`; verificar que `node --test frontend/test/ruta.test.js frontend/test/avisos.test.js` pasa.
- [x] 1.3 Añadir a `frontend/test/collab.test.js` (en rojo) los casos de la causa del fallo (la carga falla con estado 404, con 410 y sin estado: `open()` devuelve `{ok: false, reason: 'load', error}` con ese error y el diagrama queda sin conexión) e implementarlo en `frontend/collab.js`; verificar con `node --test "frontend/**/*.test.js"` en verde.

## 2. Adaptador de supabase-js (0,75 h)

- [x] 2.1 Crear `frontend/test/helpers/supabase-falso.js` (canales con sus manejadores y estados controlados por el test, consultas con `from().select().eq().order().range()` sobre arrays, `rpc` programable, `auth.getSession` y `realtime.setAuth`) con un test mínimo `supabase-falso.test.js`; verificar con `node --test frontend/test/supabase-falso.test.js`.
- [x] 2.2 Escribir en rojo `frontend/test/transporte-supabase.test.js`: `subscribe` no resuelve en `SUBSCRIBED`, resuelve con el mensaje `system` de `postgres_changes` con estado `ok`, rechaza con `CHANNEL_ERROR` antes de estar listo o al pasar el plazo, ignora los `system` de otras extensiones, entrega cada `INSERT` como `{seq, op_id, op}`, llama a `onClose` una sola vez si el canal se cierra ya listo y fija el JWT del canal; `load` devuelve tipo, rol y registro, pide 1 500 filas en dos páginas, 2 500 en tres y 1 000 exactas en dos (la segunda vacía), rechaza con estado 404 sin fila de diagrama y con 410 si está borrado, y relanza un error de la API con su estado; `send` llama a `apply_ops` con `p_diagram_id` y `p_ops`, devuelve `{ok: true}` y traduce 422, 403, 409 y la falta de respuesta (estado 0) a `status: null`; verificar que fallan porque el módulo no existe.
- [x] 2.3 Implementar `frontend/transporte-supabase.js` y añadir un test que lo conecta con `createCollab` sobre el cliente falso: un diagrama de 1 500 operaciones se abre completo y una operación nueva por el canal llega a lo visible; verificar con `node --test "frontend/**/*.test.js"` en verde.

## 3. La app: sesión, apertura y bloqueo (1,25 h)

- [x] 3.1 Crear `frontend/config.js` con la URL y la clave pública del remoto (leídas de `supabase/.env.remoto` sin imprimir nada más), añadir en `frontend/index.html` la etiqueta de supabase-js 2.119.0 con su integridad y un comentario para recalcularla, el panel de entrada, el indicador de modo y el botón "Salir", y sus estilos en `frontend/styles.css`; verificar sirviendo `frontend/` y ejecutando el driver de la skill sin ruta: debe dar `OK` y la misma salida que `frontend/test/baseline-skill.txt`, sin errores en la consola.
- [x] 3.2 Cambiar `frontend/input.js`: recibir `locked()` y no empezar trazos ni arrastres ni abrir el editor si da un motivo (avisando con él), comprobar el resultado de `addNode` y `addEdge`, leer la posición final de un nodo arrastrado por su id y exponer `cancelInteraction()`; verificar con `node --test "frontend/**/*.test.js"` en verde y el driver sin ruta en `OK`.
- [x] 3.3 Crear `frontend/colaboracion.js` y enlazarlo desde `frontend/main.js`: leer la ruta, no cargar el ejemplo con ruta de diagrama, sesión y panel de entrada con `textContent`, apertura con el adaptador y `createCollab`, enlace con el modelo (`onChange`, `replaceState`, `setReadOnly`), indicador de modo, bloqueo de "Deshacer", "Limpiar" y los dos selectores, avisos, repintado por fotograma con los selectores sincronizados, "Salir" y recarga al cambiar el hash; verificar con el driver sin ruta en `OK` y con `http-server` abriendo `#/d/xyz` (aviso de dirección inválida, lienzo bloqueado y sin errores en la consola).

## 4. Un diagrama que abrir (0,25 h)

- [ ] 4.1 Crear `supabase/scripts/preparar-diagrama.js` (A crea el diagrama con `--tipo flow|state`, lo comparte con B con `--rol editor|viewer` y se escribe el id y el enlace; `--borrar <id>` lo borra) con el entorno de `supabase/.env.remoto` y sin imprimir credenciales; verificar con `node --check` y ejecutándolo una vez contra el remoto (con confirmación del PO, porque escribe en el proyecto) para ver que da un enlace `#/d/<id>` y que `--borrar` lo borra.

## 5. Prueba en el navegador real (0,5 h)

- [ ] 5.1 Crear `.claude/skills/run-trazo-mermaid/driver-colaborativo.cjs` con dos contextos de Playwright (A editor y B lector o editor) y documentarlo en la skill; el escenario: ambos abren el mismo diagrama, A dibuja y B lo ve en menos de 3 s, B renombra y A lo ve, A cambia la dirección y el selector de B la sigue, A deshace y B deja de verlo, B recarga y vuelve al mismo diagrama, un lector no dibuja (aviso, botones desactivados, ve lo de A), un diagrama ajeno da "No tienes acceso…", y no hay errores en la consola; verificar que termina en `OK` (con confirmación del PO para escribir las credenciales de A y B en el panel).
- [ ] 5.2 Anotar en `design.md` (Decisions, punto 11) el resultado de la prueba y el tiempo medido de A a B en el navegador, y borrar los diagramas de prueba con `--borrar`; verificar que quedan anotados y que el borrado devuelve sin error.

## 6. Documentación (0,25 h)

- [ ] 6.1 Actualizar `CLAUDE.md` (módulos nuevos, la ruta `#/d/<id>`, cómo probar con dos navegadores y el script), `docs/PRD-MVP.md` (F4 hecho y el login mínimo de F5 hecho; pendiente el resto de F5 y D1) y, si hace falta, el readme; verificar con `node --test "frontend/**/*.test.js"` y `npm run test:backend` en verde.

## Workflow follow-up

- Subir la rama (`git push`) cuando el PO lo confirme: hay commits locales sin subir en `feat/f4-cliente-colaborativo`.
- Archivar el change (`/opsx:archive`) antes de proponer el resto de F5, porque el archivado reescribe `openspec/specs/`.
- Siguiente: D1 (despliegue y prueba con dos dispositivos reales), el resto de F5 (lista, "Nuevo", renombrar, borrar, invitar) y el test de Realtime de S3.
- Añadir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
