(() => {
// ---------- Diagram definitions: which shapes exist and what they mean ----------
const KINDS = {
  flow: {
    name: 'Flujo',
    shapes: {
      rect:    { label: 'Proceso',    mm: (id,t)=>`${id}["${t}"]` },
      diamond: { label: 'Decisión',   mm: (id,t)=>`${id}{"${t}"}` },
      ellipse: { label: 'Inicio/Fin', mm: (id,t)=>`${id}(["${t}"])` },
    },
    header: dir => `flowchart ${dir}`,
    edge: (a,b,t) => t ? `${a} -->|${t}| ${b}` : `${a} --> ${b}`,
    radius: 4,
  },
  state: {
    name: 'Estados',
    shapes: {
      rect:    { label: 'Estado',            mm: (id,t)=>`state "${t}" as ${id}` },
      diamond: { label: 'Elección (choice)', mm: (id,t)=>`state ${id} <<choice>>` },
      ellipse: { label: 'Inicio / Fin [*]',  mm: null },  // rendered as [*]
    },
    header: dir => `stateDiagram-v2\n  direction ${dir}`,
    edge: (a,b,t) => t ? `${a} --> ${b} : ${t}` : `${a} --> ${b}`,
    radius: 12,
  },
};

// ---------- State ----------
let kind = 'flow', dir = 'TD', mouseDraws = true;
let nodes = [], edges = [], seq = 1;
let history = [];
const $ = id => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d'), stage = $('stage');
const toastEl = $('toast'); let toastT;
const toast = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>toastEl.classList.remove('show'), 1800); };
const snapshot = () => { history.push(JSON.stringify({nodes,edges,seq})); if (history.length > 60) history.shift(); };

// ---------- Canvas sizing ----------
function resize(){
  const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0); draw();
}
window.addEventListener('resize', resize);

// ---------- Geometry helpers ----------
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
function bbox(pts){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of pts){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);} return {x:x0,y:y0,w:x1-x0,h:y1-y0}; }
function polyArea(pts){ let a=0; for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length]; a+=p.x*q.y-q.x*p.y;} return Math.abs(a)/2; }
function pathLen(pts){ let l=0; for(let i=1;i<pts.length;i++) l+=dist(pts[i-1],pts[i]); return l; }
function minDistTo(pts,c){ let m=1e9; for(const p of pts) m=Math.min(m,dist(p,c)); return m; }
function segDist(p,a,b){ const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy; let t=l2?((p.x-a.x)*dx+(p.y-a.y)*dy)/l2:0; t=Math.max(0,Math.min(1,t)); return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)); }
const inNode = (n,p,m=0) => p.x>=n.x-m && p.x<=n.x+n.w+m && p.y>=n.y-m && p.y<=n.y+n.h+m;
const center = n => ({x:n.x+n.w/2, y:n.y+n.h/2});
function nodeAt(p,m=0){ for(let i=nodes.length-1;i>=0;i--) if(inNode(nodes[i],p,m)) return nodes[i]; return null; }
function edgeAt(p){ for(const e of edges){ const [a,b]=edgeEnds(e); if(segDist(p,a,b)<14) return e; } return null; }

// Point where the line from node center towards `to` leaves the node's box
function borderPoint(n,to){
  const c=center(n), dx=to.x-c.x, dy=to.y-c.y;
  if(!dx&&!dy) return c;
  if(n.shape==='ellipse'){ const a=n.w/2,b=n.h/2, ang=Math.atan2(dy,dx); const r=1/Math.sqrt((Math.cos(ang)/a)**2+(Math.sin(ang)/b)**2); return {x:c.x+r*Math.cos(ang), y:c.y+r*Math.sin(ang)}; }
  if(n.shape==='diamond'){ const a=n.w/2,b=n.h/2; const t=1/(Math.abs(dx)/a+Math.abs(dy)/b); return {x:c.x+dx*t, y:c.y+dy*t}; }
  const sx=(n.w/2)/Math.abs(dx||1e-9), sy=(n.h/2)/Math.abs(dy||1e-9); const t=Math.min(sx,sy); return {x:c.x+dx*t, y:c.y+dy*t};
}
function edgeEnds(e){ const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to); return [borderPoint(a,center(b)), borderPoint(b,center(a))]; }

