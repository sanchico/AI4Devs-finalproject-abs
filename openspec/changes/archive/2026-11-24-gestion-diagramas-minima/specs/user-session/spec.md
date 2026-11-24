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

## ADDED Requirements

### Requirement: Una sesión nunca se queda en la dirección
El sistema SHALL quitar de la dirección de la página, nada más arrancar, cualquier fragmento que lleve una sesión
(`access_token` o `refresh_token`, como el que deja el enlace de confirmación del correo), sin recargar la página y
sin dejarlo en el historial de la dirección actual. El sistema MUST NOT usar, mostrar ni guardar esos valores, y la
app SHALL abrir como lo haría sin ese fragmento. Una dirección sin sesión, incluidas `#/lista`, `#/d/<id>` y
`#/i/<token>`, MUST NOT cambiar.

#### Scenario: Volver del enlace de confirmación del correo
- **WHEN** el usuario abre `http://<app>/#access_token=abc&refresh_token=def&type=signup`
- **THEN** la dirección queda como `http://<app>/` sin fragmento, la app abre en modo solitario con el ejemplo y no hace ninguna petición

#### Scenario: Solo el refresh_token
- **WHEN** el fragmento lleva únicamente `refresh_token`
- **THEN** también se quita

#### Scenario: Un error de Auth no es una sesión
- **WHEN** el usuario abre `http://<app>/#error=access_denied&error_code=otp_expired`
- **THEN** la dirección no cambia

#### Scenario: Una ruta normal no se toca
- **WHEN** el usuario abre `#/lista`, `#/d/<id>` o `#/i/<token>`
- **THEN** la dirección sigue igual
