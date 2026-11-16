# Tasks

Estimación: unas 0,6 h de trabajo mío más unos 5 minutos de dibujo del usuario para la validación. F3 ya
superó sus 1,5 h del PRD; se anota el desvío (design.md, Riesgos).

## 1. Guardas (0,1 h)

- [x] 1.1 En `frontend/test/baseline.test.js` (o un archivo nuevo `abiertos.test.js`), añadir trazos sintéticos que deben seguir siendo `open` con las tres formas permitidas: una línea de 200 px, una "L", una "U" de ancho igual a su alto y un arco de media circunferencia. Verificación: los tests pasan **antes** de tocar `recognizer.js`; `node --test "frontend/**/*.test.js"` en verde.

## 2. Ajuste con los 30 trazos actuales (0,3 h)

- [x] 2.1 Con un script de scratchpad (fuera del repositorio), buscar prototipos y pesos de `r` y `cd` sobre `fixtures/trazos/s-pen.json` con valores redondos, y aplicar el mejor a `frontend/recognizer.js`. Verificación: tabla de aciertos por forma impresa por `node --test frontend/test/reconocedor.test.js`; los tests sintéticos de `baseline.test.js` y las guardas de 1.1 siguen en verde.
- [x] 2.2 Si quedan trazos cerrados a mano como `open`, subir el umbral de cierre lo mínimo que los arregle. Verificación: las guardas de 1.1 siguen en verde (la "U" y el arco no se vuelven formas).
- [x] 2.3 (No hizo falta: el rectángulo llegó a 9/10 con 2.1 y 2.2.) Solo si el rectángulo sigue por debajo de 9/10: añadir **una** métrica nueva (design.md §1, paso 3) probándola antes con el script. Verificación: las tres formas llegan a 9/10 o más en los 30 trazos de ajuste, sin romper 1.1 ni `baseline.test.js`. Si aun así no llega, se detiene el apply y se consulta.
- [x] 2.4 Anotar en design.md los parámetros elegidos y la tabla de aciertos de ajuste. Verificación: el design lleva ambas cosas.

## 3. Validación con trazos nuevos (sesión del usuario, unos 5 min)

- [x] 3.1 El usuario abre `?grabar` en la tablet, limpia el ejemplo y dibuja **10 trazos nuevos de cada forma** con el S Pen (distintos de los anteriores: otros tamaños, velocidades y puntos de cierre), descarga el archivo y lo copia a `frontend/test/fixtures/trazos/s-pen-validacion.json`. Verificación: el JSON se lee y contiene al menos 10 trazos por forma, todos con `tipo` `pen`.
- [x] 3.2 Medir los trazos de validación **sin reajustar nada**. Verificación: `node --test frontend/test/reconocedor.test.js` muestra la tabla con el 90 % por forma en cada archivo. Si una forma queda por debajo, se detiene el apply y se sigue design.md §2.

## 4. Test y cierre (0,2 h)

- [x] 4.1 En `frontend/test/reconocedor.test.js`: quitar el `todo` y exigir el 90 % por forma y por tipo de diagrama en cada archivo de `fixtures/trazos/` y también en el conjunto. Verificación: el test pasa; con una copia temporal de un fixture en la que se intercambian las etiquetas de rombo y rectángulo falla y nombra el archivo (se deshace el cambio).
- [x] 4.2 Actualizar `CLAUDE.md` (el reconocedor ya no es "dos métricas" si se añadió una, y `reconocedor.test.js` ya no está pendiente). Verificación: `grep -n "todo\|ajustar-reconocedor" CLAUDE.md` no devuelve nada.
- [x] 4.3 Comprobar la app en el navegador con la skill `run-trazo-mermaid` y el resto de la suite. Verificación: la salida del driver es idéntica a `frontend/test/baseline-skill.txt` y `node --test "frontend/**/*.test.js"` termina con 0 fallos y 0 `todo`.

## Workflow follow-up

- Archivar con sincronización de specs: se añade el requisito a `shape-recognition`.
- Abrir la PR de `feat/f3-tests-del-frontend` contra `develop`: cierra F3.
- Escribir la entrada de la sesión con `/cerrar-sesion`, con el desvío de horas de F3.
