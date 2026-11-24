# Tasks

Estimación del núcleo: 1,75 h (grupos 1 a 4), más 0,5 h del grupo 0, que no cuenta para el tope. **Tope duro de
2,5 h para F5** (grupos 1 a 4 y los extras del grupo 5); ver `design.md`, decisión 9. Al terminar cada grupo se
apunta en esta lista el tiempo activo acumulado; si pasa de 2,5 h, se para y se documenta lo que falte. Los grupos 1
y 2 siguen la política TDD del proyecto (primero los tests en rojo, después el código mínimo, sin editar los tests
anteriores). Los grupos 3 y 4 son código de navegador, que no se puede probar en Node: cada tarea dice cómo se
verifica. Necesita Node, el proyecto remoto con los usuarios A y B de la medida (`supabase/.env.remoto`) y, para los
grupos 0 y 4, Playwright (ver la skill `run-trazo-mermaid`).

## 0. Antes de escribir código: la PR y el invitado nuevo (0,5 h, fuera del tope)

- [x] 0.1 Subir `feat/f4-cliente-colaborativo` y abrir la PR contra `develop` (pedir confirmación al PO: publica 22 commits); verificar que la PR existe con `gh pr view` y que no hay conflictos con `develop`.
- [ ] 0.2 Con el script `preparar:diagrama` y un correo nuevo, recorrer en el remoto lo que hará un invitado: abrir `#/d/<id>` sin cuenta, crear la cuenta, confirmar el correo (o ver que el proyecto no lo exige) y volver al enlace; verificar que acaba dentro del diagrama o anotar en `design.md` (Risks) el motivo exacto del fallo y el ajuste de Auth que se haga (confirmación desactivada o URL de redirección). Comprobar también, con una operación guardada, que `diagrams.updated_at` cambia (decisión 4).

## 1. Rutas y textos (0,25 h)

- [x] 1.1 Añadir en rojo a `frontend/test/ruta.test.js`: `#/lista` es `{tipo: 'lista'}`; `#/i/<64 hex>` es `{tipo: 'invitacion', token}` con el token sin transformar; `#/i/`, `#/i/xyz`, un token de 63 o 65 caracteres y uno con caracteres no hexadecimales son `invalida`; `#/lista/x` y `#/otra` siguen siendo `solitario`; y a `frontend/test/avisos.test.js` el texto de cada aviso nuevo (crear que falla, compartir copiado, solo el dueño, diagrama borrado, enlace manual, invitación no válida o caducada con el mismo texto para las dos causas, y lista que no carga); verificar que fallan.
- [x] 1.2 Implementar en `frontend/ruta.js` y `frontend/avisos.js`; verificar con `node --test frontend/test/ruta.test.js frontend/test/avisos.test.js` en verde y con `node --test "frontend/**/*.test.js"` sin regresiones.

## 2. Las llamadas a Supabase (0,5 h)

- [ ] 2.1 Ampliar `frontend/test/helpers/supabase-falso.js` con `from(tabla).select(...).is(columna, valor).order(...)` y, en su test, lo mínimo para cubrirlo; escribir en rojo `frontend/test/gestion-supabase.test.js`: `listarDiagramas` pide `id, title, kind, updated_at` con `deleted_at` nulo y orden descendente, devuelve las filas y relanza un error de la API con su estado; `crearDiagrama` llama a `create_diagram` con `p_kind` y devuelve el id, y rechaza un tipo que no sea `flow` ni `state` sin llamar al servidor; `crearInvitacion` llama a `create_invite` con `p_role: 'editor'` y devuelve el token, con el estado 403 y 410 en el error; `aceptarInvitacion` llama a `accept_invite` con `p_token` y devuelve el id, con 404 y 410 en el error; la falta de respuesta da un error sin estado; verificar que fallan porque el módulo no existe.
- [ ] 2.2 Implementar `frontend/gestion-supabase.js` (sin DOM, cliente inyectado, errores con `status` como `transporte-supabase.js`); verificar con `node --test "frontend/**/*.test.js"` en verde.

