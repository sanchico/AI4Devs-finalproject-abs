# Spec Delta

## ADDED Requirements

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
