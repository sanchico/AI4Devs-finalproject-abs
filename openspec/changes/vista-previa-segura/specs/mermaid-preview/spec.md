# Spec Delta

## Purpose

Muestra el diagrama renderizado por Mermaid junto al lienzo sin que el contenido de las etiquetas pueda
ejecutar código ni inyectar HTML en el navegador de ningún usuario.

## ADDED Requirements

### Requirement: Render en modo estricto
La vista previa MUST renderizar el código con el nivel de seguridad estricto de Mermaid, que no ejecuta
scripts ni permite eventos de clic definidos en el código.

#### Scenario: Configuración del render
- **WHEN** la vista previa renderiza cualquier diagrama
- **THEN** Mermaid se inicializa con `securityLevel: 'strict'`

### Requirement: Etiquetas mostradas como texto literal
El sistema MUST mostrar el texto de una etiqueta de nodo o de conector tal cual lo escribió el usuario,
sin interpretar `<`, `>` ni `&` como HTML, en la vista previa y en el lienzo.

#### Scenario: Etiqueta con una imagen maliciosa
- **WHEN** el usuario pone a un nodo la etiqueta `<img src=x onerror=alert(1)>`
- **THEN** la vista previa muestra ese texto literal, no aparece ninguna imagen y no se ejecuta ningún script

#### Scenario: Etiqueta de conector con HTML
- **WHEN** el usuario pone a un conector la etiqueta `<b>sí</b>`
- **THEN** la vista previa muestra `<b>sí</b>` como texto, sin negrita

#### Scenario: Diagrama de estados
- **WHEN** en un diagrama de estados un estado tiene la etiqueta `<script>alert(1)</script>`
- **THEN** la vista previa muestra ese texto literal y no se ejecuta ningún script

### Requirement: Errores de render mostrados como texto
Cuando Mermaid no puede renderizar el código, la vista previa MUST mostrar el mensaje de error como texto
plano, porque puede contener el texto de una etiqueta.

#### Scenario: Error con HTML en el mensaje
- **WHEN** el render falla con un mensaje que contiene `<img src=x onerror=alert(1)>`
- **THEN** la vista previa muestra "Mermaid no puede renderizar aún:" seguido del mensaje como texto, sin crear ningún elemento `img`
