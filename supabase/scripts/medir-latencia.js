// Mide cuánto tarda una operación en llegar de un miembro a otro (change medir-latencia, design.md).
// A (dueño) escribe con apply_op y B (lector) la recibe por Realtime; los dos van en este proceso, con un
// solo reloj. Funciona igual contra el Supabase local y contra el remoto: solo cambia el archivo de entorno.
//
//   node --env-file=supabase/.env.local  supabase/scripts/medir-latencia.js [--json]
//   node --env-file=supabase/.env.remoto supabase/scripts/medir-latencia.js [--json]   (npm run medir:latencia)
//
// Usa la clave pública y la sesión de cada usuario; nunca la clave de servicio. No imprime claves ni contraseñas.
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as esperar } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { percentiles, emparejar, duracionRafaga } from './medida.js';
import { suscribir } from '../tests/helpers/realtime.js';

const CALENTAMIENTO = 5;      // operaciones iniciales que no cuentan
const SERIE = 100;            // operaciones sueltas que sí cuentan
const PAUSA_MS = 200;         // entre operaciones sueltas, para no medir colas
const RAFAGA = 30;            // removeNode seguidos, cada uno al responder el anterior
const ESPERA_MAX_MS = 5000;   // lo que se espera a B tras el último envío; lo que no llega es una perdida
const json = process.argv.includes('--json');

function entorno() {
  const nombres = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'MEDIR_A_CORREO', 'MEDIR_A_PASSWORD', 'MEDIR_B_CORREO', 'MEDIR_B_PASSWORD'];
  const faltan = nombres.filter(n => !process.env[n]);
  if (faltan.length) {
    throw new Error(`Faltan variables: ${faltan.join(', ')}. Copia supabase/.env.ejemplo, rellénalo y lanza el script con node --env-file=<archivo>.`);
  }
  return Object.fromEntries(nombres.map(n => [n, process.env[n]]));
}

const opcionesCliente = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente con la sesión del usuario. Si no existe, lo registra (en local entra sin confirmar el correo). */
async function sesion(env, correo, password, quien) {
  const cliente = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, opcionesCliente);
  let { data, error } = await cliente.auth.signInWithPassword({ email: correo, password });
  if (error?.code === 'invalid_credentials') {
    ({ data, error } = await cliente.auth.signUp({ email: correo, password }));
    if (!error && !data.session) {
      throw new Error(`El usuario ${quien} no existe y el registro exige confirmar el correo: créalo en el panel (Authentication > Add user, con "Auto confirm").`);
    }
  }
  if (error) throw new Error(`No se pudo iniciar sesión con el usuario ${quien}: ${error.message}`);
  await cliente.realtime.setAuth(data.session.access_token);
  return cliente;
}

async function rpc(cliente, funcion, args) {
  const { data, error } = await cliente.rpc(funcion, args);
  if (error) throw new Error(`${funcion} rechazada: ${error.code} ${error.message} ${error.details ?? ''}`.trim());
  return data;
}

/** Envía una operación con A y anota cuándo salió y cuándo volvió la secuencia. */
async function enviar(a, diagramaId, op) {
  const opId = randomUUID();
  const t0 = performance.now();
  await rpc(a, 'apply_op', { p_diagram_id: diagramaId, p_op_id: opId, p_op: op });
  return { opId, t0, tAck: performance.now() };
}

/** Espera hasta que B haya recibido todos los envíos o pase ESPERA_MAX_MS. */
async function esperarRecepciones(envios, recepciones) {
  const limite = performance.now() + ESPERA_MAX_MS;
  const pendientes = () => { const r = new Set(recepciones.map(x => x.opId)); return envios.some(e => !r.has(e.opId)); };
  while (pendientes() && performance.now() < limite) await esperar(50);
}

const nodo = id => ({ type: 'addNode', node: { id, shape: 'rect', x: 0, y: 0, w: 80, h: 40, label: 'medida' } });
const redondear = n => (n == null ? null : Math.round(n * 10) / 10);
const resumen = p => ({ n: p.n, p50: redondear(p.p50), p95: redondear(p.p95), max: redondear(p.max) });

