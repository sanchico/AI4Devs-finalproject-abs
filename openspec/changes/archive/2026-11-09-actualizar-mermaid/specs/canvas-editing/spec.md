# Spec Delta

## MODIFIED Requirements

### Requirement: App servida sin build
El sistema SHALL funcionar sirviendo la carpeta `frontend/` con cualquier servidor HTTP estático, sin paso
de build ni dependencias instaladas, y con mermaid.js cargado desde un CDN en una versión exacta (nunca un
alias como "latest" o "10") y con comprobación de integridad, de modo que el navegador MUST NOT ejecutar
un archivo de mermaid.js distinto del esperado.

#### Scenario: Servidor estático
- **WHEN** se sirve `frontend/` con `npx http-server` y se abre en el navegador de la tablet
- **THEN** la app carga sin errores en la consola y el ejemplo se ve en el lienzo y en la vista previa

#### Scenario: Archivo de mermaid.js alterado
- **WHEN** el CDN sirve un mermaid.js cuyo contenido no coincide con el hash de integridad declarado
- **THEN** el navegador no lo ejecuta, la vista previa muestra "No se pudo cargar mermaid.js; el código sigue disponible en la pestaña Código." y el lienzo y el código Mermaid siguen funcionando
