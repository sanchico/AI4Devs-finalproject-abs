# Spec Delta

## Purpose

Define cómo se escribe en el registro de operaciones de un diagrama: quién puede hacerlo, qué comprueba el
servidor antes de guardar una operación y las garantías de orden y de reintento que los clientes necesitan
para llegar al mismo diagrama.

## ADDED Requirements

### Requirement: Solo el dueño y los editores escriben operaciones
El sistema SHALL guardar una operación en el registro de un diagrama solo si la envía su dueño o un editor,
con sesión iniciada. A un lector MUST rechazarle la operación con un error de rol insuficiente. A quien no es
miembro, y a quien pide un diagrama que no existe, MUST responderle el mismo error de "no encontrado", sin
revelar que el diagrama existe.

#### Scenario: Un editor escribe
- **WHEN** un editor envía una operación válida a un diagrama de su equipo
- **THEN** la operación queda en el registro y el servidor devuelve su secuencia

#### Scenario: Un lector escribe
- **WHEN** un lector envía una operación válida
- **THEN** recibe un error de rol insuficiente (403) y el registro no cambia

#### Scenario: Un ajeno escribe
- **WHEN** un usuario con sesión que no es miembro envía una operación a un diagrama existente
- **THEN** recibe el error "no encontrado" (404), igual que si el diagrama no existiera, y el registro no cambia

#### Scenario: Sin sesión
- **WHEN** un cliente con la clave pública y sin sesión envía una operación
- **THEN** recibe un error de permisos y el registro no cambia

### Requirement: Secuencias consecutivas y sin huecos
El sistema SHALL asignar a cada operación guardada la secuencia siguiente a la última del diagrama, de modo
que el registro tenga siempre 1, 2, 3… sin repetidos ni huecos, aunque varias sesiones escriban a la vez. Una
operación rechazada MUST NOT consumir una secuencia.

#### Scenario: Dos sesiones a la vez
- **WHEN** el dueño y un editor envían a la vez 10 operaciones cada uno al mismo diagrama
- **THEN** el registro tiene exactamente las secuencias de la 1 a la 20, cada una con una operación distinta

#### Scenario: El rechazo no deja huecos
- **WHEN** se envía una operación inválida entre dos operaciones válidas
- **THEN** las dos válidas reciben secuencias consecutivas

### Requirement: Reenviar una operación no la duplica
El sistema SHALL devolver la secuencia ya asignada, sin guardar nada nuevo, cuando se reenvía una operación
con el mismo identificador (`op_id`) que otra del mismo diagrama, también si llegan a la vez.

#### Scenario: Reintento
- **WHEN** un editor envía dos veces la misma operación con el mismo `op_id`
- **THEN** las dos respuestas tienen la misma secuencia y el registro contiene la operación una sola vez

#### Scenario: Reintentos simultáneos
- **WHEN** se envían a la vez dos operaciones con el mismo `op_id` a un diagrama
- **THEN** las dos respuestas tienen la misma secuencia y el registro contiene una sola operación

#### Scenario: Reintento con el registro lleno
- **WHEN** el registro tiene 5 000 operaciones y se reenvía la última
- **THEN** el servidor devuelve su secuencia sin error

### Requirement: Validación de la forma de la operación
El sistema SHALL rechazar con un error de operación inválida (422), sin guardarla, una operación que no sea
un objeto de uno de los siete tipos conocidos, que ocupe más de 2 kB, que no lleve el objeto (`node`, `edge`
o `set`) y los identificadores de texto que su tipo necesita, que lleve una etiqueta que no sea texto o pase
de 200 caracteres, o un `setMeta` con tipo, con título o dirección inválidos.

#### Scenario: Tipo desconocido
- **WHEN** se envía una operación de tipo `moverNodo`
- **THEN** se rechaza con el error de operación inválida y el registro no cambia

#### Scenario: Operación demasiado grande
- **WHEN** se envía una operación cuyo JSON ocupa más de 2 kB
- **THEN** se rechaza con el error de operación inválida

#### Scenario: Falta el nodo
- **WHEN** se envía un `addNode` sin objeto `node`, o un `addEdge` sin objeto `edge`
- **THEN** se rechaza con el error de operación inválida

