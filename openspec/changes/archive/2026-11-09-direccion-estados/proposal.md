# Proposal

## Why

En un diagrama de estados, el código Mermaid empieza con `direction TD`, pero Mermaid solo admite `TB`,
`BT`, `RL` y `LR` en `stateDiagram-v2`. Con `TD` interpreta `direction` y `TD` como dos estados más: la
vista previa dibuja dos cajas sueltas que el usuario no ha creado, y lo mismo pasa en cualquier sitio
donde se pegue el código copiado (comprobado con mermaid.js 10.9.1). Ocurre con la dirección por
defecto, "Arriba → abajo", así que afecta a todo diagrama de Estados desde el primer trazo.

Es un defecto del código entregado en el bloque **F1** del PRD (generación del tipo Estados), sin
historia de usuario propia: degrada la salida que HU-01 y HU-02 comparten entre personas. No está en el
presupuesto del PRD; se estima en 0,5 h y conviene cerrarlo antes de F2, que guarda la dirección en la
base de datos y en la operación `setMeta`.

## What Changes

- Al generar un diagrama de Estados, la dirección "Arriba → abajo" se escribe como `direction TB` en
  lugar de `direction TD`; "Izquierda → derecha" sigue siendo `direction LR`.
- El diagrama de Flujo no cambia: `flowchart TD` es válido y se mantiene.
- El selector de dirección, el valor que guarda el modelo (`TD` o `LR`) y el comportamiento de la
  interfaz no cambian. La traducción ocurre solo al escribir el código Mermaid.
- Tests con `node --test` de la cabecera de Estados en las dos direcciones, y comprobación en el navegador
  de que la vista previa ya no dibuja las cajas "direction" y "TD".

Queda fuera:
- Añadir las direcciones "Abajo → arriba" (`BT`) y "Derecha → izquierda" (`RL`) al selector: es una
  función nueva, no un arreglo.
- Cambiar el valor guardado de la dirección de `TD` a `TB`: afectaría al modelo, a la columna
  `diagrams.direction` y a `setMeta` (F2), y habría que migrar datos; la traducción en el generador evita
  todo eso.
- Validar que el código generado sea sintácticamente correcto para cualquier etiqueta (por ejemplo el
  carácter `|` en conectores de flujo, ya identificado en `vista-previa-segura`).

No choca con el "fuera de alcance" del MVP: no añade tipos de diagrama ni funciones.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mermaid-generation`: cambian dos requisitos. "Código de un diagrama de estados" pasa a especificar
  la palabra clave de dirección que admite Mermaid en ese tipo, y "Dirección del diagrama" deja de
  afirmar que la cabecera lleva literalmente `TD` o `LR` para todos los tipos.

## Impact

- Código: `frontend/kinds/state.js` (la función `header` traduce la dirección). Sin cambios en
  `frontend/kinds/flow.js`, el modelo, la interfaz ni el selector.
- El código Mermaid copiado de un diagrama de Estados cambia en una línea (`direction TB`); es el valor
  que Mermaid documenta, así que se ve igual o mejor en cualquier renderizador (GitHub, mermaid.live).
- Tests: un archivo nuevo en `frontend/test/`. La línea base de Flujo (`baseline-ejemplo.mmd`) no se toca.
- Sin dependencias nuevas. No afecta a operaciones ni a Java, ni a datos ya guardados, porque hoy no se
  guarda nada.
- Convive con `vista-previa-segura`, que modifica otro requisito de la misma spec
  (`Escape de comillas y saltos de línea en etiquetas`); no se pisan.
