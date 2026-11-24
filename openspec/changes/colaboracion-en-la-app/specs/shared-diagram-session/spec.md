# Spec Delta

## Purpose

Define cómo la app abre un diagrama compartido por su dirección, muestra y respeta en qué modo se está (editando,
solo lectura o sin conexión), explica los rechazos del servidor y deja ver a cada miembro lo que hacen los demás.

## ADDED Requirements

### Requirement: Un diagrama compartido se abre por su ruta
El sistema SHALL abrir el diagrama de la dirección `#/d/<id>`, con sesión iniciada, cargando su registro de
operaciones y mostrando el diagrama resultante en el lienzo y en el código Mermaid, sin cargar el diagrama de
ejemplo. El tipo del diagrama SHALL quedar fijado: el selector de tipo muestra el del diagrama y no se puede
cambiar. Recargar la página MUST volver al mismo diagrama.

#### Scenario: Abrir un diagrama con contenido
- **WHEN** un miembro con sesión abre `#/d/<id>` de un diagrama de estados con tres nodos
- **THEN** el lienzo y el código Mermaid muestran esos tres nodos, el selector de tipo dice "Estados (UML)" y está bloqueado, y no aparece el ejemplo

#### Scenario: Recargar
- **WHEN** el miembro recarga la página
- **THEN** vuelve a abrirse el mismo diagrama con el mismo contenido

#### Scenario: Dirección inválida
- **WHEN** el usuario abre `#/d/no-es-un-uuid`
- **THEN** la app muestra el aviso "La dirección del diagrama no es válida", el lienzo queda bloqueado y no se hace ninguna petición sobre un diagrama

### Requirement: Lo que hacen los demás aparece sin recargar
El sistema SHALL mostrar, sin recargar, los cambios que otros miembros hacen en el diagrama abierto: nodos,
aristas, etiquetas, posiciones, título y dirección, y SHALL mantener el selector de dirección igual a la del
diagrama.

#### Scenario: Otro miembro dibuja
- **WHEN** un miembro dibuja un rectángulo en un diagrama que otro miembro tiene abierto
- **THEN** el otro miembro ve el rectángulo en su lienzo y en su código Mermaid en menos de 3 s

#### Scenario: Otro miembro cambia la dirección
- **WHEN** un miembro cambia la dirección a "Izquierda → derecha"
- **THEN** en el otro dispositivo el selector de dirección muestra "Izquierda → derecha" y el código Mermaid empieza por `flowchart LR`

### Requirement: El modo de edición se ve
El sistema SHALL mostrar en todo momento el modo del diagrama compartido: "Conectando…" mientras se carga,
"Editando", "Solo lectura" con su motivo (tu rol, diagrama borrado o sin acceso) o "Sin conexión: recarga la
página", y SHALL mantener visible el modo de solo lectura y el de sin conexión hasta recargar.

#### Scenario: Abrir como editor
- **WHEN** un editor abre un diagrama
- **THEN** el indicador pasa de "Conectando…" a "Editando"

#### Scenario: Abrir como lector
- **WHEN** un lector abre un diagrama
- **THEN** el indicador dice "Solo lectura: tu rol no permite editar"

#### Scenario: Se corta el canal
- **WHEN** el canal de Realtime se cierra con el diagrama abierto
- **THEN** el indicador dice "Sin conexión: recarga la página" y sigue diciéndolo hasta que se recarga

### Requirement: Sin poder editar, la interfaz no edita
El sistema SHALL bloquear la edición mientras el diagrama compartido se carga, está en solo lectura o sin
conexión: los botones "Deshacer" y "Limpiar" y los selectores de tipo y dirección MUST estar desactivados, y el
lienzo MUST NOT empezar trazos, mover nodos ni abrir el editor de etiquetas. Un intento de dibujar SHALL avisar
del motivo sin producir errores en la consola.

#### Scenario: Un lector intenta dibujar
- **WHEN** un lector traza una forma con el lápiz sobre el lienzo
- **THEN** no aparece ninguna forma, se avisa "Solo lectura: tu rol no permite editar" y la consola no muestra errores

