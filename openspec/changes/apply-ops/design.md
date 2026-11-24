# Design

## Context

- `apply_op` (`supabase/migrations/20261118120100_apply_op.sql`) hace, por este orden: comprueba el rol
  (`diagram_role_or_fail`: 401, 404, 403, 410), exige `op_id`, valida la forma (`validate_op`), bloquea la fila
  del diagrama (`FOR UPDATE`), repite el 410 por si se borró mientras esperaba, devuelve la secuencia guardada
  si el `op_id` ya existe, aplica el tope de 5 000 y, en una sola `UPDATE`, sube `last_seq`, `updated_at` y
  copia título y dirección de un `setMeta`; después inserta la fila en `diagram_ops`.
- El bloqueo dura hasta el final de la transacción: las filas de un diagrama se confirman en orden de `seq` y
  Realtime, que lee el WAL en orden de commit, las entrega en ese orden. Un grupo en una transacción hereda esa
  garantía y además queda contiguo.
- Las migraciones existentes ya están en el proyecto remoto: se añade una nueva y no se edita ninguna.
- `permisos.sql` ya quita `EXECUTE` a `public`, `anon` y `authenticated` en toda función nueva creada por
  `postgres`; una función interna sin `grant` no la expone PostgREST.
- Motivación y alcance: ver proposal.md. Reglas exigibles: spec delta de `operation-log`.

## Goals / Non-Goals

**Goals:**
- Que `apply_op` y `apply_ops` compartan una sola implementación, para que no puedan separarse en roles,
  validación, reintento ni tope.
- Que `apply_op` no cambie de comportamiento: los tests actuales de `apply-op.test.js`, `validacion-op.test.js`
  y `fixtures-ops.test.js` pasan sin tocarlos.

**Non-Goals:**
- Cambiar el formato de `diagram_ops` o de lo que reparte Realtime: una fila por operación.
- Medir `apply_ops` contra el remoto: la migración llega allí en D1 y la medida se repite entonces.

## Decisions

### 1. Firma: un array JSON de `{op_id, op}` y secuencias en un array

`apply_ops(p_diagram_id uuid, p_ops jsonb) returns bigint[]`. `p_ops` es `[{"op_id": "<uuid>", "op": {...}}, …]`
y la respuesta tiene una secuencia por elemento, en el mismo orden. PostgREST la entrega como un array JSON.

- *Descartado: dos arrays paralelos (`p_op_ids uuid[]`, `p_ops jsonb[]`).* Pueden desalinearse y obligan a
  comprobar que tienen la misma longitud; un elemento con su `op_id` no.
- *Descartado: devolver `jsonb` con `{op_id, seq}`.* El cliente ya sabe el `op_id` de cada posición.

### 2. Una función interna con toda la lógica; las dos públicas solo preparan la entrada

`write_ops(p_diagram_id uuid, p_items jsonb) returns bigint[]`, `security definer`, `search_path` vacío y sin
`grant`, contiene todo lo que hoy hace `apply_op` y lo generaliza a un array. `apply_op` la llama con un grupo
de un elemento y devuelve su única secuencia; `apply_ops` le pasa `p_ops` tal cual.

- Por qué no `apply_op` como caso especial de `apply_ops`: la interna mantiene el patrón del repositorio
  (solo las funciones del contrato llevan `grant`; las auxiliares no) y deja cada pública con su firma y su
  nombre de parámetros (`p_op_id`, `p_op`), que el cliente y los tests ya usan.
- `apply_op` se reescribe con `create or replace` y la misma firma. Sus errores no cambian: un `p_op_id` nulo
  da el mismo 422 `invalid_op`, y una operación nula o que no es un objeto, también.
- *Descartado: duplicar el cuerpo en `apply_ops`.* Es lo que el PRD y la bitácora quieren evitar: dos copias
  del bloqueo y del tope acaban distintas.

### 3. Orden de las comprobaciones (el de `apply_op`, ampliado)

1. Rol y sesión (`diagram_role_or_fail`, roles dueño y editor).
2. Forma del grupo: es un array de entre 1 y 500 elementos; cada uno es un objeto con `op_id` que es un UUID
   en texto y con `op`; los `op_id` no se repiten dentro del grupo. 422 `invalid_op` si no.
3. Forma de cada operación con `validate_op` (sin cambios), antes de bloquear: un grupo inválido no toma el
   bloqueo de nadie.
4. Bloqueo de la fila (`FOR UPDATE`) y 410 si se borró mientras esperaba.
5. Operaciones nuevas = las que no están ya en `diagram_ops` (una sola consulta por `op_id`). Si el registro
   más las nuevas supera 5 000, 409 `op_limit`; no se guarda nada.
6. Una `UPDATE` de `diagrams` suma el número de nuevas a `last_seq`, pone `updated_at` y copia título y
   dirección; después un solo `INSERT … SELECT` guarda las nuevas con secuencias `last_seq + 1…`, en el orden
   del grupo. Devuelve, por posición, la secuencia guardada o la que ya tenía.

- *Cuidado con el `op_id`:* el `::uuid` de un texto mal formado lanzaría 22P02 (HTTP 400, no 422). Se
  valida el formato con una expresión regular antes de convertir.
- *Descartado: detallar el índice de la operación inválida en el error.* Exigiría envolver `validate_op` en
  un bloque con excepción (una subtransacción por operación) o cambiar su firma; el cliente descarta el grupo
  entero de todos modos.

### 4. El reintento es por operación, no por grupo

