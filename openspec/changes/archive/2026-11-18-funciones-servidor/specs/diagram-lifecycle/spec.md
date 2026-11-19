# Spec Delta

## Purpose

Define cómo nace un diagrama y cómo lo borra o lo restaura su dueño, con el borrado como marca que se puede
quitar, y quién puede hacer cada cosa.

## ADDED Requirements

### Requirement: Crear un diagrama
El sistema SHALL crear, a petición de un usuario con sesión, un diagrama vacío titulado "Diagrama sin
título", del tipo indicado (`flow` o `state`), con dirección `TD` y secuencia 0, y SHALL añadir a ese usuario
como su único dueño, con su correo como nombre visible. Un tipo desconocido MUST rechazarse sin crear nada.

#### Scenario: Crear un diagrama de estados
- **WHEN** un usuario con sesión crea un diagrama de tipo `state`
- **THEN** recibe su identificador, y al leerlo ve un diagrama "Diagrama sin título" de tipo `state`, dirección `TD`, sin operaciones, del que es el único dueño con su correo como nombre visible

#### Scenario: Tipo desconocido
- **WHEN** un usuario crea un diagrama de tipo `class`
- **THEN** recibe un error de operación inválida y no se crea ningún diagrama ni miembro

#### Scenario: Sin sesión
- **WHEN** un cliente con la clave pública y sin sesión intenta crear un diagrama
- **THEN** recibe un error de permisos y no se crea nada

### Requirement: Solo el dueño borra y restaura
El sistema SHALL marcar un diagrama como borrado, o quitar esa marca, solo a petición de su dueño. A un
editor o a un lector MUST responderle un error de rol insuficiente, y a quien no es miembro, "no
encontrado". Repetir la llamada sobre un diagrama que ya está en ese estado SHALL no hacer nada ni dar error.

#### Scenario: El dueño borra
- **WHEN** el dueño de un diagrama con un editor lo borra
- **THEN** el editor deja de ver el diagrama, sus operaciones y sus miembros, y el dueño sigue viéndolo con la fecha de borrado

#### Scenario: Un editor intenta borrar
- **WHEN** un editor intenta borrar el diagrama
- **THEN** recibe un error de rol insuficiente y el diagrama no cambia

#### Scenario: Un ajeno intenta borrar
- **WHEN** un usuario que no es miembro intenta borrar o restaurar el diagrama
- **THEN** recibe el error "no encontrado" y el diagrama no cambia

#### Scenario: Borrar dos veces
- **WHEN** el dueño borra un diagrama que ya está borrado
- **THEN** la llamada termina sin error y la fecha de borrado no cambia

#### Scenario: Restaurar
- **WHEN** el dueño restaura un diagrama borrado con operaciones y un editor
- **THEN** el editor vuelve a verlo con las mismas operaciones en el mismo orden y con los mismos miembros

#### Scenario: Restaurar uno que no está borrado
- **WHEN** el dueño restaura un diagrama que no está borrado
- **THEN** la llamada termina sin error y el diagrama no cambia

### Requirement: Borrar no pierde nada
El sistema MUST conservar al borrar un diagrama sus miembros, sus invitaciones y todas sus operaciones, y
SHALL tratar el borrado y las escrituras de forma ordenada: una operación que se está guardando cuando se
borra termina antes del borrado o recibe el error de diagrama borrado.

#### Scenario: Borrar durante una escritura
- **WHEN** un editor envía una operación a la vez que el dueño borra el diagrama
- **THEN** la operación se guarda antes del borrado o se rechaza con el error de diagrama borrado, y nunca queda a medias
