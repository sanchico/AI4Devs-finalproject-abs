// ---------- Rendering: canvas, Mermaid preview, legend, stats (browser only) ----------
import { KINDS, shapeName, mermaidCode } from './kinds/index.js';
import { state, edgeEnds } from './model.js';
import { center } from './geometry.js';

export const $ = id => document.getElementById(id);
export const canvas = $('c'), stage = $('stage');
const ctx = canvas.getContext('2d');

// ---------- Canvas sizing ----------
export function resize(){
  const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0); draw();
}

// ---------- Canvas ----------
let live = null; // stroke in progress
export const setLive = pts => { live = pts; };

export function draw(){
  const {kind, nodes, edges} = state;
  const W = canvas.width/(window.devicePixelRatio||1), H = canvas.height/(window.devicePixelRatio||1);
  ctx.clearRect(0,0,W,H);
  const cs = getComputedStyle(document.documentElement);
  const ink = cs.getPropertyValue('--node-stroke').trim(), fill = cs.getPropertyValue('--node-fill').trim(), acc = cs.getPropertyValue('--stroke-live').trim(), paper = cs.getPropertyValue('--paper').trim(), ink2 = cs.getPropertyValue('--ink-2').trim();
  ctx.lineJoin='round'; ctx.lineCap='round';
  // edges
  for(const e of edges){
    const [a,b]=edgeEnds(e); ctx.strokeStyle=ink; ctx.fillStyle=ink; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    const ang=Math.atan2(b.y-a.y,b.x-a.x), L=10;
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x-L*Math.cos(ang-0.45), b.y-L*Math.sin(ang-0.45)); ctx.lineTo(b.x-L*Math.cos(ang+0.45), b.y-L*Math.sin(ang+0.45)); ctx.closePath(); ctx.fill();
    if(e.label){ const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2}; ctx.font='12px '+cs.getPropertyValue('--font'); const tw=ctx.measureText(e.label).width; ctx.fillStyle=paper; ctx.fillRect(m.x-tw/2-4,m.y-9,tw+8,18); ctx.fillStyle=ink2; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(e.label,m.x,m.y); }
  }
  // nodes
  for(const n of nodes){
    ctx.strokeStyle=ink; ctx.fillStyle=fill; ctx.lineWidth=1.8; ctx.beginPath();
    const c=center(n);
    if(n.shape==='rect'){ const r=KINDS[kind].radius; ctx.roundRect(n.x,n.y,n.w,n.h,r); }
    else if(n.shape==='diamond'){ ctx.moveTo(c.x,n.y); ctx.lineTo(n.x+n.w,c.y); ctx.lineTo(c.x,n.y+n.h); ctx.lineTo(n.x,c.y); ctx.closePath(); }
    else { ctx.ellipse(c.x,c.y,n.w/2,n.h/2,0,0,Math.PI*2); }
    ctx.fill(); ctx.stroke();
    if(kind==='state' && n.shape==='ellipse'){ ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(c.x,c.y,Math.min(n.w,n.h)/4,0,Math.PI*2); ctx.fill(); }
    if(n.label){ ctx.fillStyle=ink; ctx.font='500 13px '+cs.getPropertyValue('--font'); ctx.textAlign='center'; ctx.textBaseline='middle'; wrapText(n.label,c.x,c.y,n.w-14); }
  }
  if(live && live.length>1){ ctx.strokeStyle=acc; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(live[0].x,live[0].y); for(const p of live) ctx.lineTo(p.x,p.y); ctx.stroke(); }
}
function wrapText(t,x,y,maxW){
  const words=t.split(' '), lines=[]; let cur='';
  for(const w of words){ const test=cur?cur+' '+w:w; if(ctx.measureText(test).width>maxW && cur){lines.push(cur);cur=w;} else cur=test; }
  lines.push(cur); const lh=16; let yy=y-(lines.length-1)*lh/2; for(const l of lines){ ctx.fillText(l,x,yy); yy+=lh; }
}

// ---------- Mermaid preview ----------
let renderT, renderN=0;
export function renderMermaid(){
  const {nodes, edges, kind, dir} = state;
  const code = mermaidCode(state, kind, dir); $('code').textContent = code;
  $('stats').textContent = `${nodes.length} nodos · ${edges.length} conexiones`;
  clearTimeout(renderT);
  renderT = setTimeout(async () => {
    const box=$('preview');
    if(!window.mermaid){ box.innerHTML='<div class="err">No se pudo cargar mermaid.js; el código sigue disponible en la pestaña Código.</div>'; return; }
    if(!nodes.length){ box.innerHTML='<div style="color:var(--ink-2)">Dibuja una forma con el lápiz y aparecerá aquí.</div>'; return; }
    try{
      const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme!=='light' || document.documentElement.dataset.theme==='dark';
      mermaid.initialize({startOnLoad:false, theme: dark?'dark':'neutral', securityLevel:'strict'});
      const {svg} = await mermaid.render('mmd'+(++renderN), code);
      box.innerHTML = svg;
    }catch(err){
      // The message can contain a label's text: show it as text, never as HTML
      const div = document.createElement('div'); div.className = 'err';
      div.textContent = 'Mermaid no puede renderizar aún:\n'+(err.message||err);
      box.replaceChildren(div);
    }
  }, 250);
}
export function update(){ draw(); renderMermaid(); }

// ---------- Legend ----------
export function renderLegend(){
  const K=KINDS[state.kind];
  $('legend').innerHTML = Object.entries(K.shapes).map(([s,d])=>`<span><b>${shapeName(s)}</b> → ${d.label}</span>`).join('') + '<span><b>Línea</b> de una forma a otra → conexión</span><span><b>Toque</b> → editar texto</span>';
}
