# operation-log Specification

## Purpose

Define cómo se escribe en el registro de operaciones de un diagrama: quién puede hacerlo, qué comprueba el
servidor antes de guardar una operación y las garantías de orden y de reintento que los clientes necesitan
para llegar al mismo diagrama.

## Requirements

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

### Requirement: Un grupo de operaciones se guarda en una sola llamada
El sistema SHALL permitir enviar a un diagrama un grupo de operaciones en una sola llamada, cada una con su
`op_id`, y guardarlas en el orden recibido con secuencias consecutivas, una fila por operación, igual que si
se hubieran enviado una a una. La respuesta MUST dar las secuencias en el mismo orden que el grupo. Al guardar
un grupo, el sistema SHALL aplicar las mismas reglas de validación y la misma copia de título y dirección que
al guardar una operación suelta.

#### Scenario: Un editor envía un grupo
- **WHEN** un editor envía un grupo de tres operaciones válidas a un diagrama vacío
- **THEN** el registro tiene tres filas con las secuencias 1, 2 y 3, en el orden del grupo, y la respuesta es 1, 2, 3

#### Scenario: Mismo registro que en serie
- **WHEN** se envía un grupo y, en otro diagrama, las mismas operaciones una a una
- **THEN** los dos registros contienen las mismas operaciones con las mismas secuencias y los mismos `op_id`

#### Scenario: Un gesto de 30 operaciones
- **WHEN** un editor envía en un solo grupo 30 operaciones `removeNode`
- **THEN** una única llamada las guarda con secuencias consecutivas y la respuesta tiene 30 secuencias

#### Scenario: El grupo lleva un setMeta
- **WHEN** un grupo incluye un `setMeta` con el título "Login" y la dirección "LR"
- **THEN** la ficha del diagrama muestra ese título y esa dirección una vez guardado el grupo

#### Scenario: Operación sobre un nodo inexistente
- **WHEN** un grupo incluye un `updateNode` sobre un nodo que no existe
- **THEN** la operación se guarda con su secuencia como las demás, porque el servidor no interpreta el grafo

### Requirement: Roles y errores de un grupo
El sistema SHALL guardar un grupo solo si lo envía el dueño o un editor con sesión iniciada, y MUST rechazarlo
con los mismos errores que una operación suelta: sin sesión, un error de permisos; no miembro o diagrama
inexistente, "no encontrado" (404); lector, rol insuficiente (403); diagrama borrado, diagrama borrado (410).

#### Scenario: Un lector envía un grupo
- **WHEN** un lector envía un grupo de operaciones válidas
- **THEN** recibe el error de rol insuficiente (403) y el registro no cambia

#### Scenario: Un ajeno envía un grupo
- **WHEN** un usuario con sesión que no es miembro envía un grupo a un diagrama existente
- **THEN** recibe el mismo "no encontrado" (404) que si el diagrama no existiera y el registro no cambia

#### Scenario: Sin sesión
- **WHEN** un cliente con la clave pública y sin sesión envía un grupo
- **THEN** recibe un error de permisos y el registro no cambia

#### Scenario: Diagrama borrado
- **WHEN** el dueño borra un diagrama y un editor envía un grupo
- **THEN** el editor recibe el error de diagrama borrado (410) y el registro no cambia

### Requirement: Un grupo se guarda entero o no se guarda
El sistema SHALL rechazar con el error de operación inválida (422) un grupo en el que alguna operación no
sea válida, sin guardar ninguna de sus operaciones y sin consumir ninguna secuencia. También MUST rechazar con
ese error un grupo vacío, de más de 500 operaciones, que no sea una lista, con un elemento sin `op_id` o con
dos elementos con el mismo `op_id`.

#### Scenario: Una operación inválida en medio
- **WHEN** se envía un grupo de tres operaciones cuya segunda es de tipo `moverNodo`
- **THEN** se rechaza con el error de operación inválida, el registro no cambia y la siguiente operación que se envíe recibe la secuencia siguiente a la última guardada

