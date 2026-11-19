# diagram-sharing Specification

## Purpose

Define cómo el dueño de un diagrama da acceso a otros con un enlace de invitación, qué rol reciben al
aceptarlo y cuándo deja de servir el enlace.

## Requirements

### Requirement: Crear una invitación
El sistema SHALL crear, a petición del dueño de un diagrama, una invitación con el rol de editor o de lector,
un token aleatorio de 32 bytes y una caducidad de 7 días, y SHALL devolver el token. Un rol distinto MUST
rechazarse. A un editor o un lector MUST responderles un error de rol insuficiente, a quien no es miembro
"no encontrado", y a una invitación para un diagrama borrado el error de diagrama borrado.

#### Scenario: El dueño invita como editor
- **WHEN** el dueño crea una invitación de editor
- **THEN** recibe un token de 64 caracteres hexadecimales y la invitación guardada es de editor y caduca dentro de 7 días

#### Scenario: Dos invitaciones distintas
- **WHEN** el dueño crea dos invitaciones seguidas
- **THEN** los dos tokens son distintos

#### Scenario: Un rol que no se puede invitar
- **WHEN** el dueño crea una invitación con el rol `owner`
- **THEN** recibe un error de operación inválida y no se crea ninguna invitación

#### Scenario: Un editor invita
- **WHEN** un editor intenta crear una invitación
- **THEN** recibe un error de rol insuficiente y no se crea ninguna invitación

#### Scenario: Diagrama borrado
- **WHEN** el dueño intenta invitar a un diagrama que está borrado
- **THEN** recibe el error de diagrama borrado

### Requirement: Aceptar una invitación
El sistema SHALL añadir como miembro, con el rol de la invitación y su correo como nombre visible, al usuario
con sesión que presenta un token válido y no caducado, y SHALL devolver el identificador del diagrama. La
invitación MUST seguir valiendo hasta que caduque, para más de un usuario. Un token desconocido o caducado
SHALL dar el mismo error de invitación no válida, y el de un diagrama borrado el error de diagrama borrado.

#### Scenario: Aceptar como editor
- **WHEN** un usuario con sesión acepta una invitación de editor
- **THEN** es miembro editor del diagrama con su correo como nombre visible, ve el diagrama y sus operaciones y puede enviar operaciones

#### Scenario: Aceptar como lector
- **WHEN** un usuario acepta una invitación de lector y después envía una operación
- **THEN** ve el diagrama pero recibe un error de rol insuficiente al escribir

#### Scenario: Un enlace para varios
- **WHEN** dos usuarios distintos aceptan la misma invitación antes de que caduque
- **THEN** los dos quedan como miembros con el rol de la invitación

#### Scenario: Invitación caducada
- **WHEN** un usuario acepta una invitación cuya caducidad ya ha pasado
- **THEN** recibe el error de invitación no válida y no se le añade como miembro

#### Scenario: Token desconocido
- **WHEN** un usuario presenta un token que no existe
- **THEN** recibe el mismo error de invitación no válida que con una caducada

#### Scenario: Sin sesión
- **WHEN** un cliente con la clave pública y sin sesión presenta un token válido
- **THEN** recibe un error de permisos y no se añade a nadie

### Requirement: Aceptar no cambia el rol de un miembro
El sistema MUST NOT cambiar el rol de quien ya es miembro del diagrama al aceptar una invitación, ni subirlo
ni bajarlo. Repetir la aceptación SHALL terminar sin error y devolver el diagrama.

#### Scenario: El dueño abre su propio enlace de lector
- **WHEN** el dueño de un diagrama acepta una invitación de lector de ese diagrama
- **THEN** sigue siendo el único dueño y no pasa a lector

#### Scenario: Un lector abre un enlace de editor
- **WHEN** un lector acepta una invitación de editor del mismo diagrama
- **THEN** su rol sigue siendo lector

#### Scenario: Aceptar dos veces
- **WHEN** un usuario acepta dos veces la misma invitación
- **THEN** la segunda llamada termina sin error y solo hay una fila de miembro suya
