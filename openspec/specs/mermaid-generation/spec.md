# mermaid-generation Specification

## Purpose

Genera el código Mermaid recorriendo el grafo de nodos y aristas, sin IA, con la sintaxis propia de cada
tipo de diagrama y la dirección elegida.

## Requirements

### Requirement: Código de un diagrama de flujo
El sistema SHALL generar para el tipo Flujo una cabecera `flowchart <dir>`, una línea por nodo
(`id["t"]` para proceso, `id{"t"}` para decisión, `id(["t"])` para inicio/fin) y una línea por arista
(`a --> b`, o `a -->|t| b` si tiene etiqueta), en el orden de creación.

#### Scenario: Diagrama de ejemplo
- **WHEN** se abre la app con el diagrama de ejemplo, tipo Flujo y dirección "Arriba → abajo"
- **THEN** el código Mermaid es exactamente el que genera el commit base `5ea5e8a` para ese ejemplo

#### Scenario: Arista con etiqueta
- **WHEN** una arista de `n3` a `n4` tiene la etiqueta "sí"
- **THEN** el código contiene la línea `n3 -->|sí| n4`

### Requirement: Código de un diagrama de estados
El sistema SHALL generar para el tipo Estados una cabecera `stateDiagram-v2` con `direction <dir>`,
`state "t" as id` para cada estado, `state id <<choice>>` para cada elección, y SHALL representar las
elipses como `[*]` en las aristas sin declararlas como nodo.

#### Scenario: Inicio y fin como pseudoestado
- **WHEN** en un diagrama de estados hay una arista de una elipse a un estado `n2`
- **THEN** el código contiene `[*] --> n2` y ninguna línea `state` para la elipse

### Requirement: Escape de comillas y saltos de línea en etiquetas
El sistema SHALL sustituir las comillas dobles de una etiqueta por `#quot;` y los saltos de línea por un
espacio, y SHALL usar un espacio como texto de un nodo sin etiqueta.

#### Scenario: Etiqueta con comillas
- **WHEN** un nodo de proceso tiene la etiqueta `Leer "x"`
- **THEN** el código contiene `["Leer #quot;x#quot;"]`

### Requirement: Dirección del diagrama
El sistema SHALL usar la dirección elegida en el selector (`TD` o `LR`) en la cabecera del código y
SHALL regenerarlo al cambiarla.

#### Scenario: Cambio a izquierda → derecha
- **WHEN** el usuario elige "Izquierda → derecha" en un diagrama de flujo
- **THEN** la primera línea del código pasa a ser `flowchart LR`
