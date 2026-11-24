// Cliente falso de supabase-js para probar transporte-supabase.js sin red (código de test, no de la aplicación).
// Imita lo que el adaptador usa: from().select().eq().order().range().maybeSingle(), rpc, channel().on().subscribe(),
// auth.getSession y realtime.setAuth. Reproduce el tope de 1 000 filas por respuesta de la API (`max_rows`), que es lo
// que obliga al adaptador a paginar. El test controla los estados y los mensajes de los canales.

const MAX_FILAS = 1000;

class CanalFalso {
  constructor(nombre) { this.nombre = nombre; this.manejadores = { postgres_changes: [], system: [] }; this.filtroPostgres = null; this.alEstado = null; }
  on(tipo, filtro, cb) {
    (this.manejadores[tipo] ??= []).push(cb);
    if (tipo === 'postgres_changes') this.filtroPostgres = filtro;
    return this;
  }
  subscribe(cb) { this.alEstado = cb; return this; }
  // Controles del test
  emitirEstado(estado, err) { this.alEstado?.(estado, err); }
  emitirSistema(mensaje) { for (const cb of this.manejadores.system) cb(mensaje); }
  emitirInsert(nuevo) { for (const cb of this.manejadores.postgres_changes) cb({ eventType: 'INSERT', new: nuevo }); }
}

// Una consulta se resuelve al hacerle await (es "thenable"), como la de postgrest-js
class ConsultaFalsa {
  constructor(cliente, tabla) { this.cliente = cliente; this.tabla = tabla; this.filtros = {}; this.nulos = {}; this.columnas = null; this.orden = null; this.rango = null; this.una = false; }
  select(columnas) { this.columnas = columnas ?? null; return this; }
  is(columna, valor) { this.nulos[columna] = valor; return this; }
  eq(columna, valor) { this.filtros[columna] = valor; return this; }
  order(columna, opciones = {}) { this.orden = { columna, ascendente: opciones.ascending !== false }; return this; }
  range(desde, hasta) { this.rango = [desde, hasta]; return this; }
  maybeSingle() { this.una = true; return this; }
  then(resolver, rechazar) { return Promise.resolve(this.ejecutar()).then(resolver, rechazar); }
  ejecutar() {
    this.cliente.consultas.push({ tabla: this.tabla, columnas: this.columnas, filtros: { ...this.filtros }, nulos: { ...this.nulos }, orden: this.orden, rango: this.rango });
    const error = this.cliente.errores[this.tabla];
    if (error) return { data: null, error: { message: error.message }, status: error.status };
    let filas = (this.cliente.tablas[this.tabla] ?? []).filter(f => Object.entries(this.filtros).every(([c, v]) => f[c] === v)
      && Object.entries(this.nulos).every(([c, v]) => (f[c] ?? null) === v));
    if (this.orden) {
      const { columna, ascendente } = this.orden;
      filas = [...filas].sort((a, b) => (a[columna] < b[columna] ? -1 : a[columna] > b[columna] ? 1 : 0) * (ascendente ? 1 : -1));
    }
    if (this.una) return { data: filas[0] ?? null, error: null, status: 200 };
    const [desde, hasta] = this.rango ?? [0, MAX_FILAS - 1];
    return { data: filas.slice(desde, Math.min(hasta + 1, desde + MAX_FILAS)), error: null, status: 200 };
  }
}

export class SupabaseFalso {
  tablas; errores = {}; consultas = []; canales = []; canalesQuitados = []; llamadasRpc = []; rpcRespuestas = []; tokensRealtime = [];
  constructor({ tablas = {}, userId = 'u1', token = 'jwt-1', sesion = true } = {}) {
    this.tablas = tablas;
    this.auth = { getSession: async () => ({ data: { session: sesion ? { access_token: token, user: { id: userId } } : null }, error: null }) };
    this.realtime = { setAuth: async t => { this.tokensRealtime.push(t); } };
  }
  from(tabla) { return new ConsultaFalsa(this, tabla); }
  rpc(nombre, args) {
    this.llamadasRpc.push({ nombre, args });
    return Promise.resolve(this.rpcRespuestas.shift() ?? { data: null, error: null, status: 200 });
  }
  channel(nombre) { const c = new CanalFalso(nombre); this.canales.push(c); return c; }
  removeChannel(canal) { this.canalesQuitados.push(canal); return Promise.resolve('ok'); }
  get ultimoCanal() { return this.canales.at(-1); }
}
