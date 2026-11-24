# Tasks

Estimación total: 2 h (el PRD da 2 h al resto de F4 tras `apply_ops`; la app y el adaptador de supabase-js son el
change siguiente). No hace falta Docker. Cada grupo sigue la política TDD del proyecto: primero los tests en rojo,
después el código mínimo, y los tests anteriores no se editan.

## 1. Ganchos del modelo (0,5 h)

- [x] 1.1 Escribir `frontend/test/modelo-colaborativo.test.js` (en rojo, con `model.reset()` entre tests): sin `onChange` crear, deshacer y cambiar la dirección funcionan como antes; `perform` llama a `onChange` una vez por gesto con solo las operaciones aplicadas y no llama si no se aplicó ninguna; `undo()` devuelve y envía las inversas aplicadas y no las saltadas; `setDir` se envía y no entra en la pila; con `setReadOnly('role')`, `addNode`, `moveNode`, `setLabel`, `clear`, `undo` y `setDir` devuelven `{ok: false, reason: 'readonly'}` sin cambiar nada ni llamar a `onChange`; `replaceState` cambia el diagrama sin tocar la pila de deshacer; verificar con `node --test frontend/test/modelo-colaborativo.test.js` que falla por falta de los ganchos.
- [x] 1.2 Implementar en `frontend/model.js` `onChange`, `perform(ops, {undoable})`, `undo()` con `ops`, `setReadOnly` y `replaceState`, y pasar `setDir` a `perform` sin deshacer; verificar que `modelo-colaborativo.test.js` pasa y que `node --test "frontend/**/*.test.js"` sigue en verde sin editar ningún test anterior.

## 2. Transporte simulado, apertura y conciliación (0,75 h)

- [x] 2.1 Crear `frontend/test/helpers/transporte-simulado.js` (`ServidorSimulado` con la semántica de `apply_ops`: grupo atómico, reintento por `op_id`, secuencias contiguas, máximo de 500, fallos programables; y un `TransporteSimulado` por cliente con la entrega del canal y las respuestas bajo control del test) con su `transporte-simulado.test.js`; verificar con `node --test frontend/test/transporte-simulado.test.js`.
- [x] 2.2 Escribir en `frontend/test/collab.test.js` (en rojo) los casos de apertura y conciliación: carga del registro con el tipo y el rol; una operación que llega durante la carga se aplica una vez; una que está a la vez en la carga y en el canal, una vez; una entrada repetida se ignora; un salto de secuencia deja el diagrama sin conexión sin aplicar la operación; el cierre del canal conserva el diagrama; lo visible es el confirmado más lo pendiente; gana el orden del servidor en una etiqueta; un pendiente sobre un nodo borrado por otro no da error; el registro llega antes que la respuesta; un fallo de `subscribe` o `load` deja sin conexión; un rol `viewer` abre en solo lectura; verificar que falla porque `frontend/collab.js` no existe.
- [x] 2.3 Implementar `frontend/collab.js` con `createCollab({transport, onVisible, onMode, onNotice, wait})`, `open()`, la aplicación del registro por secuencia, el cálculo del visible, los modos y un `local` con el envío básico en orden (los casos de conciliación necesitan gestos pendientes); verificar que los casos de 2.2 pasan.

## 3. Cola, rechazos y reintentos (0,5 h)

- [ ] 3.1 Añadir a `frontend/test/collab.test.js` (en rojo) los casos de envío: dos gestos seguidos salen en orden y de uno en uno; un `op_id` distinto por operación; un gesto de 1 200 operaciones sale en tramos de 500, 500 y 200; un gesto vacío no envía; 422 y 409 descartan ese grupo, avisan y envían el siguiente; 403, 404 y 410 descartan todos los grupos, avisan del motivo y dejan solo lectura; un fallo de red y un acierto guardan el grupo una vez; cuatro fallos dejan sin conexión; sin conexión o en solo lectura `local` no envía; verificar que falla por falta de `local`.
- [ ] 3.2 Completar `local` con los tramos de 500, y añadir el tratamiento de los rechazos del servidor y los reintentos de red con `wait`; verificar que `collab.test.js` entero pasa.

## 4. Convergencia, enlace con el modelo y documentación (0,25 h)

- [ ] 4.1 Añadir a `collab.test.js` un test de convergencia con 3 clientes y semillas fijas (de 1 a 50): gestos aleatorios con ráfagas, entregas y respuestas en orden barajado y deshacer; al final todos tienen el mismo confirmado, el visible es igual al registro reproducido y el código Mermaid coincide; verificar que pasa para todas las semillas.
- [ ] 4.2 Crear `frontend/test/enlace-modelo.test.js`: con el modelo real enlazado (`onChange(collab.local)`, `onVisible` → `replaceState`), un gesto llega a otro cliente simulado, `undo` y `setDir` también, y un lector con `setReadOnly` no cambia el diagrama; verificar con `node --test frontend/test/enlace-modelo.test.js`.
- [ ] 4.3 Actualizar `CLAUDE.md` (estado actual: `collab.js`, ganchos del modelo y tests nuevos) y `docs/PRD-MVP.md` (F4: cola hecha; pendientes el adaptador de supabase-js y la app); verificar con `node --test "frontend/**/*.test.js"` y `npm run test:backend` en verde.

## Workflow follow-up

- Archivar el change (`/opsx:archive`) antes de proponer `colaboracion-en-la-app`, porque el archivado reescribe `openspec/specs/`.
- En el change siguiente: adaptador de supabase-js (que cumple el contrato del transporte y espera el mensaje `system` de Postgres Changes), sesión mínima, abrir un diagrama por id, avisos y bloqueo visual en `main.js` e `input.js` (que hoy no comprueba el resultado de `addNode`), y prueba en el navegador real.
- Añadir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
