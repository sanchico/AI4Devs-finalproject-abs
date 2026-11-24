## Context

Ver `proposal.md` (Why). Estado observado en el código:

- `ruta.js` (puro) solo distingue `solitario`, `diagrama` e `invalida`; cambiar el hash recarga la página (`main.js`).
- `colaboracion.js` (el único con DOM) crea el cliente de supabase-js, pide sesión con `asegurarSesion` y abre el
  diagrama de la ruta. Es la única pieza que sabe de sesión; `transporte-supabase.js` recibe el cliente inyectado y
  no toca el DOM.
- El servidor ya tiene todo lo que hace falta y está probado: `create_diagram(p_kind)` devuelve el id,
  `create_invite(p_diagram_id, p_role)` devuelve un token de 64 hex (solo el dueño: 403 a los demás, 410 si está
  borrado), `accept_invite(p_token)` devuelve el id del diagrama (404 `invite_invalid` igual para desconocido y
  caducado, 410 si está borrado). Las tablas se leen con RLS: `diagrams` solo devuelve filas de las que el usuario es
  miembro, y el dueño ve también las borradas (`deleted_at`).
- Ninguna ruta acepta invitaciones hoy: un enlace copiado no tendría a dónde llevar.

## Goals / Non-Goals

**Goals:** cerrar el ciclo crear, compartir y colaborar desde la interfaz con el menor código nuevo, sin tocar el
servidor ni el modo solitario.

**Non-Goals:** renombrar, borrar, `set_member_role`, invitar como lector, revocar enlaces y lista de miembros (ver
`proposal.md`); un enrutador general; estilos más allá de lo legible.

## Decisions

**1. Dos rutas nuevas en `ruta.js`: `#/lista` y `#/i/<token>`.** El token se valida con `/^[0-9a-f]{64}$/` (es lo
que genera `create_invite`), y se devuelve tal cual, sin pasar a minúsculas ni transformarlo. Cualquier otra cosa
tras `#/i/` es `invalida`. Se mantiene que una ruta desconocida es `solitario`.
- *Alternativa descartada:* la invitación como parámetro de búsqueda (`?invita=<token>`). El hash ya es la ruta y
  cambiarlo ya recarga la página; mezclar dos mecanismos complicaría `parseRuta`, que es puro y fácil de probar.

**2. La aceptación de la invitación vive en `colaboracion.js`, tras la sesión, y termina con `location.replace` a
`#/d/<id>`.** Usar `replace` evita que «Atrás» vuelva al enlace con el token y lo reutilice sin querer. Pasa por
`asegurarSesion` (que ya cubre cuenta nueva y correo sin confirmar), así que quien no tiene cuenta usa el mismo
panel, y el token sigue en el hash mientras tanto, de modo que al volver de confirmar el correo con el mismo enlace
se acepta.
- *Alternativa descartada:* guardar el token en `localStorage` mientras se confirma el correo. Es más cómodo para
  el invitado, pero es estado nuevo, y el enlace sigue en su correo o su mensaje. Se anota como mejora.

**3. Un módulo nuevo sin DOM, `gestion-supabase.js`, con el cliente inyectado**, igual que `transporte-supabase.js`:
`listarDiagramas()`, `crearDiagrama(kind)`, `crearInvitacion(id)` y `aceptarInvitacion(token)`. Devuelven datos o
lanzan un error con `status`, como el transporte, y se prueban con el cliente falso de `test/helpers/supabase-falso.js`
(se amplía lo mínimo: `rpc` ya existe; `from().select().is().order()` hay que añadirlo). Así la lógica no se prueba
solo a mano en el navegador.
- *Alternativa descartada:* llamar a `client.rpc` directamente desde `colaboracion.js`: no se puede probar en Node y
  mezcla la red con el DOM.

**4. La lista se lee con una sola consulta**: `from('diagrams').select('id, title, kind, updated_at')`
`.is('deleted_at', null).order('updated_at', {ascending: false})`. La RLS ya limita a los diagramas del miembro; no
hace falta `diagram_members` ni migración. Los títulos viajan hasta `textContent`.
- *Riesgo conocido:* `diagrams.updated_at` solo cambia si `apply_op` lo actualiza al guardar una operación; se
  comprueba en la prueba con el remoto (tarea 1.1) y, si no se mueve, el orden será por `created_at`, sin cambiar la
  spec («el más reciente» sigue siendo cierto en uno de los dos sentidos) pero anotándolo.

