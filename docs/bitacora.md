# Bitácora de trabajo con Claude Code

Una entrada por sesión. Es la materia prima de `prompts.md` y el traspaso entre sesiones (ver B9 en
[PRD-MVP.md](PRD-MVP.md)).

Formato de cada entrada: fecha, objetivo, prompts literales, qué hizo el agente, qué se corrigió y horas.

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

### Correcciones

- v0.2 afirmaba que el ejemplo tenía una demo en vivo publicada y que el vídeo quedaba fuera. Con la
  plantilla completa se vio que la demo no tiene URL y que el apartado 1.3 pide "imágenes y/o
  videotutorial". Se corrigió en v0.3: se publica igualmente (la ficha pide la URL del proyecto aparte
  de la del repositorio) y se entregan capturas.
- Al leer el código, el agente detectó que la vista previa usa `securityLevel: 'loose'`, un riesgo en
  cuanto se importen JSON ajenos. Quedó como requisito de B3.

### Pendiente

- Confirmar con el profesorado la equivalencia de los tickets de la sección 6 (backend, frontend y
  base de datos frente a lógica, interfaz y datos).

**Horas:** fuera del presupuesto de 30 h (definición previa del proyecto).
