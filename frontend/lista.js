// ---------- «Mis diagramas»: the list of the user's diagrams and the «Nuevo» button (browser only) ----------
// Calls to Supabase live in gestion-supabase.js; the texts in avisos.js. Everything that comes from the server is written
// with textContent, never as HTML: a title can be any text. Opening a diagram is changing the address, which reloads the app.
import { listarDiagramas, crearDiagrama, renombrarDiagrama, borrarDiagrama } from './gestion-supabase.js';
import { textoGestion } from './avisos.js';
import { KINDS } from './kinds/index.js';
import { $ } from './render.js';

const VACIA = 'Aún no tienes diagramas: crea el primero con «Nuevo»';
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

  // A row: open it, rename it, delete it. The server decides who can (an editor renames, only the owner deletes) and the
  // refusal is explained in the message line; the title is always written as text.
  const boton = (texto, clase = 'btn') => { const b = document.createElement('button'); b.type = 'button'; b.className = clase; b.textContent = texto; return b; };
  function fila(d) {
    const li = document.createElement('li'), abrir = boton('', 'btn lista-abrir'), titulo = document.createElement('span'), detalle = document.createElement('small');
    const renombrar = boton('Renombrar'), borrar = boton('Borrar');
    li.dataset.id = d.id;                                        // lets the browser test find a row by diagram
    titulo.textContent = d.title;
    detalle.textContent = [KINDS[d.kind]?.name ?? d.kind, fecha(d.updated_at)].filter(Boolean).join(' · ');
    abrir.append(titulo, detalle);
    abrir.addEventListener('click', () => { location.hash = '#/d/' + d.id; });

    renombrar.addEventListener('click', async () => {
      const nuevo = prompt('Título del diagrama', d.title);
      if (nuevo === null) return;                                // cancelled: nothing changes
      msg.textContent = ''; renombrar.disabled = true;
      try { await renombrarDiagrama(client, d.id, nuevo); d.title = nuevo; titulo.textContent = nuevo; }
      catch (e) { msg.textContent = textoGestion('renombrar', e); }
      finally { renombrar.disabled = false; }
    });
    borrar.addEventListener('click', async () => {
      if (!confirm('¿Borrar «' + d.title + '»? Dejará de aparecer en tu lista.')) return;
      msg.textContent = ''; borrar.disabled = true;
      try { await borrarDiagrama(client, d.id); li.remove(); if (!items.children.length) msg.textContent = VACIA; }
      catch (e) { msg.textContent = textoGestion('borrar', e); borrar.disabled = false; }
    });
    li.append(abrir, renombrar, borrar);
    return li;
  }

  msg.textContent = lista.length ? '' : VACIA;
  for (const d of lista) items.append(fila(d));
}
