# Tasks

## 1. Helper compartido de Realtime (≈0,25 h)

- [x] 1.1 Crear `supabase/tests/helpers/realtime.js` con `suscribir(cliente, diagramaId, recepciones)` movido de `medir-latencia.js` (espera al mensaje `system` con estado `ok`), un `cerrar()` que retira los canales y desconecta, y la llamada a `realtime.setAuth(token)` para clientes con sesión. Verificar: `node --check` del archivo y que se importa sin Supabase arrancado, si no lee el entorno al importarse.
- [x] 1.2 Hacer que `supabase/scripts/medir-latencia.js` importe el helper en vez de su copia. Verificar: `node --test supabase/tests/medida.test.js` en verde y `node --env-file=supabase/.env.local supabase/scripts/medir-latencia.js` en local imprime el mismo informe que antes.
- [x] 1.3 Documentar el helper en la sección de `supabase/` de `CLAUDE.md`. Verificar: la sección nombra `helpers/realtime.js` y su uso.

## 2. Test de Realtime con RLS (≈0,5 h)

- [x] 2.1 (Rojo) Escribir en `supabase/tests/realtime.test.js` el caso de `apply_op`: `equipo()` con dueño y editor, un ajeno y `anonimo()`; los cuatro suscritos al mismo canal; esperar `system ok` en los cuatro; el dueño envía dos operaciones (la segunda es el centinela); esperar a que el editor tenga las dos y comprobar que el ajeno y el anónimo tienen cero. Verificar: con Supabase local arrancado, el test se ejecuta y falla solo si se rompe a propósito la política (ver 2.3).
- [x] 2.2 Añadir el caso de `apply_ops` (un gesto de tres operaciones): el editor las recibe en orden de secuencia y el ajeno y el anónimo no reciben ninguna. Verificar: `npm run test:backend` en verde.
- [x] 2.3 Comprobar que el test detecta una brecha: en una base local de usar y tirar, aplicar a mano una política de lectura abierta en `diagram_ops` (`using (true)`), ver que el test falla porque el ajeno recibe, y restaurar con `npx supabase db reset`. No se guarda ningún cambio de migración. Verificar: el fallo se anota en la bitácora y `db reset` deja `npm run test:backend` en verde.
- [x] 2.4 Ejecutar `realtime.test.js` cinco veces seguidas para descartar inestabilidad y comprobar que `node --test` termina solo (sin conexiones colgadas). Verificar: cinco verdes seguidos y el proceso sale con código 0 sin intervención.

## 3. Cierre (≈0,25 h)

- [x] 3.1 Ejecutar `npm run test:backend` y `node --test "frontend/**/*.test.js"` completos. Verificar: ambos en verde.
- [x] 3.2 Marcar S3 como hecho en `docs/PRD-MVP.md` (sección de F4/S3 y plan de sesiones) y en `CLAUDE.md` si cambia lo que cuenta. Verificar: `grep` de «test de Realtime de S3» no deja ningún «pendiente».
- [ ] 3.3 Commits pequeños en español con conventional commits, en la rama `feat/s3-realtime-con-rls` y PR contra `develop` con confirmación del PO. Verificar: el CI de backend de la PR pasa.

## Workflow follow-up

- Archivar el change con `/opsx:archive` una vez fusionada la PR, de modo que `diagram-storage` incorpore el requisito nuevo.
- Escribir la entrada de la sesión en `docs/bitacora.md` con `/cerrar-sesion`.
