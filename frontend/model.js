// ---------- Diagram model: state and the operations that change it (no DOM, no toasts) ----------
// Every change goes through perform(), which applies operations (ops.js) and remembers how to undo them.
// Functions return a result ({ok:true,...} / {ok:false,reason}) and the caller decides what to show.
import { KINDS } from './kinds/index.js';
import { borderPoint, center, inNode, segDist } from './geometry.js';
import { apply, inverse, newId } from './ops.js';

export const state = { kind: 'flow', dir: 'TD', nodes: [], edges: [] };

// Undo stack: one group per user gesture. A group is a list with, for each operation applied, the
// operations that undo it. Only the user's own gestures go in; remote operations never do.
const MAX_UNDO = 60;
let history = [];

// Back to an empty flow diagram with no undo history
export function reset(){ state.kind='flow'; state.dir='TD'; state.nodes=[]; state.edges=[]; history=[]; }

// ---------- Queries ----------
export function nodeAt(p, m=0){ for(let i=state.nodes.length-1;i>=0;i--) if(inNode(state.nodes[i],p,m)) return state.nodes[i]; return null; }
export function edgeEnds(e){ const a=state.nodes.find(n=>n.id===e.from), b=state.nodes.find(n=>n.id===e.to); return [borderPoint(a,center(b)), borderPoint(b,center(a))]; }
export function edgeAt(p){ for(const e of state.edges){ const [a,b]=edgeEnds(e); if(segDist(p,a,b)<14) return e; } return null; }

// ---------- Applying operations ----------
// Apply the user's operations as one undo step. Rejected ones are skipped; returns the results in order.
export function perform(ops){
  const group = [], results = [];
  for(const op of ops){
    const undo = inverse(state, op), r = apply(state, op);
    results.push(r);
    if(r.ok) group.push(undo);
  }
  if(group.length){ history.push(group); if(history.length > MAX_UNDO) history.shift(); }
  return results;
}
// Apply an operation from another user: it changes the diagram but is not undoable here
export function applyRemote(op){ return apply(state, op); }

// ---------- Changes (gestures) ----------
export function addNode(shape, bb){
  const {kind, nodes} = state;
  const w=Math.max(bb.w,64), h=Math.max(bb.h,40);
  const def = KINDS[kind].shapes[shape];
  const node = {id:newId(), shape, x:bb.x+bb.w/2-w/2, y:bb.y+bb.h/2-h/2, w, h, label: shape==='ellipse'&&kind==='state' ? '' : `${def.label} ${nodes.filter(k=>k.shape===shape).length+1}`};
  const [r] = perform([{type:'addNode', node}]);
  return r.ok ? {ok: true, node: state.nodes.find(n=>n.id===node.id)} : r;
}
export function addEdge(from, to){
  const edge = {id:newId(), from, to, label:''};
  const [r] = perform([{type:'addEdge', edge}]);
  return r.ok ? {ok: true, edge: state.edges.find(e=>e.id===edge.id)} : r;
}
export function removeNode(id){ return perform([{type:'removeNode', id}])[0]; }
export function removeEdge(id){ return perform([{type:'removeEdge', id}])[0]; }
// `id` is a node or an edge (ids are unique across both)
export function setLabel(id, label){
  const type = state.nodes.some(n=>n.id===id) ? 'updateNode' : 'updateEdge';
  return perform([{type, id, set:{label}}])[0];
}
// Dragging: previewMove() follows the pointer without touching the history; moveNode() runs once on
// release. It puts the node back at `from` first, so the undo step restores the position before the drag.
export function previewMove(id, x, y){ const n=state.nodes.find(k=>k.id===id); if(n){ n.x=x; n.y=y; } }
export function moveNode(id, from, to){
  previewMove(id, from.x, from.y);
  if(from.x===to.x && from.y===to.y) return {ok: false, reason: 'unchanged'};
  return perform([{type:'updateNode', id, set:{x:to.x, y:to.y}}])[0];
}
export function clear(){
  if(!state.nodes.length) return {ok: false, reason: 'empty'};
  perform(state.nodes.map(n=>({type:'removeNode', id:n.id})));
  return {ok: true};
}
// Undo the last gesture that still has something to undo; inverses whose element is gone are skipped
export function undo(){
  while(history.length){
    const group = history.pop();
    let applied = 0;
    for(const undoOps of group.reverse()) for(const op of undoOps) if(apply(state, op).ok) applied++;
    if(applied) return {ok: true};
  }
  return {ok: false, reason: 'empty'};
}
// Type and direction are changes of the diagram but not undoable steps
export function setKind(kind){ return applyRemote({type:'setMeta', set:{kind}}); }
export function setDir(dir){ return applyRemote({type:'setMeta', set:{dir}}); }

// ---------- Example so the page opens working ----------
export function loadExample(){
  const [n1,n2,n3,n4,n5] = [
    {shape:'ellipse',x:60,y:40,w:120,h:48,label:'Inicio'},
    {shape:'rect',x:60,y:130,w:140,h:52,label:'Leer petición'},
    {shape:'diamond',x:50,y:230,w:160,h:90,label:'¿Válida?'},
    {shape:'rect',x:280,y:250,w:140,h:52,label:'Procesar'},
    {shape:'ellipse',x:290,y:360,w:120,h:48,label:'Fin'},
  ].map(n=>({id:newId(), ...n}));
  const edge = (a,b,label='') => ({id:newId(), from:a.id, to:b.id, label});
  state.nodes=[n1,n2,n3,n4,n5];
  state.edges=[edge(n1,n2), edge(n2,n3), edge(n3,n4,'sí'), edge(n3,n2,'no'), edge(n4,n5)];
  history=[];
}