Una operación cuyo `op_id` ya está guardado devuelve su secuencia y no cuenta para el tope; las nuevas se
numeran detrás. Es la regla de `apply_op` aplicada elemento a elemento. Sirve para el caso previsto (el grupo
completo reenviado tras perder la respuesta) y no inventa un caso de "grupo a medias", que la atomicidad hace
imposible salvo que el cliente reagrupe.

- **Solo las operaciones nuevas copian título y dirección a `diagrams`.** Si un reintento copiara los
  `setMeta` ya guardados, devolvería el título a un valor viejo. Dentro de un grupo, el último `setMeta` con
  `title` y el último con `dir` ganan, como en el registro reproducido.
- Con cero operaciones nuevas no se toca `diagrams` (ni `updated_at`): igual que el reintento de `apply_op`,
  que sale antes de la `UPDATE`.

### 5. Tope de 500 operaciones por grupo

Un grupo de más de 500 se rechaza con 422. Acota la carga útil (500 × 2 kB = 1 MB como máximo) y el tiempo que
el grupo mantiene el bloqueo. Un gesto real no se acerca: vaciar el lienzo genera una operación por nodo y un
diagrama dibujado a mano tiene decenas.

- *Descartado: sin tope.* Un cliente modificado podría mantener el bloqueo de un diagrama durante mucho
  tiempo con una sola llamada válida hasta las 5 000 operaciones.
- *Descartado: 5 000.* Es el tope del registro, no de un gesto, y no acota nada útil.
- **Supuesto de F4:** si algún día una cola necesita enviar más de 500 operaciones de un solo gesto, tendrá que
  partirlo y perder la atomicidad de ese gesto. Se anota en el change de la cola.

### 6. Tests: la red de seguridad es la batería de `apply_op`

La reescritura de `apply_op` se comprueba antes de tocar nada nuevo: tras la migración y `db reset`, pasan sin
cambios `apply-op.test.js`, `validacion-op.test.js`, `fixtures-ops.test.js` y el resto. `apply-ops.test.js` es
nuevo y sigue el estilo de `apply-op.test.js` (con `equipo()`, `enviar()` y `leer()` de los ayudantes, más un
`enviarGrupo()`).

- **Contrato de grupo con las fixtures.** Para cada fixture, el grupo con las operaciones que el cliente acepta
  o descarta por el grafo se guarda entero con las secuencias 1…n y deja el mismo registro que el envío en
  serie; si la fixture trae operaciones que el cliente rechaza por su forma, el grupo con todas se rechaza
  con 422 y el registro queda vacío.
- **Tiempos.** Se compara una vez en local la ráfaga de 30 `removeNode` en serie y en un grupo, y las cifras se
  anotan aquí. No es una aserción: la latencia depende de la máquina y fallaría al azar, el mismo motivo por
  el que `medir-latencia` no es un test.
  - **Medido el 24-11-2026 en local** (5 repeticiones, un diagrama nuevo cada una): 30 `apply_op` en serie
    tardaron 119-157 ms (mediana 129 ms, unos 4 ms por llamada) y un `apply_ops` con las 30, 5-7 ms (mediana
    5 ms). En el remoto, con unos 70 ms por llamada de ida y vuelta, la serie fue de 2,5-2,6 s en la medida de
    la sesión 9; un grupo cuesta una sola ida y vuelta.
  - **Medido en el remoto el 24-11-2026** (una ejecución, usuario A de la medida, tras `db push --remote`):
    30 `removeNode` en un `apply_ops` tardaron 188 ms y 30 `apply_op` en serie, 1 981 ms. Con el mismo
    diagrama se comprobó el reintento del grupo (mismas secuencias), un grupo con una operación inválida (422
    sin consumir secuencias), la llamada sin sesión (permiso denegado) y `write_ops` desde la API (403). No
    es una serie estadística: la repetición con dos usuarios y Realtime queda para D1.

## Risks / Trade-offs

- [Reescribir `apply_op` rompe lo que ya funciona] → La batería de S2 pasa entera sin editarse y se ejecuta
  antes de escribir los tests nuevos. Si falla, se arregla `write_ops`, no los tests.
- [Un grupo largo mantiene el bloqueo y retrasa a los demás] → Tope de 500 y una sola transacción; el bloqueo
  dura lo que tarda un `INSERT … SELECT`, menos que 30 transacciones sueltas.
- [Hueco en el reparto por Realtime] → No cambia: las filas del grupo se confirman a la vez y en orden de
  `seq`. La spec exige secuencias contiguas, y la prueba de dos grupos simultáneos la comprueba.
- [El 410 y el 409 llegan con el grupo entero rechazado] → Es lo deseado; el cliente de F4 trata un rechazo
  del servidor como el de una operación suelta (descarta la pendiente).
- [`apply_ops` en el remoto antes de que lo use el cliente] → Subir la migración con `db push` no cambia nada
  para el cliente actual, que no la llama.

## Migration Plan

1. Nueva migración `supabase/migrations/20261124120000_apply_ops.sql`: `write_ops`, `apply_op` reescrita y
   `apply_ops`, con `revoke`/`grant` como las demás.
2. `npx supabase db reset` en local y la batería completa (`npm run test:backend`).
3. Subida al remoto con `npx supabase db push` cuando se vaya a probar F4 contra el remoto (acción sobre un
   entorno compartido: la hace el PO o con su confirmación).
4. Vuelta atrás: una migración que restaure el cuerpo anterior de `apply_op` y borre `apply_ops` y
   `write_ops`. No hay datos que migrar: el formato del registro no cambia.
