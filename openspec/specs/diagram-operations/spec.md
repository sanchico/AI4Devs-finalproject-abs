# diagram-operations Specification

## Purpose

Define cómo cambia el diagrama: cada cambio es una operación serializable sobre el grafo, con
identificadores únicos y reglas de validación deterministas, de modo que varios clientes puedan aplicar
la misma secuencia y llegar al mismo estado, y cada usuario pueda deshacer solo lo suyo.

## Requirements

### Requirement: Todo cambio del diagrama es una operación
El sistema SHALL realizar todo cambio de nodos, aristas, dirección o título mediante una operación de
uno de estos tipos: `addNode`, `updateNode`, `removeNode`, `addEdge`, `updateEdge`, `removeEdge` o
`setMeta`. Una operación MUST ser un objeto JSON plano (sin funciones ni referencias a objetos del modelo),
de modo que aplicar la operación o su copia serializada y deserializada produzca el mismo estado.

#### Scenario: Operación serializada
- **WHEN** se aplica a dos diagramas iguales una operación `addNode` y, respectivamente, el resultado de `JSON.parse(JSON.stringify(op))`
- **THEN** los dos diagramas quedan idénticos

#### Scenario: Gestos del usuario
- **WHEN** el usuario crea un nodo, lo conecta, lo renombra, lo arrastra, lo borra o pulsa "Limpiar"
- **THEN** cada cambio del diagrama corresponde a una o más operaciones aplicadas, y ninguno cambia el estado por otra vía

#### Scenario: Cambio de título serializado
- **WHEN** se aplica a dos diagramas iguales una operación `setMeta` con título y, respectivamente, su copia serializada y deserializada
- **THEN** los dos diagramas quedan con el mismo título

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

### Requirement: Título del diagrama
El sistema SHALL guardar un título en cada diagrama, que empieza siendo "Diagrama sin título" y solo cambia
con una operación `setMeta` que lo incluya. Aplicar la inversa de esa operación SHALL devolver el título
anterior. "Limpiar" MUST NOT cambiar el título.

#### Scenario: Diagrama nuevo
- **WHEN** se crea un diagrama vacío
- **THEN** su título es "Diagrama sin título"

#### Scenario: Renombrar
- **WHEN** se aplica `setMeta` con el título "Login"
- **THEN** el título del diagrama es "Login" y su tipo, dirección, nodos y aristas no cambian

#### Scenario: Revertir un renombrado
- **WHEN** el diagrama se titula "Login", se calcula la inversa de un `setMeta` con el título "Alta de usuario", se aplica ese `setMeta` y después su inversa
- **THEN** el título vuelve a ser "Login"

#### Scenario: Limpiar conserva el título
- **WHEN** el diagrama se titula "Login" y tiene nodos, y el usuario pulsa "Limpiar"
- **THEN** el diagrama queda sin nodos ni aristas y su título sigue siendo "Login"

### Requirement: Validación del título
El sistema SHALL rechazar con un motivo, sin cambiar nada, una operación `setMeta` cuyo título no sea texto,
esté vacío o tenga solo espacios, o pase de 200 caracteres. Si un `setMeta` cambia varios campos y uno no es
válido, el sistema MUST NOT aplicar ninguno.

#### Scenario: Título vacío
- **WHEN** se aplica `setMeta` con el título "   "
- **THEN** la operación se rechaza con el motivo "inválido" y el título no cambia

#### Scenario: Título demasiado largo
- **WHEN** se aplica `setMeta` con un título de 201 caracteres
- **THEN** la operación se rechaza y el título no cambia

#### Scenario: Título que no es texto
- **WHEN** se aplica `setMeta` con el título `42`
- **THEN** la operación se rechaza y el título no cambia

#### Scenario: Título de 200 caracteres
- **WHEN** se aplica `setMeta` con un título de exactamente 200 caracteres
- **THEN** la operación se acepta

#### Scenario: Título válido con un tipo inválido
- **WHEN** se aplica `setMeta` con el título "Login" y un tipo de diagrama desconocido
- **THEN** la operación se rechaza y ni el título ni el tipo cambian

#### Scenario: Título válido con una dirección inválida
- **WHEN** se aplica `setMeta` con el título "Login" y una dirección desconocida
- **THEN** la operación se rechaza y ni el título ni la dirección cambian

### Requirement: El título no forma parte del código Mermaid
El sistema MUST NOT incluir el título en el código Mermaid generado: cambiar el título SHALL dejar el código
idéntico.

#### Scenario: Renombrar el ejemplo
- **WHEN** se carga el ejemplo, se genera su código Mermaid y después se aplica `setMeta` con el título "Login"
- **THEN** el código Mermaid generado es idéntico al de antes

### Requirement: El tipo del diagrama no cambia con operaciones
El sistema MUST NOT cambiar el tipo de un diagrama con ninguna operación: el tipo se fija al crear el
diagrama. Una operación `setMeta` que incluya el campo `kind` SHALL rechazarse con el motivo "inválido"
sin aplicar ninguno de sus campos.

#### Scenario: Cambiar el tipo
- **WHEN** se aplica `setMeta` con el tipo "state" a un diagrama de tipo "flow"
- **THEN** la operación se rechaza con el motivo "inválido" y el tipo sigue siendo "flow"

#### Scenario: Tipo junto a un título válido
- **WHEN** se aplica `setMeta` con el título "Login" y el tipo "state"
- **THEN** la operación se rechaza y el título no cambia

#### Scenario: Dirección y título siguen siendo editables
- **WHEN** se aplica `setMeta` con la dirección "LR" y el título "Login"
- **THEN** la operación se acepta y el tipo, los nodos y las aristas no cambian

### Requirement: Validación de las etiquetas
El sistema SHALL rechazar con el motivo "inválido", sin cambiar nada, una operación que añada o cambie la
etiqueta de un nodo o de un conector con algo que no sea texto o con más de 200 caracteres. Una etiqueta
vacía MUST aceptarse.

#### Scenario: Etiqueta de 200 caracteres
- **WHEN** se aplica `addNode` con una etiqueta de exactamente 200 caracteres
- **THEN** la operación se acepta

#### Scenario: Etiqueta demasiado larga en un nodo
- **WHEN** se aplica `updateNode` con una etiqueta de 201 caracteres
- **THEN** la operación se rechaza con el motivo "inválido" y la etiqueta del nodo no cambia

#### Scenario: Etiqueta demasiado larga en un conector
- **WHEN** se aplica `addEdge` o `updateEdge` con una etiqueta de 201 caracteres
- **THEN** la operación se rechaza y el diagrama no cambia

#### Scenario: Etiqueta que no es texto
- **WHEN** se aplica `updateNode` con la etiqueta `42`
- **THEN** la operación se rechaza y la etiqueta del nodo no cambia

#### Scenario: Etiqueta vacía
- **WHEN** se aplica `updateNode` con la etiqueta ""
- **THEN** la operación se acepta y el nodo queda sin etiqueta
