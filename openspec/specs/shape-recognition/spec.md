# shape-recognition Specification

## Purpose

Convierte cada trazo del lápiz en una forma del tipo de diagrama elegido, en un conector o en un trazo
descartado, de forma local y determinista, sin IA ni red.

## Requirements

### Requirement: Clasificación restringida por el tipo de diagrama
El sistema SHALL clasificar un trazo cerrado como una de las formas que admite el tipo de diagrama
activo (rectángulo, rombo o elipse en Flujo y en Estados) y nunca como una forma que ese tipo no admite.

#### Scenario: Rectángulo dibujado en un diagrama de flujo
- **WHEN** el usuario dibuja un trazo cerrado con forma de rectángulo de al menos 28×28 px en un diagrama de flujo
- **THEN** el sistema crea un nodo `rect` con la etiqueta por defecto "Proceso N"

#### Scenario: Rombo dibujado en un diagrama de estados
- **WHEN** el usuario dibuja un trazo cerrado con forma de rombo en un diagrama de estados
- **THEN** el sistema crea un nodo `diamond` con la etiqueta por defecto "Elección (choice) N"

#### Scenario: Elipse dibujada en un diagrama de flujo
- **WHEN** el usuario dibuja un trazo cerrado con forma de elipse en un diagrama de flujo
- **THEN** el sistema crea un nodo `ellipse` con la etiqueta por defecto "Inicio/Fin N"

### Requirement: Reconocimiento determinista y sin dependencias del navegador
El reconocedor MUST devolver siempre el mismo resultado para la misma secuencia de puntos y el mismo
conjunto de formas permitidas, y MUST poder ejecutarse fuera del navegador, sin DOM ni red.

#### Scenario: Mismo trazo, mismo resultado
- **WHEN** se clasifica dos veces la misma secuencia de puntos con las mismas formas permitidas
- **THEN** ambas clasificaciones devuelven el mismo tipo, la misma forma y la misma caja

#### Scenario: Ejecución en Node
- **WHEN** un test de `node --test` importa el reconocedor y le pasa un trazo sintético
- **THEN** obtiene la clasificación sin errores y sin acceder a `window` ni a `document`

### Requirement: Trazo abierto entre dos nodos como conector
El sistema SHALL tratar un trazo abierto como conector cuando empieza dentro de un nodo y termina dentro
de otro distinto, con 18 px de tolerancia, y SHALL crear una arista dirigida del primero al segundo.

#### Scenario: Línea de un nodo a otro
- **WHEN** el usuario dibuja una línea que empieza dentro del nodo A y termina dentro del nodo B
- **THEN** el sistema crea la arista A → B sin etiqueta

#### Scenario: Conexión repetida
- **WHEN** el usuario dibuja una línea de A a B y ya existe la arista A → B
- **THEN** el sistema no crea una segunda arista y avisa "Ya existe esa conexión"

#### Scenario: Línea que no une dos nodos
- **WHEN** el usuario dibuja una línea que no empieza o no termina dentro de un nodo
- **THEN** el sistema no crea nada y avisa "Conector no reconocido: empieza dentro de una forma y termina dentro de otra"

#### Scenario: Trazo abierto dentro del mismo nodo
- **WHEN** el usuario dibuja una línea que empieza y termina dentro del mismo nodo, como una punta de flecha
- **THEN** el sistema lo ignora sin aviso

### Requirement: Descarte de trazos demasiado pequeños
El sistema SHALL descartar un trazo de menos de 25 px de recorrido o de menos de 12 px de diagonal, y un
trazo cerrado cuya caja mida menos de 28 px de ancho o de alto.

#### Scenario: Garabato diminuto
- **WHEN** el usuario dibuja un trazo de 10 px de recorrido que no es un toque
- **THEN** el sistema no crea nada y avisa "Trazo demasiado pequeño"

### Requirement: Precisión mínima con trazos reales
El reconocedor SHALL clasificar correctamente al menos el 90 % de los trazos reales grabados de cada forma
(rectángulo, rombo y elipse), en cada tipo de diagrama. Un trazo reconocido como otra forma, como abierto o
como descartado cuenta como fallo.

#### Scenario: Trazos del S Pen
- **WHEN** se clasifican los trazos grabados con el S Pen, con las formas permitidas de Flujo y con las de Estados
- **THEN** en cada tipo y para cada forma se reconocen como esa forma al menos el 90 % de los trazos

#### Scenario: Trazos que no se usaron para ajustar
- **WHEN** se clasifican por separado los trazos grabados después de ajustar el reconocedor
- **THEN** el 90 % por forma se cumple también con ellos solos

#### Scenario: Muestra mínima
- **WHEN** se mide la precisión
- **THEN** hay al menos 10 trazos grabados de cada forma, de modo que la medición nunca pasa sin muestras

#### Scenario: Formas perfectas
- **WHEN** se clasifica un rectángulo, un rombo o una elipse sintéticos y exactos
- **THEN** se reconocen como esa forma, como antes del ajuste
