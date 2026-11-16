// ---------- Stroke recording state (pure: no DOM) ----------
// Used by the `?grabar` mode: every stroke is stored as a sample of the shape the user chose, to be used as a
// test fixture for the recognizer. Format of the exported file:
//   { dispositivo, formas: { rect: [{tipo, pts:[{x,y}…]}…], diamond: […], ellipse: […] } }
export const FORMAS = ['rect', 'diamond', 'ellipse'];

const round1 = n => Math.round(n * 10) / 10;

export function crear() {
  return { muestras: {}, orden: [] };   // muestras por forma; `orden` recuerda cuál se añadió al final
}
// Returns true if stored; false for an unknown shape or a stroke without points
export function añadir(g, forma, tipo, pts) {
  if (!FORMAS.includes(forma) || !pts?.length) return false;
  (g.muestras[forma] ??= []).push({ tipo, pts: pts.map(p => ({ x: round1(p.x), y: round1(p.y) })) });
  g.orden.push(forma);
  return true;
}
// Removes the last sample added, of any shape; false if there was none
export function descartarUltimo(g) {
  const forma = g.orden.pop();
  if (!forma) return false;
  g.muestras[forma].pop();
  return true;
}
export const contar = g => Object.fromEntries(FORMAS.map(f => [f, g.muestras[f]?.length ?? 0]));
export const total = g => g.orden.length;
export const aJSON = (g, dispositivo = '') =>
  ({ dispositivo, formas: Object.fromEntries(FORMAS.map(f => [f, g.muestras[f] ?? []])) });
