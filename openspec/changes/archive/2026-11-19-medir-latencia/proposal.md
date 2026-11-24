# Proposal

## Why

Parte del bloque **D1 · Despliegue** de [docs/PRD-MVP.md](../../../docs/PRD-MVP.md) (v0.7.6), adelantada a la
sesión 9 como paso previo a **F4 · Cliente colaborativo**. Respalda **HU-01** (dibujar juntos) y su criterio
de terminado 1: "cada uno ve los cambios del otro en menos de 1 s con la app desplegada".

Hay dos decisiones de F4 que dependen de un número que aún no tenemos:

- **El transporte.** Si Postgres Changes no reparte las operaciones por debajo de 1 s, el plan B del PRD es
  que `apply_op` las emita por Broadcast (`realtime.send`). Eso cambia S2 y las políticas de Realtime, y
  conviene saberlo antes de escribir `collab.js`.
- **Las ráfagas.** Vaciar un diagrama de 20 nodos son 20 llamadas en serie y deshacerlo, 45. Si el tiempo de
  una llamada por la ráfaga pasa de 1 s, lo que se dibuja detrás llega tarde a los demás, y F4 necesita
  `apply_ops` para enviar cada gesto en una sola llamada.

En local la latencia sale siempre baja, porque no hay red, así que solo vale medirla contra el proyecto
remoto. Ese proyecto había que crearlo en D1 de todas formas; adelantarlo descubre además ahora, y no con
la demo encima, cualquier diferencia de las migraciones en el Supabase alojado.

## What Changes

- **Proyecto Supabase remoto**: crearlo, enlazarlo (`supabase link`) y aplicar las migraciones con
  `supabase db push`. La parte de D1 que queda (hosting estático y URLs de Auth) sigue en la sesión 10.
- **Comprobación del esquema remoto**: la publicación de Realtime del proyecto alojado tiene solo
  `diagram_ops` y solo sus inserciones, como en local.
- **Script de medida** `supabase/scripts/medir-latencia.js`: dos usuarios de prueba en un solo proceso
  de Node (un reloj para los dos). A escribe con `apply_op` y B recibe por Realtime. Mide:
  - el tiempo de la llamada de A,
  - el tiempo desde que A envía hasta que B recibe la operación,
  - el tiempo de una ráfaga de 30 operaciones en serie.

  Da p50, p95 y máximo. Lee la URL, la clave pública y las credenciales de los dos usuarios de un archivo
  fuera de git, y nunca usa la clave de servicio.
- **Resultado y decisión**: las cifras y lo que deciden (Postgres Changes o Broadcast, y si F4 lleva
  `apply_ops`) quedan en el `design.md` de este change y en el PRD.

## Fuera de alcance

- **Implementar el plan B.** Si hace falta Broadcast o `apply_ops`, irá en su propio change (F4 o una
  corrección de S2); este solo mide y decide.
- **Medir desde la tablet.** El script corre en el PC por la misma wifi. La prueba con dos dispositivos
  reales es la aceptación de D1, en la sesión 10.
- **El resto de D1**: hosting estático, URLs de Auth y prueba con la app publicada.
- **Tests automáticos contra el remoto.** `npm run test:backend` sigue apuntando solo al Supabase local.

Nada de esto choca con el fuera de alcance del MVP: no hay servidor propio, ni Edge Functions, ni
instantáneas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `diagram-storage`: se añade el requisito de que una operación llegue por Realtime a los demás miembros
  en menos de 1 s en el proyecto desplegado (criterio de terminado 1, que no estaba en las specs), y el de
  que el proyecto remoto tenga la misma publicación de Realtime que el local.

## Impact

- **Código nuevo**: `supabase/scripts/medir-latencia.js`, que no forma parte de `npm run test:backend`.
  Puede añadirse un script `medir:latencia` en `package.json`.
- **Configuración**: `supabase/.env.remoto` (fuera de git) con la URL, la clave pública y las credenciales de
  los dos usuarios de prueba. Se añade al `.gitignore`. La contraseña de la base de datos solo la pide
  `supabase link` y no se guarda en el repositorio.
- **Sistemas**: un proyecto Supabase en el plan gratuito, con dos usuarios de prueba creados desde el panel.
- **Documentación**: el PRD recoge el resultado (fila del historial y el riesgo de latencia), y
  `CLAUDE.md` explica cómo ejecutar la medida.
- **Sin cambios** en `frontend/`, en las migraciones ni en los tests.
