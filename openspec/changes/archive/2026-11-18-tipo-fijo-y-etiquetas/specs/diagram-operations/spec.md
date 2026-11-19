# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
