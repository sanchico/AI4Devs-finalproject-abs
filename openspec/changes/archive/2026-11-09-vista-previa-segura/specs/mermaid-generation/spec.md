# Spec Delta

## MODIFIED Requirements

### Requirement: Escape de comillas y saltos de línea en etiquetas
El sistema SHALL sustituir en una etiqueta `&` por `#amp;`, `<` por `#lt;` y `>` por `#gt;` (en ese orden),
las comillas dobles por `#quot;` y los saltos de línea por un espacio, y SHALL usar un espacio como texto
de un nodo sin etiqueta.

#### Scenario: Etiqueta con comillas
- **WHEN** un nodo de proceso tiene la etiqueta `Leer "x"`
- **THEN** el código contiene `["Leer #quot;x#quot;"]`

#### Scenario: Etiqueta con HTML y ampersand
- **WHEN** un nodo de proceso `n1` tiene la etiqueta `a<b & c>d`
- **THEN** el código contiene `n1["a#lt;b #amp; c#gt;d"]`
