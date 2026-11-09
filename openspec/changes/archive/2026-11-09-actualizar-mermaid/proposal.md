# Proposal

## Why

La app carga mermaid.js 10.9.1 (publicada el 14-05-2024) desde cdnjs. Nadie eligió esa versión: viene del
prototipo inicial y los documentos solo la repiten. `npm audit` le encuentra 10 avisos de seguridad de
Mermaid (1 alto, 7 moderados, 2 bajos). El alto es una contaminación de prototipo en el DOMPurify que
Mermaid lleva dentro, y DOMPurify es justo el sanitizador del que depende `securityLevel: 'strict'`, la
defensa que introduce `vista-previa-segura`. Además el `<script>` no lleva `integrity`: si el archivo del
CDN se alterase, el navegador lo ejecutaría sin avisar.

Corresponde al bloque **F1** del PRD (la vista previa segura y el criterio de terminado 8: "las etiquetas
no pueden inyectar HTML en la vista previa de ningún usuario") y prepara HU-01 y HU-02, en las que la vista
previa muestra etiquetas de otras personas. No está en el presupuesto del PRD; se estima en 0,5 h y
conviene hacerlo antes de F4, cuando el diagrama empiece a compartirse.

## What Changes

- mermaid.js pasa de 10.9.1 a **10.9.8**, el último parche de la rama 10: misma API (`window.mermaid`,
  `initialize`, `render`) y sin ninguno de los avisos de Mermaid de la 10.9.1.
- El `<script>` del CDN lleva `integrity` (SRI, el hash que publica cdnjs) y `crossorigin="anonymous"`: si
  el archivo servido no coincide, el navegador no lo ejecuta y la vista previa muestra el aviso que ya
  existe ("No se pudo cargar mermaid.js…"), mientras el lienzo y el código siguen funcionando.
- `readme.md`, el único documento vivo que nombra la versión (tabla de tecnologías), pasa a 10.9.8.

Queda fuera:
- Pasar a mermaid 11 o 12. Son versiones mayores que pueden cambiar el aspecto del SVG, la API o el
  sanitizado; se evalúan en otro cambio, con su propia comparación de capturas.
- Cargar Mermaid como módulo ES (`import`): `modularizar-frontend` D4 lo descartó para que un fallo del
  CDN no tumbe la app.
- El aviso bajo de KaTeX (dependencia de Mermaid) que sigue en 10.9.8: no lo usamos (no hay fórmulas) y
  solo se resuelve en Mermaid 12.

No choca con el "fuera de alcance" del MVP: no añade funciones ni dependencias nuevas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `canvas-editing`: el requisito "App servida sin build" pasa a exigir que mermaid.js se cargue en una
  versión fijada y con comprobación de integridad, y que un archivo alterado no se ejecute.

## Impact

- Código: solo `frontend/index.html` (la etiqueta `<script>` de Mermaid). Sin cambios en los módulos.
- Documentación: `readme.md` (tabla de tecnologías y una nota sobre cómo actualizar la versión y su
  hash). Los cambios archivados que citan 10.9.1 no se tocan: describen el estado de entonces.
- Comprobado antes de proponerlo: con 10.9.8 el ejemplo se renderiza idéntico píxel a píxel a 10.9.1 y
  Estados también funciona; cdnjs sirve el archivo con `Access-Control-Allow-Origin: *`, que `crossorigin`
  necesita.
- Sin efecto en operaciones, Java ni datos guardados.
- Independiente de `vista-previa-segura` y de `direccion-estados`, que tocan otros archivos; complementa al
  primero, porque su modo estricto confía en el DOMPurify de Mermaid.
