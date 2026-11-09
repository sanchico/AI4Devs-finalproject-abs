# canvas-editing Specification

## Purpose

Define cómo se edita el diagrama en el lienzo con lápiz, dedo y ratón, y cómo se sirve la app, de modo
que el refactor y los bloques siguientes conserven la misma experiencia.

## Requirements

### Requirement: Cada tipo de puntero tiene un papel
El sistema SHALL dibujar con el lápiz, mover nodos con el dedo y, con el ratón, dibujar o mover según el
botón "Ratón: dibuja / Ratón: mueve", que empieza en "dibuja".

#### Scenario: Dedo sobre un nodo
- **WHEN** el usuario arrastra un nodo con el dedo
- **THEN** el nodo sigue al dedo y no se crea ningún trazo

#### Scenario: Ratón en modo mover
- **WHEN** el usuario pulsa "Ratón: dibuja" y arrastra un nodo con el ratón
- **THEN** el botón pasa a "Ratón: mueve" y el nodo se desplaza

### Requirement: Un toque edita la etiqueta
El sistema SHALL abrir el editor de etiqueta al tocar un nodo o un conector (menos de 6 px de movimiento
y menos de 500 ms), y SHALL permitir confirmar con OK o Intro, cancelar con Escape y borrar el elemento.

#### Scenario: Renombrar un nodo
- **WHEN** el usuario toca un nodo, escribe "Guardar" y pulsa Intro
- **THEN** el nodo muestra "Guardar" en el lienzo y en el código Mermaid

#### Scenario: Borrar un nodo
- **WHEN** el usuario toca un nodo y pulsa el botón de borrar del editor
- **THEN** desaparecen el nodo y todas sus aristas

### Requirement: Deshacer y limpiar
El sistema SHALL deshacer el último cambio del modelo (crear, mover, renombrar, borrar o limpiar), con un
máximo de 60 pasos, y SHALL avisar "Nada que deshacer" si no queda ninguno. "Limpiar" SHALL vaciar el
diagrama.

#### Scenario: Deshacer un nodo nuevo
- **WHEN** el usuario dibuja un rectángulo y pulsa "Deshacer"
- **THEN** el rectángulo desaparece y el código vuelve al estado anterior

#### Scenario: Limpiar y deshacer
- **WHEN** el usuario pulsa "Limpiar" y después "Deshacer"
- **THEN** el diagrama vuelve a tener los nodos y aristas que tenía antes de limpiar

### Requirement: Cambio de tipo de diagrama
El sistema SHALL actualizar la leyenda y el código al cambiar el tipo de diagrama, y SHALL avisar de que
solo se reconocen las formas del nuevo tipo.

#### Scenario: Paso a Estados
- **WHEN** el usuario elige "Estados (UML)" en el selector
- **THEN** la leyenda muestra las formas de Estados y aparece el aviso "Ahora solo se reconocen las formas de: Estados"

### Requirement: Diagrama de ejemplo al abrir
El sistema SHALL abrir con un diagrama de flujo de ejemplo de 5 nodos y 5 conexiones y el aviso
"Ejemplo cargado: dibuja encima con el lápiz o pulsa Limpiar".

#### Scenario: Primera carga
- **WHEN** el usuario abre la app
- **THEN** el pie de la vista previa muestra "5 nodos · 5 conexiones"

### Requirement: App servida sin build
El sistema SHALL funcionar sirviendo la carpeta `frontend/` con cualquier servidor HTTP estático, sin paso
de build ni dependencias instaladas, y con mermaid.js cargado desde un CDN.

#### Scenario: Servidor estático
- **WHEN** se sirve `frontend/` con `npx http-server` y se abre en el navegador de la tablet
- **THEN** la app carga sin errores en la consola y el ejemplo se ve en el lienzo y en la vista previa
