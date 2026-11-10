# Spec Delta

## MODIFIED Requirements

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
