# Tasks

Estimación: el núcleo, 2 h (grupos 1 a 4 y 4b), y 0,5 h más de renombrar y borrar (grupo 5), más 0,5 h del grupo 0, que no cuenta para el tope. **Tope duro de
2,5 h para F5** (grupos 1 a 4, 4b y los extras del grupo 5); ver `design.md`, decisión 9. Al terminar cada grupo se
apunta en esta lista el tiempo activo acumulado; si pasa de 2,5 h, se para y se documenta lo que falte. Los grupos 1
y 2 siguen la política TDD del proyecto (primero los tests en rojo, después el código mínimo, sin editar los tests
anteriores). Los grupos 3 y 4 son código de navegador, que no se puede probar en Node: cada tarea dice cómo se
verifica. Necesita Node, el proyecto remoto con los usuarios A y B de la medida (`supabase/.env.remoto`) y, para los
grupos 0 y 4, Playwright (ver la skill `run-trazo-mermaid`).

## 0. Antes de escribir código: la PR y el invitado nuevo (0,5 h, fuera del tope)

- [x] 0.1 Subir `feat/f4-cliente-colaborativo` y abrir la PR contra `develop` (pedir confirmación al PO: publica 22 commits); verificar que la PR existe con `gh pr view` y que no hay conflictos con `develop`.
- [x] 0.2 Con el script `preparar:diagrama` y un correo nuevo, recorrer en el remoto lo que hará un invitado: abrir `#/d/<id>` sin cuenta, crear la cuenta, confirmar el correo (o ver que el proyecto no lo exige) y volver al enlace; verificar que acaba dentro del diagrama o anotar en `design.md` (Risks) el motivo exacto del fallo y el ajuste de Auth que se haga (confirmación desactivada o URL de redirección). Comprobar también, con una operación guardada, que `diagrams.updated_at` cambia (decisión 4).

## 1. Rutas y textos (0,25 h)

- [x] 1.1 Añadir en rojo a `frontend/test/ruta.test.js`: `#/lista` es `{tipo: 'lista'}`; `#/i/<64 hex>` es `{tipo: 'invitacion', token}` con el token sin transformar; `#/i/`, `#/i/xyz`, un token de 63 o 65 caracteres y uno con caracteres no hexadecimales son `invalida`; `#/lista/x` y `#/otra` siguen siendo `solitario`; y a `frontend/test/avisos.test.js` el texto de cada aviso nuevo (crear que falla, compartir copiado, solo el dueño, diagrama borrado, enlace manual, invitación no válida o caducada con el mismo texto para las dos causas, y lista que no carga); verificar que fallan.
- [x] 1.2 Implementar en `frontend/ruta.js` y `frontend/avisos.js`; verificar con `node --test frontend/test/ruta.test.js frontend/test/avisos.test.js` en verde y con `node --test "frontend/**/*.test.js"` sin regresiones.

## 2. Las llamadas a Supabase (0,5 h)

- [x] 2.1 Ampliar `frontend/test/helpers/supabase-falso.js` con `from(tabla).select(...).is(columna, valor).order(...)` y, en su test, lo mínimo para cubrirlo; escribir en rojo `frontend/test/gestion-supabase.test.js`: `listarDiagramas` pide `id, title, kind, updated_at` con `deleted_at` nulo y orden descendente, devuelve las filas y relanza un error de la API con su estado; `crearDiagrama` llama a `create_diagram` con `p_kind` y devuelve el id, y rechaza un tipo que no sea `flow` ni `state` sin llamar al servidor; `crearInvitacion` llama a `create_invite` con `p_role: 'editor'` y devuelve el token, con el estado 403 y 410 en el error; `aceptarInvitacion` llama a `accept_invite` con `p_token` y devuelve el id, con 404 y 410 en el error; la falta de respuesta da un error sin estado; verificar que fallan porque el módulo no existe.
- [x] 2.2 Implementar `frontend/gestion-supabase.js` (sin DOM, cliente inyectado, errores con `status` como `transporte-supabase.js`); verificar con `node --test "frontend/**/*.test.js"` en verde.

## 3. La interfaz (0,75 h)

- [x] 3.1 Extraer en `frontend/colaboracion.js` la creación del cliente y `asegurarSesion` a funciones que compartan los tres usos, sin cambiar lo que hace la ruta de diagrama; verificar con el driver de la skill sin ruta en `OK` (misma salida que `frontend/test/baseline-skill.txt`) y con `#/d/xyz` mostrando la dirección inválida.
- [x] 3.2 Añadir en `frontend/index.html` y `frontend/styles.css` el panel de la lista (`<ul>`, selector de tipo, «Nuevo» y mensaje), los botones «Mis diagramas» y «Compartir» de la barra y el cuadro para copiar el enlace a mano; verificar sirviendo `frontend/` que sin ruta no se ve ninguno de los paneles nuevos y el driver sin ruta sigue en `OK`.
- [x] 3.3 Implementar `frontend/lista.js` (con DOM, todo texto con `textContent`): cargar y pintar la lista, abrir un diagrama cambiando el hash, «Nuevo» con el botón desactivado mientras crea y avisos de error; enlazar `#/lista` desde `main.js` y `colaboracion.js`; verificar abriendo `#/lista` con A en el navegador real: la lista sale ordenada, un título con `<img src=x onerror=alert(1)>` se ve como texto y «Nuevo» abre un diagrama vacío del tipo elegido.
- [x] 3.4 Implementar «Compartir» y la ruta `#/i/<token>` en `frontend/colaboracion.js`: crear la invitación como editor, copiar el enlace con `navigator.clipboard` y, si no se puede, mostrarlo seleccionado; aceptar tras la sesión y abrir con `location.replace('#/d/<id>')`; un editor recibe «Solo el dueño puede invitar»; verificar en el navegador real que A comparte, B abre el enlace y entra como editor, que el mismo enlace dos veces no duplica nada y que `#/i/xyz` avisa sin llamar al servidor.

