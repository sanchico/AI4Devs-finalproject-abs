// Suscripción a Realtime compartida por los tests y por scripts/medir-latencia.js. No lee el entorno ni importa
// nada de Supabase: recibe el cliente ya creado, así que se puede importar sin el Supabase local arrancado.
import { performance } from 'node:perf_hooks';

const redondear = n => (n == null ? null : Math.round(n * 10) / 10);

/** Pasa a Realtime el token de la sesión del cliente. Sin sesión (clave pública) no hace nada y Realtime usa la clave. */
export async function autenticarRealtime(cliente) {
  const { data } = await cliente.auth.getSession();
  if (data.session) await cliente.realtime.setAuth(data.session.access_token);
}

/** Suscribe al canal del diagrama; cada INSERT recibido se anota en `recepciones` con su hora. */
// SUBSCRIBED solo dice que el canal se ha unido: Postgres Changes empieza a entregar cuando Realtime manda el
// mensaje `system` con `extension: 'postgres_changes'` y `status: 'ok'`. Lo enviado entre uno y otro se pierde.
// Resuelve en cuanto llega ese mensaje, con cuánto tardó cada uno desde la llamada, en ms.
export function suscribir(cliente, diagramaId, recepciones, { plazoMs = 15000 } = {}) {
  const inicio = performance.now();
  let unido = null;
  return new Promise((resolver, rechazar) => {
    const plazo = setTimeout(() => rechazar(new Error(`Realtime: Postgres Changes no confirmó la suscripción en ${plazoMs / 1000} s`)), plazoMs);
    cliente.channel(`diagram:${diagramaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diagram_ops', filter: `diagram_id=eq.${diagramaId}` },
        cambio => recepciones.push({ opId: cambio.new.op_id, seq: cambio.new.seq, t1: performance.now() }))
      .on('system', {}, mensaje => {
        if (mensaje?.extension !== 'postgres_changes') return;
        clearTimeout(plazo);
        if (mensaje.status === 'ok') resolver({ unido: redondear(unido), listo: redondear(performance.now() - inicio) });
        else rechazar(new Error(`Realtime: ${mensaje.message ?? 'error en Postgres Changes'}`));
      })
      .subscribe((estado, err) => {
        if (estado === 'SUBSCRIBED') unido = performance.now() - inicio;
        else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') { clearTimeout(plazo); rechazar(new Error(`Realtime: ${estado} ${err?.message ?? ''}`.trim())); }
      });
  });
}

/** Retira los canales y cierra la conexión de cada cliente, para que el proceso pueda terminar. */
export async function cerrar(...clientes) {
  for (const c of clientes) {
    await c.removeAllChannels();
    c.realtime.disconnect();
  }
}
