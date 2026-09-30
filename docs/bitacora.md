# Bitácora de trabajo con Claude Code

Una entrada por sesión. Es la materia prima de `prompts.md` y el traspaso entre sesiones (ver B9 en
[PRD-MVP.md](PRD-MVP.md)).

Formato de cada entrada: fecha, objetivo, prompts literales, qué hizo el agente, qué se corrigió y horas.

---

## Sesión −1 · 18 sep 2026 en adelante · Idea y prototipo (Claude Desktop)

**Objetivo:** encontrar una herramienta para dibujar diagramas con lápiz y, al no haber una que encaje,
diseñar y prototipar la propia.

**Herramienta:** Claude Desktop, antes de pasar a Claude Code. La conversación completa está en
[conversacion-previa.md](conversacion-previa.md), que puede adjuntarse a `prompts.md` como permite la
plantilla del curso.

### Prompts

**Prompt 1: el problema**

```
Busco una app o webapp para dibujar diagramas de manera ágil, creo que con un lápiz en una tablet se
agilizaría bastante. Me gusta la app Samsung Notes porque convierte formas: si dibujo algo parecido a
una flecha la convierte en una flecha, pero le veo 2 problemas:
1. No sé qué formas acepta, me gustaría seleccionar un tipo de diagrama con unas formas predefinidas y
que sólo convierta a estas formas.
2. A veces no conectan bien unas con otras, no siguen las reglas de un diagrama UML, por ejemplo. En
cambio la webapp draw.io sí puedo elegir el tipo de diagrama pero está hecha para arrastrar las formas,
no para dibujarlas con un lápiz.

¿Hay alguna app que combine ambos enfoques? ¿Crees que esto agilizaría la creación de diagramas y
esquemas o se te ocurre alguna otra manera?
```

- **Qué hizo el agente:** comparó Lekh, DrawExpress, Grapholite, Miro y Sketchboard, y propuso los
  diagramas como texto (Mermaid, PlantUML) como alternativa para diagramas formales.
- **Impacto:** los dos problemas del prompt se convirtieron en dos principios de diseño del producto:
  el tipo de diagrama restringe las formas, y los conectores enlazan nodos de verdad.

**Prompt 2: Mermaid y el análisis de la competencia**

```
Por lo que veo Mermaid se ha convertido en el estándar para representar diagramas como texto y trabajar
con la IA, ¿verdad? En vez de pedirte que conviertas la foto de un boceto a Mermaid cada vez, ¿sería
viable hacer una app? ¿Hay alguna que ya lo haga?
```

- **Qué hizo el agente:** confirmó Mermaid como estándar de facto y revisó las apps de imagen a Mermaid
  (SketchFlow, ImageToEditable, mermaidonline.org, imagetomermaid.com) y sus limitaciones. Esbozó cómo
  hacer una app propia con una API de visión.
- **Impacto:** fija Mermaid como formato de salida y sitúa el producto frente a la competencia, que
  convierte imágenes ya terminadas.

**Prompt 3: tiempo real mientras se dibuja**

```
¿Y si en vez de subir una imagen quiero que vaya convirtiendo conforme dibujo con el lápiz en una tablet?
```

- **Qué hizo el agente:** descartó usar un LLM en cada trazo (lento, caro e inestable) y propuso la
  arquitectura:
  - captura con Pointer Events: el lápiz dibuja y el dedo mueve;
  - reconocimiento local tipo $1/$P, con formas restringidas por tipo de diagrama;
  - modelo de grafo en lugar de dibujo;
  - Mermaid generado sin IA, recorriendo el grafo;
  - ML Kit Digital Ink para el texto.
- **Impacto:** es la decisión de arquitectura central del proyecto. Pasó tal cual a los principios de
  diseño de CLAUDE.md, y la IA quedó como función opcional.

**Prompt 4: prototipo**

```
¿Crees que podrías crear un prototipo funcional aquí o mejor iniciar un proyecto en Claude Code con commits?
```

