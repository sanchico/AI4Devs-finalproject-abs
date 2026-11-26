# Design

## Context

Realtime reparte las inserciones de `diagram_ops` (la única tabla publicada, solo `insert`; migración
`20261117120100_permisos.sql`). Para Postgres Changes, Realtime evalúa la política de lectura de la tabla
(`member_role(diagram_id) is not null`) con la sesión de cada suscriptor antes de entregarle la fila. Hoy
nada lo prueba: `realtime.test.js` mira el catálogo y `medir-latencia.js` solo suscribe a un miembro.

La suscripción correcta está escrita en `medir-latencia.js` (`suscribir`): la suscripción se da por hecha al
llegar el mensaje `system` con `extension: 'postgres_changes'` y `status: 'ok'`, no con `SUBSCRIBED`; lo
enviado entre uno y otro se pierde (sesión 9). Un cliente con sesión necesita además `realtime.setAuth(token)`.
Ver proposal.md para el motivo y el alcance.

## Goals / Non-Goals

**Goals:**
- Probar contra el Supabase local que el miembro recibe y que el ajeno y el anónimo no reciben nada, por
  `apply_op` y por `apply_ops`.
- Que un verde signifique algo: sin esperas fijas y sin canales que no llegaron a unirse.
- Una sola implementación de la suscripción, compartida por el test y el script.

**Non-Goals:**
- Pérdida de acceso con el canal abierto (borrar el diagrama, cambiar el rol).
- Medir latencia o probar el proyecto remoto.
- Tocar migraciones, funciones o el cliente de `frontend/`. No afecta a `ops.js` ni a `apply_op`: solo lee
  lo que ya se escribe.

## Decisions

**1. Sacar `suscribir` a `supabase/tests/helpers/realtime.js`** y que `medir-latencia.js` lo importe.
Alternativa descartada: copiarlo en el test. Habría dos versiones de una lógica sutil (la espera al mensaje
`system`) que se desfasarían. El script ya vive en `supabase/` y sus cálculos tienen test (`medida.test.js`,
sin Supabase), así que el riesgo de tocarlo es bajo; la medición real se comprueba ejecutándolo una vez en
local.

**2. El helper recibe el cliente y anota lo recibido** (`{opId, seq, t1}`, como hoy) y devuelve
`{unido, listo}`. Añade un cierre (`cerrar`) para que el test no deje canales ni conexiones abiertas y
`node --test` termine. El test del anónimo usa `anonimo()` sin `setAuth`; el de los usuarios con sesión
llama a `realtime.setAuth(sesion.access_token)`, que el `usuario()` actual no hace. Se añade en el
helper de Realtime, no en `entorno.js`, para no cambiar lo que usan los demás tests.

**3. «No recibe nada» se demuestra con una operación centinela, no con una pausa.** Tras la operación de
prueba, el dueño envía una segunda; se espera con un plazo (10 s) a que el miembro tenga las dos y entonces
se comprueba que el ajeno y el anónimo tienen cero. Como Realtime entrega en orden de inserción y a todos
los suscriptores del mismo canal, si el ajeno recibiera algo ya lo habría recibido a esas alturas.
Alternativa descartada: dormir N ms y mirar; da falsos verdes en una máquina lenta y alarga el CI.
El plazo solo falla el test si el **miembro** no recibe (entonces el resultado no vale).

**4. Exigir que los cuatro lleguen a `system ok`** antes de enviar nada. Si el ajeno o el anónimo
fallan al unirse (error de Postgres Changes), el test falla con ese motivo en vez de dar un verde por
ausencia. El escenario de la spec lo recoge.

**5. Una prueba por ruta de escritura.** Un `test` con `apply_op` (dos operaciones sueltas) y otro con
`apply_ops` (un gesto de tres). Comparten el montaje (`equipo()` más cuatro clientes); si el montaje es caro
se hace una vez con `before`. Los canales usan el nombre `diagram:<id>` del cliente real.

**6. Sin cambios en la publicación.** Si el test fallara por una brecha real (el ajeno recibe algo), se
detiene y se arregla en un change aparte; este change no toca migraciones.

## Risks / Trade-offs

- [Falso verde por un canal que nunca se une] → Decisión 4: los cuatro deben confirmar y el miembro debe
  recibir antes de comprobar los ceros.
- [Test lento o inestable por Realtime local, que tarda en arrancar] → plazo de 15 s para confirmar la
  suscripción (el actual) y de 10 s para recibir; se ejecuta varias veces seguidas antes de darlo por bueno.
- [Conexiones sin cerrar dejan colgado `node --test`] → el helper devuelve `cerrar()` y los tests lo llaman
  en `after`; se comprueba que el proceso termina solo.
- [Romper la medida al mover `suscribir`] → el script conserva su salida; se ejecuta una vez contra el local
  y `medida.test.js` sigue en verde.
- [El CI informativo no bloquea] → un fallo del test no impide fusionar; se revisa a mano en la PR.
