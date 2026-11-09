# Proposal

## Why

La vista previa renderiza Mermaid con `securityLevel: 'loose'` y mete el SVG resultante con `innerHTML`.
Hoy solo afecta a quien dibuja, pero en cuanto el diagrama sea compartido (F4) una etiqueta con HTML se
ejecutaría en el navegador de todos los miembros. Es la segunda parte del bloque **F1 · Modularizar el
frontend** del PRD y el criterio de terminado 8 ("las etiquetas no pueden inyectar HTML en la vista
previa de ningún usuario"). Conviene cerrarlo antes de que exista la colaboración. Prepara HU-01 y
HU-02, en las que otras personas ven tus etiquetas.

## What Changes

- La vista previa pasa a `securityLevel: 'strict'`.
- Los caracteres `<`, `>` y `&` de las etiquetas de nodos y conectores se escriben en el código Mermaid
  como entidades de Mermaid (`#lt;`, `#gt;`, `#amp;`), de modo que se muestran como texto literal y no
  como HTML.
- El mensaje de error de Mermaid, que puede contener el texto de una etiqueta, se muestra como texto y no
  con `innerHTML`.
- Test con `node --test` de la generación con etiquetas hostiles, y comprobación en el navegador con la
  etiqueta `<img src=x onerror=alert(1)>`.

Queda fuera:
- Validar o limitar las etiquetas en el servidor (máximo de 200 caracteres): es B4.
- El carácter `|` en etiquetas de conectores de flujo, que hoy rompe la sintaxis pero no inyecta HTML.
- Actualizar mermaid.js a otra versión.

No choca con el "fuera de alcance" del MVP: aplica la invariante de seguridad del proyecto (Mermaid con
`securityLevel: 'strict'`).

## Capabilities

### New Capabilities

- `mermaid-preview`: render de la vista previa Mermaid y su seguridad frente a etiquetas con HTML.

### Modified Capabilities

- `mermaid-generation`: el requisito "Escape de comillas y saltos de línea en etiquetas" se amplía con
  `&`, `<` y `>` (`#amp;`, `#lt;`, `#gt;`) y un escenario nuevo. Es un MODIFIED sobre la spec principal
  que dejó `modularizar-frontend` al archivarse.

## Impact

- Código: `frontend/kinds/index.js` (función de escape) y `frontend/render.js` (configuración de Mermaid
  y aviso de error). Parte de `modularizar-frontend`, ya aplicado y archivado.
- El código Mermaid copiado lleva `#lt;`/`#gt;`/`#amp;` en lugar de esos caracteres; Mermaid lo
  muestra igual en cualquier sitio que lo renderice (GitHub, mermaid.live).
- Sin dependencias nuevas. No afecta a operaciones ni a Java.