## 4. Prueba de dos usuarios y documentación (0,25 h)

- [x] 4.1 Ampliar `.claude/skills/run-trazo-mermaid/driver-colaborativo.cjs` con el recorrido lista, «Nuevo», «Compartir» y aceptar: A crea un diagrama desde la lista, dibuja, copia el enlace, B lo abre, entra y ve lo de A, y B no ve los diagramas ajenos; verificar que termina en `OK` (con confirmación del PO, porque escribe en el remoto con las credenciales de A y B) y borrar los diagramas de prueba con `npm run preparar:diagrama -- --borrar <id>`.
- [x] 4.2 Actualizar `CLAUDE.md` (rutas `#/lista` y `#/i/<token>`, `gestion-supabase.js` y `lista.js`, cómo probar) y `docs/PRD-MVP.md` (F5: núcleo hecho; renombrar, borrar y `set_member_role` según lo que entre, o «backend listo, interfaz pendiente»); verificar con `node --test "frontend/**/*.test.js"` en verde, y anotar el tiempo acumulado de F5 frente al tope.

## 4b. La sesión fuera de la dirección (0,25 h)

- [x] 4b.1 Añadir en rojo a `frontend/test/ruta.test.js` la función `llevaSesion(hash)`: verdadera con `#access_token=abc&refresh_token=def&type=signup`, con solo `#refresh_token=x` y con solo `#access_token=x`; falsa con `#error=access_denied&error_code=otp_expired`, `#/lista`, `#/d/<uuid>`, `#/i/<64 hex>`, `''`, `#`, `undefined` y `#/otra?access_token=x` (no es un fragmento de parámetros); verificar que falla porque la función no existe.
- [x] 4b.2 Implementar `llevaSesion` en `frontend/ruta.js` y usarla al principio de `frontend/main.js` con `history.replaceState(null, '', location.pathname + location.search)`; verificar con `node --test "frontend/**/*.test.js"` en verde y, sirviendo `frontend/`, abriendo `/#access_token=a&refresh_token=b&type=signup` en el navegador real: la dirección queda sin fragmento, abre el ejemplo, no hay peticiones a Supabase ni errores, y `#/lista` y `#/otra` no cambian.
- [x] 4b.3 Anotar la regla en `CLAUDE.md` (módulo de rutas) y en `design.md` (Risks: el invitado entra con su contraseña tras confirmar); verificar releyéndolos.

## 5. Renombrar y borrar desde la lista (0,5 h; escalón 2, decidido por el PO en la sesión 11)

- [x] 5.1 Decisión de corte: el PO decidió que renombrar y borrar entran; sus requisitos, su decisión de diseño (11) y estas tareas se añadieron antes de escribir código. `set_member_role` sigue fuera (otro change, solo si quedan 0,5 h bajo el tope); verificar con `openspec validate gestion-diagramas-minima --strict`.
- [x] 5.2 Añadir en rojo a `frontend/test/gestion-supabase.test.js`: `renombrarDiagrama` llama a `apply_op` con `p_diagram_id`, un `p_op_id` UUID y `p_op: {type: 'setMeta', set: {title}}`, deja el título sin transformar y rechaza con estado 422, sin llamar al servidor, un título vacío, solo de espacios, de 201 caracteres o que no sea texto (200 sí vale); un 403 y un 410 del servidor llegan con su estado; `borrarDiagrama` llama a `delete_diagram` con `p_diagram_id` y un 403 llega con su estado; la falta de respuesta no lleva estado; y a `frontend/test/avisos.test.js` los textos de `renombrar` (422, 403, 410 y otro) y `borrar` (403 y otro); verificar que fallan.
- [x] 5.3 Implementar `renombrarDiagrama` y `borrarDiagrama` en `frontend/gestion-supabase.js` (con `newId` de `frontend/ops.js`) y los textos en `frontend/avisos.js`; verificar con `node --test "frontend/**/*.test.js"` en verde.
- [x] 5.4 Cambiar `frontend/lista.js` y `frontend/styles.css`: cada fila con tres botones (abrir, «Renombrar» con `prompt()` y «Borrar» con `confirm()`), cancelar no hace nada, el título nuevo y las filas se pintan con `textContent`, un borrado quita la fila y un fallo avisa en el mensaje de la lista; verificar en el navegador real con el driver (tarea 5.5).
- [x] 5.5 Ampliar `.claude/skills/run-trazo-mermaid/driver-gestion.cjs` (con confirmación del PO ya dada para el remoto): A renombra un diagrama suyo y la fila cambia, un título de 201 caracteres avisa sin llamar al servidor, cancelar el `prompt` no cambia nada, B (editor) renombra el compartido y A lo ve al recargar la lista, B intenta borrar y recibe «Solo el dueño puede borrar el diagrama», A cancela un borrado (sigue) y lo confirma (desaparece de su lista y de la de B); verificar que termina en `OK`.
- [x] 5.6 Actualizar `CLAUDE.md`, `docs/PRD-MVP.md` (F5: queda solo `set_member_role` sin interfaz) y la skill (`SKILL.md`, párrafo del driver); verificar releyéndolos y con `node --test "frontend/**/*.test.js"` en verde.

## Workflow follow-up

- Archivar el change tras la revisión de la PR y sincronizar `openspec/specs/` (nueva `diagram-management` y `user-session` modificada).
- Añadir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