## 3. La interfaz (0,75 h)

- [ ] 3.1 Extraer en `frontend/colaboracion.js` la creación del cliente y `asegurarSesion` a funciones que compartan los tres usos, sin cambiar lo que hace la ruta de diagrama; verificar con el driver de la skill sin ruta en `OK` (misma salida que `frontend/test/baseline-skill.txt`) y con `#/d/xyz` mostrando la dirección inválida.
- [ ] 3.2 Añadir en `frontend/index.html` y `frontend/styles.css` el panel de la lista (`<ul>`, selector de tipo, «Nuevo» y mensaje), los botones «Mis diagramas» y «Compartir» de la barra y el cuadro para copiar el enlace a mano; verificar sirviendo `frontend/` que sin ruta no se ve ninguno de los paneles nuevos y el driver sin ruta sigue en `OK`.
- [ ] 3.3 Implementar `frontend/lista.js` (con DOM, todo texto con `textContent`): cargar y pintar la lista, abrir un diagrama cambiando el hash, «Nuevo» con el botón desactivado mientras crea y avisos de error; enlazar `#/lista` desde `main.js` y `colaboracion.js`; verificar abriendo `#/lista` con A en el navegador real: la lista sale ordenada, un título con `<img src=x onerror=alert(1)>` se ve como texto y «Nuevo» abre un diagrama vacío del tipo elegido.
- [ ] 3.4 Implementar «Compartir» y la ruta `#/i/<token>` en `frontend/colaboracion.js`: crear la invitación como editor, copiar el enlace con `navigator.clipboard` y, si no se puede, mostrarlo seleccionado; aceptar tras la sesión y abrir con `location.replace('#/d/<id>')`; un editor recibe «Solo el dueño puede invitar»; verificar en el navegador real que A comparte, B abre el enlace y entra como editor, que el mismo enlace dos veces no duplica nada y que `#/i/xyz` avisa sin llamar al servidor.

## 4. Prueba de dos usuarios y documentación (0,25 h)

- [ ] 4.1 Ampliar `.claude/skills/run-trazo-mermaid/driver-colaborativo.cjs` con el recorrido lista, «Nuevo», «Compartir» y aceptar: A crea un diagrama desde la lista, dibuja, copia el enlace, B lo abre, entra y ve lo de A, y B no ve los diagramas ajenos; verificar que termina en `OK` (con confirmación del PO, porque escribe en el remoto con las credenciales de A y B) y borrar los diagramas de prueba con `npm run preparar:diagrama -- --borrar <id>`.
- [ ] 4.2 Actualizar `CLAUDE.md` (rutas `#/lista` y `#/i/<token>`, `gestion-supabase.js` y `lista.js`, cómo probar) y `docs/PRD-MVP.md` (F5: núcleo hecho; renombrar, borrar y `set_member_role` según lo que entre, o «backend listo, interfaz pendiente»); verificar con `node --test "frontend/**/*.test.js"` en verde, y anotar el tiempo acumulado de F5 frente al tope.

## 5. Extras, solo si queda tiempo bajo el tope (fuera de este change hasta que se decida)

- [ ] 5.1 Decisión de corte: con el tiempo acumulado a la vista, decidir si entran renombrar y borrar (≈0,5 h) y, si entran, añadir su requisito con `/opsx:update` antes de escribir código; si el acumulado ya pasa de 2,5 h, no entran y se anota en el PRD y el readme como «backend listo, interfaz pendiente». `set_member_role` va en otro change y solo si tras esto quedan 0,5 h bajo el tope.

## Workflow follow-up

- Archivar el change tras la revisión de la PR y sincronizar `openspec/specs/` (nueva `diagram-management` y `user-session` modificada).
- Añadir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
