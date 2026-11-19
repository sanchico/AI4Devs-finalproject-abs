# Spec Delta

## ADDED Requirements

### Requirement: Operaciones mal formadas
El sistema SHALL rechazar con un motivo, sin cambiar nada y sin lanzar ninguna excepción, una operación a la
que le falte el objeto o los campos que su tipo necesita (por ejemplo, un `addNode` sin `node`, un `addEdge`
sin `edge` o sin sus extremos, o un `id` que no sea texto). Aplicar un registro con una operación así MUST
seguir produciendo el mismo diagrama en todos los clientes.

#### Scenario: addNode sin nodo
- **WHEN** se aplica `{"type":"addNode"}`
- **THEN** la operación se rechaza con el motivo "inválido", no se lanza ninguna excepción y el diagrama no cambia

#### Scenario: addEdge sin arista
- **WHEN** se aplica `{"type":"addEdge"}` o un `addEdge` cuya arista no tiene origen y destino
- **THEN** la operación se rechaza con el motivo "inválido" y el diagrama no cambia

#### Scenario: Operación que no es un objeto
- **WHEN** se aplica `null`, un número o un texto como operación
- **THEN** la operación se rechaza y el diagrama no cambia

#### Scenario: Registro con una operación mal formada
- **WHEN** dos réplicas aplican la misma secuencia que incluye un `addNode` sin `node`
- **THEN** las dos terminan con el mismo diagrama
