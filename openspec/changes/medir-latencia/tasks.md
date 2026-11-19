# Tasks

Parte de D1 adelantada a la sesión 9 (PRD v0.7.6). Estimación total: 1,5 h, dentro de las 2,5 h previstas
para la sesión 9 junto con el inicio de F4. Las tareas del grupo 1 las hace el PO en el panel de Supabase
(región, contraseña y usuarios); el agente guía y comprueba.

## 1. Proyecto remoto (0,3 h)

- [ ] 1.1 Crear el proyecto en el panel de Supabase (plan gratuito, región más cercana a la demo) y guardar la contraseña de la base de datos fuera del repositorio. Verificar: el panel muestra el proyecto activo y su `project ref`.
- [ ] 1.2 Ejecutar `npx supabase login`, `npx supabase link --project-ref <ref>` y `npx supabase db push`. Si una migración falla en el remoto, corregirla con una migración nueva, probarla en local con `npx supabase db reset` y `npm run test:backend`, y repetir el `push`. Verificar: `npx supabase migration list` muestra las cinco migraciones aplicadas en local y en remoto, y `git status` no muestra ningún archivo con secretos.
- [ ] 1.3 Ejecutar en el editor SQL del panel las consultas de `supabase/tests/realtime.test.js` sobre `pg_publication_tables` y `pg_publication`. Verificar: solo aparece `public.diagram_ops`, con `pubinsert` verdadero y el resto falso (requisito "El proyecto remoto publica lo mismo que el local").
- [ ] 1.4 Crear en el panel los usuarios A y B ("Add user", con "Auto confirm"). Verificar: los dos aparecen como confirmados en Authentication.

## 2. Script de medida (0,8 h)

- [x] 2.1 Añadir `supabase/.env.*` al `.gitignore`, salvo `supabase/.env.ejemplo`, que se crea con `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MEDIR_A_CORREO`, `MEDIR_A_PASSWORD`, `MEDIR_B_CORREO` y `MEDIR_B_PASSWORD` vacíos y un comentario de para qué sirve cada uno. Verificar: `git check-ignore supabase/.env.remoto supabase/.env.local` los ignora y `git check-ignore supabase/.env.ejemplo` no.
- [x] 2.2 Crear `supabase/scripts/medida.js` con funciones puras: percentiles (p50, p95 y máximo) y el emparejado de envíos y recepciones por `op_id` (tiempos, perdidas y si llegaron en orden de secuencia). Escribir `supabase/tests/medida.test.js` sin conexión a Supabase: percentiles de listas conocidas (vacía, un valor, 20 valores), una recepción duplicada que cuenta una vez, una perdida y un desorden detectado. Verificar: `node --test supabase/tests/medida.test.js` en verde sin Supabase arrancado.
- [x] 2.3 Crear `supabase/scripts/medir-latencia.js` (decisiones 1, 4 y 5): lee el entorno, inicia sesión con A y B (y los registra si no existen, con un mensaje claro si el registro exige confirmar el correo), crea el diagrama, invita a B como lector, suscribe a B al canal `diagram:{id}` filtrado por `diagram_id` y espera a `SUBSCRIBED`. Al terminar borra el diagrama y cierra los canales. Verificar: `node --env-file=supabase/.env.local supabase/scripts/medir-latencia.js` contra el Supabase local llega a `SUBSCRIBED` y termina sin dejar el proceso colgado.
- [x] 2.4 Añadir la serie (100 `addNode`, 5 de calentamiento, 200 ms entre envíos) y la ráfaga (30 `removeNode` en serie) de las decisiones 2 y 3, con el informe en texto y con `--json`, sin imprimir claves ni contraseñas. Verificar: en local recibe las 100 y las 30 en orden de secuencia, sin perdidas, y `--json` produce JSON válido (`... --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"`).
- [ ] 2.5 Añadir a `package.json` el script `medir:latencia` (`node --env-file=supabase/.env.remoto supabase/scripts/medir-latencia.js`) y documentar en `CLAUDE.md` (apartado `supabase/` y "Cómo ejecutarlo") el proyecto remoto, los archivos `.env.*` y cómo medir en local y en remoto. Verificar: `npm run test:backend` sigue en verde contra el local, incluido `medida.test.js`, y las órdenes documentadas funcionan tal cual.

## 3. Medida y decisión (0,4 h)

- [ ] 3.1 Ejecutar `npm run medir:latencia -- --json` al menos tres veces contra el remoto, desde la wifi de la demo si es posible. Verificar: se tienen tres resultados sin perdidas (si una tiene perdidas, se repite y se anota por qué).
- [ ] 3.2 Añadir a `design.md` una sección "Resultado" con la región, la red, las cifras de cada ejecución y la decisión según la tabla de la decisión 6: transporte (Postgres Changes o Broadcast) y si F4 lleva `apply_ops`. Verificar: la sección cita p95 de T_b y T_ráfaga de cada ejecución y la decisión se deduce de la tabla sin interpretación.
- [ ] 3.3 Actualizar `docs/PRD-MVP.md`: fila del historial con las cifras y la decisión, el riesgo de latencia con el resultado y, si T_ráfaga ≥ 1 s, `apply_ops` como parte confirmada de F4 con su coste (1–1,5 h). Si p95 de T_b ≥ 1 s, anotar en el plan el change aparte de Broadcast. Verificar: la versión de la cabecera y la nueva fila existen y coinciden con la sección "Resultado".

## Workflow follow-up

- Archivar el change con `/opsx:archive` cuando el PO revise el resultado, sincronizando la spec de `diagram-storage`.
- Escribir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
- Con la decisión tomada, proponer F4 (`collab.js`, cola por gestos y, si toca, `apply_ops`) en la rama `feat/f4-cliente-colaborativo`.