- **Qué hizo el agente:** recomendó prototipar primero y pasar a un repositorio después. Publicó el
  prototipo "Trazo a Mermaid" como página: https://claude.ai/artifact/HDuNnjVw9x35uZmbbvKdoE.
  Incluía flujo y estados, un reconocedor de dos métricas, conectores entre formas, edición por toque,
  vista previa y código.
- **Impacto:** valida la idea en la tablet con el S Pen antes de invertir en estructura.

**Prompt 5: paso a Claude Code**

```
Vale, ¿cómo paso esto a Claude Code?
```

- **Qué hizo el agente:** empaquetó el proyecto como repositorio git con un primer commit y un CLAUDE.md
  con la idea, los principios, la estructura y la hoja de ruta. Explicó cómo usarlo en local y en
  claude.ai/code.
- **Resultado:** commit `5ea5e8a` ("Prototipo inicial: dibujo con lápiz a diagrama Mermaid").
- **Impacto:** el CLAUDE.md inicial es el contexto del que parten todas las sesiones de Claude Code, y su
  hoja de ruta es la base del PRD.

### Uso en `prompts.md`

| Sección de `prompts.md` | Prompts candidatos |
|---|---|
| 1. Descripción general del producto | Prompt 1 (problema) y prompt 2 (competencia) |
| 2. Arquitectura del sistema | Prompt 3 (reconocimiento local y modelo de grafo) |
| 2.4 Infraestructura y despliegue, o nota sobre el proceso | Prompt 5 (paso a Claude Code con CLAUDE.md) |

El prompt 4 cuenta la historia del prototipo, pero no encaja en ninguna sección de la plantilla. Puede ir
en la introducción de `prompts.md`.

### Correcciones

La conversación exportada no recoge correcciones al agente.

**Horas:** fuera del presupuesto de 30 h (fase de idea y prototipo, anterior al MVP).

---

## Sesión 0 · 28–29 sep 2026 · Definición de producto

**Objetivo:** pasar del prototipo (commit `5ea5e8a`) a un PRD de visión y a un PRD de MVP de 30 horas
ajustado a la entrega del curso.

**Fase del ciclo de vida:** producto (candidatos a la sección 1 de `prompts.md`).

### Prompts

**Prompt 1: PRD de visión**

```
Como product manager crea un PRD basado en este prototipo.
El objetivo es extender la funcionalidad a todos los tipos de diagramas soportados por mermaid
```

- **Qué hizo el agente:** leyó `app.js`, `index.html`, `styles.css`, README y CLAUDE.md. Clasificó los
  22 tipos de Mermaid en tres modelos de interacción (grafo libre, lienzo con plantilla, datos dibujados),
  con el encaje de cada tipo, los gestos por tipo, requisitos, un contrato de tipo que sustituye a `KINDS`,
  seis fases y riesgos.
- **Resultado:** PRD completo publicado como página: https://claude.ai/artifact/SXUdhEZr5Fn9M9ZJx7X2XH
  (privada; no está en el repositorio).
- **Impacto:** fija la visión y el vocabulario (familias de tipos, contrato de tipo) del que sale el MVP.

**Prompt 2: PRD del MVP**

```
Crea otro PRD para un MVP que se pueda crear en 30 horas. Como product owner, pregúntame qué más
necesitas saber para definir el proyecto.
```

- **Qué hizo el agente:** hizo dos rondas de preguntas antes de escribir.
  - Ronda 1. Respuestas: propósito "Entrega de curso/proyecto"; tipos: secuencia, clases UML, ER y mapa
    mental; equipo "Yo solo, con Claude Code"; imprescindibles: modularizar `app.js`, guardar y abrir,
    pan y zoom, tests del reconocedor.
  - El agente avisó de que eso sumaba unas 42 h. Ronda 2. Respuestas: quitar secuencia; se evalúa el
    "uso del agente de IA en el proceso"; calendario de más de un mes; PRD como página y en
    `docs/PRD-MVP.md`.