**5. La lista es una pantalla del propio `index.html`, no una página aparte.** Un panel oculto como el de entrada,
con `<ul>`, el selector de tipo y «Nuevo», en un módulo con DOM nuevo `lista.js`. Con la ruta `#/lista` no se carga
el ejemplo ni el lienzo de un diagrama: se muestra el panel sobre la app vacía. Entrar en un diagrama es cambiar el
hash, que recarga: nada del diagrama anterior sobrevive (ya es la regla de `shared-diagram-session`).
- *Alternativa descartada:* una página `lista.html`. Duplicaría el panel de entrada, la carga de supabase-js y la
  configuración.

**6. La sesión pasa a ser un servicio compartido de `colaboracion.js`**: se extrae el crear cliente y
`asegurarSesion` para que los tres usos (diagrama, lista e invitación) lo compartan, en vez de copiarlos. Es el
único refactor del change y se hace antes de añadir nada, con el driver sin ruta y con ruta como red.

**7. «Compartir» siempre crea el enlace de editor y deja que el servidor diga quién puede.** El botón se ve en todo
diagrama compartido abierto; el 403 de `create_invite` se traduce a «Solo el dueño puede invitar» y el 410 al aviso
de diagrama borrado. No se expone el rol del usuario a la interfaz para decidir si mostrar el botón: sería más
código y la regla ya vive en el servidor. El enlace se compone con `location.origin + location.pathname + '#/i/' +
token` (en la tablet, `http://<ip>:8000`; en producción, el dominio con HTTPS).
- *Alternativa descartada:* ocultar «Compartir» a los no dueños. Requiere que `collab.js` exponga el rol y mantenerlo
  al día si cambia; se hará solo con `set_member_role`.

**8. Los textos nuevos van a `avisos.js`** (puro), con test, como los demás: crear que falla, compartir (copiado,
solo el dueño, borrado), invitación no válida o caducada (el mismo texto para las dos, para no revelar nada) y lista
que no carga.

**9. Orden de trabajo y tope (decisión del consejo de la sesión 11).**

| Orden | Pieza | Estimación | Regla |
|---|---|---|---|
| 0 | Subir la rama, abrir la PR y probar en el remoto a un invitado nuevo con la confirmación de correo | 0,5 h | Antes que nada: es lo que puede romper la demo. No cuenta para el tope |
| 1 | Núcleo: rutas, lista, «Nuevo», «Compartir», aceptar | 1,75 h | Es lo único con spec; entra siempre |
| 2 | Renombrar y borrar con `confirm()` | 0,5 h | Solo si el acumulado de F5 no pasa de 1,75 h al terminar el núcleo; antes de implementarlos se añade su requisito con `/opsx:update` |
| 3 | `set_member_role` y lista de miembros | 0,5 h | Solo si tras 2 queda al menos 0,5 h bajo el tope; en otro change |

**Tope:** 2,5 h para F5 (1 a 3), medidas con las horas activas de la bitácora. Si al terminar un escalón el acumulado
pasa de 2,5 h, se para, se anota lo que falta como «backend listo, interfaz pendiente» en el PRD y el readme, y se
sigue con D1, S3 y P2. Las estimaciones de este proyecto se han quedado cortas en torno al 50 %, por eso el núcleo
lleva 1,75 h y no 1,5 h.

## Risks / Trade-offs

- [Un invitado nuevo no puede entrar porque la confirmación de correo del proyecto remoto no llega o redirige mal]
  → La tarea 1.1 lo comprueba antes de escribir código; si falla, se desactiva la confirmación en el panel de Auth
  o se prueba con «Auto confirm», y se anota en D1.
- [`updated_at` no se mueve y la lista parece desordenada] → ver Decisión 4.
- [Un enlace de invitación es un secreto en una URL: queda en el historial del navegador y se reutiliza hasta que
  caduca a los 7 días] → es la regla ya fijada en S2; `location.replace` evita que «Atrás» lo reabra. La revocación
  queda fuera.
- [Doble creación por doble pulsación o reintento] → botón desactivado durante la llamada; el servidor no es
  idempotente en `create_diagram`, y un diagrama de más vacío se puede borrar con el script.
- [Recorte: la entrega queda sin renombrar, borrar ni roles en la interfaz] → documentado como límite conocido; el
  backend los soporta y está probado.
- [Sin tests de navegador en el CI] → el driver de Playwright de la skill `run-trazo-mermaid` se amplía con el
  recorrido lista, nuevo, compartir y aceptar con dos usuarios.

## Migration Plan

Sin migraciones ni cambios en el servidor. El despliegue es el del propio `frontend/` (D1). Si algo falla, volver a
la versión anterior no tiene datos que migrar: los diagramas creados desde la lista son diagramas normales.

## Open Questions

- ¿Las 33 h son un tope duro y qué puntúa la rúbrica? Lo comprueba el PO; solo decide cuánto del escalón 2 entra.
