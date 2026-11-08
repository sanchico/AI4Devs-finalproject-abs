// ---------- Diagram model: state and the operations that change it (no DOM, no toasts) ----------
// Operations return a result ({ok:true,...} / {ok:false,reason}) and the caller decides what to show.
import { KINDS } from './kinds/index.js';
import { borderPoint, center, inNode, segDist } from './geometry.js';

export const state = { kind: 'flow', dir: 'TD', nodes: [], edges: [], seq: 1 };
let history = [];

// Undo by snapshots (F2 replaces this with inverse operations)
export const snapshot = () => { history.push(JSON.stringify({nodes: state.nodes, edges: state.edges, seq: state.seq})); if (history.length > 60) history.shift(); };

// ---------- Queries ----------
export function nodeAt(p, m=0){ for(let i=state.nodes.length-1;i>=0;i--) if(inNode(state.nodes[i],p,m)) return state.nodes[i]; return null; }
export function edgeEnds(e){ const a=state.nodes.find(n=>n.id===e.from), b=state.nodes.find(n=>n.id===e.to); return [borderPoint(a,center(b)), borderPoint(b,center(a))]; }
export function edgeAt(p){ for(const e of state.edges){ const [a,b]=edgeEnds(e); if(segDist(p,a,b)<14) return e; } return null; }

// ---------- Changes ----------
export function addNode(shape, bb){
  snapshot();
  const {kind, nodes} = state;
  const w=Math.max(bb.w,64), h=Math.max(bb.h,40);
  const def = KINDS[kind].shapes[shape];
  const n = {id:'n'+(state.seq++), shape, x:bb.x+bb.w/2-w/2, y:bb.y+bb.h/2-h/2, w, h, label: shape==='ellipse'&&kind==='state' ? '' : `${def.label} ${nodes.filter(k=>k.shape===shape).length+1}`};
  nodes.push(n);
  return {ok: true, node: n};
}
export function addEdge(a, b){
  if(state.edges.some(e=>e.from===a.id&&e.to===b.id)) return {ok: false, reason: 'duplicate'};
  snapshot();
  const edge = {from:a.id, to:b.id, label:''};
  state.edges.push(edge);
  return {ok: true, edge};
}
export function removeNode(n){ snapshot(); state.nodes=state.nodes.filter(k=>k!==n); state.edges=state.edges.filter(e=>e.from!==n.id&&e.to!==n.id); }
export function removeEdge(e){ snapshot(); state.edges=state.edges.filter(k=>k!==e); }
export function setLabel(item, label){ snapshot(); item.label=label; }
// Dragging: call snapshot() once when the drag starts, then moveNode() for each pointer move
export function moveNode(n, x, y){ n.x=x; n.y=y; }
export function clear(){ if(!state.nodes.length) return {ok: false, reason: 'empty'}; snapshot(); state.nodes=[]; state.edges=[]; return {ok: true}; }
export function undo(){
  const s=history.pop(); if(!s) return {ok: false, reason: 'empty'};
  const o=JSON.parse(s); state.nodes=o.nodes; state.edges=o.edges; state.seq=o.seq;
  return {ok: true};
}
export function setKind(kind){ state.kind=kind; }
export function setDir(dir){ state.dir=dir; }

// ---------- Example so the page opens working ----------
export function loadExample(){
  state.nodes=[
    {id:'n1',shape:'ellipse',x:60,y:40,w:120,h:48,label:'Inicio'},
    {id:'n2',shape:'rect',x:60,y:130,w:140,h:52,label:'Leer petición'},
    {id:'n3',shape:'diamond',x:50,y:230,w:160,h:90,label:'¿Válida?'},
    {id:'n4',shape:'rect',x:280,y:250,w:140,h:52,label:'Procesar'},
    {id:'n5',shape:'ellipse',x:290,y:360,w:120,h:48,label:'Fin'},
  ];
  state.edges=[{from:'n1',to:'n2',label:''},{from:'n2',to:'n3',label:''},{from:'n3',to:'n4',label:'sí'},{from:'n3',to:'n2',label:'no'},{from:'n4',to:'n5',label:''}];
  state.seq=6;
}
