---
name: cerrar-sesion
description: Cierra una sesión de trabajo de pen2mermaid escribiendo su entrada en docs/bitacora.md con los prompts literales del registro de Claude Code, las horas activas, las correcciones y los candidatos para prompts.md. Usar cuando el usuario diga "cierra la sesión", "escribe la bitácora", "fin de sesión" o invoque /cerrar-sesion.
argument-hint: "[--since AAAA-MM-DD[THH:MM]]"
model: sonnet
---

Escribe la entrada de la sesión en [docs/bitacora.md](../../../docs/bitacora.md). La bitácora es la
materia prima de `prompts.md` (bloque P2 de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md)) y el traspaso
entre sesiones, así que prima la fidelidad sobre la redacción.

## 1. Reunir los datos

1. **Prompts literales.** No los reconstruyas de memoria: el contexto puede haberse resumido. Sácalos
   del registro de Claude Code:

   ```bash
   node .claude/skills/cerrar-sesion/prompts.cjs $ARGUMENTS
   ```

   Sin argumentos lee la sesión más reciente. Si la sesión de trabajo abarcó varias sesiones de Claude
   Code (por `/clear` o por reiniciar), usa `--since` con la fecha u hora de inicio. Si dudas, pregunta.
   La salida también da las horas activas.

2. **Commits de la sesión:** `git log --oneline --since="<inicio>"` y `git status`.
3. **Contexto:** la última entrada de la bitácora (número de sesión y "Pendiente") y la sección 6 del
   PRD (plan de sesiones y horas acumuladas) para saber qué bloque tocaba.

## 2. Redactar la entrada

Sigue el formato de las entradas existentes:

~~~markdown
## Sesión N · <fecha> · <título breve>

**Objetivo:** <qué bloque o bloques del PRD (F1, B4…) y qué se quería conseguir>.

**Fase del ciclo de vida:** <producto, arquitectura, datos, API, historias, tickets o PR; según la sección de prompts.md a la que alimente>.

### Prompts

**Prompt 1: <título>**

```
<texto literal, copiado de la salida del script>
```

- **Qué hizo el agente:** <acciones concretas: archivos, decisiones, comprobaciones>.
- **Resultado:** <commit, archivo o PR>.
- **Impacto:** <por qué importa para el proyecto o la evaluación>.

### Uso en `prompts.md`

| Sección de `prompts.md` | Prompts candidatos |
|---|---|

### Correcciones

### Pendiente

**Horas:** <activas> (acumulado <total> h de 33).
~~~

Reglas:

- **Los prompts van literales**, sin corregir erratas. Las respuestas cortas ("sí", "vale", la opción
  elegida en una pregunta) no llevan bloque propio: se cuentan en el "Qué hizo" del prompt anterior,
  como en las respuestas del PO de la sesión 0. Omite también los prompts triviales (permisos,
  "continúa"), pero nunca resumas uno relevante en lugar de citarlo.
- **Correcciones** es lo que más vale en la evaluación y lo que peor recuerdas de ti mismo. Busca en
  los prompts los rechazos, las rectificaciones y las llamadas denegadas, y anota qué hiciste mal y
  cómo se corrigió. Si no encuentras ninguna, dilo y pregunta al usuario si recuerda alguna.
- **Horas:** usa las activas del script, redondeadas al cuarto de hora. Suma el acumulado a la
  entrada anterior. Si tras la sesión 8 el acumulado supera 25 h, recuerda los recortes de la
  sección 6 del PRD.
- Escribe en español, con frases cortas.

## 3. Cierre

1. Enseña la entrada al usuario y aplica sus cambios antes de guardarla.
2. Si se cerró un bloque del PRD, actualiza `CLAUDE.md` (estructura, cómo arrancar y cómo ejecutar los
   tests), como pide P1.
3. Guarda la conversación completa en `docs/sesiones/` para adjuntarla a `prompts.md`. Tú no puedes
   lanzar `/export` (es un comando del usuario), así que ejecuta el script equivalente, con el número
   y un título breve de la sesión:

   ```bash
   node .claude/skills/cerrar-sesion/export-sesion.cjs --nombre "Sesion<N> <título breve>"
   ```

   Genera `docs/sesiones/Sesion<N> <título breve> <fecha-hora>.txt` desde el registro de Claude Code,
   con prompts (`>`), respuestas (`●`) y una línea por herramienta usada. Si la sesión abarcó varios
   registros, pásale las rutas `.jsonl`. El formato se parece al de `/export` pero no es idéntico: si el
   usuario quiere el de `/export`, que lo ejecute él. Dile la ruta del archivo creado.
4. Propón un commit (`docs: añade la sesión N a la bitácora`) que incluya la entrada y el archivo de
   `docs/sesiones/`, pero no lo hagas sin su confirmación.
