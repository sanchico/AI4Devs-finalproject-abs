// ---------- «Mis diagramas»: the list of the user's diagrams and the «Nuevo» button (browser only) ----------
// Calls to Supabase live in gestion-supabase.js; the texts in avisos.js. Everything that comes from the server is written
// with textContent, never as HTML: a title can be any text. Opening a diagram is changing the address, which reloads the app.
import { listarDiagramas, crearDiagrama } from './gestion-supabase.js';
import { textoGestion } from './avisos.js';
import { KINDS } from './kinds/index.js';
import { $ } from './render.js';

const fecha = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es'); };

export async function mostrarLista(client) {
  const msg = $('listaMsg'), items = $('listaItems'), nuevo = $('listaNuevo');
  $('lista').hidden = false;

  nuevo.addEventListener('click', async () => {
    if (nuevo.disabled) return;                                  // a double press must not create two diagrams
    nuevo.disabled = true;
    msg.textContent = '';
    try {
      const id = await crearDiagrama(client, $('listaTipo').value);
      location.hash = '#/d/' + id;                               // reloads the app on the new diagram; the button stays off meanwhile
    } catch (e) {
      msg.textContent = textoGestion('crear', e);
      nuevo.disabled = false;
    }
  });

  msg.textContent = 'Cargando…';
  let lista;
  try { lista = await listarDiagramas(client); }
  catch (e) { msg.textContent = textoGestion('lista', e); return; }

  msg.textContent = lista.length ? '' : 'Aún no tienes diagramas: crea el primero con «Nuevo»';
  for (const d of lista) {
    const li = document.createElement('li'), boton = document.createElement('button'), titulo = document.createElement('span'), detalle = document.createElement('small');
    boton.type = 'button'; boton.className = 'btn';
    titulo.textContent = d.title;
    detalle.textContent = [KINDS[d.kind]?.name ?? d.kind, fecha(d.updated_at)].filter(Boolean).join(' · ');
    boton.append(titulo, detalle);
    boton.addEventListener('click', () => { location.hash = '#/d/' + d.id; });
    li.append(boton);
    items.append(li);
  }
}
