# Design

## Context

Ver proposal.md (Why). Punto de partida:

- `recognize(pts, allowedShapes)` (`frontend/recognizer.js`) es puro. Devuelve `{type:'shape', shape, bb}`,
  `{type:'open'}` o `{type:'none'}`. Compara dos métricas (área relativa a la caja y distancia media a las
  esquinas) con tres prototipos y un peso de 2,2 para la segunda.
- `input.js` recoge los puntos con Pointer Events en coordenadas del lienzo (`clientX - rect.left`) y al
  soltar llama a `recognize`. `pointerType` es `pen`, `touch` o `mouse`; el ratón dibuja o mueve según un botón.
- Los tests actuales usan trazos sintéticos perfectos (`baseline.test.js`) y no detectan el fallo de
  `notas/mejoras.md` [2].
- Los módulos puros se pueden importar desde Node; `input.js`, `main.js` y `render.js` no.
- El PRD (F3) pide `?grabar` y 10 trazos por forma con el S Pen; las horas que quedan de F3 son unas 0,45 h.

## Goals / Non-Goals

**Goals:**
- Poder grabar trazos reales en la tablet sin tocar el diagrama y sacarlos como datos.
- Un test que mida la precisión por forma y tipo con esos datos, y que no pueda pasar en vacío.

**Non-Goals:**
- Cambiar el reconocedor. Este change mide; ajustar umbrales es otro change.
- Persistencia de las muestras o sincronización con un servidor.

## Decisions

### 1. El trazo se guarda tal cual lo ve el reconocedor

La muestra es la lista de puntos que `input.js` ya produce para `recognize`, redondeada a un decimal. El
test llama a `recognize(pts, formas)` con ese mismo dato, así que mide lo que ocurre en la app. Cada trazo
lleva además su `pointerType`.

- *Alternativa:* guardar eventos crudos con presión y tiempo. Descartada: el reconocedor no los usa y el
  archivo crecería sin que el test los aprovechara.

### 2. El estado de la grabación vive en un módulo puro

`frontend/grabacion.js` (sin DOM): lista de muestras por forma, `añadir(forma, tipo, pts)`, `descartarUltimo()`,
contadores y `aJSON()`. La interfaz (panel, botones, descarga) es una capa fina en `main.js`/`input.js`.
Así el formato del archivo se prueba desde Node y el navegador solo se comprueba a mano y con el driver de
la skill `run-trazo-mermaid`.

Formato:

```
{ "dispositivo": "<userAgent>", "formas": { "rect": [ {"tipo":"pen","pts":[{x,y},…]}, … ], "diamond": […], "ellipse": […] } }
```

Un único archivo, con las tres formas, porque es una sola descarga en la tablet. Va a
`frontend/test/fixtures/trazos/` (por ejemplo `s-pen.json`) y el test lee todos los `*.json` de esa carpeta.

### 3. Con `?grabar` el trazo se desvía antes de reconocerlo

En `finish()` de `input.js`, si el modo está activo y el modo del puntero es dibujar, el trazo va a la
grabación y no a `recognize`. No se pasa por `model`, así que no hay operaciones, ni deshacer, ni cambios en
el Mermaid. El toque corto (menos de 500 ms y sin mover) no es un trazo: no se graba.

El dedo sigue moviendo nodos (no habrá ninguno en pantalla si se limpia antes; se mantiene el comportamiento
actual para no tocar `input.js` más de lo necesario). El panel pide elegir la forma antes de dibujar; con la
forma sin elegir no se graba nada.

- *Alternativa:* un segundo `canvas` o una página `grabar.html`. Descartada: duplicaría el modo de dibujar y
  grabaría trazos con otro código de captura, lo que invalida la medición.

### 4. Descarga con un `Blob` y un enlace, con alternativa en pantalla

`navigator.clipboard` no existe en `http://<ip>:8000` (contexto no seguro, igual que `crypto.randomUUID`),
así que se descarga con `URL.createObjectURL`. Si el navegador no descargara, el panel muestra el JSON en un
área de texto para copiarlo a mano. Es el mismo recurso que ya usa "Copiar" en `main.js`.

