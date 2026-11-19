// Cálculos de la medida de latencia (sin red ni Supabase): percentiles y emparejado de lo que A envía con lo
// que B recibe por Realtime. Los usa medir-latencia.js y los prueba supabase/tests/medida.test.js.

/**
 * p50, p95 y máximo de una lista de tiempos en ms, por rango más cercano (sin interpolar): el valor que deja
 * por debajo al menos ese porcentaje de la muestra. Una lista vacía da `null` en los tres.
 */
export function percentiles(valores) {
  const orden = [...valores].sort((a, b) => a - b);
  const n = orden.length;
  const rango = p => (n ? orden[Math.max(0, Math.ceil((p / 100) * n) - 1)] : null);
  return { n, p50: rango(50), p95: rango(95), max: n ? orden[n - 1] : null };
}

/**
 * Empareja por `op_id` los envíos de A ({opId, t0, tAck}: antes de llamar y al recibir la secuencia) con las
 * recepciones de B ({opId, t1, seq}, en orden de llegada). Una recepción repetida cuenta una vez (la primera)
 * y una que no corresponde a ningún envío se ignora.
 *
 * Devuelve los tiempos de la llamada (`tA`) y del reparto (`tB`) de cada envío recibido, en orden de envío;
 * los `op_id` enviados que B no recibió (`perdidas`); cuántas recepciones repetidas hubo (`repetidas`), y si
 * B recibió las operaciones en orden de secuencia (`enOrden`).
 */
export function emparejar(envios, recepciones) {
  const enviados = new Set(envios.map(e => e.opId));
  const llegada = new Map();
  let repetidas = 0;
  for (const r of recepciones) {
    if (!enviados.has(r.opId)) continue;
    if (llegada.has(r.opId)) { repetidas++; continue; }
    llegada.set(r.opId, r);
  }
  const tA = [], tB = [], perdidas = [];
  for (const e of envios) {
    const r = llegada.get(e.opId);
    if (e.tAck != null) tA.push(e.tAck - e.t0);
    if (r) tB.push(r.t1 - e.t0); else perdidas.push(e.opId);
  }
  const seqs = [...llegada.values()].map(r => r.seq);
  const enOrden = seqs.every((s, i) => i === 0 || s > seqs[i - 1]);
  return { tA, tB, perdidas, repetidas, enOrden };
}

/**
 * Duración de una ráfaga: desde que A envía la primera operación hasta que B recibe la última que llega.
 * `null` si B no recibió alguna, porque entonces la ráfaga no se completó.
 */
export function duracionRafaga(envios, recepciones) {
  if (!envios.length) return null;
  const llegada = new Map();
  for (const r of recepciones) if (!llegada.has(r.opId)) llegada.set(r.opId, r.t1);
  if (envios.some(e => !llegada.has(e.opId))) return null;
  const inicio = Math.min(...envios.map(e => e.t0));
  const fin = Math.max(...envios.map(e => llegada.get(e.opId)));
  return fin - inicio;
}
