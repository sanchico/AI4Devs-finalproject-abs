# Tasks

Estimación total: 0,5 h (una sesión corta). No está en el presupuesto del PRD: refuerza la seguridad de F1.

## 1. Versión e integridad (0,2 h)

- [x] 1.1 Antes de tocar nada, guardar con la skill `run-trazo-mermaid` una captura del ejemplo de Flujo y otra de un diagrama de Estados con dos estados y una conexión (versión 10.9.1); verificar que la skill imprime la salida de `frontend/test/baseline-skill.txt` y `OK`
- [x] 1.2 En `frontend/index.html`, cambiar el `<script>` de Mermaid a `https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.8/mermaid.min.js` con `integrity` (hash SHA-512 de la API de cdnjs, contrastado con `openssl dgst -sha512 -binary mermaid.min.js | openssl base64 -A`) y `crossorigin="anonymous"`; verificar que la página carga sin ningún error de integridad ni de otro tipo en la consola
- [x] 1.3 Actualizar la tabla de tecnologías de `readme.md` (10.9.1 → 10.9.8) y añadir una nota de que al cambiar de versión hay que cambiar también el hash `integrity`; verificar con `grep -rn "10.9.1" readme.md frontend/` que no queda ninguna mención fuera de los cambios archivados

## 2. Comprobación en el navegador (0,3 h)

- [x] 2.1 Repetir la skill y las dos capturas de 1.1 con 10.9.8; verificar que la salida es la de `frontend/test/baseline-skill.txt`, que la captura del ejemplo de Flujo es idéntica y que la de Estados no cambia (o documentar y aceptar cualquier diferencia)
- [x] 2.2 Con Playwright, interceptar la petición de mermaid.min.js y servirla con un byte cambiado; verificar que el navegador la bloquea por integridad, que la vista previa muestra "No se pudo cargar mermaid.js; el código sigue disponible en la pestaña Código." y que se puede dibujar un rectángulo y ver su código en la pestaña "Código Mermaid"
- [x] 2.3 Verificar con `npm audit` en un directorio temporal (`npm i --package-lock-only mermaid@10.9.8`) que no queda ningún aviso de Mermaid, y anotar el resultado en el commit

## Workflow follow-up

- Abrir la PR contra `develop`. No pisa a `vista-previa-segura` ni a `direccion-estados` (tocan otros
  archivos); con `vista-previa-segura` fusionado, repetir su comprobación de etiquetas hostiles sobre 10.9.8.
- Proponer más adelante un cambio para evaluar Mermaid 11 o 12, con comparación de capturas.
- Archivar el cambio con `/opsx:archive` y registrar la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
