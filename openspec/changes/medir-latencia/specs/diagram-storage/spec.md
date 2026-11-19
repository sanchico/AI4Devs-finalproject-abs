## ADDED Requirements

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
