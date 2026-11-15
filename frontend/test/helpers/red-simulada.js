// Red simulada para probar la convergencia sin red ni navegador (código de test, no de la aplicación).
// El Servidor numera las operaciones en un registro y no interpreta el grafo (como apply_op en Supabase).
// Cada Cliente guarda `confirmado` (el registro aplicado en orden) y `pendientes` (lo propio sin confirmar);
// `visible` se recalcula siempre aplicando las pendientes sobre una copia de `confirmado`.
import { apply } from '../../ops.js';

export const vacio = () => ({ kind: 'flow', dir: 'TD', title: 'Diagrama sin título', nodes: [], edges: [] });

// Generador pseudoaleatorio con semilla (mulberry32): devuelve números en [0, 1)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0)) / 4294967296;
  };
}

// El diagrama que resulta de aplicar el registro entero sobre `inicial`; `alRechazar(entrada, motivo)` es opcional
export function reproducir(registro, inicial = vacio(), alRechazar) {
  const s = structuredClone(inicial);
  for (const e of registro) { const r = apply(s, e.op); if (!r.ok) alRechazar?.(e, r.reason); }
  return s;
}

export class Servidor {
  registro = [];
  clientes = [];
  // Numera la operación, la guarda y la deja en la bandeja de todos los clientes (también la del autor)
  recibir(autor, opId, op) {
    const entrada = { seq: this.registro.length + 1, autor, opId, op };
    this.registro.push(entrada);
    for (const c of this.clientes) c.bandeja.push(entrada);
  }
}

export class Cliente {
  pendientes = [];   // [{opId, op}] en el orden de creación; la primera es la que va en vuelo
  bandeja = [];      // entradas del registro aún sin entregar, siempre en orden
  enVuelo = null;
  ultimaSeq = 0;
  contador = 0;
  constructor(nombre, servidor, inicial = vacio()) {
    this.nombre = nombre; this.servidor = servidor;
    this.confirmado = structuredClone(inicial);
    servidor.clientes.push(this);
  }
  get visible() {
    const s = structuredClone(this.confirmado);
    for (const p of this.pendientes) apply(s, p.op);
    return s;
  }
  editar(op) { this.pendientes.push({ opId: `${this.nombre}-${++this.contador}`, op }); }
  // Envía la primera pendiente si no hay otra en vuelo (de una en una); false si no había nada que enviar
  enviar() {
    if (this.enVuelo || !this.pendientes.length) return false;
    this.enVuelo = this.pendientes[0];
    this.servidor.recibir(this.nombre, this.enVuelo.opId, this.enVuelo.op);
    return true;
  }
  // Entrega la siguiente entrada de la bandeja; un hueco en la secuencia es un error, no se arregla aquí
  entregar() {
    const e = this.bandeja.shift();
    if (!e) return false;
    if (e.seq !== this.ultimaSeq + 1) throw new Error(`${this.nombre}: hueco, esperaba ${this.ultimaSeq + 1} y llegó ${e.seq}`);
    this.ultimaSeq = e.seq;
    apply(this.confirmado, e.op);
    if (e.opId === this.enVuelo?.opId) { this.pendientes.shift(); this.enVuelo = null; }
    return true;
  }
}

// Envía y entrega hasta que no queda nada pendiente en ningún cliente
export function asentar(servidor) {
  let avanza = true;
  while (avanza) {
    avanza = false;
    for (const c of servidor.clientes) avanza = c.enviar() || avanza;
    for (const c of servidor.clientes) while (c.entregar()) avanza = true;
  }
}
