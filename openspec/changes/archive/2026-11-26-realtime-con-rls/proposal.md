# Proposal

## Why

El criterio de terminado 7 del PRD dice que quien no es miembro de un diagrama no recibe nada, ni por la
API ni por Realtime. La API está probada con un usuario ajeno y con la clave pública sin sesión
(`supabase/tests/lectura.test.js`, S1), pero Realtime no: `supabase/tests/realtime.test.js` solo comprueba
el catálogo (la publicación y los eventos), no abre ningún canal. La auditoría de la sesión 10 lo marcó como
el único hueco de S3 y la sesión 12 lo dejó pendiente. Es el único sitio donde la RLS se aplica en otro
servicio (Realtime la evalúa al repartir cada inserción), y si ahí falla, las operaciones de un diagrama
llegarían a quien no debe verlas aunque la API las niegue.

## What Changes

- Un test de Realtime con cuatro clientes sobre el mismo canal y el mismo filtro: el dueño que escribe, un
  miembro, un usuario con sesión que no es miembro y la clave pública sin sesión. El miembro recibe cada
  operación; el ajeno no recibe ninguna y la clave pública sin sesión es rechazada al suscribirse
  (Realtime no deja suscribirse a quien no puede leer la tabla).
- La ausencia de entregas se demuestra con una operación centinela enviada al final: cuando el miembro ya
  tiene las dos, el ajeno tiene cero. Sin esperas fijas, que darían falsos verdes.
- El test exige que el ajeno **sí** llegue a la confirmación de Postgres Changes (un canal que nunca se unió
  no probaría nada) y que el anónimo sea rechazado con el error concreto de Realtime.
- Se prueba tanto una operación suelta (`apply_op`) como un gesto de varias (`apply_ops`), que es la ruta del
  cliente real.
- La suscripción con espera al mensaje `system` pasa de `scripts/medir-latencia.js` a un helper compartido
  (`supabase/tests/helpers/realtime.js`) que usan el script y el test, sin duplicarla.
- Cierra S3 del PRD (la parte pendiente; el resto ya estaba en S1 y S2). Sin historia de usuario propia:
  respalda HU-02 (colaborar solo con quien se invita).

**Fuera de alcance:** un miembro que pierde el acceso con el canal ya abierto (diagrama borrado) y la
revocación en caliente de roles; la prueba de Realtime contra el proyecto remoto (el CI y el local
bastan); cambios en las migraciones o en la publicación (si el test falla por una brecha real, se
arregla en un change aparte). No choca con el «fuera de alcance» del MVP.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `diagram-storage`: nuevo requisito de que Realtime solo entrega las operaciones de un diagrama a sus
  miembros, con sus escenarios de usuario ajeno y de clave pública sin sesión. Hoy la capability solo exige
  qué se publica, no a quién se entrega.

## Impact

- `supabase/tests/realtime.test.js` (casos nuevos) y `supabase/tests/helpers/realtime.js` (nuevo).
- `supabase/scripts/medir-latencia.js`: usa el helper en lugar de su copia de `suscribir`. Su salida no cambia.
- Sin cambios en `frontend/`, migraciones ni funciones del servidor. Sin dependencias nuevas.
- El CI de backend ya ejecuta `npm run test:backend`, así que el test corre en cada PR.
- La documentación de `CLAUDE.md` (sección de `supabase/`) menciona el helper nuevo.
