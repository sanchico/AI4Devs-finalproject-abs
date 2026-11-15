# Design

## Context

Ver proposal.md (Why). Estado de `recognize(pts, allowedShapes)` en `frontend/recognizer.js`:

- Descarta trazos de menos de 25 px de recorrido o 12 px de diagonal. Considera **cerrado** el trazo cuyo
  inicio y final distan menos de `0,28 · diagonal + 12` px; si no, devuelve `open`.
- Con un trazo cerrado calcula `r` (área del polígono del trazo entre el área de la caja) y `cd` (distancia
  media de las cuatro esquinas de la caja al trazo, entre la diagonal) y elige la forma permitida con menor
  `|r − r*| + 2,2 · |cd − cd*|`. Prototipos: rect `r .93 cd .03`, elipse `r .78 cd .146`, rombo `r .5 cd .25`.
- `baseline.test.js` fija sus resultados con trazos sintéticos exactos y los tests de trazo abierto
  (línea de 200 px) y de trazo diminuto. El conector depende de que un trazo abierto lo sea de verdad.

Medición de los 30 trazos reales de `fixtures/trazos/s-pen.json` (solo lectura, hecha al proponer):

| Forma | `r` | `cd` | hueco de cierre / límite |
|---|---|---|---|
| Rectángulo | 0,54 – 0,84 | 0,03 – 0,15 | hasta 0,58 |
| Elipse | 0,53 – 0,80 | 0,127 – 0,169 | 0,56 – 1,17 (uno abierto) |
| Rombo | 0,37 – 0,57 | 0,16 – 0,25 | 0,31 – 1,24 (uno abierto) |

Lo que explica los fallos: el área de un rectángulo hecho a mano (0,54–0,84) queda muy lejos del prototipo
0,93, así que ese término penaliza al rectángulo y favorece a la elipse (0,78). El prototipo de `cd` sí separa
rectángulo y elipse (0,03 frente a 0,146), pero con peso 2,2 no compensa. Un tanteo con otros prototipos
(rect `r .75 cd .07`, elipse `r .70 cd .15`, rombo `r .47 cd .21`) y cierre 0,35 dio 8/10, 9/10 y 9/10 sobre
estos mismos trazos: encamina, pero el rectángulo aún no llega a 9.

## Goals / Non-Goals

**Goals:**
- Que el reconocedor llegue al 90 % por forma con trazos reales, medido con trazos que no se usaron para ajustar.
- No empeorar los trazos sintéticos exactos ni la detección de conectores.

**Non-Goals:**
- Otro algoritmo de reconocimiento ni más formas.
- Ajustar para el ratón o el dedo.

## Decisions

### 1. Orden de los intentos: parámetros, cierre y, solo si hace falta, una métrica

1. Ajustar prototipos y pesos de las dos métricas actuales.
2. Subir el umbral de cierre (hoy `0,28 · diag + 12`) para los trazos con hueco, que son 2 de los 6 fallos.
3. Si con 1 y 2 el rectángulo no llega a 9/10, añadir **una** métrica nueva. Candidata: la fracción del
   trazo que va pegada a los lados de la caja (un rectángulo recorre los lados; una elipse solo los toca en
   cuatro puntos). Se prueba con los mismos 30 trazos antes de adoptarla.

Se prefiere lo más pequeño: cada parámetro nuevo puede sobreajustarse a 30 trazos.

- *Alternativa:* cambiar a un reconocedor por plantillas ($P). Descartada: es la hoja de ruta, mucho más
  grande y no cabe en lo que queda de F3.

### 2. Se ajusta con unos trazos y se mide con otros

Con 10 trazos por forma es fácil dejar un reconocedor que acierta solo esos. Por eso:

- **Ajuste**: los 30 trazos de `s-pen.json`.
- **Validación**: 30 trazos nuevos que el usuario graba con `?grabar` **después** de dejar fijados los
  parámetros (`s-pen-validacion.json`). Hasta entonces no existe el archivo, así que ni el ajuste ni el test
  los ven.
- Una vez medida la validación **no se vuelve a tocar el reconocedor para que pase**. Si queda por debajo del
  90 %, se detiene el apply y se decide con el usuario (más muestras y reajustar con las 60, o dejarlo).

La búsqueda es un script de scratchpad (no entra en el repositorio) que recorre una rejilla pequeña de
parámetros con valores redondos sobre los 30 trazos de ajuste. El resultado y la tabla de aciertos quedan
escritos en este design al aplicar.

- *Alternativa:* separar 7 trazos para ajustar y 3 para comprobar. Descartada: 3 trazos por forma no
  distinguen un 90 % de un 67 %.

### 3. El test mide cada archivo por separado y todos juntos

`reconocedor.test.js` ya junta los archivos. Se añade que **cada archivo** cumpla el 90 % por sí solo, de
modo que un archivo de validación no se diluya dentro de uno más grande, y se quita el `todo`.

### 4. Guardas antes de tocar nada

