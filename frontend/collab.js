// ---------- Collaboration client: sends my gestures, applies everyone's, reaches the same diagram (pure: no DOM, no network) ----------
// The server keeps one ordered log of operations. Each client keeps two things apart:
//   confirmed = the log applied in sequence order
//   pending   = my own gestures not yet seen in the log
// and what the user sees is always `confirmed` + `pending`, recomputed every time either changes. That is what makes
// two people editing the same thing end up with the same diagram: the last one in the server's order wins.
//
// The network is injected as a `transport` with three functions (the supabase-js adapter implements them):
//   subscribe(onEntry, onClose) -> Promise   resolves when the subscription is really ready
//   load() -> Promise<{kind, role, log}>     log: [{seq, op_id, op}] in sequence order
//   send(group) -> Promise<{ok:true} | {ok:false, status, key?}>   group: [{op_id, op}]; status null = no answer (network)
// `onEntry({seq, op_id, op})` delivers every new row of the log, mine included.
import { apply, newId } from './ops.js';
import { UNTITLED } from './model.js';

// Modes: 'loading' (opening), 'edit', 'readonly' (reason: role | deleted | no-access) and
// 'offline' (reason: gap | closed | network | load). Only 'edit' accepts gestures.
export function createCollab({ transport, onVisible = () => {}, onMode = () => {}, onNotice = () => {}, wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  let mode = 'loading', reason = null;
  let confirmed = null;   // the diagram after the log, in order
  let last = 0;           // sequence of the last log entry applied
  let pending = [];       // my groups not yet seen in the log: [{ops: [{op_id, op}], sent}]
  let inFlight = null;    // the group whose call has not answered yet
  let buffer = [];        // entries that arrive while the log is loading

  const setMode = (m, r = null) => { mode = m; reason = r; onMode({ mode, reason }); };
  const fail = why => { setMode('offline', why); onNotice(why); };

  // What the user sees: the confirmed diagram with my pending gestures on top (a pending one that no longer applies is skipped)
  function visible() {
    if (!confirmed) return null;
    const s = structuredClone(confirmed);
    for (const g of pending) for (const o of g.ops) apply(s, o.op);
    return s;
  }
  const emitVisible = () => { const v = visible(); if (v) onVisible(v); };

  // Apply one log entry: 'ignored' if already applied, 'gap' if it does not follow the last one, 'applied' otherwise
  function take(e) {
    if (e.seq <= last) return 'ignored';
    if (e.seq !== last + 1) return 'gap';
    apply(confirmed, e.op);
    last = e.seq;
    for (const g of pending) {          // one of mine seen in the log: no longer pending
      const i = g.ops.findIndex(o => o.op_id === e.op_id);
      if (i >= 0) { g.ops.splice(i, 1); break; }
    }
    pending = pending.filter(g => g.ops.length || g === inFlight);
    return 'applied';
  }

  function onEntry(e) {
    if (mode === 'loading') { buffer.push(e); return; }
    if (mode === 'offline') return;
    const r = take(e);
    if (r === 'gap') fail('gap');
    else if (r === 'applied') emitVisible();
  }
  const onClose = () => { if (mode !== 'offline') fail('closed'); };

  // Subscribe first and keep what arrives, then load the log, apply it, then apply what was kept
  async function open() {
    setMode('loading');
    buffer = [];
    let role, why = 'load';
    try {
      await transport.subscribe(onEntry, onClose);
      const loaded = await transport.load();
      role = loaded.role;
      confirmed = { kind: loaded.kind, dir: 'TD', title: UNTITLED, nodes: [], edges: [] };
      last = 0;
      for (const e of loaded.log) if (take(e) === 'gap') throw new Error('hole in the loaded log');
      why = 'gap';
      for (const e of buffer) if (take(e) === 'gap') throw new Error('hole in the channel');
    } catch {
      emitVisible();
      fail(why);
      return { ok: false, reason: why };
    }
    buffer = [];
    emitVisible();
    if (role === 'viewer') setMode('readonly', 'role'); else setMode('edit');
    return { ok: true };
  }

  // Send my groups in order, one call at a time
  async function pump() {
    if (inFlight || mode !== 'edit') return;
    const group = pending.find(g => !g.sent);
    if (!group) return;
    inFlight = group;
    group.sent = true;
    const res = await transport.send(group.ops.map(({ op_id, op }) => ({ op_id, op })));
    inFlight = null;
    if (!res.ok) return;
    pending = pending.filter(g => g.ops.length);
    pump();
  }

  // A gesture of mine, already applied by the model: the operations it applied
  function local(ops) {
    if (mode !== 'edit') return { ok: false, reason: mode === 'loading' ? 'loading' : mode === 'readonly' ? 'readonly' : 'offline' };
    if (!ops.length) return { ok: true };
    pending.push({ ops: ops.map(op => ({ op_id: newId(), op: structuredClone(op) })), sent: false });
    emitVisible();
    pump();
    return { ok: true };
  }

  return {
    open, local, visible,
    confirmed: () => confirmed && structuredClone(confirmed),
    mode: () => ({ mode, reason }),
  };
}
