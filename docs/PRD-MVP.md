# PRD · MVP de Trazo a Mermaid en 30 horas

| | |
|---|---|
| Estado | Borrador para revisión |
| Versión | 0.3 · 29 sep 2026 (ajustada a la plantilla de entrega del curso) |
| Base | commit `5ea5e8a` (prototipo de flujo y estados) |
| Presupuesto | 30 horas, una persona con Claude Code |
| Calendario | Más de un mes, en sesiones de 2–3 h |
| Propósito | Entrega de curso; se evalúa el uso del agente de IA en el proceso |

## 1. Resumen

El prototipo reconoce rectángulos, rombos, elipses y conectores dibujados con lápiz y genera Mermaid para
dos tipos de diagrama. El MVP lo amplía a **cinco tipos** (flujo, estados, clases UML, entidad-relación y
mapa mental) sobre una base que aguante el crecimiento: código en módulos, tests del reconocedor,
guardado y pan/zoom.

Es un recorte del PRD completo, que cubre los 22 tipos de Mermaid. Del plan por fases de ese documento,
el MVP toma la fase F0 casi entera, parte de F1 (clases y ER) y el mapa mental de F2.

Como el curso evalúa el uso del agente, **el proceso de trabajo con Claude Code es un entregable más**,
con horas asignadas y criterios de aceptación propios (bloques B8 y B9). El formato de entrega sigue el
[proyecto de ejemplo del curso](https://github.com/LIDR-academy/AI4Devs-finalproject-Example1/): ficha y
secciones 1–7 en el README o en archivos numerados, capturas de la experiencia de usuario, `prompts.md`
con los prompts principales y 3 pull requests documentadas (ver sección 8).

## 2. Criterios de terminado

El MVP está terminado cuando se cumple todo esto:

1. Los cinco tipos generan código que renderiza sin error en la vista previa (Mermaid 10.9.1).
2. Hay un recorrido de demostración por tipo que se completa con lápiz, usando el teclado solo para textos.
3. `node --test` pasa, y la precisión del reconocedor sobre los trazos grabados es ≥ 90 % por forma.
4. Recargar la página no pierde el diagrama, y se puede exportar e importar JSON y exportar `.mmd`.
5. Un diagrama más grande que la pantalla se recorre con pan y zoom en la tablet.
6. La bitácora, el CLAUDE.md, la skill y el hook del bloque B8 están en el repositorio.
7. Las secciones 0–7 del curso y `prompts.md` están completas, con capturas de cada tipo y
   3 pull requests documentadas.
8. La app está publicada en GitHub Pages y se puede abrir desde la tablet.
9. Las etiquetas y los JSON importados no pueden inyectar HTML en la vista previa.
10. El total de horas registradas es ≤ 30.

## 3. Fuera de alcance

- Diagrama de secuencia y el resto de tipos del PRD completo.
- Importar código Mermaid al lienzo.
- Escritura a mano de etiquetas; se sigue usando el teclado.
- Contención: subgrafos, estados compuestos, paquetes.
- Autolayout e IA de visión.
- Subir a Mermaid 11. Los cinco tipos ya existen en 10.9.1, así que no hace falta.
- Cardinalidad ER dibujada (patas de gallo a mano). En el MVP se elige por menú y el lienzo la dibuja.
- CI con GitHub Actions. El proyecto de ejemplo solo la propone; aquí los tests se ejecutan en local y
  con el hook de B8.
- Vídeo tutorial. La plantilla pide "imágenes y/o videotutorial"; se entregan capturas (B9).
- Tests end-to-end con Cypress o similar. La skill `run-trazo-mermaid` cubre la prueba en navegador.

## 4. Bloques de trabajo

| Bloque | Horas | Depende de |
|---|---:|---|
| B1 Modularizar `app.js` | 3 | — |
| B2 Tests del reconocedor y de la generación | 3,5 | B1 |
| B3 Guardar y abrir | 2 | B1 |
| B4 Pan y zoom | 2,5 | B1 |
| B5 Clases UML | 7 | B1, B2 |
| B6 Entidad-relación | 4 | B5 (reutiliza menú y compartimentos) |
| B7 Mapa mental | 3 | B1 |
| B8 Configuración de Claude Code | 0,5 | repartido |
| B9 Documentación de entrega | 3,5 | repartido |
| B10 Publicación en GitHub Pages | 0,5 | B1 |
| Colchón | 0,5 | — |
| **Total** | **30** | |

Respecto a la versión 0.1, la documentación del curso (B9, incluidas las capturas) y la publicación (B10)
añaden 4 h. Salen de recortar pan y zoom (sin espacio + arrastrar con ratón), clases (dependencia y
realización solo por menú), ER (la relación no identificante solo por menú), B8 (la bitácora pasa a B9)
y 1,5 h de colchón. Con solo media hora de colchón, el punto de control de la sección 5 es el
mecanismo real de ajuste.

### B1 · Modularizar `app.js` (3 h)

Separar en módulos ES nativos, sin build: `geometry.js`, `recognizer.js`, `model.js`, `kinds/*.js`
(uno por tipo), `render.js`, `input.js`, `storage.js` y `main.js`. `KINDS` pasa a ser un registro de
tipos con un contrato común: formas, `generate(model)`, `render` específico y menú.

- **Aceptación:** el comportamiento es idéntico al del commit base, comprobado con la skill
  `run-trazo-mermaid`. Ningún módulo toca el DOM salvo `render.js`, `input.js` y `main.js`.
- **Consecuencia:** los módulos ES no cargan desde `file://`. La app pasa a requerir servidor
  (`python -m http.server`). Hay que actualizar README y CLAUDE.md.

### B2 · Tests (3,5 h)

- Test runner nativo de Node (`node --test`), sin dependencias.
- Modo de grabación (`?grabar` en la URL): cada trazo se añade a una lista que se copia como JSON.
- Fixtures en `tests/fixtures/*.json`: al menos 10 trazos por forma usada en el MVP, dibujados con el
  S Pen en la tablet.
- Tests de generación: un modelo de ejemplo por tipo y el texto Mermaid esperado.
- **Aceptación:** `node --test` en verde; precisión ≥ 90 % por forma, mostrada en la salida del test.

### B3 · Guardar y abrir (2 h)

- Autoguardado en `localStorage` en cada cambio.
- Exportar JSON (`{version: 1, kind, dir, nodes, edges}`) y `.mmd`; abrir JSON con un selector de archivo.
- **Seguridad:** hoy la vista previa usa `securityLevel: 'loose'`, que permite HTML en las etiquetas.
  Con la importación de JSON, un archivo ajeno podría inyectar HTML en la página. Se pasa a `'strict'`
  y se valida el JSON importado (esquema y versión) antes de cargarlo. Esto alimenta la sección 2.5
  (Seguridad) de la plantilla.
- **Aceptación:** recargar restaura el diagrama. Exportar y volver a abrir da el mismo código Mermaid.
  Un JSON con una etiqueta `<img src=x onerror=alert(1)>` se muestra como texto.

### B4 · Pan y zoom (2,5 h)

- Transformación de vista (desplazamiento y escala). El modelo guarda coordenadas de mundo, así que
  el reconocedor no cambia.
- Dos dedos: desplazar y pellizcar. Ratón: rueda con Ctrl para el zoom. Botón "Encajar".
- Un dedo sigue moviendo nodos y el toque sigue editando.
- **Aceptación:** dibujar, mover y editar funcionan igual a 50 % y a 200 % de zoom.

### B5 · Clases UML (7 h)

- **Clase:** rectángulo. El editor pasa a ser un área de texto: la primera línea es el nombre, las
  líneas con `(` son métodos y el resto son atributos. El lienzo dibuja los compartimentos.
- **Relaciones por marca en el extremo:** justo después de un conector, un trazo cerrado pequeño cerca
  de uno de sus extremos se interpreta como la marca de ese extremo:
  - triángulo → herencia `<|--`
  - rombo → composición `*--`, que se puede cambiar a agregación `o--` en el menú
  - sin marca → asociación `-->`
- **Menú del conector:** tipo de relación (incluye dependencia `..>` y realización `..|>`),
  cardinalidad en cada extremo y etiqueta.
- El reconocedor gana el prototipo `triangle`, solo activo en marcas de extremo.
- **Aceptación:** un diagrama de 5 clases con herencia, composición y asociación se dibuja sin menú
  salvo para los textos, y el código es correcto.

### B6 · Entidad-relación (4 h)

- **Entidad:** rectángulo, con atributos en el área de texto (`tipo nombre PK|FK`), igual que las clases.
- **Relación:** conector con etiqueta. La cardinalidad de cada extremo se elige en el menú
  (`||`, `|o`, `}o`, `}|`) y el lienzo dibuja la pata de gallo correspondiente. Por defecto `||--o{`.
- Identificante (continua) o no (discontinua) por menú.
- **Aceptación:** un modelo de 4 entidades con PK/FK y las cuatro cardinalidades renderiza bien. Si
  la etiqueta está vacía, se genera `: ""` y está cubierto por un test.

### B7 · Mapa mental (3 h)

- La primera forma dibujada es la raíz. Forma → sintaxis: rectángulo `[ ]`, elipse `( )`, rombo `{{ }}`.
- **Gesto rama:** un trazo abierto que sale de un nodo y acaba en un hueco crea un hijo en ese punto.
- Cada nodo tiene un solo padre. Conectar un nodo a otro padre lo mueve, con aviso.
- El código se genera por indentación recorriendo el árbol; las aristas se dibujan sin flecha.
- **Aceptación:** un mapa de 3 niveles y 10 nodos se crea sin dibujar ninguna forma después de la raíz.

### B8 · Configuración de Claude Code (0,5 h, repartido)

- **`CLAUDE.md`:** se actualiza al cerrar cada bloque (estructura de módulos, cómo ejecutar tests,
  convenciones nuevas).
- **Skill `run-trazo-mermaid`:** se versiona, que hoy no lo está, y se amplía para ejecutar los
  recorridos de demostración de los cinco tipos.
- **Hook:** ejecuta `node --test` cuando Claude termina un turno que ha modificado `.js`.

### B9 · Documentación de entrega (3,5 h, repartido)

El criterio de evaluación del curso es el uso del agente. El formato sigue la plantilla del README del
proyecto de ejemplo:

- **Bitácora (`docs/bitacora.md`):** una entrada por sesión con fecha, objetivo, **prompts literales**,
  qué hizo el agente, qué se corrigió a mano y horas. Es la materia prima de `prompts.md` y sirve de
  traspaso entre sesiones separadas por días. La primera entrada es la sesión que ha producido este PRD.
- **`prompts.md`:** un máximo de 3 prompts por sección (1–7). Cada uno con el mismo formato que el
  ejemplo: título, contexto, prompt literal, respuesta clave del agente e impacto en el proyecto.
  La plantilla admite adjuntar la conversación completa; se adjuntan las sesiones exportadas con
  `/export` de Claude Code.
- **Secciones de la plantilla**, adaptadas a una app sin backend:
  - **0. Ficha:** nombre, descripción breve, 0.4 URL del proyecto (la de GitHub Pages) y 0.5 URL del
    repositorio.
  - **1. Producto:** 1.1 objetivo, 1.2 funcionalidades, **1.3 capturas** de cada tipo (se generan con la
    skill `run-trazo-mermaid`) y 1.4 instalación.
  - **2. Arquitectura:** 2.1 diagrama de módulos y justificación, 2.2 componentes, 2.3 estructura de
    ficheros, 2.4 despliegue en GitHub Pages, 2.5 seguridad (la de B3 y que ningún trazo sale del
    dispositivo) y 2.6 tests (B2).
  - **3. Modelo de datos:** el modelo del diagrama (`nodes`, `edges`, tipo) y el formato JSON de B3. La
    plantilla recomienda Mermaid con claves primarias y foráneas, así que el diagrama ER se dibuja con
    la propia app; sirve también como demostración.
  - **4. API:** la plantilla la pide solo "si tu backend se comunica a través de API". Se indica que no
    aplica y se describe en pocas líneas el contrato de tipo de B1.
  - **5. Historias de usuario:** 3, las de clases, ER y mapa mental.
  - **6. Tickets:** 3. La plantilla pide backend, frontend y base de datos; se equiparan con lógica
    (B5, reconocedor), interfaz (B4, interacción) y datos (B3, persistencia y formato).
  - **7. Pull requests:** 3 documentadas. Cada bloque se hace en una rama y entra por PR con `gh`, así
    que sobran candidatas.
- **Aceptación:** cada sesión tiene su entrada en la bitácora; todas las secciones y `prompts.md` están
  completos; el historial de git y las PR permiten seguir los bloques en orden.

### B10 · Publicación en GitHub Pages (0,5 h)

- La app es estática, así que se publica tal cual desde `main`. Además, HTTPS evita el problema de
  `file://` con los módulos ES.
- La URL va en la ficha (sección 0) y en el README; sirve para que el evaluador la pruebe y para
  abrirla en la tablet sin montar un servidor.
- **Aceptación:** la URL publicada carga, dibuja y genera Mermaid en la tablet.

## 5. Plan de sesiones

Unas 12 sesiones de 2–3 h. El orden prioriza la base, porque abarata todo lo demás.

| Sesión | Trabajo | Acumulado |
|---|---|---:|
| 1 | B1 modularizar, más B8 (versionar la skill), B9 (crear la bitácora) y B10 (GitHub Pages) | 4,5 h |
| 2 | B2 grabador y fixtures de las formas actuales; tests de generación | 8 h |
| 3 | B3 guardar y abrir, más B8: hook de tests | 10,5 h |
| 4 | B4 pan y zoom | 13 h |
| 5–7 | B5 clases UML | 20 h |
| 8–9 | B6 entidad-relación | 24 h |
| 10 | B7 mapa mental | 27 h |
| 11 | B9: capturas, secciones 0–7, `prompts.md` y PR documentadas; colchón | 30 h |

La bitácora se escribe al final de cada sesión (unos 5 minutos, contados en B9). Publicar en la sesión 1
hace que cada PR fusionada quede desplegada y probada en la tablet.

**Punto de control tras la sesión 4.** Si las horas acumuladas superan 15, se recorta en este orden:

1. Pan y zoom se queda en botones de zoom y "Encajar", sin gestos.
2. En ER, la pata de gallo se muestra como texto en el lienzo.
3. En clases, la agregación se elige solo por menú.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Los módulos ES rompen la apertura directa de `index.html` | Documentarlo en B1; la skill ya sirve la carpeta por HTTP |
| Las marcas pequeñas de extremo (triángulo y rombo) se confunden | Solo se evalúan cerca de un extremo y justo después del conector; menú como alternativa; fixtures específicos |
| El pan de dos dedos choca con mover nodos con un dedo | Se distingue por número de punteros activos; test manual en la tablet en la sesión 4 |
| Se pierde contexto entre sesiones separadas por días | Bitácora y CLAUDE.md al cierre de cada sesión |
| Las horas se desbordan en clases | Punto de control tras la sesión 4; el colchón es solo de media hora |

## 7. Entregables

- Código en el repositorio, con los tests en verde, y la URL de GitHub Pages.
- README con la ficha y las secciones 1–7 (o archivos numerados enlazados desde él), `prompts.md`,
  `docs/PRD-MVP.md` (este documento) y `docs/bitacora.md`.
- README actualizado: cómo ejecutar la app y los tests.
- `.claude/`: skill y configuración del hook.

## 8. Decisiones tomadas a partir del proyecto de ejemplo

El README del [proyecto de ejemplo del curso](https://github.com/LIDR-academy/AI4Devs-finalproject-Example1/)
incluye la plantilla de entrega con sus instrucciones. Responde a las preguntas abiertas de la versión 0.1:

| Pregunta | Lo que dice la plantilla | Decisión para este MVP |
|---|---|---|
| ¿Qué se evalúa? | Ficha (0.1–0.5) y secciones 1–7 con subapartados: producto (1.1–1.4), arquitectura (2.1–2.6: diagrama, componentes, ficheros, despliegue, seguridad, tests), modelo de datos, API, 3 historias, 3 tickets, 3 PR; y `prompts.md` | Se cubren todas en B9 |
| ¿Hay que publicar la app? | La ficha pide por separado "0.4 URL del proyecto" y "0.5 URL o archivo comprimido del repositorio". El ejemplo no tiene la app publicada: su apartado de demo en vivo no lleva URL | Sí, en GitHub Pages (B10): la 0.4 queda cubierta y cuesta media hora |
| ¿Prompts literales o resumen? | "Máximo de 3 por sección", que justifiquen el uso del asistente en todas las fases; se puede adjuntar la conversación completa | Literales en la bitácora; `prompts.md` es la selección final, con las sesiones exportadas adjuntas |
| ¿Vídeo? | 1.3 pide "imágenes y/o videotutorial" de la experiencia de usuario | Capturas por tipo; vídeo fuera de alcance |
| ¿CI? | 2.6 pide describir "algunos de los tests"; el ejemplo propone GitHub Actions pero no lo implementa | Fuera de alcance |
| ¿API sin backend? | 4 se pide "si tu backend se comunica a través de API" | No aplica; se describe el contrato de tipo |

**Pendiente:** la sección 6 pide un ticket de backend, uno de frontend y uno de base de datos. La
equivalencia con lógica, interfaz y datos que propone B9 es razonable para una app sin servidor, pero
conviene confirmarla con el profesorado.
