// ---------- Entry point: startup, toolbar, toast, theme ----------
import { KINDS, mermaidCode } from './kinds/index.js';
import * as model from './model.js';
import { $, canvas, resize, update, renderLegend } from './render.js';
import { initInput, toggleMouseDraws, setRecorder } from './input.js';
import * as grab from './grabacion.js';

const { state } = model;

// ---------- Toast ----------
const toastEl = $('toast'); let toastT;
const toast = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>toastEl.classList.remove('show'), 1800); };

initInput({toast});

// ---------- Toolbar ----------
$('kind').addEventListener('change', e => { model.setKind(e.target.value); renderLegend(); update(); toast('Ahora solo se reconocen las formas de: '+KINDS[state.kind].name); });
$('dir').addEventListener('change', e => { model.setDir(e.target.value); update(); });
$('mode').addEventListener('click', e => { const draws=toggleMouseDraws(); e.target.textContent = draws?'Ratón: dibuja':'Ratón: mueve'; canvas.style.cursor = draws?'crosshair':'grab'; });
$('undo').addEventListener('click', () => { if(!model.undo().ok){ toast('Nada que deshacer'); return; } update(); });
$('clear').addEventListener('click', () => { if(model.clear().ok) update(); });
$('tabPrev').addEventListener('click', ()=>setTab(true)); $('tabCode').addEventListener('click', ()=>setTab(false));
function setTab(prev){ $('preview').hidden=!prev; $('codePane').hidden=prev; $('tabPrev').classList.toggle('on',prev); $('tabCode').classList.toggle('on',!prev); }
$('copy').addEventListener('click', async () => {
  const code=mermaidCode(state, state.kind, state.dir);
  try{ await navigator.clipboard.writeText(code); toast('Código copiado'); }
  catch{ setTab(false); const rg=document.createRange(); rg.selectNodeContents($('code')); const s=getSelection(); s.removeAllRanges(); s.addRange(rg); toast('Selecciona y copia el código'); }
});
window.addEventListener('resize', resize);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);

// ---------- Recording mode (?grabar): strokes are saved as samples instead of recognized ----------
if(new URLSearchParams(location.search).has('grabar')){
  const g = grab.crear(), NOMBRES = {rect:'Rectángulo', diamond:'Rombo', ellipse:'Elipse'};
  let forma = 'rect';
  const panel = $('grabPanel'), cont = $('grabFormas'), txt = $('grabText');
  const botones = grab.FORMAS.map(f => { const b=document.createElement('button'); b.className='btn'; b.addEventListener('click', ()=>{ forma=f; pintar(); }); cont.append(b); return [f,b]; });
  const pintar = () => { const n=grab.contar(g); for(const [f,b] of botones){ b.textContent = NOMBRES[f]+' ('+n[f]+')'; b.classList.toggle('on', f===forma); } };
  setRecorder((pts, tipo) => { if(grab.añadir(g, forma, tipo, pts)){ pintar(); toast(NOMBRES[forma]+' grabado ('+grab.contar(g)[forma]+')'); } });
  $('grabUndo').addEventListener('click', () => { grab.descartarUltimo(g); pintar(); });
  $('grabDown').addEventListener('click', () => {
    if(!grab.total(g)){ toast('No hay trazos grabados'); return; }
    const json = JSON.stringify(grab.aJSON(g, navigator.userAgent));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], {type:'application/json'})); a.download = 'trazos.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    txt.value = json; txt.hidden = false;   // alternative if the browser does not download
  });
  panel.hidden = false; pintar(); resize();
}

// ---------- Start with the example so the page opens working ----------
model.loadExample(); renderLegend(); resize(); update();
toast('Ejemplo cargado: dibuja encima con el lápiz o pulsa Limpiar');
