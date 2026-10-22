# Diagramas con lápiz → Mermaid

Conversación entre Alvaro y Claude, 18–30 de septiembre de 2026.

Temas: apps para dibujar diagramas con lápiz en tablet, Mermaid como estándar de diagramas como texto, herramientas de imagen a Mermaid, diseño de una app de reconocimiento en tiempo real, prototipo "Trazo a Mermaid" y paso a Claude Code.

---

## 1. Apps para dibujar diagramas con lápiz

**Alvaro:**

> Busco una app o webapp para dibujar diagramas de manera ágil, creo que con un lápiz en una tablet se agilizaría bastante. Me gusta la app Samsung Notes porque convierte formas: si dibujo algo parecido a una flecha la convierte en una flecha, pero le veo 2 problemas:
> 1. No sé qué formas acepta, me gustaría seleccionar un tipo de diagrama con unas formas predefinidas y que sólo convierta a estas formas.
> 2. A veces no conectan bien unas con otras, no siguen las reglas de un diagrama UML, por ejemplo. En cambio la webapp draw.io sí puedo elegir el tipo de diagrama pero está hecha para arrastrar las formas, no para dibujarlas con un lápiz.
>
> ¿Hay alguna app que combine ambos enfoques? ¿Crees que esto agilizaría la creación de diagramas y esquemas o se te ocurre alguna otra manera?

**Claude:**

Sí existe ese punto intermedio, aunque con matices. Las opciones que más se acercan a lo que describes:

- **Lekh** (iOS, Android y web) es probablemente la más cercana. Tiene un "modo inteligente" en el que dibujas como en papel y convierte automáticamente tus trazos en formas y conexiones precisas, y soporta tipos de diagrama específicos: UML, ERD, secuencia, estados, casos de uso, DFD, organigramas y arquitecturas cloud (AWS, GCP, Azure). Al elegir el tipo de diagrama, el reconocimiento se orienta a las formas de esa notación (tu problema 1).
- **DrawExpress Diagram** (Android/iOS) funciona por gestos: dibujas el caso de uso, el actor, la clase o el estado y la app lo reconoce. Tiene un diccionario de gestos por notación, así que sabes exactamente qué acepta. Es veterana, pero sigue siendo de las más fluidas con lápiz.
- **Grapholite** (iPad, Windows) crea formas y conexiones a partir de dibujo a mano alzada, con auto-enrutado de conexiones, lo que ayuda con tu problema 2 (las conexiones se enganchan de verdad a las formas, como en draw.io).
- **Miro** y **Sketchboard** tienen dibujo inteligente, pero son más genéricas: no restringen las formas a una notación concreta.

Sobre la segunda pregunta: el lápiz agiliza mucho la fase de *boceto* (pensar dibujando), pero para diagramas formales tipo UML suele ser aún más rápido el enfoque de **diagramas como texto** con Mermaid o PlantUML. Escribes algo como `ClaseA --> ClaseB : usa` y el layout, las formas y las reglas de la notación se generan solos. draw.io permite importar Mermaid, y Obsidian, Notion o VS Code lo renderizan en vivo.

Flujo híbrido que funciona bien: bocetar a mano para pensar y pasar la versión limpia a Mermaid, que además queda versionable. Incluso se puede pedir a una IA que convierta la foto del boceto en código Mermaid.

Si la tablet es Android con S Pen: empezar por Lekh o DrawExpress; si es iPad: Lekh o Grapholite.

