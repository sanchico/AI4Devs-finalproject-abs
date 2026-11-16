# Proposal

## Why

Cierra el bloque **F3** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7), criterio de terminado 9: "la
precisión del reconocedor se mantiene en ≥ 90 % por forma". Respalda la historia **HU-01** (dibujar): si el
lápiz produce la forma equivocada, el usuario no puede dibujar juntos nada útil.

El change `grabar-trazos` midió el reconocedor con 30 trazos reales del S Pen y quedó por debajo en dos formas:

| Forma | Aciertos | Fallos |
|---|---|---|
| Rectángulo | 4/10 | 6 como elipse |
| Rombo | 9/10 | 1 como trazo abierto |
| Elipse | 8/10 | 1 como rombo y 1 como trazo abierto |

El test de precisión de [reconocedor.test.js](../../../frontend/test/reconocedor.test.js) está marcado `todo` hasta
este change. Es el fallo [2] de `notas/mejoras.md`: un rectángulo a mano no llega al `r = 0,93` del prototipo
(sus áreas reales van de 0,54 a 0,84, porque no se cierra del todo y los lados se curvan), así que el
reconocedor lo compara con la elipse y gana la elipse.

Los dos trazos "abiertos" son trazos cerrados a mano con un hueco mayor que el 28 % de la diagonal + 12 px
que admite hoy `recognize`.

## What Changes

- **Ajustar `recognize()`** (`frontend/recognizer.js`) para que los trazos reales de las tres formas
  lleguen al 90 %: los prototipos y pesos de las dos métricas actuales y, si no bastan, el umbral con el que
  un trazo se considera cerrado. Solo se admite un cambio que añada una métrica nueva si el ajuste de lo
  existente no llega (design.md).
- **Validar con trazos que no se usaron para ajustar**: el usuario graba otros 10 trazos por forma con
  `?grabar` (`s-pen-validacion.json`). Los 30 actuales sirven para ajustar; la medición del 90 % que cuenta
  es la de los nuevos.
- **Quitar el `todo`** de `reconocedor.test.js`: el test exige el 90 % por forma y por tipo de diagrama en
  todos los archivos de `fixtures/trazos/`.
- **Spec**: nuevo requisito de precisión mínima con trazos reales en `shape-recognition`.
- Los tests de trazos sintéticos de `baseline.test.js` y el código Mermaid del ejemplo no cambian.

## Fuera de alcance

- Un reconocedor distinto ($P u otro algoritmo, más formas, flechas UML): hoja de ruta, tras la entrega.
- Reconocer conectores o escritura a mano mejor.
- Mejorar el resultado para ratón o dedo: los trazos medidos son los del S Pen.
- No choca con el "fuera de alcance" del MVP.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities
- `shape-recognition`: nuevo requisito de precisión mínima del 90 % por forma sobre trazos reales; los requisitos existentes no cambian.

## Impact

- `frontend/recognizer.js` (parámetros del reconocedor; el tipo de resultado y su firma no cambian).
- `frontend/test/reconocedor.test.js` (se quita el `todo`) y `frontend/test/fixtures/trazos/s-pen-validacion.json`.
- `CLAUDE.md`: el texto del reconocedor y la nota de `reconocedor.test.js`.
- `openspec/specs/shape-recognition/spec.md`: un requisito más.
- **Requiere al usuario**: otros 5 minutos con el S Pen para 30 trazos de validación.
