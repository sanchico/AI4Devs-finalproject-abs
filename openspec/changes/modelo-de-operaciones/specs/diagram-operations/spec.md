# Spec Delta

## Purpose

Define cómo cambia el diagrama: cada cambio es una operación serializable sobre el grafo, con
identificadores únicos y reglas de validación deterministas, de modo que varios clientes puedan aplicar
la misma secuencia y llegar al mismo estado, y cada usuario pueda deshacer solo lo suyo.

## ADDED Requirements

### Requirement: Todo cambio del diagrama es una operación
El sistema SHALL realizar todo cambio de nodos, aristas, tipo o dirección mediante una operación de uno de
estos tipos: `addNode`, `updateNode`, `removeNode`, `addEdge`, `updateEdge`, `removeEdge` o `setMeta`. Una
operación MUST ser un objeto JSON plano (sin funciones ni referencias a objetos del modelo), de modo que
aplicar la operación o su copia serializada y deserializada produzca el mismo estado.

#### Scenario: Operación serializada
- **WHEN** se aplica a dos diagramas iguales una operación `addNode` y, respectivamente, el resultado de `JSON.parse(JSON.stringify(op))`
- **THEN** los dos diagramas quedan idénticos

#### Scenario: Gestos del usuario
- **WHEN** el usuario crea un nodo, lo conecta, lo renombra, lo arrastra, lo borra o pulsa "Limpiar"
- **THEN** cada cambio del diagrama corresponde a una o más operaciones aplicadas, y ninguno cambia el estado por otra vía

### Requirement: Identificadores únicos
El sistema SHALL asignar a cada nodo y a cada arista nuevos un identificador UUID v4, también cuando la
app se abre desde una dirección HTTP de la red local (contexto no seguro del navegador).

#### Scenario: Nodo y arista nuevos
- **WHEN** el usuario dibuja dos rectángulos y un conector entre ellos
- **THEN** los dos nodos y la arista tienen identificadores UUID v4 distintos entre sí

#### Scenario: Tablet por la red local
- **WHEN** la app se abre en la tablet desde `http://<ip-del-pc>:8000` y el usuario dibuja un rectángulo
- **THEN** el nodo se crea con un identificador UUID v4 y no aparece ningún error en la consola

### Requirement: Validación de operaciones
El sistema SHALL rechazar sin cambiar nada una operación que referencie un nodo o una arista que no
existe, una `addEdge` cuyos extremos no existan o que repita el origen y el destino de otra arista, y una
operación de tipo desconocido. El rechazo MUST indicar el motivo.

#### Scenario: Actualizar un nodo borrado
- **WHEN** se aplica `updateNode` sobre un nodo que ya se ha borrado
- **THEN** la operación se rechaza con el motivo "no existe" y el diagrama no cambia

#### Scenario: Conector duplicado
- **WHEN** ya hay una arista de A a B y el usuario dibuja otro conector de A a B
- **THEN** la operación se rechaza, el diagrama no cambia y aparece el aviso "Ya existe esa conexión"

### Requirement: Borrar un nodo borra sus aristas
El sistema SHALL eliminar con `removeNode` el nodo y todas las aristas que salen de él o llegan a él.

#### Scenario: Nodo con dos aristas
- **WHEN** se aplica `removeNode` a un nodo con una arista de entrada y una de salida
- **THEN** desaparecen el nodo y las dos aristas, y el resto del diagrama no cambia

### Requirement: Aplicación determinista
El sistema SHALL producir el mismo diagrama, con nodos y aristas en el mismo orden, al aplicar la misma
secuencia de operaciones al mismo estado inicial, sin depender de la hora, del azar ni del cliente.

#### Scenario: Dos réplicas
- **WHEN** dos diagramas vacíos aplican la misma secuencia de operaciones, incluidas algunas que se rechazan
- **THEN** los dos terminan con los mismos nodos, aristas, tipo y dirección, en el mismo orden

### Requirement: Deshacer con operaciones inversas
El sistema SHALL deshacer aplicando las inversas de las operaciones propias del usuario, agrupadas por
gesto, en orden contrario al original. Si una inversa se rechaza porque su elemento ya no existe, el
sistema SHALL saltarla y aplicar las demás del grupo. Las operaciones aplicadas que no son del usuario
MUST NOT entrar en su pila de deshacer.

#### Scenario: Deshacer tras un cambio ajeno
- **WHEN** el usuario renombra un nodo, después se aplica una operación ajena que borra ese nodo y el usuario pulsa "Deshacer"
- **THEN** la inversa del renombrado se salta, el nodo sigue borrado y no aparece ningún error

#### Scenario: Las operaciones ajenas no se deshacen
- **WHEN** se aplica una operación ajena que añade un nodo y el usuario, sin cambios propios, pulsa "Deshacer"
- **THEN** el nodo ajeno sigue en el diagrama y aparece el aviso "Nada que deshacer"
