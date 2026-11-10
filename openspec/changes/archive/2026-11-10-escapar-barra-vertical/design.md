# Design

## Context

`esc` (en `frontend/kinds/index.js`) es la única función que prepara las etiquetas para todos los tipos:
la usan los nodos y las aristas. El tipo Flujo escribe la etiqueta de arista entre barras
(`a -->|t| b`), así que un `|` dentro de `t` cierra la etiqueta antes de tiempo. El tipo Estados escribe
`a --> b : t`, donde `|` no es delimitador.

Comprobado con Mermaid 10.9.8 (el de la página), analizando el texto con su propio parser:

| Escritura de la etiqueta `x\|y`      | Resultado                                         |
|--------------------------------------|---------------------------------------------------|
| `-->|x|y| b` (como hoy)              | error de sintaxis                                 |
| `-->|"x\|y"| b` (entre comillas)     | analiza bien; el texto de la arista es `x\|y`     |
| `-->|x#124;y| b` (entidad)           | analiza bien; Mermaid guarda la entidad y la decodifica al dibujar |
| Estados `a --> b : x\|y`             | analiza bien                                      |

## Goals / Non-Goals

**Goals:**
- Que una etiqueta con `|` nunca rompa el diagrama, en Flujo y en Estados.
- No cambiar el código generado para las etiquetas que no llevan `|`.

**Non-Goals:**
- Escapar otros caracteres especiales de Mermaid; auditar la sintaxis completa de etiquetas.
- Distinguir entre etiquetas de nodo y de arista dentro de `esc`.

## Decisions

**1. Entidad `#124;` dentro de `esc`.** Encaja con el mecanismo que ya existe (`#amp;`, `#lt;`, `#gt;`,
`#quot;`), es una línea más y no toca las plantillas de cada tipo.
- Descartada: poner siempre la etiqueta de arista entre comillas (`-->|"t"|`). También funciona, pero
  cambia la línea de todas las aristas con etiqueta, la línea base y el escenario `n3 -->|sí| n4` del
  spec, y obliga a tocar `flow.js` aparte del escape.
- Descartada: comillas solo cuando la etiqueta contiene `|`. Dos formas de escribir lo mismo y más
  casos que probar.
- Descartada: prohibir `|` al editar la etiqueta. Quita al usuario un carácter válido en su texto.

**2. Se escapa en todas las etiquetas, no solo en las de arista.** Dentro de `["..."]` el `|` no
molesta, pero la entidad se dibuja igual (`|`), y un solo `esc` evita ramas por tipo o por posición.

**3. El orden: `&` primero y `|` después de `>`.** `#124;` no contiene `&`, `<` ni `>`, así que
el orden relativo con ellos no importa mientras `&` vaya antes que los demás, como ya exige el spec.

## Risks / Trade-offs

- [La entidad `#124;` podría no decodificarse al dibujar y mostrarse literal] → Es la única parte no
  comprobada por el parser; la tarea 2.1 la verifica en el navegador real con Flujo y con Estados. Si
  falla en alguno, se recurre a las comillas (alternativa 1) solo en ese tipo.
- [Un texto del usuario que ya parezca una entidad, como `#124;`, se interpreta como tal] → Ya ocurre
  con `#lt;` y lo fija un test existente; no se cambia aquí.