- **Resultado:** [PRD-MVP.md](PRD-MVP.md) v0.1: cinco tipos, bloques B1–B8 con horas, plan de sesiones
  y punto de control.
- **Impacto:** convierte la visión en un alcance de 30 h con criterios de terminado.

**Prompt 3: resolver preguntas abiertas con el proyecto de ejemplo**

```
Para resolver las preguntas que siguen abiertas aqui tienes un ejemplo de proyecto del curso
https://github.com/LIDR-academy/AI4Devs-finalproject-Example1/
```

- **Qué hizo el agente:** leyó la estructura y los encabezados del repositorio por red. Añadió al PRD la
  documentación de entrega (B9) y la publicación en GitHub Pages (B10), y recortó otros bloques para
  mantener las 30 h. Parte de la lectura falló por errores temporales de permisos de red.
- **Resultado:** PRD-MVP v0.2.

**Prompt 4: copia local del ejemplo**

```
Para solucionar los problemas de red he descargado el proyecto en C:\dev\lidr\AI4Devs-finalproject-Example1
```

- **Qué hizo el agente:** leyó la plantilla completa en el README del ejemplo y el formato de `prompts.md`.
- **Resultado:** PRD-MVP v0.3.

**Prompt 5: cambio a aplicación con backend**

```
Creo que este proyecto encajaría mejor si fuera una app completa con backend y base de datos en vez de
almacenarlos en el navegador
```

- **Qué hizo el agente:** valoró el cambio a favor, porque encaja con las secciones 3, 4 y 6 de la
  plantilla, y mantuvo el reconocimiento en el navegador como principio. Estimó el coste y preguntó qué
  recortar, qué stack usar y si hacía falta login.
  - Respuestas: recortar mapa mental y dejar pan y zoom en botones; stack Java con PostgreSQL; usuarios
    con login.
  - El agente comprobó que había JDK 21, Maven y Docker instalados, y avisó de que Java con login propio
    llevaba el MVP a unas 42,5 h. Ofreció cuatro formas de ajustarlo.
  - Respuesta del PO, fuera de las opciones: *"Quitar E-R y login más simple con Supabase Auth + API
    Spring Boot que valida el JWT y gestiona datos con JPA sobre el Postgres de Supabase."*
- **Resultado:** PRD-MVP v0.4: Spring Boot, Supabase Auth y PostgreSQL; clases UML como único tipo
  nuevo; 30 h sin colchón.
- **Impacto:** es la decisión de arquitectura del MVP. Es el mejor candidato para la sección 2 de
  `prompts.md`, junto con el prompt 3 de la sesión −1. Al diseñar el backend, el agente detectó dos
  riesgos de seguridad: la API pública de Supabase expone las tablas si no se activa RLS, y
  `securityLevel: 'loose'` se convierte en un XSS persistente al guardar diagramas.

### Correcciones

- v0.2 afirmaba que el ejemplo tenía una demo en vivo publicada y que el vídeo quedaba fuera. Con la
  plantilla completa se vio que la demo no tiene URL y que el apartado 1.3 pide "imágenes y/o
  videotutorial". Se corrigió en v0.3: se publica igualmente (la ficha pide la URL del proyecto aparte
  de la del repositorio) y se entregan capturas.
- Al leer el código, el agente detectó que la vista previa usa `securityLevel: 'loose'`, un riesgo en
  cuanto se importen JSON ajenos. Quedó como requisito de B3.

### Pendiente

- Elegir el servicio de despliegue del backend (Render, Railway o Fly.io) en la sesión 7.
- La duda sobre los tickets de la sección 6 quedó resuelta con el backend: ya hay uno de backend, uno de
  frontend y uno de base de datos.

**Horas:** fuera del presupuesto de 30 h (definición previa del proyecto).
