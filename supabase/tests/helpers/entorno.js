// Entorno de los tests del backend: lee la URL y las claves del Supabase local (npx supabase status)
// y ofrece clientes ya configurados. No guarda ni escribe ningún secreto.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const AVISO = 'Arranca Supabase local: npx supabase start (con Docker en marcha)';
const CLI = fileURLToPath(new URL('../../../node_modules/supabase/dist/supabase.js', import.meta.url));

function leerEstado() {
  let salida;
  try {
    salida = execFileSync(process.execPath, [CLI, 'status', '-o', 'env'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(AVISO);
  }
  const env = {};
  for (const linea of salida.split(/\r?\n/)) {
    const m = linea.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = leerEstado();
// Admite los nombres nuevos de las claves y los antiguos.
const url = env.API_URL;
const clavePublica = env.PUBLISHABLE_KEY ?? env.ANON_KEY;
const claveServicio = env.SECRET_KEY ?? env.SERVICE_ROLE_KEY;
if (!url || !clavePublica || !claveServicio || !env.DB_URL) throw new Error(AVISO);

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente con la clave de servicio: se salta la RLS. Solo para preparar datos y comprobar. */
export const admin = () => createClient(url, claveServicio, opciones);

/** Cliente con la clave pública y sin sesión. */
export const anonimo = () => createClient(url, clavePublica, opciones);

/** Crea un usuario con correo único y devuelve su id, su correo y un cliente con sesión iniciada. */
export async function usuario() {
  const correo = `test-${randomUUID()}@pen2mermaid.test`;
  const password = randomUUID();
  const { data, error } = await admin().auth.admin.createUser({ email: correo, password, email_confirm: true });
  if (error) throw error;
  const cliente = createClient(url, clavePublica, opciones);
  const { error: errorSesion } = await cliente.auth.signInWithPassword({ email: correo, password });
  if (errorSesion) throw errorSesion;
  return { id: data.user.id, correo, cliente };
}

/** Conexión directa a PostgreSQL, para el catálogo (privilegios, publicación). Cerrar con sql.end(). */
export const sql = postgres(env.DB_URL, { max: 2, onnotice: () => {} });
