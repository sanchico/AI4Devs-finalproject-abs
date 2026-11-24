## Why

Hoy un diagrama compartido solo se crea con `npm run preparar:diagrama`: sin el script, nadie puede crear,
encontrar ni compartir un diagrama desde la app, y la colaboración (lo más valioso del proyecto) no se puede
demostrar. Quedan unas 7,25 h de las 33 h del presupuesto (25,0 h gastadas, 2,75 h por encima del plan) y las
estimaciones del proyecto han ido siempre por debajo del coste real. Un consejo de asesores (sesión 11) concluyó que
F5 no se recorta por decreto: se ordena por valor y se le pone un tope de tiempo.

## What Changes

Resto de F5 (HU-03), reordenado y con tope. El núcleo es lo que cierra el ciclo «un usuario real crea, comparte y
colabora sin script»:

- **Pantalla «Mis diagramas»** (ruta `#/lista`): lista los diagramas del usuario (título, tipo, fecha) y abre
  cada uno en `#/d/<id>`; un botón «Nuevo» con selector de tipo (Flujo o Estados) que crea el diagrama y lo abre.
- **«Compartir»** en un diagrama abierto: crea una invitación como editor y copia el enlace.
- **Ruta de invitación** (`#/i/<token>`): pide sesión si falta, acepta la invitación y abre el diagrama. Sin esta
  ruta el enlace copiado no serviría de nada.
- Entrada a la lista desde el modo solitario (botón «Mis diagramas») sin cambiar lo que hace la app sin ruta.
- **Sesión fuera de la dirección:** al volver del enlace de confirmación del correo, Auth deja `access_token` y
  `refresh_token` en el fragmento de la URL; la app los ignora, pero se quedan en la barra y el historial. Se quitan al
  arrancar. Se añadió tras probar con un invitado nuevo (sesión 11).
- Un orden de trabajo y un tope: primero PR y flujo del invitado nuevo (el riesgo real), después el núcleo, después
  renombrar y borrar si queda tiempo, y `set_member_role` solo si aún sobra. **Tope duro de 2,5 h para F5 (sin contar
  la PR ni la prueba del invitado)**; lo que no entre se documenta como «backend listo, interfaz pendiente».

**Fuera de este change (sin spec hasta que entren):** renombrar, borrar y restaurar desde la interfaz,
`set_member_role` y su lista de miembros, invitar como lector (el backend ya lo admite), revocar enlaces, y avisar al
instante a quien tiene abierto un diagrama que se borra (ya está fuera del MVP). Si se llega a renombrar o borrar,
se añade su requisito con `/opsx:update` antes de implementarlo.

No choca con el «fuera de alcance» del MVP: no añade tipos de diagrama, presencia ni cursores. No toca el servidor:
usa `create_diagram`, `create_invite`, `accept_invite` y las lecturas con RLS que ya existen y están probadas.

Corresponde al bloque F5 del PRD (HU-03) y, de rebote, a la prueba de D1 con un invitado nuevo.

## Capabilities

### New Capabilities
- `diagram-management`: lista de diagramas propios, creación desde la interfaz, enlace de invitación como editor y
  aceptación de la invitación por ruta.

### Modified Capabilities
- `user-session`: «Sin diagrama compartido no se pide sesión» pasa a decir que las rutas de la lista y de la
  invitación también la piden; sin ruta o con una ruta desconocida sigue sin sesión ni red. Requisito nuevo: una
  sesión nunca se queda en la dirección.

## Impact

- Código: `frontend/ruta.js` (rutas `lista` e `invitacion`), `frontend/avisos.js` (textos), módulo nuevo sin DOM
  para las llamadas a Supabase, `frontend/colaboracion.js` (sesión compartida, compartir), módulo nuevo con DOM para
  la lista, `frontend/main.js`, `frontend/index.html` y `frontend/styles.css`.
- Tests: `ruta.test.js`, `avisos.test.js` y uno nuevo del adaptador con el cliente falso. El navegador real se
  comprueba con el driver de la skill `run-trazo-mermaid`.
- Sin migraciones ni cambios de RLS ni dependencias nuevas.
- Documentación: `CLAUDE.md`, `docs/PRD-MVP.md` (F5 y su recorte) y la bitácora.
- Supuesto sin comprobar: que las 33 h sean un tope duro y qué puntúa la rúbrica del curso. Es del PO y no cambia
  el orden de este change, solo cuánto del extra entra.
