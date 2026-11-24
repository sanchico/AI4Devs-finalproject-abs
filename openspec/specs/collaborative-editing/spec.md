# collaborative-editing Specification

## Purpose

Define cómo el cliente envía los gestos propios al registro compartido, aplica los de los demás y llega al
mismo diagrama que ellos, sin perder ni duplicar operaciones y con un modo de solo lectura cuando ya no
puede editar con seguridad.

## Requirements

### Requirement: Cada gesto se envía como un grupo, en orden y de uno en uno
El sistema SHALL enviar las operaciones de cada gesto del usuario como un grupo, con un `op_id` nuevo por
operación, y SHALL enviar los grupos en el orden en que se hicieron sin empezar uno hasta que el anterior ha
recibido respuesta. Solo se envían las operaciones que el modelo local aplicó. Un gesto de más de 500
operaciones SHALL enviarse en tramos consecutivos de 500 como máximo.

#### Scenario: Dos gestos seguidos
- **WHEN** el usuario crea un nodo y, antes de que el servidor responda, mueve otro
- **THEN** el segundo grupo no se envía hasta que el primero recibe respuesta, y los dos salen en ese orden

#### Scenario: Una operación que el modelo rechaza
- **WHEN** un gesto incluye una operación que el modelo local descarta
- **THEN** esa operación no se envía y el resto del gesto sí

#### Scenario: Limpiar un diagrama grande
- **WHEN** el usuario limpia un diagrama con 1 200 nodos
- **THEN** las 1 200 operaciones salen en tres tramos de 500, 500 y 200, en ese orden

### Requirement: Lo propio se ve al instante y se concilia con el registro
El sistema SHALL mostrar de inmediato cada gesto propio y SHALL mantener por separado el diagrama
**confirmado** (el registro aplicado en orden de secuencia) y los grupos **pendientes** (propios aún sin ver en
el registro). Lo que se ve MUST ser siempre el confirmado más lo pendiente, de modo que, cuando todo se
confirma, todos los clientes tengan el mismo diagrama y el mismo código Mermaid.

#### Scenario: Gana el orden del servidor
- **WHEN** dos clientes cambian la etiqueta del mismo nodo a la vez y el servidor ordena primero la de B y después la de A
- **THEN** los dos terminan viendo la etiqueta de A, aunque B viera la suya al principio

#### Scenario: Lo ajeno llega con cambios propios pendientes
- **WHEN** llega una operación ajena mientras el usuario tiene un gesto sin confirmar
- **THEN** el diagrama visible conserva el gesto pendiente aplicado sobre el diagrama con la operación ajena

#### Scenario: Un pendiente que deja de valer
- **WHEN** un gesto propio pendiente actualiza un nodo y llega una operación ajena que borra ese nodo
- **THEN** el nodo desaparece del diagrama visible y el gesto pendiente no produce ningún error

### Requirement: Cada operación del registro se aplica una sola vez y en orden
El sistema SHALL aplicar las operaciones del registro en orden de secuencia, ignorar las que ya aplicó y dar
por confirmada una operación propia al verla en el registro, sin importar si la respuesta del servidor llega
antes o después.

#### Scenario: El registro llega antes que la respuesta
- **WHEN** la operación propia llega por el canal antes de que responda la llamada que la envió
- **THEN** se aplica una vez, deja de estar pendiente y, al llegar la respuesta, no cambia nada

#### Scenario: Una entrada repetida
- **WHEN** el canal entrega una operación con una secuencia que ya se aplicó
- **THEN** se ignora y el diagrama no cambia

### Requirement: Abrir un diagrama no pierde operaciones
El sistema SHALL, al abrir un diagrama, suscribirse primero y guardar en espera lo que llegue, esperar a que la
suscripción esté lista, cargar el registro completo, aplicarlo, y aplicar después lo que estaba en espera con
secuencia posterior a la última cargada. El diagrama MUST abrirse con el tipo y el rol que devuelve el
servidor, y no admitir gestos hasta terminar la carga.

#### Scenario: Una operación llega durante la carga
- **WHEN** otro miembro guarda una operación después de que se confirme la suscripción y antes de que termine la carga del registro
- **THEN** el diagrama abierto la contiene exactamente una vez

#### Scenario: Una operación ya incluida en la carga
- **WHEN** una operación aparece a la vez en el registro cargado y en lo que llegó por el canal
- **THEN** el diagrama la contiene una sola vez

#### Scenario: Apertura con historial
- **WHEN** se abre un diagrama con operaciones de varios miembros, algunas rechazadas por el modelo al aplicarlas
- **THEN** el diagrama resultante es el mismo que el de un cliente que lo tuvo abierto desde el principio

### Requirement: Deshacer es un gesto más
El sistema SHALL enviar como un grupo las operaciones inversas que "Deshacer" aplica, igual que cualquier otro
gesto, y MUST NOT enviar las que se saltan porque su elemento ya no existe. Las operaciones recibidas de otros
MUST NOT entrar en la pila de deshacer propia.

