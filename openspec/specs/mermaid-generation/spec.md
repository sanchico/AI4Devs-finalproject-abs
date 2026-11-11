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

### Requirement: Escape de comillas y saltos de línea en etiquetas
El sistema SHALL sustituir en una etiqueta `&` por `#amp;`, `<` por `#lt;`, `>` por `#gt;` y `|` por
`#124;` (con `&` siempre el primero), las comillas dobles por `#quot;` y los saltos de línea por un
espacio, y SHALL usar un espacio como texto de un nodo sin etiqueta.

#### Scenario: Etiqueta con comillas
- **WHEN** un nodo de proceso tiene la etiqueta `Leer "x"`
- **THEN** el código contiene `["Leer #quot;x#quot;"]`

#### Scenario: Etiqueta con HTML y ampersand
- **WHEN** un nodo de proceso `n1` tiene la etiqueta `a<b & c>d`
- **THEN** el código contiene `n1["a#lt;b #amp; c#gt;d"]`

#### Scenario: Conector de flujo con barra vertical
- **WHEN** una arista de `n1` a `n2` en un diagrama de Flujo tiene la etiqueta `a|b`
- **THEN** el código contiene la línea `n1 -->|a#124;b| n2` y ninguna otra `|` en esa línea además de las dos que delimitan la etiqueta

#### Scenario: Conector de estados con barra vertical
- **WHEN** una arista de `n1` a `n2` en un diagrama de Estados tiene la etiqueta `a|b`
- **THEN** el código contiene la línea `n1 --> n2 : a#124;b`

#### Scenario: Vista previa con barra vertical
- **WHEN** la vista previa renderiza un diagrama de Flujo con un conector de etiqueta `a|b`
- **THEN** el diagrama se dibuja completo, sin mensaje de error, y el conector muestra el texto `a|b`

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

### Requirement: Identificadores de nodo en el código
El sistema SHALL identificar cada nodo en el código Mermaid como `n1`, `n2`… según su posición en el
diagrama, sin usar el identificador interno del nodo, de modo que el código sea legible y no dependa de
qué cliente creó cada nodo.

#### Scenario: Nodos nuevos tras limpiar
- **WHEN** el usuario pulsa "Limpiar" y dibuja dos rectángulos
- **THEN** el código declara los nodos como `n1` y `n2`

#### Scenario: Borrar un nodo intermedio
- **WHEN** el diagrama tiene tres nodos y el usuario borra el segundo
- **THEN** el código declara los nodos restantes como `n1` y `n2`, y sus aristas usan esos identificadores
