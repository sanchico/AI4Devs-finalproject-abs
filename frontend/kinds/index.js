// ---------- Diagram definitions and Mermaid generation (pure: no DOM) ----------
import { flow } from './flow.js';
import { state } from './state.js';

export const KINDS = { flow, state };

export function shapeName(s){ return {rect:'Rectángulo',diamond:'Rombo',ellipse:'Elipse'}[s]; }

// ---------- Mermaid generation: no AI, just walking the graph ----------
// Mermaid entities (#lt; #124; ...) so labels render as literal text, never as HTML. `&` goes first so the
// `#` entities written afterwards are not touched.
export const esc = t => (t||'').replace(/&/g,'#amp;').replace(/</g,'#lt;').replace(/>/g,'#gt;').replace(/\|/g,'#124;').replace(/"/g,'#quot;').replace(/\n/g,' ');

// graph = {nodes, edges}; kind = key of KINDS; dir = 'TD' | 'LR'
export function mermaidCode(graph, kind, dir){
  const {nodes, edges} = graph;
  const K = KINDS[kind], lines=[K.header(dir)];
  // Nodes are named n1, n2... by position: internal ids are UUIDs, unreadable and not valid Mermaid ids
  const name = new Map(nodes.map((n,i)=>[n.id, 'n'+(i+1)]));
  const idOf = n => (kind==='state' && n.shape==='ellipse') ? '[*]' : name.get(n.id);
  for(const n of nodes){ const s=K.shapes[n.shape]; if(s.mm) lines.push('  '+s.mm(name.get(n.id), esc(n.label)||' ')); }
  for(const e of edges){ const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to); lines.push('  '+K.edge(idOf(a), idOf(b), esc(e.label))); }
  return lines.join('\n');
}
