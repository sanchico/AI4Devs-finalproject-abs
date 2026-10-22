# pen2mermaid

Nombre del producto: **pen2mermaid** (dominio previsto `pen2mermaid.app`); lema en la interfaz:
"Dibuja a mano, colabora y obtén Mermaid". Antes se llamaba "Trazo a Mermaid"; la carpeta local
y la skill `run-trazo-mermaid` conservan el nombre antiguo. El repositorio remoto en GitHub se llama
`AI4Devs-finalproject-abs` (requisito del curso).

Webapp para dibujar diagramas con lápiz (S Pen en tablet Android) y convertirlos en tiempo real
en un grafo de nodos y conexiones, generando código Mermaid al vuelo.

## Principios de diseño
- **Reconocimiento local y determinista**, sin IA por trazo: rápido, gratis y estable.
- **El tipo de diagrama restringe las formas**: el usuario elige "Flujo", "Estados UML"... y el
  reconocedor solo clasifica entre las formas de ese tipo.
- **Modelo de grafo, no de dibujo**: los conectores son aristas entre nodos. El Mermaid se genera
  recorriendo el grafo; no hace falta IA para eso.
- La IA (API de visión) queda para funciones opcionales: limpiar trazos ambiguos, importar fotos de bocetos.

## Estado actual
Prototipo en un único script (`app.js`) sin build ni dependencias salvo mermaid.js por CDN.
- `KINDS`: definición de cada tipo de diagrama (formas permitidas, sintaxis Mermaid).
- `recognize()`: clasifica un trazo cerrado por dos métricas (área relativa a la caja y distancia
  media a las esquinas) → rect / rombo / elipse. Un trazo abierto entre dos nodos = conector.
- `mermaidCode()`: genera el código desde `nodes` y `edges`.
- Entrada con Pointer Events: `pen` dibuja, `touch` mueve, ratón configurable. Toque = editar etiqueta.

## Cómo ejecutarlo
Abrir `index.html` en un navegador, o servir la carpeta: `python3 -m http.server 8000`
(para probar en la tablet, abrir `http://<ip-del-pc>:8000` en la misma red).

## Hoja de ruta (ideas, por orden aproximado)
1. Separar `app.js` en módulos ES: reconocedor, modelo/grafo, generadores Mermaid por tipo, render, entrada.
2. Tests del reconocedor con trazos grabados (fixtures JSON) y de la generación Mermaid.
3. Mejorar el reconocedor (p. ej. $P recognizer) y añadir formas: flechas de herencia/agregación UML.
4. Nuevos tipos: diagrama de clases UML, secuencia, ER.
5. Pan/zoom del lienzo, autolayout opcional, guardado/carga (JSON y Mermaid).
6. Reconocimiento de escritura a mano para etiquetas (ML Kit Digital Ink si se empaqueta como app Android).

## Convenciones
- Interfaz y textos en español.
- Mantener la app usable sin build (HTML + JS plano) mientras sea posible.
- Commits pequeños y descriptivos, en español.
