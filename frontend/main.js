// ---------- Entry point: startup, toolbar, toast, theme ----------
import { KINDS, mermaidCode } from './kinds/index.js';
import * as model from './model.js';
import { $, canvas, resize, update, renderLegend } from './render.js';
import { initInput, toggleMouseDraws } from './input.js';

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

// ---------- Start with the example so the page opens working ----------
model.loadExample(); renderLegend(); resize(); update();
toast('Ejemplo cargado: dibuja encima con el lápiz o pulsa Limpiar');