async function medir() {
  const env = entorno();
  const origen = new URL(env.SUPABASE_URL).host;
  const a = await sesion(env, env.MEDIR_A_CORREO, env.MEDIR_A_PASSWORD, 'A');
  const b = await sesion(env, env.MEDIR_B_CORREO, env.MEDIR_B_PASSWORD, 'B');
  const recepciones = [];
  let diagramaId;
  try {
    // El camino de un miembro invitado: A crea e invita como lector, B acepta y se suscribe
    diagramaId = await rpc(a, 'create_diagram', { p_kind: 'flow' });
    const token = await rpc(a, 'create_invite', { p_diagram_id: diagramaId, p_role: 'viewer' });
    await rpc(b, 'accept_invite', { p_token: token });
    const suscripcion = await suscribir(b, diagramaId, recepciones);
    if (!json) console.error(`Suscrito a ${origen}. Midiendo ${CALENTAMIENTO + SERIE} operaciones sueltas y una ráfaga de ${RAFAGA}…`);

    const nodos = [], calentamiento = [], serie = [];
    for (let i = 0; i < CALENTAMIENTO + SERIE; i++) {
      const id = randomUUID();
      nodos.push(id);
      const envio = await enviar(a, diagramaId, nodo(id));
      (i < CALENTAMIENTO ? calentamiento : serie).push(envio);
      await esperar(PAUSA_MS);
    }
    await esperarRecepciones(serie, recepciones);

    const rafaga = [];
    for (const id of nodos.slice(0, RAFAGA)) rafaga.push(await enviar(a, diagramaId, { type: 'removeNode', id }));
    await esperarRecepciones(rafaga, recepciones);

    const s = emparejar(serie, recepciones);
    const r = emparejar(rafaga, recepciones);
    // Posición (1 = la primera que cuenta) de cada perdida y cuántas de calentamiento llegaron: distinguen una
    // suscripción que tarda en estar activa (perdidas al principio) de pérdidas sueltas.
    const posicionesPerdidas = s.perdidas.map(id => serie.findIndex(e => e.opId === id) + 1);
    const calentamientoRecibidas = CALENTAMIENTO - emparejar(calentamiento, recepciones).perdidas.length;
    return {
      origen,
      fecha: new Date().toISOString(),
      suscripcion,
      calentamiento: { enviadas: CALENTAMIENTO, recibidas: calentamientoRecibidas },
      serie: { llamada: resumen(percentiles(s.tA)), reparto: resumen(percentiles(s.tB)), perdidas: s.perdidas.length, posicionesPerdidas, repetidas: s.repetidas },
      rafaga: { operaciones: RAFAGA, duracion: redondear(duracionRafaga(rafaga, recepciones)), llamada: resumen(percentiles(r.tA)), perdidas: r.perdidas.length },
      enOrden: emparejar([...serie, ...rafaga], recepciones).enOrden,
    };
  } finally {
    if (diagramaId) await a.rpc('delete_diagram', { p_diagram_id: diagramaId });
    await b.removeAllChannels();
    b.realtime.disconnect();
    a.realtime.disconnect();
  }
}

function informe(m) {
  const fila = (nombre, p) => `  ${nombre.padEnd(22)} p50 ${String(p.p50).padStart(7)} ms   p95 ${String(p.p95).padStart(7)} ms   máx ${String(p.max).padStart(7)} ms   (n=${p.n})`;
  return [
    `Medida de latencia contra ${m.origen} (${m.fecha})`,
    'Operaciones sueltas:',
    fila('llamada (T_a)', m.serie.llamada),
    fila('envío → B (T_b)', m.serie.reparto),
    `  perdidas: ${m.serie.perdidas}${m.serie.perdidas ? ` (posiciones ${m.serie.posicionesPerdidas.join(', ')})` : ''}   repetidas: ${m.serie.repetidas}`,
    `  calentamiento recibido: ${m.calentamiento.recibidas} de ${m.calentamiento.enviadas} (canal unido a los ${m.suscripcion.unido} ms; Postgres Changes listo a los ${m.suscripcion.listo} ms)`,
    `Ráfaga de ${m.rafaga.operaciones} en serie:`,
    `  primer envío → última recepción (T_ráfaga): ${m.rafaga.duracion ?? 'incompleta'} ms`,
    fila('llamada', m.rafaga.llamada),
    `  perdidas: ${m.rafaga.perdidas}`,
    `En orden de secuencia: ${m.enOrden ? 'sí' : 'NO'}`,
    `Umbral (design.md, decisión 6): p95 de T_b ${m.serie.reparto.p95 < 1000 ? '<' : '≥'} 1 s; T_ráfaga ${m.rafaga.duracion != null && m.rafaga.duracion < 1000 ? '<' : '≥'} 1 s`,
  ].join('\n');
}

try {
  const m = await medir();
  console.log(json ? JSON.stringify(m, null, 2) : informe(m));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
