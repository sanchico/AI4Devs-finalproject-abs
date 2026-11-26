# Spec Delta

## ADDED Requirements

### Requirement: Realtime solo entrega las operaciones a los miembros
El sistema SHALL entregar por Realtime las operaciones de un diagrama solo a los usuarios con sesión que
son miembros de ese diagrama, con cualquier rol. Un usuario con sesión que no es miembro y un cliente con
la clave pública sin sesión MUST poder suscribirse al mismo canal sin recibir ninguna operación de ese
diagrama, ni de una en una ni agrupadas en un gesto.

#### Scenario: Un miembro recibe las operaciones
- **WHEN** un miembro y el dueño están suscritos al canal de un diagrama y el dueño envía una operación
- **THEN** el miembro recibe esa operación con su secuencia

#### Scenario: Un usuario ajeno no recibe nada
- **WHEN** un usuario con sesión que no es miembro está suscrito al canal de un diagrama y su dueño envía operaciones, y un miembro suscrito las recibe todas
- **THEN** el usuario ajeno no ha recibido ninguna operación de ese diagrama

#### Scenario: La clave pública sin sesión no recibe nada
- **WHEN** un cliente con la clave pública y sin sesión está suscrito al canal de un diagrama y su dueño envía operaciones, y un miembro suscrito las recibe todas
- **THEN** ese cliente no ha recibido ninguna operación de ese diagrama

#### Scenario: Un gesto de varias operaciones tampoco llega a quien no es miembro
- **WHEN** el dueño envía un gesto de varias operaciones en una sola llamada, con un miembro, un usuario ajeno y un cliente sin sesión suscritos al canal
- **THEN** el miembro recibe todas las operaciones del gesto en orden de secuencia, y el usuario ajeno y el cliente sin sesión no reciben ninguna

#### Scenario: Quien no es miembro llega a estar suscrito
- **WHEN** un usuario ajeno y un cliente sin sesión se suscriben al canal de un diagrama
- **THEN** Postgres Changes confirma la suscripción de los dos, de modo que la ausencia de operaciones se debe a la RLS y no a un canal que no llegó a unirse
