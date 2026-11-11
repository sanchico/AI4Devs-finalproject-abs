# Spec Delta

## MODIFIED Requirements

### Requirement: Deshacer y limpiar
El sistema SHALL deshacer el último gesto del usuario sobre el modelo (crear, conectar, mover, renombrar,
borrar o limpiar), con un máximo de 60 pasos, devolviendo los nodos y aristas afectados a su estado y su
orden anteriores, y SHALL avisar "Nada que deshacer" si no queda ninguno. Un arrastre completo de un nodo
SHALL contar como un solo paso. Los cambios de tipo de diagrama o de dirección MUST NOT entrar en la pila
de deshacer. "Limpiar" SHALL vaciar el diagrama.

#### Scenario: Deshacer un nodo nuevo
- **WHEN** el usuario dibuja un rectángulo y pulsa "Deshacer"
- **THEN** el rectángulo desaparece y el código vuelve al estado anterior

#### Scenario: Limpiar y deshacer
- **WHEN** el usuario pulsa "Limpiar" y después "Deshacer"
- **THEN** el diagrama vuelve a tener los nodos y aristas que tenía antes de limpiar, y el código Mermaid es idéntico al de antes de limpiar

#### Scenario: Deshacer un arrastre
- **WHEN** el usuario arrastra un nodo a otra posición con el dedo y pulsa "Deshacer" una vez
- **THEN** el nodo vuelve a la posición en la que estaba antes de empezar el arrastre

#### Scenario: Deshacer un borrado
- **WHEN** el usuario borra desde el editor un nodo que está en medio del diagrama y tiene aristas, y pulsa "Deshacer"
- **THEN** el nodo y sus aristas vuelven, y el código Mermaid es idéntico al de antes de borrar

#### Scenario: El tipo no se deshace
- **WHEN** el usuario dibuja un rectángulo, cambia el tipo a "Estados (UML)" y pulsa "Deshacer"
- **THEN** el rectángulo desaparece y el tipo sigue siendo Estados