Fuentes:
- [Lekh – App Store](https://apps.apple.com/us/app/lekh-whiteboard-diagramming/id576124115)
- [Lekh – web](https://lekh.app/)
- [Grapholite – App Store](https://apps.apple.com/us/app/id954302708)
- [Apps para diagramas UML en Android (DrawExpress, HandyUML)](https://blogdeapps.com/las-mejores-apps-para-crear-diagramas-uml-en-android/)

---

## 2. Mermaid como estándar y apps de imagen a Mermaid

**Alvaro:**

> Por lo que veo Mermaid se ha convertido en el estándar para representar diagramas como texto y trabajar con la IA, ¿verdad? En vez de pedirte que conviertas la foto de un boceto a Mermaid cada vez, ¿sería viable hacer una app? ¿Hay alguna que ya lo haga?

**Claude:**

Sí, en lo esencial: Mermaid es el estándar de facto para diagramas como texto, sobre todo en IA y documentación. Lo renderizan de forma nativa GitHub, GitLab, Notion, Obsidian, VS Code o Azure DevOps, y como hay muchísimo Mermaid en los datos de entrenamiento, los LLM lo generan muy bien. Matiz: para UML completo, PlantUML sigue cubriendo más notación, pero para la mayoría de los usos Mermaid gana por ecosistema.

**Ya existen varias apps que lo hacen:**

- **SketchFlow** (sketchflow.app): foto del boceto → Mermaid, Draw.io XML o PlantUML.
- **ImageToEditable**: captura, foto o pizarra → Draw.io, Mermaid o Excalidraw editables.
- **mermaidonline.org/image-to-mermaid**: pegas o arrastras la imagen y devuelve Mermaid editable que se renderiza al momento.
- **imagetomermaid.com**: además de imágenes, convierte .drawio, PlantUML, SVG y Visio a Mermaid leyendo el archivo directamente (resultado exacto, no inferido).

Limitación común: los diagramas limpios salen bien; la letra desordenada, el bajo contraste o las etiquetas densas requieren correcciones.

**Hacerla uno mismo es viable y pequeño:**

1. Página web (o app Android) con cámara o subida de imagen.
2. Llamada a una API de visión (Claude, GPT…) con un prompt fijo, p. ej. *"convierte este boceto a Mermaid, usa solo notación de diagrama de clases UML"*.
3. Renderizado con `mermaid.js` en el cliente.
4. Bucle de autocorrección: si el código no renderiza, reenviar el error a la IA para que lo arregle.

El punto 2 resuelve además el problema original de Samsung Notes: en el prompt se puede **restringir la notación**.

Fuentes:
- [SketchFlow](https://www.sketchflow.app/)
- [ImageToEditable](https://imagetoeditable.com/)
- [Mermaid Online — Image to Mermaid](https://mermaidonline.org/image-to-mermaid)
- [ImageToMermaid](https://www.imagetomermaid.com/)

---

## 3. Conversión en tiempo real mientras se dibuja

**Alvaro:**

> ¿Y si en vez de subir una imagen quiero que vaya convirtiendo conforme dibujo con el lápiz en una tablet?

**Claude:**

Cambia bastante la arquitectura. **Para tiempo real no conviene un LLM por trazo**: sería lento (1–3 s por llamada), caro e inestable (cada llamada podría reinterpretar el diagrama entero). Lo adecuado es reconocimiento local y determinista:

1. **Captura de trazos**: canvas con Pointer Events, que distinguen lápiz de dedo (lápiz dibuja; dedos hacen pan/zoom).
2. **Reconocimiento al levantar el lápiz**: clasificar cada trazo con algoritmos clásicos tipo **$1 / $P recognizer** (JavaScript, instantáneos, sin red). La plantilla de formas depende del tipo de diagrama elegido: en diagrama de flujo solo existen rectángulo, rombo, óvalo y flecha; en UML de clases, rectángulos, flechas de herencia, rombos de agregación… (problema 1 resuelto por diseño).
3. **Modelo de grafo, no de dibujo**: un trazo reconocido como conector crea una *arista* entre los *nodos* cercanos a su inicio y su fin. Las formas quedan conectadas semánticamente y se pueden validar reglas (p. ej. una herencia solo une dos clases) (problema 2).
4. **Mermaid sin IA**: el grafo *es* el diagrama; generar Mermaid es recorrer nodos y aristas y emitir `A --> B`, actualizándose en vivo.
5. **Texto**: en Android, **ML Kit Digital Ink Recognition** (escritura a mano en el dispositivo, sin conexión), o doble toque y teclado.

La IA queda como acabado opcional: botón de "limpiar/interpretar" trazos ambiguos o importar bocetos en papel.

---

## 4. Prototipo: "Trazo a Mermaid"

**Alvaro:**

> ¿Crees que podrías crear un prototipo funcional aquí o mejor iniciar un proyecto en Claude Code con commits?

**Claude:**

Las dos cosas, en ese orden: primero un prototipo aquí como página web (se abre en la tablet y se prueba con el S Pen) y, cuando el proyecto crezca, migrarlo a un repositorio con git en Claude Code.

Se publicó el prototipo **Trazo a Mermaid** como artifact: https://claude.ai/artifact/HDuNnjVw9x35uZmbbvKdoE

**Cómo funciona:**

- **Lápiz dibuja, dedo mueve.** Un rectángulo, rombo o elipse cerrado se convierte en nodo. Una línea que empieza dentro de una forma y termina dentro de otra se convierte en conector con flecha (la dirección es la del trazo).
- **Toque sobre un nodo o flecha** → editar su texto o borrarlo.
- **Selector de diagrama**:
  - *Flujo*: rectángulo = Proceso, rombo = Decisión, elipse = Inicio/Fin → `flowchart`.
  - *Estados (UML)*: rectángulo = Estado, rombo = Elección (`<<choice>>`), elipse = Inicio/Fin `[*]` → `stateDiagram-v2`.
- Selector de dirección (arriba→abajo / izquierda→derecha).
- Panel lateral con vista previa renderizada, código Mermaid y botón de copiar. Deshacer y limpiar. Arranca con un ejemplo cargado.
- En PC, un botón decide si el ratón dibuja o mueve.

**Limitaciones del prototipo:** el reconocedor usa dos métricas geométricas sencillas (área relativa a la caja y distancia media a las esquinas), así que un rectángulo muy redondeado puede caer como elipse; no hay pan/zoom; el texto se escribe con teclado.

---

## 5. Paso a Claude Code

**Alvaro:**

> Vale, ¿cómo paso esto a Claude Code?

**Claude:**

Se preparó el proyecto como repositorio git con un primer commit (`trazo-mermaid.zip`):

```
trazo-mermaid/
├── index.html
├── styles.css
├── app.js
├── README.md
├── CLAUDE.md   ← contexto que Claude Code lee al empezar: idea, principios, estructura y hoja de ruta
└── .gitignore
```

**Opción A — En el PC, con la terminal** (recomendada mientras se itera el reconocedor):

1. Instalar Claude Code: `npm install -g @anthropic-ai/claude-code` (Node.js 18+), o el instalador nativo de la documentación.
2. Descomprimir el zip, entrar en la carpeta y ejecutar `claude`; la primera vez pide iniciar sesión.
3. Pedir, por ejemplo: *"Lee CLAUDE.md y empieza por el punto 1 de la hoja de ruta: separa app.js en módulos ES, con un commit por paso"*.
4. Probar en la tablet: `python3 -m http.server 8000` y abrir `http://<ip-del-pc>:8000` en la misma red.

**Opción B — En la web (claude.ai/code), sin instalar nada:**

1. Subir el repo a GitHub: crear un repositorio vacío y ejecutar `git remote add origin <url>` y `git push -u origin main`.
2. En claude.ai/code, conectar GitHub y elegir el repositorio; Claude propone los cambios como commits o pull requests.

Nota: el commit inicial está hecho con el correo de Gmail; si se usa otra identidad de git, cambiarla con `git commit --amend --reset-author` antes de subirlo.

### Hoja de ruta (de CLAUDE.md)

1. Separar `app.js` en módulos ES: reconocedor, modelo/grafo, generadores Mermaid por tipo, render, entrada.
2. Tests del reconocedor con trazos grabados (fixtures JSON) y de la generación Mermaid.
3. Mejorar el reconocedor (p. ej. $P recognizer) y añadir formas: flechas de herencia/agregación UML.
4. Nuevos tipos: diagrama de clases UML, secuencia, ER.
5. Pan/zoom del lienzo, autolayout opcional, guardado/carga (JSON y Mermaid).
6. Escritura a mano para etiquetas (ML Kit Digital Ink si se empaqueta como app Android).