#### Scenario: Un lector toca un nodo
- **WHEN** un lector toca un nodo
- **THEN** no se abre el editor de etiquetas

#### Scenario: Botones desactivados
- **WHEN** el diagrama está en solo lectura
- **THEN** "Deshacer", "Limpiar" y los dos selectores están desactivados

### Requirement: Cada rechazo del servidor se explica
El sistema SHALL avisar con un texto propio de cada rechazo que recibe: operación inválida, límite de 5 000
operaciones, rol que ya no permite editar, sin acceso, diagrama borrado y pérdida de la conexión.

#### Scenario: Pasa a lector
- **WHEN** el servidor rechaza un gesto con 403 porque el rol del usuario cambió
- **THEN** aparece el aviso "Tu rol ya no permite editar este diagrama", el diagrama queda en solo lectura y el gesto desaparece del lienzo

#### Scenario: Diagrama borrado mientras se edita
- **WHEN** el servidor rechaza un gesto con 410
- **THEN** aparece el aviso "Este diagrama se ha borrado" y el diagrama queda en solo lectura

#### Scenario: Límite del registro
- **WHEN** el servidor rechaza un gesto con 409 por el tope de operaciones
- **THEN** aparece el aviso "El diagrama alcanzó el límite de 5 000 operaciones" y el gesto desaparece del lienzo

### Requirement: Un diagrama que no se puede abrir dice por qué
El sistema SHALL explicar por qué no abre un diagrama compartido, sin mostrar un diagrama a medias: sin acceso o
inexistente ("No tienes acceso a este diagrama o no existe"), borrado ("Este diagrama se ha borrado") o sin
conexión ("Sin conexión: recarga la página"). MUST NOT distinguir entre un diagrama inexistente y uno ajeno.

#### Scenario: Un diagrama ajeno
- **WHEN** un usuario con sesión abre el enlace de un diagrama del que no es miembro
- **THEN** aparece "No tienes acceso a este diagrama o no existe", el lienzo queda vacío y bloqueado

#### Scenario: Un diagrama que no existe
- **WHEN** un usuario con sesión abre `#/d/` con un UUID que no corresponde a ningún diagrama
- **THEN** aparece el mismo aviso que con un diagrama ajeno

#### Scenario: Un diagrama borrado
- **WHEN** el dueño abre el enlace de un diagrama borrado
- **THEN** aparece "Este diagrama se ha borrado"

### Requirement: Los diagramas grandes se abren enteros
El sistema SHALL abrir completo un diagrama con más de 1 000 operaciones en el registro, aunque la API limite
cada respuesta a 1 000 filas.

#### Scenario: Registro de 1 500 operaciones
- **WHEN** un miembro abre un diagrama cuyo registro tiene 1 500 operaciones
- **THEN** el diagrama que ve es el que resulta de aplicar las 1 500, en orden de secuencia

### Requirement: Cambiar de diagrama reinicia la app
El sistema SHALL recargar la página cuando la dirección cambia de un diagrama a otro o al modo solitario, de modo
que ningún estado del diagrama anterior sobreviva en el siguiente.

#### Scenario: Pasar a otro diagrama
- **WHEN** el usuario cambia la dirección `#/d/<id>` por la de otro diagrama
- **THEN** la página se recarga y muestra solo el contenido del nuevo diagrama

### Requirement: Sin conexión con el servicio, el modo solitario sigue
El sistema SHALL seguir funcionando en modo solitario si la biblioteca de conexión no se puede cargar, y SHALL
avisar en una dirección de diagrama compartido de que no se pudo cargar la conexión con el servidor.

#### Scenario: La biblioteca no carga
- **WHEN** el navegador no puede ejecutar supabase-js y el usuario abre la app sin ruta
- **THEN** la app abre con el ejemplo y se puede dibujar como siempre

#### Scenario: La biblioteca no carga con ruta de diagrama
- **WHEN** el navegador no puede ejecutar supabase-js y el usuario abre `#/d/<id>`
- **THEN** aparece "No se pudo cargar la conexión con el servidor" y el lienzo queda bloqueado
