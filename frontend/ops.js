// ---------- Operations on the diagram graph (pure: no DOM, no network, no clock) ----------
// Every change to the diagram is one of these plain-JSON operations:
//   addNode {node, at?}   updateNode {id, set}   removeNode {id}
//   addEdge {edge, at?}   updateEdge {id, set}   removeEdge {id}
//   setMeta {set:{dir?, title?}}   (the diagram type is fixed at creation: a `kind` is rejected)
// `state` is {kind, dir, title, nodes, edges}. apply() mutates it in place and returns {ok:true} or
// {ok:false, reason}; a rejected operation never changes anything.

const NODE_FIELDS = ['x', 'y', 'w', 'h', 'label'];
const EDGE_FIELDS = ['label'];
const META_FIELDS = ['dir', 'title'];
const DIRS = ['TD', 'LR'];
const MAX_TITLE = 200;
const MAX_LABEL = 200;
// The title is stored exactly as received (no trimming), so the server can copy it without transforming it
const validTitle = t => typeof t === 'string' && t.trim() !== '' && t.length <= MAX_TITLE;
// Same measure as the title (UTF-16 units; the server counts code points, so it is never stricter). Empty is valid.
const validLabel = l => typeof l === 'string' && l.length <= MAX_LABEL;
// A label that is present must be valid; an absent one is not this check's business
const labelOk = obj => !obj || !('label' in obj) || validLabel(obj.label);

const ok = () => ({ ok: true });
const fail = reason => ({ ok: false, reason });
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj && k in obj).map(k => [k, obj[k]]));
const clamp = (at, len) => Number.isInteger(at) ? Math.max(0, Math.min(at, len)) : len;

// UUID v4. crypto.randomUUID() only exists in secure contexts (HTTPS or localhost) and the tablet opens
// the app over plain http://<ip>:8000, so fall back to getRandomValues, which works everywhere.
export function newId(c = globalThis.crypto) {
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const nodeIndex = (s, id) => s.nodes.findIndex(n => n.id === id);
const edgeIndex = (s, id) => s.edges.findIndex(e => e.id === id);

export function apply(state, op) {
  switch (op?.type) {
    case 'addNode': {
      if (!labelOk(op.node)) return fail('invalid');
      if (nodeIndex(state, op.node.id) >= 0) return fail('duplicate');
      state.nodes.splice(clamp(op.at, state.nodes.length), 0, { ...op.node });
      return ok();
    }
    case 'updateNode': {
      const n = state.nodes[nodeIndex(state, op.id)];
      if (!n) return fail('missing');
      if (!labelOk(op.set)) return fail('invalid');
      Object.assign(n, pick(op.set, NODE_FIELDS));
      return ok();
    }
    case 'removeNode': {
      const i = nodeIndex(state, op.id);
      if (i < 0) return fail('missing');
      state.nodes.splice(i, 1);
      state.edges = state.edges.filter(e => e.from !== op.id && e.to !== op.id);
      return ok();
    }
    case 'addEdge': {
      const { id, from, to } = op.edge;
      if (!labelOk(op.edge)) return fail('invalid');
      if (nodeIndex(state, from) < 0 || nodeIndex(state, to) < 0) return fail('missing');
      if (edgeIndex(state, id) >= 0 || state.edges.some(e => e.from === from && e.to === to)) return fail('duplicate');
      state.edges.splice(clamp(op.at, state.edges.length), 0, { ...op.edge });
      return ok();
    }
    case 'updateEdge': {
      const e = state.edges[edgeIndex(state, op.id)];
      if (!e) return fail('missing');
      if (!labelOk(op.set)) return fail('invalid');
      Object.assign(e, pick(op.set, EDGE_FIELDS));
      return ok();
    }
    case 'removeEdge': {
      const i = edgeIndex(state, op.id);
      if (i < 0) return fail('missing');
      state.edges.splice(i, 1);
      return ok();
    }
    case 'setMeta': {
      // The type is fixed at creation: any `kind` rejects the whole operation, like any other invalid field
      if (op.set && 'kind' in op.set) return fail('invalid');
      const set = pick(op.set, META_FIELDS);
      if ('dir' in set && !DIRS.includes(set.dir)) return fail('invalid');
      if ('title' in set && !validTitle(set.title)) return fail('invalid');
      Object.assign(state, set);
      return ok();
    }
    default:
      return fail('unknown');
  }
}

// Operations that undo `op`, computed BEFORE applying it, from the current state. Apply them in the
// order returned. Returns [] if `op` would be rejected. Undo is local to each client, so this has no
// counterpart on the server.
export function inverse(state, op) {
  switch (op?.type) {
    case 'addNode': return [{ type: 'removeNode', id: op.node.id }];
    case 'addEdge': return [{ type: 'removeEdge', id: op.edge.id }];
    case 'updateNode': {
      const n = state.nodes[nodeIndex(state, op.id)];
      return n ? [{ type: 'updateNode', id: op.id, set: pick(n, Object.keys(pick(op.set, NODE_FIELDS))) }] : [];
    }
    case 'updateEdge': {
      const e = state.edges[edgeIndex(state, op.id)];
      return e ? [{ type: 'updateEdge', id: op.id, set: pick(e, Object.keys(pick(op.set, EDGE_FIELDS))) }] : [];
    }
    case 'removeNode': {
      const i = nodeIndex(state, op.id);
      if (i < 0) return [];
      // The node first, then its edges in their original order, each at its original position
      const attached = state.edges.flatMap((e, at) => (e.from === op.id || e.to === op.id) ? [{ type: 'addEdge', edge: { ...e }, at }] : []);
      return [{ type: 'addNode', node: { ...state.nodes[i] }, at: i }, ...attached];
    }
    case 'removeEdge': {
      const i = edgeIndex(state, op.id);
      return i < 0 ? [] : [{ type: 'addEdge', edge: { ...state.edges[i] }, at: i }];
    }
    case 'setMeta': {
      const set = pick(op.set, META_FIELDS);
      return [{ type: 'setMeta', set: pick(state, Object.keys(set)) }];
    }
    default: return [];
  }
}
