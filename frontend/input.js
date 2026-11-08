// ---------- Input: pen draws, finger moves, mouse follows the toggle (browser only) ----------
import { KINDS, shapeName } from './kinds/index.js';
import { recognize } from './recognizer.js';
import * as model from './model.js';
import { center, dist } from './geometry.js';
import { $, canvas, stage, draw, update, setLive } from './render.js';

const { state } = model;
let toast = () => {};
let mouseDraws = true;
let live = null; // stroke in progress
let pointer = null; // {mode:'draw'|'drag', node, off, start, t0, moved}

// The mouse draws or moves nodes depending on this toggle; returns the new value
export function toggleMouseDraws(){ mouseDraws = !mouseDraws; return mouseDraws; }

const pos = ev => { const r=canvas.getBoundingClientRect(); return {x:ev.clientX-r.left, y:ev.clientY-r.top}; };

function addShape(shape, bb){
  const {node} = model.addNode(shape, bb);
  toast(`${shapeName(shape)} → ${KINDS[state.kind].shapes[node.shape].label}`);
  update();
}
function addConnector(a, b){
  const r = model.addEdge(a, b);
  if(!r.ok){ toast('Ya existe esa conexión'); return; }
  toast('Conector → ' + (a.label||'[*]') + ' → ' + (b.label||'[*]')); update();
}

function finish(ev){
  if(!pointer) return; const p=pos(ev), pt=pointer; pointer=null;
  const quick = !pt.moved && performance.now()-pt.t0 < 500;
  if(pt.mode==='draw'){
    const pts=live; live=null; setLive(null);
    if(quick){ draw(); tap(p); return; }
    const r=recognize(pts, Object.keys(KINDS[state.kind].shapes));
    if(r.type==='shape') addShape(r.shape, r.bb);
    else if(r.type==='open'){
      const a=model.nodeAt(pts[0],18), b=model.nodeAt(pts[pts.length-1],18);
      if(a&&b&&a!==b) addConnector(a,b);
      else if(a&&b&&a===b){ draw(); }                       // e.g. an arrowhead drawn over a node: ignore
      else { toast('Conector no reconocido: empieza dentro de una forma y termina dentro de otra'); draw(); }
    } else { toast('Trazo demasiado pequeño'); draw(); }
  } else {
    if(quick){ tap(p); } else if(pt.node){ update(); }
  }
}

// Tap = edit the label of the node or connector under the pen
function tap(p){
  const n=model.nodeAt(p); if(n){ openEditor(n.label, center(n), v=>model.setLabel(n,v), ()=>{ model.removeNode(n); update(); }); return; }
  const e=model.edgeAt(p); if(e){ const [a,b]=model.edgeEnds(e); openEditor(e.label, {x:(a.x+b.x)/2,y:(a.y+b.y)/2}, v=>model.setLabel(e,v), ()=>{ model.removeEdge(e); update(); }); }
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

// `showToast` is passed in by main.js so this module does not depend on it
export function initInput({toast: showToast}){
  toast = showToast;
  canvas.addEventListener('pointerdown', ev => {
    if(ev.button && ev.button!==0) return;
    hideEditor();
    const p=pos(ev), drawMode = ev.pointerType==='pen' || (ev.pointerType==='mouse' && mouseDraws);
    canvas.setPointerCapture(ev.pointerId);
    pointer = {mode: drawMode?'draw':'drag', start:p, t0:performance.now(), moved:false};
    if(drawMode){ live=[p]; setLive(live); }
    else { const n=model.nodeAt(p,8); if(n){ pointer.node=n; pointer.off={x:p.x-n.x,y:p.y-n.y}; model.snapshot(); } }
  });
  canvas.addEventListener('pointermove', ev => {
    if(!pointer) return; const p=pos(ev);
    if(dist(p,pointer.start)>6) pointer.moved=true;
    if(pointer.mode==='draw'){ live.push(p); draw(); }
    else if(pointer.node){ model.moveNode(pointer.node, p.x-pointer.off.x, p.y-pointer.off.y); draw(); }
  });
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', ()=>{ pointer=null; live=null; setLive(null); draw(); });

  $('editOk').addEventListener('click', commitEditor);
  editInput.addEventListener('keydown', e=>{ if(e.key==='Enter') commitEditor(); if(e.key==='Escape') hideEditor(); });
  $('editDel').addEventListener('click', ()=>{ const d=delCb; hideEditor(); if(d) d(); });
}
