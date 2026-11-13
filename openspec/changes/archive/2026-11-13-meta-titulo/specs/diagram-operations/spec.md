# Spec Delta

## MODIFIED Requirements

### Requirement: Todo cambio del diagrama es una operación
El sistema SHALL realizar todo cambio de nodos, aristas, tipo, dirección o título mediante una operación de
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

## ADDED Requirements

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

### Requirement: El título no forma parte del código Mermaid
El sistema MUST NOT incluir el título en el código Mermaid generado: cambiar el título SHALL dejar el código
idéntico.

#### Scenario: Renombrar el ejemplo
- **WHEN** se carga el ejemplo, se genera su código Mermaid y después se aplica `setMeta` con el título "Login"
- **THEN** el código Mermaid generado es idéntico al de antes
