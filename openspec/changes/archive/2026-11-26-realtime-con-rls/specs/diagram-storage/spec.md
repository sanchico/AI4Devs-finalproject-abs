# Spec Delta

## ADDED Requirements

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
