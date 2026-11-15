# Spec Delta

## ADDED Requirements

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
