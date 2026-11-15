# Tasks

Estimación: unas 0,5 h de trabajo mío más unos 5 minutos de dibujo del usuario con el S Pen. Quedan unos
0,45 h en F3, así que va justo (design.md, Riesgos).

## 1. Estado de la grabación (0,1 h)

- [x] 1.1 Crear `frontend/grabacion.js` (puro, sin DOM) con `crear()`, `añadir(g, forma, tipo, pts)` (puntos redondeados a un decimal; rechaza una forma que no sea `rect`, `diamond` o `ellipse`), `descartarUltimo(g)` (el último añadido, de cualquier forma), `contar(g)` y `aJSON(g, dispositivo)` con el formato de design.md §2. Verificación: `frontend/test/grabacion.test.js` comprueba contadores, descarte (también sin muestras), redondeo, rechazo de formas desconocidas, que `aJSON` sobrevive a `JSON.parse(JSON.stringify(...))` y que sus trazos son `{tipo, pts}`; `node --test "frontend/**/*.test.js"` pasa.

## 2. Modo `?grabar` en la interfaz (0,2 h)

- [x] 2.1 Añadir en `index.html` y `styles.css` un panel oculto con: tres botones de forma (rectángulo, rombo, elipse) con su contador, "Descartar último", "Descargar" y un área de texto para la alternativa. Verificación: sin `?grabar` el panel no se ve (comprobado en el navegador con la skill `run-trazo-mermaid`).
- [x] 2.2 En `main.js`, si la dirección lleva `grabar`, mostrar el panel, elegir `rect` por defecto, actualizar los contadores y conectar los botones; "Descargar" crea un `Blob` con `aJSON`, lo descarga como `trazos.json` y, si no hay muestras, avisa "No hay trazos grabados" sin descargar; el área de texto muestra el mismo JSON. Verificación: en el navegador, con `?grabar`, dibujar con el ratón un rectángulo, un rombo y una elipse sube cada contador y "Descargar" produce un JSON válido con tres listas.
- [x] 2.3 En `input.js`, en `finish()`, si el modo de grabación está activo y el puntero dibuja, pasar el trazo a la grabación en lugar de `recognize`, sin tocar `model`; el toque corto no se graba. Verificación: con `?grabar` el código Mermaid y los nodos no cambian tras dibujar tres trazos y "Deshacer" dice "Nada que deshacer"; sin `?grabar`, la skill `run-trazo-mermaid` reproduce el mismo resultado que antes (rectángulo, rombo, elipse y conector) y `node --test "frontend/**/*.test.js"` sigue verde.

## 3. Grabar con el S Pen (sesión del usuario, unos 5 min)

- [x] 3.1 El usuario abre `http://<ip-del-pc>:8000/?grabar` en la tablet, **limpia el ejemplo** (Limpiar) y dibuja 10 trazos de cada forma con el S Pen, variando tamaño, relación de aspecto, velocidad y punto donde se cierra el trazo, con algún trazo imperfecto como los reales. Descarga el archivo y lo copia a `frontend/test/fixtures/trazos/s-pen.json`. Verificación: el JSON se lee con `node -e "JSON.parse(require('fs').readFileSync('frontend/test/fixtures/trazos/s-pen.json'))"` y contiene al menos 10 trazos por forma, todos con `tipo` `pen`.

## 4. Test de precisión (0,1 h)

- [x] 4.1 Crear `frontend/test/reconocedor.test.js`: lee todos los `*.json` de `fixtures/trazos/`, comprueba que hay al menos 10 trazos por forma y que todos son `pen`, y para cada tipo de diagrama y cada forma exige `aciertos / total ≥ 0,9`, donde un acierto es `{type:'shape', shape:<la forma>}`. Imprime la tabla de aciertos y la matriz de confusión. Verificación: con las muestras reales dos formas quedaron por debajo del 90 % (rect 4/10, ellipse 8/10): **no se bajó el umbral ni se quitaron muestras**; por decisión del usuario (design.md §6) el test de precisión va marcado `todo` y `ajustar-reconocedor` lo activará. El test de muestra mínima y de `pen` sí pasa.
- [x] 4.2 Comprobar que el test no es vacío: con una copia temporal del JSON en la que se cambia la etiqueta de las formas (rombos como `rect`), el test falla con la forma y el porcentaje en el mensaje (se deshace el cambio). Verificación: la ejecución con esa copia falla y la normal pasa.

## 5. Documentación y comprobación (0,05 h)

- [x] 5.1 Actualizar `CLAUDE.md`: explicar `?grabar` y `grabacion.js` (en la lista de módulos puros), y `reconocedor.test.js` con sus fixtures. Verificación: `grep -n "grabar\|reconocedor.test.js\|grabacion.js" CLAUDE.md` muestra las tres menciones.
- [x] 5.2 Comprobar que todo pasa y que la app sin `?grabar` no cambió. Verificación: `node --test "frontend/**/*.test.js"` termina con 0 fallos y `git diff --stat frontend/recognizer.js frontend/model.js frontend/ops.js` no muestra cambios.

## Workflow follow-up

- Archivar el change con sincronización de specs: se crea `stroke-recording` y se añade el requisito a `shape-recognition`.
- Abrir la PR de la rama `feat/f3-tests-del-frontend` contra `develop` al cerrar F3.
- Escribir la entrada de la sesión con `/cerrar-sesion`.
