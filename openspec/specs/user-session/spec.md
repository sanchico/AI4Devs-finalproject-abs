# user-session Specification

## Purpose

Define cómo una persona entra en pen2mermaid, mantiene su sesión y sale, y cuándo no hace falta sesión
alguna, para que el modo de un solo usuario siga siendo inmediato y la colaboración exija identidad.

## Requirements

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

### Requirement: Entrar y crear cuenta con correo y contraseña
El sistema SHALL ofrecer un panel con correo, contraseña y los botones "Entrar" y "Crear cuenta". Si la
operación tiene éxito, el panel SHALL cerrarse y seguir lo que el usuario iba a hacer. Si falla, el panel MUST
seguir abierto con el motivo escrito como texto, nunca interpretado como HTML.

#### Scenario: Entrar con credenciales válidas
- **WHEN** el usuario escribe su correo y su contraseña y pulsa "Entrar"
- **THEN** el panel se cierra y la sesión queda iniciada

#### Scenario: Contraseña incorrecta
- **WHEN** el usuario pulsa "Entrar" con una contraseña incorrecta
- **THEN** el panel sigue abierto con el mensaje del servidor y el diagrama no se abre

#### Scenario: Mensaje con HTML
- **WHEN** el servidor devuelve un mensaje de error que contiene `<img src=x onerror=alert(1)>`
- **THEN** el panel lo muestra como texto y no se crea ningún elemento ni se ejecuta ningún código

#### Scenario: Crear una cuenta
- **WHEN** el usuario escribe un correo nuevo y una contraseña válida y pulsa "Crear cuenta"
- **THEN** se crea la cuenta y, si el proyecto no exige confirmar el correo, la sesión queda iniciada

#### Scenario: Crear una cuenta que exige confirmar el correo
- **WHEN** el proyecto exige confirmar el correo y el usuario pulsa "Crear cuenta" con datos válidos
- **THEN** el panel sigue abierto con el aviso "Cuenta creada: confirma tu correo y entra" y no se inicia sesión

### Requirement: La sesión persiste y se cierra con Salir
El sistema SHALL conservar la sesión al recargar la página y SHALL ofrecer "Salir" mientras hay sesión. Al salir,
el sistema MUST cerrar la sesión en el servidor y volver al modo solitario.

#### Scenario: Recargar con sesión
- **WHEN** el usuario ha entrado y recarga la página
- **THEN** sigue con la sesión iniciada y no se le pide entrar otra vez

#### Scenario: Salir
- **WHEN** el usuario pulsa "Salir" estando en un diagrama compartido
- **THEN** la sesión se cierra, la ruta vuelve a ser la del modo solitario y la app abre con el ejemplo

### Requirement: Un diagrama compartido exige sesión
El sistema SHALL pedir entrar antes de abrir un diagrama compartido y, una vez iniciada la sesión, SHALL abrirlo
sin pedir la ruta de nuevo. Mientras no haya sesión MUST NOT cargar ni mostrar nada del diagrama.

#### Scenario: Abrir un enlace sin sesión
- **WHEN** el usuario abre un enlace `#/d/<id>` sin sesión iniciada
- **THEN** aparece el panel de entrada, el lienzo no muestra ningún diagrama y, tras entrar, se abre el diagrama del enlace

#### Scenario: Cerrar el panel sin entrar
- **WHEN** el usuario no entra y deja el panel abierto
- **THEN** no se hace ninguna petición sobre el diagrama

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
