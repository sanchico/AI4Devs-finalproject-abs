# continuous-integration Specification

## Purpose

Define cómo se prueban solos el frontend y el backend en cada pull request contra develop y en cada integración, contra
un Supabase local creado desde las migraciones, sin secretos ni acceso al proyecto remoto y sin bloquear la publicación.

## Requirements

### Requirement: Los tests se ejecutan solos en cada PR y en cada integración
El sistema SHALL ejecutar los tests del frontend y los del backend, sin intervención de nadie, en cada pull request
contra `develop` (al abrirla y en cada commit nuevo) y en cada push a `develop`. El resultado de cada conjunto MUST
verse por separado en la PR, de modo que se sepa cuál ha fallado.

#### Scenario: Abrir una PR contra develop
- **WHEN** se abre una pull request contra `develop`
- **THEN** se ejecutan los tests del frontend y los del backend, y la PR muestra un resultado para cada uno

#### Scenario: Un commit nuevo en la PR
- **WHEN** se sube un commit nuevo a la rama de una PR abierta contra `develop`
- **THEN** los dos conjuntos de tests se vuelven a ejecutar sobre ese commit

#### Scenario: Un test del backend falla
- **WHEN** un commit rompe una política de RLS o una función del servidor y su test falla
- **THEN** la ejecución del backend queda en rojo en la PR, con la salida del test que ha fallado

#### Scenario: El cliente y el servidor dejan de coincidir
- **WHEN** un commit cambia las reglas de una operación en el cliente y no en el servidor, o al revés
- **THEN** el test que envía al servidor las fixtures de operaciones del cliente falla en el CI

### Requirement: El backend se prueba desde cero, sin secretos y sin tocar el remoto
Los tests del backend SHALL ejecutarse contra un Supabase local creado en cada ejecución a partir de las
migraciones del repositorio. La ejecución MUST NOT usar secretos del repositorio ni conectar con el proyecto
remoto, y MUST NOT tener permisos de escritura sobre el repositorio.

#### Scenario: Las migraciones se aplican desde cero
- **WHEN** arranca la ejecución del backend
- **THEN** todas las migraciones de `supabase/migrations/` se aplican sobre una base vacía antes de los tests, y si alguna falla la ejecución queda en rojo

#### Scenario: Una PR desde un fork
- **WHEN** alguien abre una PR contra `develop` desde un fork
- **THEN** los tests se ejecutan sin acceso a ningún secreto y sin poder escribir en el repositorio ni en el proyecto remoto

### Requirement: El CI no bloquea la publicación del frontend
El resultado del CI MUST NOT impedir ni retrasar la publicación del frontend, que depende solo de sus propios
tests (ver `static-deployment`). Un fallo del CI SHALL quedar visible en la PR y en la rama, sin cambiar la versión
publicada.

#### Scenario: El backend falla y el frontend pasa
- **WHEN** se integra en `develop` un commit con los tests del frontend en verde y algún test del backend en rojo
- **THEN** el frontend se publica igualmente y la ejecución del backend queda en rojo en la rama
