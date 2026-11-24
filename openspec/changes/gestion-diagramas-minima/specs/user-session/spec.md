## MODIFIED Requirements

### Requirement: Sin diagrama compartido no se pide sesión
El sistema SHALL abrir en modo solitario, sin pedir sesión y sin conectar con ningún servidor, cuando la
dirección de la página no apunta a un diagrama compartido, a la lista de diagramas ni a una invitación. Las
direcciones de esas tres clases SHALL pedir sesión antes de cargar nada.

#### Scenario: Abrir la app sin ruta
- **WHEN** el usuario abre la app sin ruta de diagrama
- **THEN** aparece el diagrama de ejemplo, no se muestra ningún panel de entrada y no se hace ninguna petición a Supabase

#### Scenario: Una ruta desconocida
- **WHEN** el usuario abre la app con una dirección que no es de diagrama, de lista ni de invitación (por ejemplo `#/otra`)
- **THEN** la app abre como sin ruta: ejemplo, sin panel de entrada y sin peticiones

#### Scenario: La lista o una invitación sin sesión
- **WHEN** el usuario abre `#/lista` o un enlace de invitación sin sesión iniciada
- **THEN** se muestra el panel de entrada y no se carga nada de ningún diagrama hasta que haya sesión
