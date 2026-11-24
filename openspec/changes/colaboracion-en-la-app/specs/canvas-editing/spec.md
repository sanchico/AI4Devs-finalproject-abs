# Spec Delta

## MODIFIED Requirements

### Requirement: Diagrama de ejemplo al abrir
El sistema SHALL abrir con un diagrama de flujo de ejemplo de 5 nodos y 5 conexiones y el aviso
"Ejemplo cargado: dibuja encima con el lápiz o pulsa Limpiar", salvo que la dirección de la página sea la de un
diagrama compartido, que SHALL abrirse con su propio contenido y sin el ejemplo.

#### Scenario: Primera carga
- **WHEN** el usuario abre la app sin ruta de diagrama compartido
- **THEN** el pie de la vista previa muestra "5 nodos · 5 conexiones"

#### Scenario: Primera carga con un diagrama compartido
- **WHEN** un miembro con sesión abre la app con la ruta de un diagrama compartido vacío
- **THEN** el pie de la vista previa muestra "0 nodos · 0 conexiones" y no aparece el aviso del ejemplo

### Requirement: App servida sin build
El sistema SHALL funcionar sirviendo la carpeta `frontend/` con cualquier servidor HTTP estático, sin paso
de build ni dependencias instaladas, y con mermaid.js y supabase-js cargados desde un CDN en una versión exacta
(nunca un alias como "latest" o "10") y con comprobación de integridad, de modo que el navegador MUST NOT
ejecutar un archivo distinto del esperado.

#### Scenario: Servidor estático
- **WHEN** se sirve `frontend/` con `npx http-server` y se abre en el navegador de la tablet
- **THEN** la app carga sin errores en la consola y el ejemplo se ve en el lienzo y en la vista previa

#### Scenario: Archivo de mermaid.js alterado
- **WHEN** el CDN sirve un mermaid.js cuyo contenido no coincide con el hash de integridad declarado
- **THEN** el navegador no lo ejecuta, la vista previa muestra "No se pudo cargar mermaid.js; el código sigue disponible en la pestaña Código." y el lienzo y el código Mermaid siguen funcionando

#### Scenario: Archivo de supabase-js alterado
- **WHEN** el CDN sirve un supabase-js cuyo contenido no coincide con el hash de integridad declarado
- **THEN** el navegador no lo ejecuta, la app abre en modo solitario con el ejemplo y, con la ruta de un diagrama compartido, avisa de que no se pudo cargar la conexión con el servidor
