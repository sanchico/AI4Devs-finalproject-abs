# Design

## Context

- El backend existe y está probado en local: `apply_op` numera bajo el bloqueo de la fila del diagrama y
  `diagram_ops` está en la publicación `supabase_realtime`, solo con inserciones. `realtime.test.js` revisa el
  catálogo, pero **nadie se ha suscrito todavía a Postgres Changes con la RLS de un miembro**. La primera
  suscripción real será la de este script.
- No hay proyecto remoto. Los tests (`supabase/tests/helpers/entorno.js`) leen las claves de `supabase status`
  y solo pueden apuntar al entorno local; eso no cambia.
- En local, `enable_confirmations = false`: un usuario puede registrarse e iniciar sesión sin confirmar el
  correo. En el remoto, la confirmación está activada por defecto.
- Node 22 trae `WebSocket` global y `--env-file`, así que supabase-js (ya en `devDependencies`) se suscribe
  a Realtime desde Node sin instalar nada.
- Motivación y umbrales: ver proposal.md (Why) y la spec delta de `diagram-storage`.

## Goals / Non-Goals

**Goals:**
- Unas cifras reproducibles (p50, p95 y máximo) del reparto en el proyecto remoto, y una decisión escrita
  sobre el transporte y sobre `apply_ops`.
- Un script que funcione igual en local y en remoto, cambiando solo el archivo de entorno, para depurarlo
  primero en local.

**Non-Goals:**
- Medir Broadcast. Solo se prueba si Postgres Changes falla, y en otro change.
- Medir la carga con muchos suscriptores: la demo tiene 2 o 3 por diagrama.
- Convertir la medida en un test con aserciones. La latencia depende de la red del momento y un test así
  fallaría al azar; el script informa y la decisión la toma una persona.

## Decisions

### 1. Los dos usuarios en un solo proceso de Node

A (editor) y B (lector suscrito) son dos clientes de supabase-js, cada uno con su sesión, en el mismo
proceso. Los tiempos de envío y de recepción salen del mismo reloj (`performance.now()`), sin sincronizar
nada.

- *Descartado: dos procesos o dos máquinas.* Hace falta sincronizar relojes, y un desfase de decenas de ms
  ya es del orden de lo que se mide.
- *Limitación aceptada:* los dos clientes comparten la red del PC. Es la misma situación que dos
  dispositivos en la misma wifi, que es el caso de la demo.

### 2. Qué operaciones se envían

- **Serie de sueltas:** 100 `addNode` con nodos pequeños e ids nuevos, de una en una y con 200 ms entre
  ellas, para no medir colas. Las 5 primeras son de calentamiento y no cuentan.
- **Ráfaga:** 30 `removeNode` de los nodos creados, cada una al responder la anterior. Es lo que hará la cola
  de F4 al vaciar un diagrama.

Cada operación se identifica por su `op_id`: B empareja lo que recibe con lo enviado. Una operación que no
llega en 5 s cuenta como perdida y se informa aparte.

- *Descartado:* operaciones sobre nodos inexistentes (el servidor las acepta igual) o `setMeta`. Medir con
  operaciones reales cuesta lo mismo y no deja dudas sobre el tamaño de la carga.

### 3. Qué se mide

| Medida | Desde | Hasta |
|---|---|---|
| T_a, llamada | A llama a `apply_op` | A recibe la secuencia |
| T_b, reparto | A llama a `apply_op` | B recibe el INSERT por Realtime |
| T_ráfaga | A envía la primera de las 30 | B recibe la última |

El script imprime p50, p95 y máximo de T_a y T_b, el T_ráfaga, las perdidas, si llegaron en orden de
secuencia y el origen (URL sin clave). Con `--json` imprime lo mismo en JSON, para pegarlo en el design o
en la bitácora.

### 4. Preparación del diagrama con las funciones de S2

