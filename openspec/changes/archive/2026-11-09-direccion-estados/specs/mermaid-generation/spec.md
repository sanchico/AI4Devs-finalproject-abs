# Spec Delta

## MODIFIED Requirements

### Requirement: Código de un diagrama de estados
El sistema SHALL generar para el tipo Estados una cabecera `stateDiagram-v2` con `direction TB` si la
dirección elegida es "Arriba → abajo" o `direction LR` si es "Izquierda → derecha" (Mermaid no admite
`TD` en este tipo), `state "t" as id` para cada estado, `state id <<choice>>` para cada elección, y SHALL
representar las elipses como `[*]` en las aristas sin declararlas como nodo.

#### Scenario: Inicio y fin como pseudoestado
- **WHEN** en un diagrama de estados hay una arista de una elipse a un estado `n2`
- **THEN** el código contiene `[*] --> n2` y ninguna línea `state` para la elipse

#### Scenario: Estados de arriba a abajo
- **WHEN** el diagrama es de Estados y la dirección es "Arriba → abajo"
- **THEN** la segunda línea del código es `  direction TB` y el código no contiene `direction TD`

#### Scenario: Estados de izquierda a derecha
- **WHEN** el diagrama es de Estados y la dirección es "Izquierda → derecha"
- **THEN** la segunda línea del código es `  direction LR`

#### Scenario: Vista previa sin estados añadidos
- **WHEN** la vista previa renderiza un diagrama de Estados con la dirección "Arriba → abajo"
- **THEN** solo se dibujan los estados del usuario: no aparecen cajas con los textos "direction" o "TD"

### Requirement: Dirección del diagrama
El sistema SHALL escribir en la cabecera del código la dirección elegida en el selector, con la palabra
clave que admite cada tipo (`TD` o `LR` en Flujo; `TB` o `LR` en Estados), y SHALL regenerarlo al
cambiarla.

#### Scenario: Cambio a izquierda → derecha
- **WHEN** el usuario elige "Izquierda → derecha" en un diagrama de flujo
- **THEN** la primera línea del código pasa a ser `flowchart LR`

#### Scenario: Cambio de dirección en Estados
- **WHEN** el usuario elige "Izquierda → derecha" en un diagrama de estados y después vuelve a "Arriba → abajo"
- **THEN** el código pasa a tener `direction LR` y después `direction TB`