Antes de cambiar parámetros se añaden tests de trazos abiertos sintéticos que hoy pasan: una línea, una "L",
una "U" y un arco de media circunferencia deben seguir siendo `open`. Subir el umbral de cierre es el cambio
con más riesgo: una "U" cuyos extremos quedan a poca distancia pasaría a considerarse cerrada y un conector
curvo se convertiría en una forma.

## Impacto

- **Interfaz del reconocedor:** ninguno. Misma función, mismos tipos de resultado.
- **Modelo, operaciones y Mermaid:** ninguno. Solo cambia qué forma se elige para un trazo.
- **App:** un trazo de rectángulo hecho a mano pasa a crear un `rect` en lugar de una elipse; sin migración,
  porque no hay datos guardados.

## Risks / Trade-offs

- [Sobreajuste a 30 trazos de una sola persona] → Validación con 30 trazos distintos y sin reajustar después.
  Aun así son del mismo usuario y dispositivo; la medición no cubre a otras personas.
- [Subir el umbral de cierre convierte conectores curvos en formas] → Guardas de la decisión 4 antes de
  cambiarlo, y se sube lo mínimo que arregle los dos trazos con hueco.
- [El rectángulo no llega a 9/10 sin una métrica nueva] → Está previsto en la decisión 1, paso 3. Si aun así no
  llega, se detiene el apply y se decide con el usuario.
- [Las horas: F3 ya pasó de 1,5 h] → Este change añade unas 0,6 h y la sesión de grabación. Se anota el
  desvío en la bitácora; el recorte del PRD "fixtures del reconocedor sin grabar nuevos" ya no aplica porque
  los fixtures están grabados.

## Resultado del ajuste

Búsqueda en rejilla (valores redondos) sobre los 30 trazos de `s-pen.json`, exigiendo además que los tres
trazos sintéticos exactos sigan bien clasificados y que las cuatro guardas abiertas sigan abiertas. Bastó
cambiar dos cosas, sin métrica nueva (la decisión 1, paso 3, no se necesitó):

| Parámetro | Antes | Ahora |
|---|---|---|
| Prototipo del rectángulo | `r .93, cd .03` | `r .75, cd .10` |
| Hueco máximo para considerar cerrado el trazo | `0,28 · diag + 12` | `0,4 · diag + 12` |

Elipse, rombo y el peso 2,2 no cambian. El rectángulo en `r .75` queda en una meseta estable: con `cd` de
0,09 a 0,11 da 9/10, y con `r .8 cd .09` o `r .85 cd .11` también, así que no es un punto de arista.

| Forma | Antes | Ajuste (30 trazos) |
|---|---|---|
| Rectángulo | 4/10 | 9/10 (1 como elipse) |
| Rombo | 9/10 | 10/10 |
| Elipse | 8/10 | 9/10 (1 como rombo) |

El cierre en 0,4 es el mínimo de la rejilla que arregla los dos trazos con hueco (el del rombo pide algo más
de 0,36). La "U", la "L", la línea y el arco siguen siendo abiertos. Queda pendiente la medición con los
trazos de validación (tarea 3).

## Resultado de la validación

Medido con `s-pen-validacion.json` (30 trazos nuevos, todos `pen`), sin tocar el reconocedor. Igual en Flujo y en Estados:

| Forma | Aciertos | Fallos |
|---|---|---|
| Rectángulo | 10/10 | |
| Rombo | 10/10 | |
| Elipse | 8/10 | 2 como rectángulo |

La elipse queda por debajo del 90 %. Según §2 se detiene el apply y se decide con el usuario.

## Reajuste con las 60 muestras

Tras la validación fallida (opción 1 elegida por el usuario) se reajusta con los 60 trazos (`s-pen.json` + `s-pen-validacion.json`), con la misma búsqueda y las mismas restricciones (sintéticos exactos y guardas abiertas). Ya no hay trazos de validación sin ver: se graban otros 10 por forma (`s-pen-validacion2.json`) y se miden sin tocar nada más.

| Parámetro | Antes | Ahora |
|---|---|---|
| Rectángulo | `r .75, cd .10` | `r .75, cd .09` |
| Elipse | `r .78, cd .146` | `r .75, cd .16` |
| Rombo | `r .5, cd .25` | `r .45, cd .25` |

Peso 2,2 y cierre 0,4 no cambian. Resultado sobre las 60: 19/20 en cada forma (95 
## Reajuste con las 60 muestras

Tras la validación fallida (el usuario eligió reajustar) se reajusta con los 60 trazos (`s-pen.json` y `s-pen-validacion.json`), con la misma búsqueda y las mismas restricciones (sintéticos exactos y guardas abiertas). Ya no quedan trazos de validación sin ver: se graban otros 10 por forma (`s-pen-validacion2.json`) y se miden sin tocar nada más.

| Parámetro | Antes | Ahora |
|---|---|---|
| Rectángulo | `r .75, cd .10` | `r .75, cd .09` |
| Elipse | `r .78, cd .146` | `r .75, cd .16` |
| Rombo | `r .5, cd .25` | `r .45, cd .25` |

Peso 2,2 y cierre 0,4 no cambian. Resultado sobre las 60: 19/20 en cada forma (95 %), el máximo de la rejilla; se eligió el candidato más cercano a los parámetros anteriores.
