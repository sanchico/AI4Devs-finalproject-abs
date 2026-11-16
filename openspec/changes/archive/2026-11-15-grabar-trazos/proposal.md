# Proposal

## Why

Último change del bloque **F3 · Tests del frontend** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7) y
criterio de terminado 9: "la precisión del reconocedor se mantiene en ≥ 90 % por forma". Respalda la
historia **HU-01** (dibujar), que depende de que el lápiz produzca la forma que el usuario quiso, pero no la
cambia.

Hoy ese criterio no se puede comprobar. `baseline.test.js` clasifica trazos **sintéticos perfectos**
(polígonos y elipses exactos), que el reconocedor acierta siempre, así que no detectan el fallo conocido de
`notas/mejoras.md` [2]: un rectángulo a mano con esquinas redondeadas se clasifica como elipse. Para medir la
precisión hacen falta trazos reales del S Pen, y la app no tiene forma de guardarlos.

## What Changes

- **Modo de grabación** `?grabar`: al abrir la página con ese parámetro aparece un panel donde el usuario
  elige la forma que va a dibujar (rectángulo, rombo o elipse), dibuja con el lápiz y la app **guarda el
  trazo en vez de reconocerlo**. El panel muestra cuántos trazos hay de cada forma, permite descartar el
  último y descargar todo en un archivo JSON. Sin el parámetro la app se comporta exactamente como ahora.
- **Fixtures de trazos** en `frontend/test/fixtures/trazos/`: 10 trazos por forma dibujados con el S Pen en la
  tablet, grabados con ese modo.
- **Test de precisión del reconocedor** que clasifica los trazos grabados en cada tipo de diagrama, imprime la
  tabla de aciertos y mide contra el 90 % por forma. Un trazo reconocido como otra forma, como trazo abierto o
  como demasiado pequeño cuenta como fallo. La medición real (rectángulo 4/10, elipse 8/10) quedó por debajo,
  así que el test está marcado como pendiente (`todo`) hasta el change `ajustar-reconocedor`, que también
  añadirá a la spec `shape-recognition` el requisito de precisión.
- No cambia el reconocedor ni el modelo.

## Fuera de alcance

- Mejorar el reconocedor o añadir formas ($P, clases UML…): hoja de ruta, tras la entrega. Este change solo
  mide. Si una forma no llega al 90 %, se informa y la decisión es del usuario (design.md, riesgo 1).
- Grabar y medir conectores (trazos abiertos entre nodos) o la escritura a mano.
- Fixtures con ratón: el criterio habla del S Pen. El modo graba también con ratón, pero no se miden.
- Guardar los trazos entre recargas de la página o enviarlos a un servidor: se descargan a mano.
- No choca con el "fuera de alcance" del MVP.

## Capabilities

### New Capabilities
- `stroke-recording`: modo `?grabar` para capturar trazos reales por forma y exportarlos a JSON sin tocar el diagrama.

### Modified Capabilities

Ninguna. El requisito de precisión mínima sobre trazos reales se añade a `shape-recognition` en `ajustar-reconocedor`, cuando el reconocedor pueda cumplirlo; añadirlo aquí dejaría la spec afirmando algo falso.

## Impact

- Nuevo `frontend/grabacion.js` (estado de la grabación y formato del JSON, puro y probable desde Node).
- `frontend/input.js`, `main.js`, `index.html` y `styles.css`: panel y desvío de los trazos al grabador solo con `?grabar`.
- Nuevo `frontend/test/grabacion.test.js`, `frontend/test/reconocedor.test.js` y `frontend/test/fixtures/trazos/*.json`.
- `CLAUDE.md`: modo de grabación y nuevos tests. `openspec/specs/`: nueva `stroke-recording`.
- **Requiere al usuario**: una sesión de unos 5 minutos con el S Pen para dibujar los 30 trazos.
