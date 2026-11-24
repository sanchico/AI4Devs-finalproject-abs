// ---------- Route: the page address says what the app shows (pure: no DOM) ----------
// '' / '#/' / any other hash -> {tipo:'solitario'}: the app opens as always, with no session and no network
// '#/d/<uuid>'               -> {tipo:'diagrama', id}: open that shared diagram (needs a session)
// '#/d/<anything else>'      -> {tipo:'invalida'}: it looks like a diagram address but the id is not a UUID
// '#/lista'                  -> {tipo:'lista'}: the user's diagrams (needs a session)
// '#/i/<64 hex>'             -> {tipo:'invitacion', token}: accept an invitation, then open its diagram (needs a session)
// '#/i/<anything else>'      -> {tipo:'invalida'}: the token is what create_invite makes (64 lowercase hex) or nothing
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;

export function parseRuta(hash) {
  const h = typeof hash === 'string' ? hash : '';
  if (h === '#/lista') return { tipo: 'lista' };
  if (h === '#/i' || h.startsWith('#/i/')) {
    const token = h.slice('#/i/'.length);
    return TOKEN.test(token) ? { tipo: 'invitacion', token } : { tipo: 'invalida' };
  }
  if (h !== '#/d' && !h.startsWith('#/d/')) return { tipo: 'solitario' };
  const id = h.slice('#/d/'.length);
  return UUID.test(id) ? { tipo: 'diagrama', id: id.toLowerCase() } : { tipo: 'invalida' };
}
