# diagram-storage Specification

## Purpose

Define dónde y cómo se guardan los diagramas en el servidor y quién puede leerlos: los datos de cada
diagrama, sus miembros, sus invitaciones y su registro de operaciones, con lectura limitada a los
miembros, sin escrituras directas y con un borrado que se puede deshacer.

## Requirements

### Requirement: Solo los miembros leen un diagrama
El sistema SHALL devolver un diagrama, su registro de operaciones y su lista de miembros solo a los
usuarios con sesión que son miembros de ese diagrama, con cualquier rol (dueño, editor o lector). A
cualquier otro usuario con sesión la API MUST devolverle cero filas de ese diagrama, sin error que revele
que existe.

#### Scenario: Un miembro lee su diagrama
- **WHEN** un usuario con rol de lector en un diagrama pide ese diagrama, sus operaciones y sus miembros
- **THEN** recibe el diagrama, todas sus operaciones y todos sus miembros con su rol y su nombre visible

#### Scenario: Un usuario ajeno no ve nada
- **WHEN** un usuario con sesión que no es miembro de un diagrama pide ese diagrama, sus operaciones, sus miembros o sus invitaciones
- **THEN** recibe cero filas en cada consulta

#### Scenario: La lista mezcla propios y compartidos
- **WHEN** un usuario es dueño de un diagrama y editor de otro, y existe un tercero del que no es miembro
- **THEN** al pedir sus diagramas recibe exactamente los dos primeros

### Requirement: Solo el dueño lee las invitaciones
El sistema SHALL devolver las invitaciones de un diagrama solo a su dueño. Un editor o un lector del mismo
diagrama MUST recibir cero filas al pedirlas.

#### Scenario: El dueño ve sus invitaciones
- **WHEN** el dueño de un diagrama con una invitación pendiente pide las invitaciones del diagrama
- **THEN** recibe esa invitación con su rol y su caducidad

#### Scenario: Un editor no ve las invitaciones
- **WHEN** un editor del mismo diagrama pide sus invitaciones
- **THEN** recibe cero filas

### Requirement: Sin sesión no hay acceso
El sistema SHALL negar con la clave pública y sin sesión cualquier lectura o escritura de diagramas,
miembros, invitaciones y operaciones. La respuesta MUST ser un error de permisos y nunca una fila.

#### Scenario: Lectura sin sesión
- **WHEN** un cliente con la clave pública y sin sesión pide los diagramas, los miembros, las invitaciones o las operaciones
- **THEN** cada consulta termina en un error de permisos y no devuelve ninguna fila, aunque existan diagramas

#### Scenario: Escritura sin sesión
- **WHEN** un cliente con la clave pública y sin sesión intenta insertar una operación en el registro de un diagrama existente
- **THEN** recibe un error de permisos y el registro no cambia

### Requirement: Ninguna escritura directa
El sistema SHALL rechazar cualquier inserción, modificación o borrado hecho directamente sobre las tablas
de diagramas, miembros, invitaciones y operaciones por un usuario con sesión, sea cual sea su rol. Los
cambios MUST hacerse solo a través de las funciones del servidor.

#### Scenario: Un editor inserta una operación directamente
- **WHEN** un editor de un diagrama inserta una fila en el registro de operaciones de ese diagrama sin pasar por las funciones del servidor
- **THEN** recibe un error de permisos y el registro no cambia

#### Scenario: El dueño cambia el título directamente
- **WHEN** el dueño de un diagrama modifica su título, su tipo o su secuencia directamente en la tabla
- **THEN** recibe un error de permisos y el diagrama no cambia

#### Scenario: El dueño borra directamente
- **WHEN** el dueño de un diagrama lo borra directamente de la tabla
- **THEN** recibe un error de permisos y el diagrama sigue existiendo

#### Scenario: Un usuario se añade como miembro
- **WHEN** un usuario con sesión inserta una fila que lo hace miembro de un diagrama ajeno
- **THEN** recibe un error de permisos y sigue sin ver el diagrama

### Requirement: Borrado lógico
El sistema SHALL conservar un diagrama borrado junto con sus miembros, invitaciones y operaciones, y
marcarlo con el momento del borrado. Mientras esté marcado, solo su dueño MUST poder leerlo; para el resto
de miembros se comporta como un diagrama del que no son miembros. Al quitar la marca vuelve a verse
intacto.

#### Scenario: Un miembro deja de ver el diagrama borrado
- **WHEN** un diagrama con un editor se marca como borrado y el editor pide sus diagramas, las operaciones o los miembros de ese diagrama
- **THEN** recibe cero filas en cada consulta

#### Scenario: El dueño ve el diagrama borrado
- **WHEN** el dueño pide sus diagramas después de que uno se marque como borrado
- **THEN** recibe también ese diagrama, con la fecha de borrado informada, y puede leer sus operaciones

#### Scenario: Restaurar devuelve el diagrama intacto
- **WHEN** un diagrama con varias operaciones y un editor se marca como borrado y después se le quita la marca
- **THEN** el editor vuelve a ver el diagrama con las mismas operaciones, en el mismo orden, y con los mismos miembros

### Requirement: Integridad de los datos guardados
El sistema SHALL rechazar al guardar cualquier dato fuera de su dominio: un tipo de diagrama distinto de
`flow` o `state`, una dirección distinta de `TD` o `LR`, un rol desconocido, una operación de más de 2 kB,
dos operaciones con la misma secuencia o el mismo identificador en un diagrama, o un título vacío o de más
de 200 caracteres. Un diagrama nuevo MUST empezar titulado "Diagrama sin título", de tipo `flow`,
dirección `TD` y sin operaciones.

