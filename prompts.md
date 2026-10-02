> Detalla en esta sección los prompts principales utilizados durante la creación del proyecto, que justifiquen el uso de asistentes de código en todas las fases del ciclo de vida del desarrollo. Esperamos un máximo de 3 por sección, principalmente los de creación inicial o  los de corrección o adición de funcionalidades que consideres más relevantes.
Puedes añadir adicionalmente la conversación completa como link o archivo adjunto si así lo consideras

**Conversaciones completas:**
- Idea y prototipo, en Claude Desktop: [docs/conversacion-previa.md](docs/conversacion-previa.md).
- Definición de producto y PRD, en Claude Code: resumen con prompts literales en
  [docs/bitacora.md](docs/bitacora.md) (sesión 0).

## Índice

1. [Descripción general del producto](#1-descripción-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Especificación de la API](#4-especificación-de-la-api)
5. [Historias de usuario](#5-historias-de-usuario)
6. [Tickets de trabajo](#6-tickets-de-trabajo)
7. [Pull requests](#7-pull-requests)

---

## 1. Descripción general del producto

**Prompt 1: El problema de partida**
*Contexto: primera conversación, en Claude Desktop. Buscaba una herramienta existente antes de plantear
un producto propio.*
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

**Respuesta clave de Claude:**
> "Sí existe ese punto intermedio, aunque con matices."

Comparó Lekh, DrawExpress, Grapholite y Miro, y propuso los diagramas como texto (Mermaid) como
alternativa. En el siguiente prompt se analizaron las apps que convierten fotos de bocetos a Mermaid:
ninguna convierte mientras se dibuja.

**Impacto en el proyecto:**
Los dos problemas del prompt se convirtieron en los dos principios de diseño del producto: el tipo de
diagrama restringe las formas que se reconocen, y los conectores enlazan nodos de verdad.

**Prompt 2: PRD de visión**
*Contexto: ya con el prototipo en el repositorio, en Claude Code. Primer paso para pasar del prototipo
a un producto.*
```
Como product manager crea un PRD basado en este prototipo.
El objetivo es extender la funcionalidad a todos los tipos de diagramas soportados por mermaid
```

**Respuesta clave de Claude Code:**
> "No todos los tipos de Mermaid son grafos de nodos y aristas como los que ya reconoce el prototipo.
> Por eso el PRD reparte los 22 tipos en tres formas de dibujar."

Leyó el código del prototipo y clasificó los 22 tipos en grafo libre, lienzo con plantilla y datos
dibujados, con el encaje de cada tipo, los gestos por tipo, los requisitos y un plan en seis fases.

**Impacto en el proyecto:**
Fijó la visión a largo plazo y el vocabulario del proyecto (familias de tipos, contrato común por tipo)
del que sale el MVP.

**Prompt 3: PRD del MVP con preguntas del Product Owner**
*Contexto: acotar la visión a un MVP que cupiera en el presupuesto del curso.*
```
Crea otro PRD para un MVP que se pueda crear en 30 horas. Como product owner, pregúntame qué más
necesitas saber para definir el proyecto.
```

**Respuesta clave de Claude Code:**
> "Si sumo todo lo que has marcado, salen unas 42 horas, así que no cabe en 30."

Hizo dos rondas de preguntas (propósito, tipos, equipo, funciones imprescindibles, evaluación,
calendario) y, con las respuestas, detectó que el alcance no cabía y propuso recortes antes de escribir
el PRD.

**Impacto en el proyecto:**
Convirtió la visión en un alcance con horas por bloque, plan de sesiones, criterios de terminado y un
punto de control con recortes decididos de antemano. Ese PRD es la base de la planificación actual
([docs/PRD-MVP.md](docs/PRD-MVP.md)).

---

## 2. Arquitectura del Sistema

### **2.1. Diagrama de arquitectura:**

**Prompt 1: Reconocimiento local en tiempo real**
*Contexto: conversación en Claude Desktop, después de ver que las apps existentes convierten fotos de
bocetos, no trazos en vivo.*
```
¿Y si en vez de subir una imagen quiero que vaya convirtiendo conforme dibujo con el lápiz en una tablet?
```

**Respuesta clave de Claude:**
> "Cambia bastante la arquitectura. Para tiempo real no conviene un LLM por trazo: sería lento (1–3 s
> por llamada), caro e inestable (cada llamada podría reinterpretar el diagrama entero). Lo adecuado es
> reconocimiento local y determinista."

Propuso captura con Pointer Events, reconocimiento geométrico por tipo de diagrama, un modelo de grafo
en lugar de dibujo y generación de Mermaid sin IA, recorriendo el grafo.

**Impacto en el proyecto:**
Es la decisión de arquitectura central. Pasó tal cual a los principios de diseño de `CLAUDE.md`, y la IA
quedó como función opcional.

**Prompt 2: De app en el navegador a app con backend**
*Contexto: el PRD del MVP guardaba los diagramas en el navegador.*
```
Creo que este proyecto encajaría mejor si fuera una app completa con backend y base de datos en vez de
almacenarlos en el navegador
```

**Respuesta clave de Claude Code:**
> "Tiene sentido, sobre todo para la entrega. La plantilla del curso da por hecho que hay backend y base
> de datos."

Mantuvo el reconocimiento en el navegador, estimó el coste y comprobó qué había instalado (JDK 21, Maven,
Docker). Tras avisar de que Java con login propio llevaba el MVP a unas 42,5 h, se decidió usar Supabase
Auth con una API en Spring Boot que valida el JWT y guarda los datos con JPA.

**Impacto en el proyecto:**
Definió el stack del backend (Java 21, Spring Boot, Supabase Auth y PostgreSQL) y el despliegue en un
único contenedor.

**Prompt 3: Colaboración en tiempo real**
*Contexto: con el backend decidido, solo servía para guardar una tabla.*
```
La verdad es que crear un backend sólo para guardar una tabla me parece desaprovecharlo, ¿Cambiaría
mucho la arquitectura para hacer la app colaborativa de manera que varios usuarios pudieran estar
trabajando en el mismo diagrama?
```

**Respuesta clave de Claude Code:**
> "No cambia tanto como parece. La razón es que el prototipo ya trabaja con un modelo de grafo y no con
> un dibujo."

Propuso compartir operaciones sobre el grafo en lugar de trazos, con un servidor WebSocket en Spring
Boot que actúa como autoridad y resuelve conflictos con *last-writer-wins* por campo. Descartó Supabase
Realtime y Yjs, y detectó el riesgo de que las implementaciones de JavaScript y de Java diverjan.

**Impacto en el proyecto:**
Redefinió el producto como pizarra colaborativa y dio al backend un papel real: autenticación, permisos,
orden y persistencia de operaciones.

### **2.2. Descripción de componentes principales:**

**Prompt 1: Prototipo funcional**
*Contexto: conversación en Claude Desktop, con la arquitectura de reconocimiento local ya decidida.*
```
¿Crees que podrías crear un prototipo funcional aquí o mejor iniciar un proyecto en Claude Code con commits?
```

**Respuesta clave de Claude:**
> "Las dos cosas, en ese orden: primero un prototipo aquí como página web (se abre en la tablet y se
> prueba con el S Pen) y, cuando el proyecto crezca, migrarlo a un repositorio con git en Claude Code."

Creó el prototipo con sus componentes principales: la definición de tipos de diagrama (`KINDS`), el
reconocedor (`recognize()`), la generación de Mermaid (`mermaidCode()`), el render en canvas y la entrada
con Pointer Events.

**Impacto en el proyecto:**
Validó la idea en la tablet antes de invertir en estructura. Sus componentes son los que se separan en
módulos en el primer bloque del MVP.

<!-- Pendiente: prompts de la sesión 1 del plan (F1, separar app.js en módulos) y de la sesión 6
(B4, servidor de colaboración). -->

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

**Prompt 1: Paso a Claude Code**
*Contexto: final de la conversación en Claude Desktop, con el prototipo funcionando.*
```
Vale, ¿cómo paso esto a Claude Code?
```

**Respuesta clave de Claude:**
> Se preparó el proyecto como repositorio git con un primer commit, con `CLAUDE.md` como "contexto que
> Claude Code lee al empezar: idea, principios, estructura y hoja de ruta".

**Impacto en el proyecto:**
Creó la estructura inicial del repositorio (commit `5ea5e8a`) y el `CLAUDE.md`, que es el contexto del
que parten todas las sesiones de Claude Code.

<!-- Pendiente: prompt de la sesión 1 (F1, estructura frontend/, backend/ y shared/). -->

### **2.4. Infraestructura y despliegue**

<!-- Pendiente: sesión 8 del plan (D1, Dockerfile y despliegue). -->

### **2.5. Seguridad**

<!-- Pendiente: sesiones 1 (F1, securityLevel 'strict'), 5 (B2, JWT de Supabase y RLS) y 6 (B4, permisos
por operación). Los riesgos se detectaron al diseñar el backend: ver la bitácora, sesión 0, prompts 5 y 6. -->

### **2.6. Tests**

<!-- Pendiente: sesiones 3 (F3, fixtures de trazos y de operaciones compartidas) y 11 (B6, test de
convergencia). -->

---

### 3. Modelo de Datos

<!-- Pendiente: sesiones 4 (B1, migraciones) y 9 (B5, registro de operaciones). -->

---

### 4. Especificación de la API

<!-- Pendiente: sesiones 5 (B3, API REST y OpenAPI) y 6 (B4, protocolo WebSocket). -->

---

### 5. Historias de Usuario

<!-- Pendiente: redactar las 3 historias (dibujar juntos, invitar, recuperar tras un corte) en la
sesión 12. -->

---

### 6. Tickets de Trabajo

<!-- Pendiente: sesión 12 (tickets de B4, F4 y B1/B5). -->

---

### 7. Pull Requests

<!-- Pendiente: las 3 PR más representativas al cierre del proyecto. -->