#### Scenario: Grupo vacío o demasiado grande
- **WHEN** se envía un grupo sin operaciones, o con 501
- **THEN** se rechaza con el error de operación inválida y el registro no cambia

#### Scenario: Grupo que no es una lista
- **WHEN** se envía como grupo un objeto o un valor nulo
- **THEN** se rechaza con el error de operación inválida

#### Scenario: Elemento sin op_id o con op_id repetido
- **WHEN** un grupo incluye un elemento sin `op_id`, o dos elementos con el mismo `op_id`
- **THEN** se rechaza con el error de operación inválida y el registro no cambia

### Requirement: Reenviar un grupo no lo duplica
El sistema SHALL devolver, para cada operación de un grupo cuyo `op_id` ya esté en el registro del diagrama,
la secuencia ya asignada, sin guardarla de nuevo, y SHALL numerar las operaciones nuevas del grupo a
continuación de la última secuencia. Esto vale también si el mismo grupo llega a la vez en dos llamadas.

#### Scenario: Reintento tras perder la respuesta
- **WHEN** un editor envía un grupo, no recibe la respuesta y lo envía otra vez con los mismos `op_id`
- **THEN** la segunda respuesta tiene las mismas secuencias que la primera y el registro contiene cada operación una sola vez

#### Scenario: Reintentos simultáneos
- **WHEN** se envía a la vez dos veces el mismo grupo a un diagrama
- **THEN** las dos respuestas son iguales y el registro contiene cada operación una sola vez

#### Scenario: Grupo con operaciones ya guardadas y nuevas
- **WHEN** se envía un grupo cuyas dos primeras operaciones ya están guardadas y la tercera es nueva
- **THEN** la respuesta repite las secuencias de las dos primeras y da a la tercera la secuencia siguiente a la última del registro

#### Scenario: El reintento no revierte el título
- **WHEN** se guarda un grupo con un `setMeta` de título "A", después otro `setMeta` con título "B", y se reenvía el primer grupo
- **THEN** la ficha del diagrama sigue mostrando el título "B", porque las operaciones ya guardadas no vuelven a copiarse a la ficha

#### Scenario: Reintento con el registro lleno
- **WHEN** el registro tiene 5 000 operaciones y se reenvía el último grupo guardado
- **THEN** el servidor devuelve sus secuencias sin error

### Requirement: El tope de 5 000 cuenta el grupo entero
El sistema SHALL rechazar con el error de límite alcanzado (409) un grupo cuyas operaciones nuevas hagan que el
registro supere las 5 000 operaciones, sin guardar ninguna de las del grupo. Las operaciones del grupo que ya
estén en el registro no cuentan.

#### Scenario: El grupo no cabe
- **WHEN** un diagrama tiene 4 995 operaciones y un editor envía un grupo de 6 operaciones nuevas
- **THEN** recibe el error de límite alcanzado y el registro sigue con 4 995 operaciones

#### Scenario: El grupo cabe justo
- **WHEN** un diagrama tiene 4 995 operaciones y un editor envía un grupo de 5 operaciones nuevas
- **THEN** se guardan con las secuencias 4 996 a 5 000

### Requirement: Un grupo ocupa secuencias contiguas
El sistema SHALL guardar cada grupo con secuencias contiguas, sin que se intercalen operaciones de otras
llamadas simultáneas, y el registro MUST seguir siendo 1, 2, 3… sin repetidos ni huecos aunque se mezclen grupos
y operaciones sueltas.

#### Scenario: Dos grupos a la vez
- **WHEN** el dueño y un editor envían a la vez un grupo de 10 operaciones cada uno al mismo diagrama
- **THEN** las secuencias de la 1 a la 20 existen una vez cada una, y las de cada grupo son 10 consecutivas

#### Scenario: Un grupo y una operación suelta a la vez
- **WHEN** se envían a la vez un grupo de 10 operaciones y 5 operaciones sueltas
- **THEN** el registro tiene exactamente las secuencias de la 1 a la 15 sin repetidos ni huecos y las del grupo son consecutivas