#### Scenario: Deshacer un nodo nuevo
- **WHEN** el usuario crea un nodo, espera a que se confirme y pulsa "Deshacer"
- **THEN** se envía un grupo con el borrado de ese nodo y los demás clientes dejan de verlo

#### Scenario: Deshacer sin nada propio
- **WHEN** llega un nodo de otro miembro y el usuario pulsa "Deshacer" sin cambios propios
- **THEN** no se envía nada y el nodo ajeno sigue en el diagrama

#### Scenario: Deshacer tras un cambio ajeno
- **WHEN** el usuario renombra un nodo, otro miembro lo borra y el usuario pulsa "Deshacer"
- **THEN** la inversa del renombrado se salta, no se envía y no aparece ningún error

### Requirement: La dirección se envía pero no se deshace
El sistema SHALL enviar un cambio de dirección del diagrama como cualquier otro gesto y MUST NOT añadirlo a la
pila de deshacer.

#### Scenario: Cambiar la dirección
- **WHEN** el usuario cambia la dirección a "LR"
- **THEN** se envía un grupo con ese cambio, los demás clientes pasan a "LR" y "Deshacer" no lo revierte

### Requirement: Un rechazo del servidor descarta lo pendiente afectado
El sistema SHALL descartar el grupo rechazado por el servidor y recalcular lo que se ve. Con 422 (operación
inválida) o 409 (límite alcanzado) SHALL avisar y seguir con los grupos siguientes. Con 403 (rol insuficiente),
404 (sin acceso) o 410 (diagrama borrado) SHALL descartar también todos los grupos pendientes, avisar del motivo y
dejar el diagrama en solo lectura.

#### Scenario: Operación inválida
- **WHEN** el servidor rechaza un gesto con 422 y hay otro gesto pendiente
- **THEN** el primero desaparece del diagrama visible con un aviso y el segundo se envía

#### Scenario: Pasa a lector
- **WHEN** el servidor responde 403 a un gesto y hay otros dos pendientes
- **THEN** los tres desaparecen del diagrama visible, el diagrama queda en solo lectura y el aviso dice que el rol ya no permite editar

#### Scenario: Diagrama borrado
- **WHEN** el servidor responde 410 a un gesto
- **THEN** el diagrama queda en solo lectura y el aviso dice que el diagrama se ha borrado

### Requirement: Un fallo de red se reintenta sin duplicar
El sistema SHALL reintentar un grupo cuya llamada falla sin respuesta del servidor, con los mismos `op_id` y
esperas crecientes, hasta 3 veces. Si sigue fallando, SHALL dejar el diagrama sin conexión y en solo lectura.

#### Scenario: Un fallo y un acierto
- **WHEN** la primera llamada de un grupo falla por la red y el reintento tiene éxito
- **THEN** el grupo queda guardado una sola vez y se envía el siguiente

#### Scenario: Se agotan los reintentos
- **WHEN** las cuatro llamadas de un grupo (la primera y tres reintentos) fallan por la red
- **THEN** el diagrama queda sin conexión y en solo lectura, y los gestos siguientes no se aceptan

### Requirement: Un hueco o un canal cerrado dejan el diagrama sin conexión
El sistema SHALL dejar el diagrama sin conexión y en solo lectura, con un aviso, si recibe una operación con una
secuencia que no sigue a la última aplicada o si el canal se cierra, y MUST conservar el diagrama que ya se veía.

#### Scenario: Salto de secuencia
- **WHEN** tras aplicar la secuencia 7 llega la 9
- **THEN** el diagrama queda sin conexión y en solo lectura, y la operación 9 no se aplica

#### Scenario: Cierre del canal
- **WHEN** el transporte avisa de que el canal se ha cerrado
- **THEN** el diagrama queda sin conexión y en solo lectura con el mismo diagrama que se veía

### Requirement: En solo lectura no se aceptan gestos
El sistema SHALL rechazar con un motivo todos los gestos del usuario (crear, conectar, mover, renombrar, borrar,
limpiar, deshacer y cambiar la dirección) mientras el diagrama está cargando, en solo lectura o sin conexión, sin
cambiar el diagrama ni enviar nada, y SHALL seguir aplicando las operaciones que lleguen mientras el canal esté abierto.

#### Scenario: Un lector dibuja
- **WHEN** un lector intenta crear un nodo
- **THEN** el gesto se rechaza con el motivo de solo lectura y el diagrama no cambia

#### Scenario: Un lector recibe
- **WHEN** un editor añade un nodo mientras un lector tiene el diagrama abierto
- **THEN** el lector ve el nodo nuevo

### Requirement: Sin colaboración el modelo no cambia
El sistema SHALL comportarse como hasta ahora cuando no hay colaboración: los gestos se aplican en el modelo y
se deshacen sin enviar nada y sin modo de solo lectura.

#### Scenario: Uso en solitario
- **WHEN** el usuario crea un nodo y lo deshace con la app abierta sin diagrama compartido
- **THEN** el nodo aparece y desaparece como antes y no se llama a ningún transporte
