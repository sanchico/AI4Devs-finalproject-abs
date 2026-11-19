// Cálculos del script de medida de latencia. No se conecta a Supabase: pasa también sin el entorno local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentiles, emparejar, duracionRafaga } from '../scripts/medida.js';

test('percentiles de una lista vacía son nulos', () => {
  assert.deepEqual(percentiles([]), { n: 0, p50: null, p95: null, max: null });
});

test('percentiles de un solo valor', () => {
  assert.deepEqual(percentiles([42]), { n: 1, p50: 42, p95: 42, max: 42 });
});

test('percentiles de 20 valores por rango más cercano, sin depender del orden', () => {
  const valores = Array.from({ length: 20 }, (_, i) => (i + 1) * 10).reverse();   // 200, 190 … 10
  assert.deepEqual(percentiles(valores), { n: 20, p50: 100, p95: 190, max: 200 });
  assert.equal(valores[0], 200, 'no reordena la lista recibida');
});

const envio = (opId, t0, tAck) => ({ opId, t0, tAck });
const recepcion = (opId, t1, seq) => ({ opId, t1, seq });

test('empareja por op_id y calcula llamada y reparto', () => {
  const r = emparejar(
    [envio('a', 0, 40), envio('b', 100, 150)],
    [recepcion('b', 180, 2), recepcion('a', 70, 1)].reverse(),
  );
  assert.deepEqual(r, { tA: [40, 50], tB: [70, 80], perdidas: [], repetidas: 0, enOrden: true });
});

test('una recepción repetida cuenta una vez y una ajena se ignora', () => {
  const r = emparejar(
    [envio('a', 0, 40)],
    [recepcion('a', 70, 1), recepcion('a', 95, 1), recepcion('otra', 80, 9)],
  );
  assert.deepEqual(r.tB, [70]);
  assert.equal(r.repetidas, 1);
  assert.deepEqual(r.perdidas, []);
});

test('una operación no recibida es una perdida y no entra en el reparto', () => {
  const r = emparejar([envio('a', 0, 40), envio('b', 100, 140)], [recepcion('a', 70, 1)]);
  assert.deepEqual(r.perdidas, ['b']);
  assert.deepEqual(r.tA, [40, 40]);
  assert.deepEqual(r.tB, [70]);
});

test('detecta que B recibió fuera de orden de secuencia', () => {
  const r = emparejar(
    [envio('a', 0, 40), envio('b', 100, 140)],
    [recepcion('b', 150, 2), recepcion('a', 160, 1)],
  );
  assert.equal(r.enOrden, false);
});

test('la ráfaga va del primer envío a la última recepción', () => {
  const envios = [envio('a', 10, 50), envio('b', 50, 90), envio('c', 90, 130)];
  assert.equal(duracionRafaga(envios, [recepcion('a', 60, 1), recepcion('c', 170, 3), recepcion('b', 100, 2)]), 160);
});

test('la ráfaga incompleta no tiene duración', () => {
  assert.equal(duracionRafaga([envio('a', 0, 40), envio('b', 40, 80)], [recepcion('a', 60, 1)]), null);
  assert.equal(duracionRafaga([], []), null);
});
