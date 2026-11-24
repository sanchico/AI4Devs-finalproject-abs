// Prepara un diagrama compartido para probar la app en dos navegadores, sin botón de "Nuevo" ni invitaciones en la interfaz
// (son del resto de F5): A (el dueño) crea el diagrama, lo comparte con B y se escribe el enlace #/d/<id>.
//
//   node --env-file=supabase/.env.remoto supabase/scripts/preparar-diagrama.js [--tipo flow|state] [--rol editor|viewer] [--url http://localhost:8000]
//   node --env-file=supabase/.env.remoto supabase/scripts/preparar-diagrama.js --borrar <id>     (lo borra: borrado lógico, como en la app)
//   npm run preparar:diagrama -- --rol viewer
//
// Escribe en el proyecto del archivo de entorno: crea un diagrama (o lo borra) con los usuarios A y B de la medida.
// Usa la clave pública y la sesión de cada usuario; nunca la clave de servicio. No imprime claves ni contraseñas.
import { createClient } from '@supabase/supabase-js';

const NOMBRES = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'MEDIR_A_CORREO', 'MEDIR_A_PASSWORD', 'MEDIR_B_CORREO', 'MEDIR_B_PASSWORD'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lee `--opcion valor`; devuelve el valor, `undefined` si no está o lanza si falta el valor. */
function opcion(args, nombre) {
  const i = args.indexOf(nombre);
  if (i < 0) return undefined;
  const valor = args[i + 1];
  if (!valor || valor.startsWith('--')) throw new Error(`Falta el valor de ${nombre}`);
  return valor;
}

function entorno() {
  const faltan = NOMBRES.filter(n => !process.env[n]);
  if (faltan.length) throw new Error(`Faltan variables: ${faltan.join(', ')}. Lanza el script con node --env-file=supabase/.env.remoto (plantilla: supabase/.env.ejemplo).`);
  return Object.fromEntries(NOMBRES.map(n => [n, process.env[n]]));
}

async function sesion(env, correo, password, quien) {
  const cliente = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password });
  if (error) throw new Error(`No se pudo iniciar sesión con el usuario ${quien}: ${error.message}`);
  return cliente;
}

async function rpc(cliente, funcion, args) {
  const { data, error } = await cliente.rpc(funcion, args);
  if (error) throw new Error(`${funcion} rechazada: ${error.code} ${error.message} ${error.details ?? ''}`.trim());
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const borrar = opcion(args, '--borrar');
  const tipo = opcion(args, '--tipo') ?? 'flow';
  const rol = opcion(args, '--rol') ?? 'editor';
  const url = (opcion(args, '--url') ?? 'http://localhost:8000').replace(/\/+$/, '');
  if (!['flow', 'state'].includes(tipo)) throw new Error('--tipo debe ser flow o state');
  if (!['editor', 'viewer'].includes(rol)) throw new Error('--rol debe ser editor o viewer');
  if (borrar !== undefined && !UUID.test(borrar)) throw new Error('--borrar necesita el id (UUID) del diagrama');

  const env = entorno();
  const a = await sesion(env, env.MEDIR_A_CORREO, env.MEDIR_A_PASSWORD, 'A');

  if (borrar !== undefined) {
    await rpc(a, 'delete_diagram', { p_diagram_id: borrar });
    console.log(`borrado: ${borrar}`);
    return;
  }

  const id = await rpc(a, 'create_diagram', { p_kind: tipo });
  const token = await rpc(a, 'create_invite', { p_diagram_id: id, p_role: rol });
  const b = await sesion(env, env.MEDIR_B_CORREO, env.MEDIR_B_PASSWORD, 'B');
  await rpc(b, 'accept_invite', { p_token: token });
  console.log(`diagrama: ${id}`);
  console.log(`tipo: ${tipo} · A es el dueño y B entra como ${rol}`);
  console.log(`enlace: ${url}/#/d/${id}`);
  console.log(`para borrarlo: npm run preparar:diagrama -- --borrar ${id}`);
}

main().catch(e => { console.error(`ERROR: ${e.message}`); process.exit(1); });
