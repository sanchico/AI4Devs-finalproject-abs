# Spec Delta

## ADDED Requirements

### Requirement: Un fallo al abrir informa de su causa
El sistema SHALL devolver, cuando un diagrama no se puede abrir, el motivo del fallo y el error que dio el
transporte con su estado, de modo que quien abre pueda distinguir un diagrama al que no se tiene acceso, uno
borrado y una pérdida de conexión. El diagrama MUST quedar sin conexión y sin mostrar un estado parcial.

#### Scenario: Sin acceso
- **WHEN** la carga del registro falla con un error de estado 404
- **THEN** la apertura devuelve `ok: false` con el motivo de carga y ese error, y el diagrama queda sin conexión

#### Scenario: Borrado
- **WHEN** la carga falla con un error de estado 410
- **THEN** la apertura devuelve ese error con su estado 410

#### Scenario: Un fallo sin estado
- **WHEN** la suscripción falla con un error sin estado
- **THEN** la apertura devuelve ese error y el diagrama queda sin conexión
