# Tasks

Estimación total: 0,5 h. Parte de `modularizar-frontend`, ya aplicado y archivado.

## 1. Escape en el generador (0,2 h)

- [x] 1.1 Ampliar `esc` en `frontend/kinds/index.js` para escribir `&` → `#amp;`, `<` → `#lt;` y `>` → `#gt;` (en ese orden) antes del escape de comillas; verificar con un test nuevo en `frontend/test/` (`node --test "frontend/**/*.test.js"`; con Node 24, `node --test frontend/` trata el directorio como un archivo y falla) que `a<b & c>d` genera `n1["a#lt;b #amp; c#gt;d"]` y que el test de línea base sigue en verde

## 2. Render seguro (0,3 h)

- [x] 2.1 Cambiar `securityLevel` a `'strict'` en `frontend/render.js` y mostrar el error de Mermaid con `textContent`; verificar con `grep -n "innerHTML" frontend/render.js` que ningún `innerHTML` recibe texto del usuario sin pasar por Mermaid (queda `box.innerHTML = svg`, ya sanitizado en modo estricto; el aviso de error pasa a `textContent`)
- [ ] 2.2 Con la skill `run-trazo-mermaid`, poner la etiqueta `<img src=x onerror=alert(1)>` a un nodo de flujo, `<b>sí</b>` a un conector y `<script>alert(1)</script>` a un estado; verificar en la captura que se ven como texto, que la página no tiene ningún `img` dentro de `#preview` y que no salta ningún diálogo
- [ ] 2.3 Verificar que la salida normal de la skill `run-trazo-mermaid` sigue siendo la de la línea base (`frontend/test/baseline-skill.txt`) y que el ejemplo se ve igual que antes en la captura