A crea el diagrama con `create_diagram('flow')` y una invitación de lector con `create_invite`, y B la acepta
con `accept_invite`. B se suscribe al canal `diagram:{id}` con un filtro por `diagram_id`, y el script no
envía nada hasta el estado `SUBSCRIBED`. Al terminar, A borra el diagrama con `delete_diagram`, que es un
borrado lógico.

- *Descartado:* sembrar con la clave de servicio, como en los tests. Obligaría a tener esa clave en el PC
  para el remoto, y el proyecto la deja fuera del repositorio y de cualquier archivo de trabajo.
- Así el script recorre además el camino real de un miembro invitado: RLS de lectura y Realtime con la
  sesión de B.

### 5. Usuarios y secretos

`supabase/.env.remoto` (fuera de git) contiene `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y el correo y la
contraseña de A y de B. El script se lanza con `node --env-file=...` y acepta cualquier archivo, así que
`supabase/.env.local` (también fuera de git) apunta al entorno local con los valores de `supabase status`.

El script inicia sesión con cada usuario. Si no existe, lo registra: en local entra directamente; en remoto
la confirmación por correo lo impide, y el script termina con un mensaje que pide crear los dos usuarios
desde el panel ("Add user", con "Auto confirm").

- *Descartado:* registrar usuarios aleatorios en cada ejecución. Deja usuarios basura en el remoto y choca
  con el cupo de registros por hora.
- La contraseña de la base de datos solo la pide `supabase link` y no se escribe en ningún archivo.
  `supabase login` guarda su token en el perfil del usuario, fuera del repositorio.

### 6. Regla de decisión

| Resultado | Decisión |
|---|---|
| p95 de T_b < 1 s | Se queda Postgres Changes |
| p95 de T_b ≥ 1 s | Change aparte: `apply_op` emite por Broadcast; se repite la medida |
| T_ráfaga < 1 s | F4 envía cada grupo operación a operación |
| T_ráfaga ≥ 1 s | F4 añade `apply_ops`, que envía cada gesto en una llamada (PRD v0.7.6) |

Las cifras de una ejecución representativa (se descarta una con perdidas o con la wifi saturada) y la
decisión se anotan en este design, en una sección "Resultado", antes de archivar. El PRD recibe la fila del
historial y el riesgo de latencia actualizado.

### 7. Comprobación del esquema remoto

Después del `db push`, la consulta de `realtime.test.js` sobre `pg_publication_tables` y `pg_publication` se
ejecuta en el editor SQL del panel. No hace falta otra forma de conectar: la contraseña de la base de datos
no sale del panel.

## Risks / Trade-offs

- **B no recibe nada.** Sería la primera suscripción con RLS, y podría fallar la política de `diagram_ops`
  vista desde Realtime o el filtro. → El script se ejecuta primero en local, donde se puede depurar con los
  logs de `supabase start`. Si falla en los dos sitios, es un fallo de S1 y se arregla antes de medir.
- **`db push` falla en el proyecto alojado** (por ejemplo, con `alter publication supabase_realtime set
  (publish = 'insert')`). → Es justo lo que se quiere descubrir ahora. El arreglo va en una migración nueva,
  nunca editando una ya aplicada, y se prueba en local con `db reset`.
- **Una sola medida engaña** (wifi, hora, región). → Se ejecuta al menos tres veces y se anotan todas.
  Decide la peor que no tenga perdidas.
- **La región queda fija al crear el proyecto.** → Se elige la más cercana al lugar de la demo. Una región
  lejana se nota en T_a y en T_b por igual, y la medida lo mostraría.
- **El plan gratuito pausa el proyecto tras una semana sin uso.** → Las sesiones siguientes lo usan. Antes
  de entregar se comprueba que está activo, como ya dice el PRD.
- **Diagramas borrados acumulados en el remoto.** → Uno por ejecución, con borrado lógico y unas 130
  operaciones. Es despreciable, y se pueden purgar desde el panel antes de la demo si molesta.

## Migration Plan

No migra datos. Rollback: borrar el proyecto remoto desde el panel y el archivo `supabase/.env.remoto`; el
script no afecta a nada más.
