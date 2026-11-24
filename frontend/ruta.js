// ---------- Route: the page address says whether the app is solo or opens a shared diagram (pure: no DOM) ----------
// '' / '#/' / any other hash -> {tipo:'solitario'}: the app opens as always, with no session and no network
// '#/d/<uuid>'               -> {tipo:'diagrama', id}: open that shared diagram (needs a session)
// '#/d/<anything else>'      -> {tipo:'invalida'}: it looks like a diagram address but the id is not a UUID
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRuta(hash) {
  const h = typeof hash === 'string' ? hash : '';
  if (h !== '#/d' && !h.startsWith('#/d/')) return { tipo: 'solitario' };
  const id = h.slice('#/d/'.length);
  return UUID.test(id) ? { tipo: 'diagrama', id: id.toLowerCase() } : { tipo: 'invalida' };
}
