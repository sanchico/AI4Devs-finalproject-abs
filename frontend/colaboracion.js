// ---------- Shared diagrams: session, opening, and the link between the model and the collaboration queue (browser only) ----------
// Only used when the address is a shared diagram (#/d/<id>); without it the app is the single-user app it always was.
// Everything that can be tested without a browser lives elsewhere (ruta.js, avisos.js, transporte-supabase.js, collab.js).
import { parseRuta, urlDeVuelta } from './ruta.js';
import { textoAviso, textoModo, textoErrorApertura, textoGestion, AVISO_ENLACE_COPIADO, AVISO_ENLACE_MANUAL } from './avisos.js';
import { createCollab } from './collab.js';
import { crearTransporte } from './transporte-supabase.js';
import { crearInvitacion, aceptarInvitacion } from './gestion-supabase.js';
import { mostrarLista } from './lista.js';
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
        const r = crear
          ? await client.auth.signUp({ ...credenciales, options: { emailRedirectTo: urlDeVuelta(location) } })
          : await client.auth.signInWithPassword(credenciales);
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

// ---------- Client and session, shared by the three addresses that need one ----------
// detectSessionInUrl is off: the address hash is the route, and there is no magic link or OAuth here
function crearCliente() {
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { detectSessionInUrl: false } });
  client.auth.onAuthStateChange((_evento, sesion) => { if (sesion) client.realtime.setAuth(sesion.access_token); });
  return client;
}

async function entrar(client) {
  await asegurarSesion(client);
  $('salir').hidden = false;
  $('salir').addEventListener('click', async () => {
    await client.auth.signOut();
    location.hash = '';                               // a hash change reloads the page, in single-user mode
  });
}

// ---------- Sharing: an invitation as editor, as a link ----------
function mostrarEnlace(enlace) {
  const texto = $('enlaceTexto');
  $('enlace').hidden = false;
  texto.value = enlace;                               // the browser would not let us copy it: the user does it by hand
  texto.focus(); texto.select();
}

function activarCompartir(client, toast) {
  $('enlaceCerrar').addEventListener('click', () => { $('enlace').hidden = true; });
  $('compartir').hidden = false;
  $('compartir').addEventListener('click', async () => {
    const boton = $('compartir');
    boton.disabled = true;
    try {
      const token = await crearInvitacion(client, ruta.id);
      const enlace = location.origin + location.pathname + '#/i/' + token;
      try { await navigator.clipboard.writeText(enlace); toast(AVISO_ENLACE_COPIADO); }
      catch { mostrarEnlace(enlace); toast(AVISO_ENLACE_MANUAL); }   // no clipboard on http://<ip>, for one
    } catch (e) {
      toast(textoGestion('compartir', e));
    } finally {
      boton.disabled = false;
    }
  });
}

// ---------- Opening ----------
// Called by main.js when the address is not the single-user one.
export async function iniciar({ toast }) {
  if (ruta.tipo === 'invalida') { fijarModo('offline', 'La dirección del diagrama no es válida'); return; }
  if (!window.supabase) { fijarModo('offline', 'No se pudo cargar la conexión con el servidor'); return; }

  const client = crearCliente();
  if (ruta.tipo === 'lista') return abrirLista(client);
  if (ruta.tipo === 'invitacion') return aceptar(client, toast);
  return abrirDiagrama(client, toast);
}

async function abrirLista(client) {
  fijarModo('loading', 'Entra para ver tus diagramas');
  await entrar(client);
  fijarModo('loading', 'Mis diagramas');
  await mostrarLista(client);
}

// An invitation link: sign in (or create the account) with the token still in the address, accept it and open the diagram.
// `replace`, not `assign`: "Back" must not bring the link up again.
async function aceptar(client, toast) {
  fijarModo('loading', 'Entra para aceptar la invitación');
  await entrar(client);
  fijarModo('loading', 'Aceptando la invitación…');
  try {
    location.replace('#/d/' + await aceptarInvitacion(client, ruta.token));
  } catch (e) {
    const texto = textoGestion('aceptar', e);
    fijarModo('offline', texto);
    toast(texto);
  }
}

async function abrirDiagrama(client, toast) {
  fijarModo('loading', 'Entra para abrir el diagrama');
  await entrar(client);
  activarCompartir(client, toast);

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
