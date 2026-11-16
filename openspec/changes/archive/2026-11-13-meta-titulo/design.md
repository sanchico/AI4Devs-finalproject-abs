# Design

## Context

Ver proposal.md (Why). Punto de partida (`develop` tras F2 y la adopción del PRD v0.7):

- `state` es `{kind, dir, nodes, edges}` (`model.js`) y `reset()` lo devuelve a ese estado.
- En `ops.js`, `setMeta` filtra `op.set` con `pick(op.set, META_FIELDS)`, con `META_FIELDS = ['kind',
  'dir']`. Valida cada campo presente y, si todos son válidos, hace `Object.assign(state, set)`. Un campo
  que no está en la lista se descarta sin error.
- `inverse` de `setMeta` es genérica: `pick(state, Object.keys(set))`.
- `setKind` y `setDir` del modelo usan `applyRemote`, así que no entran en la pila de deshacer.
- Los tests construyen estados a mano con `empty()` y `triangle()` en `ops.test.js`, sin `title`.

## Goals / Non-Goals

**Goals:**
- Fijar el formato y la validación del título en `apply`, que es el contrato del que copiará S2.
- Que la inversa funcione para F4, que revierte con ella una operación que el servidor rechaza.

**Non-Goals:**
- Un gesto `setTitle` en el modelo y su interfaz: llegan con F5, que decidirá si renombrar se deshace.

## Decisions

### 1. `title` como un campo más de `setMeta`

Se añade `'title'` a `META_FIELDS` y su validación junto a las de `kind` y `dir`. Así, la regla "si un
campo no es válido no se aplica ninguno" se cumple sin más código.

- *Alternativa:* una operación nueva `setTitle`. Descartada: el PRD (sección 5) ya define el título como
  parte de `setMeta`, y `apply_op` en S2 lo copia a `diagrams.title` al ver un `setMeta`. Un tipo nuevo
  obligaría a cambiar la lista de operaciones de la spec y la del servidor.

### 2. `apply` valida, pero no normaliza

`apply` acepta un texto de 1 a 200 caracteres que no sea solo espacios, y lo guarda **tal cual llega**:
sin recortar espacios ni cambiar nada. Recortar es tarea de la interfaz de F5 antes de crear la operación.

- *Alternativa:* que `apply` recorte los espacios. Descartada: cada transformación dentro de `apply` es
  algo más que `apply_op` tiene que reproducir para que `diagrams.title` coincida con el título que ven
  los clientes. Si `apply` solo valida, al servidor le basta con copiar el texto.
- *Alternativa:* no validar en el cliente y dejarlo al servidor. Descartada: las operaciones remotas
  pasan también por `apply`, y un título inválido no debe entrar en ningún estado aunque falle el
  servidor. Además, F3 debe poder probarlo sin red.

El límite de 200 se cuenta con `String.length` (unidades UTF-16). Para PostgreSQL, `char_length` cuenta
caracteres, así que un título con emojis podría medir distinto en los dos lados. Ver Riesgos.

### 3. El estado nace con título

`state` y `reset()` incluyen `title: 'Diagrama sin título'`, el mismo texto que pondrá `create_diagram`
en S2.

Sin valor inicial, la inversa genérica fallaría: `pick(state, ['title'])` devolvería `{}` sobre un estado
sin `title`, y la inversa sería un `setMeta` vacío que no restaura nada. Con el título siempre presente,
la inversa existente sirve sin cambios.

- *Alternativa:* que la inversa trate la ausencia de título con un valor por defecto. Descartada: es un
  caso especial que desaparece si el estado está siempre completo.

`loadExample()` no toca el título, igual que no toca el tipo: lo hereda del estado.

### 4. "Limpiar" no toca el título

`clear()` ya solo emite `removeNode`, así que el título se conserva sin cambiar nada. Se añade un test
porque la spec lo exige.

## Impacto en `ops.js` y en `apply_op`

- **`ops.js`:** el campo `title` en `META_FIELDS`, la validación y el comentario de cabecera
  (`setMeta {set:{kind?, dir?, title?}}`). `inverse` no cambia.
- **`apply_op` (S2):** al recibir un `setMeta` con `title`, aplica la misma validación (texto, 1 a 200,
  no solo espacios) y copia el texto **sin transformarlo** a `diagrams.title`. Un título que `apply`
  rechazaría también lo rechaza el servidor; si no, un cliente lo descartaría y la lista mostraría un
  título que nadie ve en el diagrama.

## Risks / Trade-offs

- [El cliente y el servidor miden la longitud de forma distinta (UTF-16 frente a caracteres)] → En S2,
  `apply_op` mide con `length(convert_to(title, 'UTF16'))/2` o, más simple, rechaza a partir de 200
  caracteres reales y documenta que el cliente es más estricto. Se decide en S2; no afecta a este change.
- [Los tests construyen estados sin `title`] → `empty()` y `triangle()` pasan a incluirlo; si no, la
  prueba de la inversa daría un falso fallo.
- [Títulos con espacios al principio o al final llegan al estado si F5 no los recorta] → Es aceptable: se
  ven igual en todos los clientes y en la lista. F5 recorta antes de enviar.
