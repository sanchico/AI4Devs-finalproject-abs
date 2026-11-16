# stroke-recording Specification

## Purpose

Permite capturar trazos reales del lápiz, etiquetados por la forma que se quiso dibujar, y exportarlos a un
archivo para usarlos como datos de prueba del reconocedor, sin modificar el diagrama.

## Requirements

### Requirement: Activación solo con el parámetro grabar
El sistema SHALL ofrecer el modo de grabación únicamente cuando la página se abre con el parámetro `grabar`
en la dirección, y MUST comportarse sin ningún cambio cuando no está.

#### Scenario: Abrir con el parámetro
- **WHEN** el usuario abre la página con `?grabar`
- **THEN** aparece un panel de grabación con las tres formas (rectángulo, rombo y elipse), el número de trazos grabados de cada una y una forma elegida

#### Scenario: Abrir sin el parámetro
- **WHEN** el usuario abre la página sin `?grabar`
- **THEN** no hay panel de grabación y los trazos se reconocen y crean nodos y conectores como siempre

### Requirement: Un trazo grabado no cambia el diagrama
Mientras el modo de grabación está activo, el sistema SHALL guardar cada trazo que se dibuja (con el lápiz, o con el
ratón si está en modo dibujar) como una muestra de la forma elegida, y MUST NOT reconocerlo ni crear, mover o borrar nada del diagrama.

#### Scenario: Dibujar una muestra
- **WHEN** el usuario elige "Rombo" y dibuja un trazo con el lápiz
- **THEN** el contador de rombos sube en uno, no se crea ningún nodo ni arista y el código Mermaid no cambia

#### Scenario: Descartar la última muestra
- **WHEN** el usuario pulsa "Descartar último" tras dibujar una muestra
- **THEN** se elimina la última muestra grabada y su contador baja en uno

#### Scenario: Nada que descartar
- **WHEN** el usuario pulsa "Descartar último" sin ninguna muestra grabada
- **THEN** no cambia nada

### Requirement: Exportación de las muestras
El sistema SHALL descargar las muestras grabadas como un único archivo JSON que, para cada forma, contenga
sus trazos con la lista de puntos en píxeles del lienzo (con un decimal) y el tipo de puntero con el que se
dibujó cada uno.

#### Scenario: Descargar las muestras
- **WHEN** el usuario ha grabado 10 trazos de cada forma y pulsa "Descargar"
- **THEN** se descarga un archivo JSON con tres listas de 10 trazos, una por forma, cada trazo con su tipo de puntero y sus puntos

#### Scenario: Volver a leer el archivo
- **WHEN** se lee el archivo descargado
- **THEN** cada trazo se puede pasar tal cual al reconocedor, sin transformarlo

#### Scenario: Descargar sin muestras
- **WHEN** el usuario pulsa "Descargar" sin ninguna muestra grabada
- **THEN** no se descarga nada y se avisa de que no hay trazos
