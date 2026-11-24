// ---------- Shared diagrams: session, opening, and the link between the model and the collaboration queue (browser only) ----------
// Only used when the address is a shared diagram (#/d/<id>); without it the app is the single-user app it always was.
// Everything that can be tested without a browser lives elsewhere (ruta.js, avisos.js, transporte-supabase.js, collab.js).
import { parseRuta } from './ruta.js';
import { textoAviso, textoModo, textoErrorApertura } from './avisos.js';
import { createCollab } from './collab.js';
import { crearTransporte } from './transporte-supabase.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import * as model from './model.js';
import { $, update, renderLegend } from './render.js';
import { cancelInteraction } from './input.js';

const { state } = model;
export const ruta = parseRuta(location.hash);

// ---------- Mode: what the user can do and what the toolbar shows ----------
let bloqueoTexto = null;   // why editing is off, as text; null while it is allowed
// input.js asks this before starting a stroke, a drag or the label editor
export const bloqueo = () => bloqueoTexto;

// mode: 'loading' | 'edit' | 'readonly' | 'offline'. The indicator and the toolbar always follow it.
function fijarModo(mode, texto) {
  bloqueoTexto = mode === 'edit' ? null : texto;
  const indicador = $('estado');
  indicador.hidden = false;
  indicador.dataset.modo = mode;
  indicador.textContent = texto;                      // text, never HTML
  model.setReadOnly(mode === 'edit' ? null : mode);
  for (const id of ['undo', 'clear', 'dir']) $(id).disabled = mode !== 'edit';
  $('kind').disabled = true;                          // the type of a shared diagram is fixed when it is created
  $('stage').classList.toggle('bloqueado', mode !== 'edit');
  cancelInteraction();                                // the mode may change in the middle of a gesture
}

// ---------- Repaint: one per frame, however many remote operations arrive ----------
let tipoMostrado = null, programado = false;
function sincronizarControles() {
  $('dir').value = state.dir;
  if (state.kind !== tipoMostrado) { tipoMostrado = state.kind; $('kind').value = state.kind; renderLegend(); }
}
function programarRepintado() {
  if (programado) return;
  programado = true;
  requestAnimationFrame(() => { programado = false; sincronizarControles(); update(); });
}

// ---------- Session ----------
// Resolves when there is a session. With none, the panel stays open until the user signs in (or creates an account).
async function asegurarSesion(client) {
  const { data } = await client.auth.getSession();
  if (data?.session) return;
  const panel = $('login'), msg = $('loginMsg'), botones = [$('loginEntrar'), $('loginCrear')];
  panel.hidden = false;
  $('loginCorreo').focus();
  await new Promise(resolver => {
    async function intentar(crear) {
      msg.textContent = '';
      botones.forEach(b => { b.disabled = true; });
      try {
        const credenciales = { email: $('loginCorreo').value.trim(), password: $('loginClave').value };
        const r = crear ? await client.auth.signUp(credenciales) : await client.auth.signInWithPassword(credenciales);
        if (r.error) { msg.textContent = r.error.message; return; }
        if (!r.data?.session) { msg.textContent = 'Cuenta creada: confirma tu correo y entra'; return; }
        panel.hidden = true;
        resolver();
      } catch {
        msg.textContent = 'No se pudo conectar con el servidor';
      } finally {
        botones.forEach(b => { b.disabled = false; });
      }
    }
    $('loginForm').addEventListener('submit', e => { e.preventDefault(); intentar(false); });
    $('loginCrear').addEventListener('click', () => intentar(true));
  });
}

// ---------- Opening ----------
// Called by main.js when the address is not the single-user one.
export async function iniciar({ toast }) {
  if (ruta.tipo === 'invalida') { fijarModo('offline', 'La dirección del diagrama no es válida'); return; }
  if (!window.supabase) { fijarModo('offline', 'No se pudo cargar la conexión con el servidor'); return; }

  // detectSessionInUrl is off: the address hash is the route, and there is no magic link or OAuth here
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { detectSessionInUrl: false } });
  client.auth.onAuthStateChange((_evento, sesion) => { if (sesion) client.realtime.setAuth(sesion.access_token); });

  fijarModo('loading', 'Entra para abrir el diagrama');
  await asegurarSesion(client);
  $('salir').hidden = false;
  $('salir').addEventListener('click', async () => {
    await client.auth.signOut();
    location.hash = '';                               // a hash change reloads the page, in single-user mode
  });

  fijarModo('loading', textoModo({ mode: 'loading' }));
  const colab = createCollab({
    transport: crearTransporte({ client, diagramId: ruta.id }),
    onVisible: s => { model.replaceState(s); programarRepintado(); },
    onMode: m => fijarModo(m.mode, textoModo(m)),
    onNotice: clave => { if (clave !== 'load') toast(textoAviso(clave)); },   // a failed opening is explained below
  });
  model.onChange(colab.local);
  const r = await colab.open();
  if (!r.ok) {
    const texto = textoErrorApertura(r.error);
    fijarModo('offline', texto);
    toast(texto);
  }
  programarRepintado();
}