// ---------- Shape recognition (local, deterministic) ----------
function recognize(pts){
  const bb = bbox(pts), diag = Math.hypot(bb.w,bb.h), len = pathLen(pts);
  if(len < 25 || diag < 12) return {type:'none'};
  const closed = dist(pts[0], pts[pts.length-1]) < 0.28*diag + 12;
  if(!closed) return {type:'open'};
  if(bb.w < 28 || bb.h < 28) return {type:'none'};
  // Two cheap features: filled-area ratio vs bbox, and how close the stroke gets to the bbox corners
  const r = polyArea(pts)/(bb.w*bb.h);
  const corners=[{x:bb.x,y:bb.y},{x:bb.x+bb.w,y:bb.y},{x:bb.x,y:bb.y+bb.h},{x:bb.x+bb.w,y:bb.y+bb.h}];
  const cd = corners.reduce((s,c)=>s+minDistTo(pts,c),0)/4/diag;
  const proto = { rect:{r:.93,cd:.03}, ellipse:{r:.78,cd:.146}, diamond:{r:.5,cd:.25} };
  const allowed = Object.keys(KINDS[kind].shapes);
  let best=null, bs=1e9;
  for(const s of allowed){ const sc = Math.abs(r-proto[s].r) + 2.2*Math.abs(cd-proto[s].cd); if(sc<bs){bs=sc;best=s;} }
  return {type:'shape', shape:best, bb};
}

// ---------- Model operations ----------
function addNode(shape, bb){
  snapshot();
  const w=Math.max(bb.w,64), h=Math.max(bb.h,40);
  const def = KINDS[kind].shapes[shape];
  const n = {id:'n'+(seq++), shape, x:bb.x+bb.w/2-w/2, y:bb.y+bb.h/2-h/2, w, h, label: shape==='ellipse'&&kind==='state' ? '' : `${def.label} ${nodes.filter(k=>k.shape===shape).length+1}`};
  nodes.push(n); toast(`${shapeName(shape)} → ${def.label}`); update();
}
function addEdge(a,b){
  if(edges.some(e=>e.from===a.id&&e.to===b.id)){ toast('Ya existe esa conexión'); return; }
  snapshot(); edges.push({from:a.id,to:b.id,label:''}); toast('Conector → ' + (a.label||'[*]') + ' → ' + (b.label||'[*]')); update();
}
function shapeName(s){ return {rect:'Rectángulo',diamond:'Rombo',ellipse:'Elipse'}[s]; }
function removeNode(n){ snapshot(); nodes=nodes.filter(k=>k!==n); edges=edges.filter(e=>e.from!==n.id&&e.to!==n.id); update(); }

// ---------- Mermaid generation: no AI, just walking the graph ----------
const esc = t => (t||'').replace(/"/g,'#quot;').replace(/\n/g,' ');
function mermaidCode(){
  const K = KINDS[kind], lines=[K.header(dir)];
  const idOf = n => (kind==='state' && n.shape==='ellipse') ? '[*]' : n.id;
  for(const n of nodes){ const s=K.shapes[n.shape]; if(s.mm) lines.push('  '+s.mm(n.id, esc(n.label)||' ')); }
  for(const e of edges){ const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to); lines.push('  '+K.edge(idOf(a), idOf(b), esc(e.label))); }
  return lines.join('\n');
}

