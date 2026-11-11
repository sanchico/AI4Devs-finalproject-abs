# Spec Delta

## ADDED Requirements

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
