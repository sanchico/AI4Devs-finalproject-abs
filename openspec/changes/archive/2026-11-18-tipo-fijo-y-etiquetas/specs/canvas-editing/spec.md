# Spec Delta

## MODIFIED Requirements

### Requirement: Cambio de tipo de diagrama
El sistema SHALL empezar un diagrama nuevo del tipo elegido cuando el usuario elige otro tipo en el
selector: vacío, titulado "Diagrama sin título", con la leyenda y el código Mermaid actualizados, y SHALL
avisar de que solo se reconocen las formas del nuevo tipo. Si el diagrama tiene nodos, el sistema MUST
pedir antes confirmación con el aviso de que la acción no se puede deshacer, y si el usuario cancela, el
diagrama y el tipo MUST quedar como estaban.

#### Scenario: Paso a Estados
- **WHEN** el usuario elige "Estados (UML)" en el selector con el lienzo vacío
- **THEN** la leyenda muestra las formas de Estados y aparece el aviso "Ahora solo se reconocen las formas de: Estados"

#### Scenario: Paso a Estados con nodos
- **WHEN** el usuario tiene nodos dibujados, elige "Estados (UML)" en el selector y acepta la confirmación
- **THEN** el diagrama queda vacío, la leyenda muestra las formas de Estados y aparece el aviso "Ahora solo se reconocen las formas de: Estados"

#### Scenario: Confirmación con aviso
- **WHEN** el usuario tiene nodos dibujados y elige otro tipo en el selector
- **THEN** aparece una confirmación que dice que se empieza un diagrama nuevo, que se borra el actual y que "Esta acción no se puede deshacer"

#### Scenario: Cancelar el cambio
- **WHEN** el usuario tiene nodos dibujados, elige otro tipo en el selector y cancela la confirmación
- **THEN** el diagrama, su tipo y su historial de deshacer no cambian y el selector vuelve a mostrar el tipo actual

### Requirement: Deshacer y limpiar
El sistema SHALL deshacer el último gesto del usuario sobre el modelo (crear, conectar, mover, renombrar,
borrar o limpiar), con un máximo de 60 pasos, devolviendo los nodos y aristas afectados a su estado y su
orden anteriores, y SHALL avisar "Nada que deshacer" si no queda ninguno. Un arrastre completo de un nodo
SHALL contar como un solo paso. Los cambios de dirección MUST NOT entrar en la pila de deshacer y el cambio de
tipo SHALL vaciarla. "Limpiar" SHALL vaciar el diagrama.

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
- **WHEN** el usuario dibuja un rectángulo, cambia el tipo a "Estados (UML)", acepta la confirmación y pulsa "Deshacer"
- **THEN** aparece el aviso "Nada que deshacer", el diagrama sigue vacío y su tipo sigue siendo Estados

### Requirement: Un toque edita la etiqueta
El sistema SHALL abrir el editor de etiqueta al tocar un nodo o un conector (menos de 6 px de movimiento
y menos de 500 ms), y SHALL permitir confirmar con OK o Intro, cancelar con Escape y borrar el elemento.
El editor MUST NOT admitir más de 200 caracteres.

#### Scenario: Renombrar un nodo
- **WHEN** el usuario toca un nodo, escribe "Guardar" y pulsa Intro
- **THEN** el nodo muestra "Guardar" en el lienzo y en el código Mermaid

#### Scenario: Borrar un nodo
- **WHEN** el usuario toca un nodo y pulsa el botón de borrar del editor
- **THEN** desaparecen el nodo y todas sus aristas

#### Scenario: Etiqueta larga
- **WHEN** el usuario toca un nodo y pega en el editor un texto de 300 caracteres
- **THEN** el editor conserva solo los primeros 200 y, al confirmar, el nodo queda con esa etiqueta