#### Scenario: Identificador que no es texto
- **WHEN** se envía un `updateNode` cuyo `id` es el número 42, o un `addEdge` sin `from`
- **THEN** se rechaza con el error de operación inválida

#### Scenario: Etiqueta de 201 caracteres
- **WHEN** se envía un `updateNode` con una etiqueta de 201 caracteres
- **THEN** se rechaza, y con una de 200 caracteres se guarda

#### Scenario: setMeta con tipo
- **WHEN** se envía un `setMeta` que incluye el tipo del diagrama
- **THEN** se rechaza con el error de operación inválida y ni el tipo ni el título cambian

#### Scenario: setMeta con título inválido
- **WHEN** se envía un `setMeta` con el título "   " o con una dirección distinta de TD y LR
- **THEN** se rechaza y el título y la dirección del diagrama no cambian

#### Scenario: Título que el cliente rechaza
- **WHEN** se envía un `setMeta` con un título de solo tabuladores o espacios no separables, o de 101 emojis (que el cliente cuenta como 202 caracteres)
- **THEN** se rechaza, porque el servidor acepta exactamente los títulos que aceptan los clientes, y con 100 emojis se guarda

### Requirement: El servidor guarda lo que los clientes descartan
El sistema MUST NOT interpretar el grafo del diagrama al guardar una operación: una operación bien formada
que los clientes descartarán por igual, como actualizar un nodo que no existe, SHALL guardarse y numerarse
como cualquier otra.

#### Scenario: Operación sobre un nodo inexistente
- **WHEN** un editor envía un `updateNode` sobre un nodo que no existe en el diagrama
- **THEN** la operación se guarda con su secuencia y el servidor no devuelve error

### Requirement: Título y dirección copiados de `setMeta`
El sistema SHALL copiar a la ficha del diagrama el título y la dirección de cada `setMeta` guardado, en la
misma transacción que guarda la operación, de modo que la ficha refleje lo mismo que el registro reproducido.
Cada operación guardada SHALL actualizar la fecha de modificación del diagrama.

#### Scenario: Renombrar
- **WHEN** un editor envía un `setMeta` con el título "Login" y la dirección "LR"
- **THEN** la ficha del diagrama muestra el título "Login" y la dirección "LR" y su tipo no cambia

#### Scenario: Gana la última
- **WHEN** se guardan dos `setMeta` con títulos distintos, en ese orden
- **THEN** la ficha muestra el título del segundo

#### Scenario: Una operación que no es setMeta
- **WHEN** se guarda un `addNode`
- **THEN** el título y la dirección de la ficha no cambian y su fecha de modificación sí

### Requirement: Tope de 5 000 operaciones
El sistema SHALL rechazar con un error de límite alcanzado (409) la operación nueva que supere las 5 000
operaciones de un diagrama, sin guardarla.

#### Scenario: Registro lleno
- **WHEN** un diagrama tiene 5 000 operaciones y un editor envía otra nueva
- **THEN** recibe el error de límite alcanzado y el registro sigue con 5 000

### Requirement: Un diagrama borrado no admite operaciones
El sistema SHALL rechazar con un error de diagrama borrado (410) cualquier operación enviada a un diagrama
en la papelera, también por su dueño, para que quien lo tenía abierto sepa que se ha borrado. A quien no es
miembro MUST seguir respondiéndole "no encontrado".

#### Scenario: Un editor escribe en un diagrama borrado
- **WHEN** el dueño borra un diagrama y después un editor envía una operación
- **THEN** el editor recibe el error de diagrama borrado y el registro no cambia

#### Scenario: Tras restaurar
- **WHEN** el dueño restaura el diagrama y el editor reenvía la operación
- **THEN** la operación se guarda con la secuencia siguiente

### Requirement: Cada rechazo se distingue por su estado
El sistema SHALL devolver en cada rechazo un estado HTTP y una clave estable que permitan al cliente decidir
qué mostrar: 404 "no encontrado", 403 "rol insuficiente", 410 "diagrama borrado", 422 "operación inválida" y
409 "límite alcanzado".

#### Scenario: Clave estable
- **WHEN** un lector envía una operación y después un ajeno envía otra
- **THEN** el primero recibe el estado 403 con la clave de rol insuficiente y el segundo el 404 con la clave de no encontrado