#### Scenario: Valores por defecto
- **WHEN** se crea un diagrama indicando solo su dueño
- **THEN** queda titulado "Diagrama sin título", de tipo `flow`, con dirección `TD`, secuencia 0 y sin marca de borrado

#### Scenario: Operación repetida
- **WHEN** se guarda en un diagrama una operación con un identificador que ya está en su registro
- **THEN** se rechaza y el registro no cambia

#### Scenario: Operación demasiado grande
- **WHEN** se guarda una operación cuyo JSON ocupa más de 2 kB
- **THEN** se rechaza y el registro no cambia

#### Scenario: Tipo desconocido
- **WHEN** se guarda un diagrama de tipo `class`
- **THEN** se rechaza

#### Scenario: Títulos que el cliente acepta
- **WHEN** se guarda como título un texto que el cliente acepta, como uno de 200 caracteres, uno con emojis o uno con espacios al principio
- **THEN** se guarda sin rechazarlo ni transformarlo

### Requirement: Eliminación física en cascada
El sistema SHALL eliminar los miembros, las invitaciones y las operaciones de un diagrama cuando el propio
diagrama se elimina físicamente de la base de datos, de modo que no queden filas huérfanas. Ningún usuario
de la app MUST poder hacerlo.

#### Scenario: Eliminación por mantenimiento
- **WHEN** se elimina físicamente un diagrama con miembros, invitaciones y operaciones con credenciales de administración
- **THEN** no queda ninguna fila de miembros, invitaciones ni operaciones de ese diagrama

### Requirement: Las operaciones nuevas se emiten en tiempo real
El sistema SHALL emitir por Realtime cada operación que se añade al registro de un diagrama, para que los
clientes suscritos a ese diagrama la reciban sin consultar la API. Las modificaciones y borrados del
registro no se emiten, porque el registro solo crece.

#### Scenario: Registro publicado
- **WHEN** se revisa la configuración de Realtime del proyecto
- **THEN** el registro de operaciones forma parte de la publicación de Realtime y las tablas de diagramas, miembros e invitaciones no

### Requirement: Las operaciones llegan a los demás miembros en menos de 1 s
El sistema desplegado SHALL entregar por Realtime cada operación guardada a los demás miembros suscritos
al diagrama en menos de 1 s, medido desde que el autor la envía hasta que el otro miembro la recibe, en el
percentil 95 de una serie de operaciones enviadas de una en una. Una ráfaga de 30 operaciones enviadas en
serie por un mismo autor SHOULD llegar entera en menos de 1 s; si no llega, el cliente MUST enviar las
operaciones de cada gesto en una sola llamada.

#### Scenario: Operaciones sueltas en el proyecto remoto
- **WHEN** un editor envía 100 operaciones de una en una, con una pausa entre ellas, a un diagrama del proyecto remoto y otro miembro está suscrito a ese diagrama
- **THEN** el otro miembro recibe las 100, en orden de secuencia, y el percentil 95 del tiempo entre el envío y la recepción es menor de 1 s

#### Scenario: Ráfaga en el proyecto remoto
- **WHEN** un editor envía 30 operaciones seguidas, cada una al recibir la respuesta de la anterior, y otro miembro está suscrito
- **THEN** se conoce el tiempo desde el envío de la primera hasta la recepción de la última, y ese tiempo decide si el cliente agrupa las operaciones de cada gesto en una llamada

### Requirement: El proyecto remoto publica lo mismo que el local
El proyecto Supabase remoto SHALL tener, tras aplicar las migraciones, la misma publicación de Realtime que
el entorno local: solo el registro de operaciones y solo sus inserciones.

#### Scenario: Publicación del proyecto remoto
- **WHEN** se revisa la publicación de Realtime del proyecto remoto después de aplicar las migraciones
- **THEN** contiene solo el registro de operaciones, publica las inserciones y no publica modificaciones, borrados ni vaciados

### Requirement: Realtime solo entrega las operaciones a los miembros
El sistema SHALL entregar por Realtime las operaciones de un diagrama solo a los usuarios con sesión que
son miembros de ese diagrama, con cualquier rol. Un usuario con sesión que no es miembro MUST poder suscribirse al mismo canal sin recibir ninguna operación
de ese diagrama, ni de una en una ni agrupadas en un gesto. Un cliente con la clave pública sin sesión MUST
ser rechazado al suscribirse, sin recibir nada.

#### Scenario: Un miembro recibe las operaciones
- **WHEN** un miembro y el dueño están suscritos al canal de un diagrama y el dueño envía una operación
- **THEN** el miembro recibe esa operación con su secuencia

#### Scenario: Un usuario ajeno no recibe nada
- **WHEN** un usuario con sesión que no es miembro está suscrito al canal de un diagrama y su dueño envía operaciones, y un miembro suscrito las recibe todas
- **THEN** el usuario ajeno no ha recibido ninguna operación de ese diagrama

#### Scenario: La clave pública sin sesión no puede suscribirse
- **WHEN** un cliente con la clave pública y sin sesión se suscribe al canal de un diagrama
- **THEN** Realtime rechaza la suscripción con un error de Postgres Changes y el cliente no recibe ninguna operación de ese diagrama, aunque su dueño envíe operaciones

#### Scenario: Un gesto de varias operaciones tampoco llega a quien no es miembro
- **WHEN** el dueño envía un gesto de varias operaciones en una sola llamada, con un miembro y un usuario ajeno suscritos al canal
- **THEN** el miembro recibe todas las operaciones del gesto en orden de secuencia, y el usuario ajeno no recibe ninguna

#### Scenario: El usuario ajeno con sesión llega a estar suscrito
- **WHEN** un usuario con sesión que no es miembro se suscribe al canal de un diagrama
- **THEN** Postgres Changes confirma la suscripción, de modo que la ausencia de operaciones se debe a la RLS y no a un canal que no llegó a unirse