// ---------- Rendering ----------
let live = null; // stroke in progress
function draw(){
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
async function renderMermaid(){
  const code = mermaidCode(); $('code').textContent = code;
  $('stats').textContent = `${nodes.length} nodos · ${edges.length} conexiones`;
  clearTimeout(renderT);
  renderT = setTimeout(async () => {
    const box=$('preview');
    if(!window.mermaid){ box.innerHTML='<div class="err">No se pudo cargar mermaid.js; el código sigue disponible en la pestaña Código.</div>'; return; }
    if(!nodes.length){ box.innerHTML='<div style="color:var(--ink-2)">Dibuja una forma con el lápiz y aparecerá aquí.</div>'; return; }
    try{
      const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme!=='light' || document.documentElement.dataset.theme==='dark';
      mermaid.initialize({startOnLoad:false, theme: dark?'dark':'neutral', securityLevel:'loose'});
      const {svg} = await mermaid.render('mmd'+(++renderN), code);
      box.innerHTML = svg;
    }catch(err){ box.innerHTML = '<div class="err">Mermaid no puede renderizar aún:\n'+(err.message||err)+'</div>'; }
  }, 250);
}
function update(){ draw(); renderMermaid(); }

// ---------- Input: pen draws, finger moves, mouse follows the toggle ----------
let pointer=null; // {mode:'draw'|'drag', node, off, start, t0, moved}
const pos = ev => { const r=canvas.getBoundingClientRect(); return {x:ev.clientX-r.left, y:ev.clientY-r.top}; };
canvas.addEventListener('pointerdown', ev => {
  if(ev.button && ev.button!==0) return;
  hideEditor();
  const p=pos(ev), drawMode = ev.pointerType==='pen' || (ev.pointerType==='mouse' && mouseDraws);
  canvas.setPointerCapture(ev.pointerId);
  pointer = {mode: drawMode?'draw':'drag', start:p, t0:performance.now(), moved:false};
  if(drawMode){ live=[p]; }
  else { const n=nodeAt(p,8); if(n){ pointer.node=n; pointer.off={x:p.x-n.x,y:p.y-n.y}; snapshot(); } }
});
canvas.addEventListener('pointermove', ev => {
  if(!pointer) return; const p=pos(ev);
  if(dist(p,pointer.start)>6) pointer.moved=true;
  if(pointer.mode==='draw'){ live.push(p); draw(); }
  else if(pointer.node){ pointer.node.x=p.x-pointer.off.x; pointer.node.y=p.y-pointer.off.y; draw(); }
});
function finish(ev){
  if(!pointer) return; const p=pos(ev), pt=pointer; pointer=null;
  const quick = !pt.moved && performance.now()-pt.t0 < 500;
  if(pt.mode==='draw'){
    const pts=live; live=null;
    if(quick){ draw(); tap(p); return; }
    const r=recognize(pts);
    if(r.type==='shape') addNode(r.shape, r.bb);
    else if(r.type==='open'){
      const a=nodeAt(pts[0],18), b=nodeAt(pts[pts.length-1],18);
      if(a&&b&&a!==b) addEdge(a,b);
      else if(a&&b&&a===b){ draw(); }                       // e.g. an arrowhead drawn over a node: ignore
      else { toast('Conector no reconocido: empieza dentro de una forma y termina dentro de otra'); draw(); }
    } else { toast('Trazo demasiado pequeño'); draw(); }
  } else {
    if(quick){ tap(p); } else if(pt.node){ update(); }
  }
}
canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', ()=>{ pointer=null; live=null; draw(); });

// Tap = edit the label of the node or connector under the pen
function tap(p){
  const n=nodeAt(p); if(n){ openEditor(n.label, center(n), v=>{snapshot(); n.label=v;}, ()=>removeNode(n)); return; }
  const e=edgeAt(p); if(e){ const [a,b]=edgeEnds(e); openEditor(e.label, {x:(a.x+b.x)/2,y:(a.y+b.y)/2}, v=>{snapshot(); e.label=v;}, ()=>{snapshot(); edges=edges.filter(k=>k!==e); update();}); }
}
const editor=$('editor'), editInput=$('editInput'); let editCb=null, delCb=null;
function openEditor(val, at, onOk, onDel){
  editCb=onOk; delCb=onDel; editInput.value=val;
  editor.style.display='flex';
  const r=stage.getBoundingClientRect(); const w=editor.offsetWidth||260;
  editor.style.left=Math.max(6,Math.min(r.width-w-6, at.x-w/2))+'px'; editor.style.top=Math.max(6,at.y+24)+'px';
  editInput.focus(); editInput.select();
}
function hideEditor(){ editor.style.display='none'; editCb=null; }
function commitEditor(){ if(editCb){ editCb(editInput.value.trim()); } hideEditor(); update(); }
$('editOk').addEventListener('click', commitEditor);
editInput.addEventListener('keydown', e=>{ if(e.key==='Enter') commitEditor(); if(e.key==='Escape') hideEditor(); });
$('editDel').addEventListener('click', ()=>{ const d=delCb; hideEditor(); if(d) d(); });

// ---------- Toolbar ----------
$('kind').addEventListener('change', e => { kind=e.target.value; renderLegend(); update(); toast('Ahora solo se reconocen las formas de: '+KINDS[kind].name); });
$('dir').addEventListener('change', e => { dir=e.target.value; update(); });
$('mode').addEventListener('click', e => { mouseDraws=!mouseDraws; e.target.textContent = mouseDraws?'Ratón: dibuja':'Ratón: mueve'; canvas.style.cursor = mouseDraws?'crosshair':'grab'; });
$('undo').addEventListener('click', () => { const s=history.pop(); if(!s){toast('Nada que deshacer');return;} const o=JSON.parse(s); nodes=o.nodes; edges=o.edges; seq=o.seq; update(); });
$('clear').addEventListener('click', () => { if(!nodes.length) return; snapshot(); nodes=[]; edges=[]; update(); });
$('tabPrev').addEventListener('click', ()=>setTab(true)); $('tabCode').addEventListener('click', ()=>setTab(false));
function setTab(prev){ $('preview').hidden=!prev; $('codePane').hidden=prev; $('tabPrev').classList.toggle('on',prev); $('tabCode').classList.toggle('on',!prev); }
$('copy').addEventListener('click', async () => {
  const code=mermaidCode();
  try{ await navigator.clipboard.writeText(code); toast('Código copiado'); }
  catch{ setTab(false); const rg=document.createRange(); rg.selectNodeContents($('code')); const s=getSelection(); s.removeAllRanges(); s.addRange(rg); toast('Selecciona y copia el código'); }
});
function renderLegend(){
  const K=KINDS[kind];
  $('legend').innerHTML = Object.entries(K.shapes).map(([s,d])=>`<span><b>${shapeName(s)}</b> → ${d.label}</span>`).join('') + '<span><b>Línea</b> de una forma a otra → conexión</span><span><b>Toque</b> → editar texto</span>';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);

// ---------- Example so the page opens working ----------
function example(){
  nodes=[
    {id:'n1',shape:'ellipse',x:60,y:40,w:120,h:48,label:'Inicio'},
    {id:'n2',shape:'rect',x:60,y:130,w:140,h:52,label:'Leer petición'},
    {id:'n3',shape:'diamond',x:50,y:230,w:160,h:90,label:'¿Válida?'},
    {id:'n4',shape:'rect',x:280,y:250,w:140,h:52,label:'Procesar'},
    {id:'n5',shape:'ellipse',x:290,y:360,w:120,h:48,label:'Fin'},
  ];
  edges=[{from:'n1',to:'n2',label:''},{from:'n2',to:'n3',label:''},{from:'n3',to:'n4',label:'sí'},{from:'n3',to:'n2',label:'no'},{from:'n4',to:'n5',label:''}];
  seq=6;
}
example(); renderLegend(); resize();
toast('Ejemplo cargado: dibuja encima con el lápiz o pulsa Limpiar');
})();
