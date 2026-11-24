// Transporte simulado para probar collab.js sin red ni navegador (código de test, no de la aplicación).
// ServidorSimulado hace lo que apply_ops: guarda un grupo entero o nada, devuelve la secuencia ya guardada de
// un op_id repetido, numera de forma contigua, rechaza más de 500 operaciones y cuenta el tope sobre las nuevas.
// No interpreta el grafo. TransporteSimulado es lo que ve un cliente (subscribe, load, send) y deja al test
// el control de cuándo llegan las entradas del canal y cuándo se responden las llamadas.

const TIPOS = ['addNode', 'updateNode', 'removeNode', 'addEdge', 'updateEdge', 'removeEdge', 'setMeta'];
const esObjeto = v => typeof v === 'object' && v !== null && !Array.isArray(v);
const rechazo = (status, key) => ({ ok: false, status, key });

export class ServidorSimulado {
  registro = [];       // [{seq, op_id, op}]
  transportes = [];    // los clientes; solo los suscritos reciben las filas nuevas
  maximo = 5000;
  constructor({ kind = 'flow' } = {}) { this.kind = kind; }

  // Como apply_ops: devuelve {ok: true, seqs} (una secuencia por elemento, en orden) o {ok: false, status, key}
  guardar(grupo) {
    if (!Array.isArray(grupo) || grupo.length < 1 || grupo.length > 500) return rechazo(422, 'invalid_op');
    const vistos = new Set();
    for (const it of grupo) {
      if (!esObjeto(it) || typeof it.op_id !== 'string' || vistos.has(it.op_id) || !esObjeto(it.op) || !TIPOS.includes(it.op.type)) {
        return rechazo(422, 'invalid_op');
      }
      vistos.add(it.op_id);
    }
    const nuevas = grupo.filter(it => !this.registro.some(e => e.op_id === it.op_id));
    if (nuevas.length && this.registro.length + nuevas.length > this.maximo) return rechazo(409, 'op_limit');
    for (const it of nuevas) {
      const fila = { seq: this.registro.length + 1, op_id: it.op_id, op: structuredClone(it.op) };
      this.registro.push(fila);
      for (const t of this.transportes) if (t.suscrito) t.bandeja.push(structuredClone(fila));
    }
    return { ok: true, seqs: grupo.map(it => this.registro.find(e => e.op_id === it.op_id).seq) };
  }
}

export class TransporteSimulado {
  bandeja = [];      // entradas del canal aún sin entregar, en orden
  enVuelo = [];      // respuestas retenidas, a la espera de responder()
  envios = [];       // todos los grupos enviados, reintentos incluidos
  fallos = [];       // respuestas programadas para las siguientes llamadas a send: {status, key} o {status: null, guardado?}
  retener = false;   // true: send no responde hasta que el test llama a responder()
  suscrito = false;
  fallaSuscripcion = false;
  fallaCarga = false;
  antesDeCargar = null;   // función async que se ejecuta dentro de load, antes de leer el registro
  despuesDeCargar = null; // ídem, justo después de leerlo y antes de devolverlo
  onEntry = null;
  onClose = null;

  constructor(servidor, { rol = 'editor' } = {}) {
    this.servidor = servidor;
    this.rol = rol;
    servidor.transportes.push(this);
  }

  async subscribe(onEntry, onClose) {
    if (this.fallaSuscripcion) throw new Error('suscripción fallida');
    this.onEntry = onEntry;
    this.onClose = onClose;
    this.suscrito = true;
  }

  async load() {
    if (this.fallaCarga) throw new Error('carga fallida');
    await this.antesDeCargar?.();
    const leido = { kind: this.servidor.kind, role: this.rol, log: structuredClone(this.servidor.registro) };
    await this.despuesDeCargar?.();   // lo que se guarda aquí no está en lo leído: solo llega por el canal
    return leido;
  }

  send(grupo) {
    this.envios.push(structuredClone(grupo));
    const programado = this.fallos.shift();
    let respuesta;
    if (programado && programado.status === null) {
      if (programado.guardado) this.servidor.guardar(grupo);   // el servidor lo guardó pero la respuesta se perdió
      respuesta = { ok: false, status: null };
    } else if (programado) {
      respuesta = { ok: false, status: programado.status, key: programado.key };
    } else {
      const r = this.servidor.guardar(grupo);
      respuesta = r.ok ? { ok: true } : { ok: false, status: r.status, key: r.key };
    }
    if (!this.retener) return Promise.resolve(respuesta);
    return new Promise(resolver => this.enVuelo.push(() => resolver(respuesta)));
  }

  responder() { const r = this.enVuelo.shift(); if (r) r(); return Boolean(r); }
  entregar() { const e = this.bandeja.shift(); if (!e) return false; this.onEntry(e); return true; }
  entregarTodo() { let n = 0; while (this.entregar()) n++; return n; }
  cerrarCanal() { this.onClose?.(); }
}

// Deja que se vacíen las promesas pendientes (un turno del bucle de eventos)
export const turno = () => new Promise(resolver => setImmediate(resolver));

// Responde y entrega hasta que ningún cliente tiene nada en vuelo ni en la bandeja
export async function asentar(transportes) {
  for (let vueltas = 0; vueltas < 1000; vueltas++) {
    await turno();
    let avanza = false;
    for (const t of transportes) {
      if (t.responder()) avanza = true;
      if (t.entregarTodo()) avanza = true;
    }
    if (!avanza) { await turno(); if (!transportes.some(t => t.enVuelo.length || t.bandeja.length)) return; }
  }
  throw new Error('asentar: no termina');
}