### 5. El test mide por tipo y por forma, y cuenta el fallo como fallo

`reconocedor.test.js` lee todos los JSON de `fixtures/trazos/`, y para cada tipo de diagrama y cada forma
cuenta los trazos para los que `recognize` devuelve exactamente `{type:'shape', shape: <la forma>}`. Exige
`aciertos / total ≥ 0,9` y `total ≥ 10`. Imprime la tabla de aciertos y la matriz de confusión (qué forma
esperada salió como cuál) para que un fallo se pueda diagnosticar sin volver a grabar.

Hoy Flujo y Estados admiten las mismas tres formas, así que los dos resultados coinciden; se miden los dos
porque la spec lo pide por tipo y un tipo futuro con otras formas daría otro resultado.

- *Alternativa:* medir solo el total. Descartada: el criterio es "por forma", y un 100 % en rectángulos puede
  esconder un 60 % en elipses.

### 6. Qué hacer si una forma queda por debajo del 90 %

El test asserta el 90 %, así que fallaría. El change no incluye ajustar el reconocedor: es otra decisión
(umbrales, otro algoritmo) con su propio riesgo de romper otras formas. Cuando se midió (rectángulo 4/10, elipse 8/10, rombo 9/10), el usuario eligió la opción (a): un change
aparte `ajustar-reconocedor` antes de cerrar F3. Para que este change pueda archivarse sin dejar la spec
afirmando algo falso, el test de precisión se marca `todo` (el informe se sigue imprimiendo) y el requisito de
precisión se mueve a `ajustar-reconocedor`. Las opciones eran:

- Si todo llega al 90 %: se confirman las fixtures y el change se cierra.
- Si no: se **detiene** el apply, se muestra la tabla y la matriz de confusión y se decide con el usuario entre
  (a) un change aparte `ajustar-reconocedor` antes de cerrar F3, (b) cerrar F3 con ese test marcado
  como pendiente (`todo`) y la medición documentada, o (c) volver a grabar si las muestras eran malas.
  No se rebaja el umbral ni se descartan muestras para que pase.

## Impacto

- **Aplicación sin `?grabar`:** ninguno. El único cambio en un flujo existente es una comprobación `if` en
  `finish()`; sus tests (baseline y escape) deben seguir pasando.
- **Modelo y operaciones:** ninguno.
- **Seguridad:** el parámetro no abre nada nuevo en el servidor; los trazos no salen del navegador salvo la
  descarga que pulsa el usuario. El `userAgent` guardado en el archivo es el del propio dispositivo.

## Risks / Trade-offs

- [Un rectángulo cae como elipse (notas/mejoras.md [2]) y la precisión de rectángulos queda por debajo del
  90 %] → Es lo más probable y es precisamente lo que el change debe mostrar. Se trata con la decisión 6, sin
  rebajar el umbral.
- [Las 30 muestras no representan el uso real: todas parecidas, del mismo tamaño] → Las tareas piden variar
  tamaño, relación de aspecto, velocidad y punto de cierre; la sesión de grabación la hace el usuario.
- [Se pierden las muestras si se recarga la página por error] → Se descarga al terminar cada forma; no se
  añade almacenamiento local para mantener el módulo simple. Son unos 5 minutos de trabajo.
- [El presupuesto de F3 se agota: queda 0,45 h y este change necesita unas 0,5 h más la sesión de dibujo] →
  El PRD ya prevé el recorte "fixtures del reconocedor sin grabar nuevos (−1 h)". Si hiciera falta, se
  graba con menos formas o se deja la medición para antes de P2; se decide al aplicar.
- [Las muestras con ratón o dedo se mezclan con las del S Pen y falsean el 90 %] → Cada trazo guarda su
  `pointerType`; los fixtures de la entrega solo incluyen `pen`, y el test comprueba que son todos `pen`.
