// ---------- Shape recognition (local, deterministic) ----------
// Pure: the diagram type restricts the shapes by passing `allowedShapes` (e.g. ['rect','diamond','ellipse']).
import { bbox, dist, pathLen, polyArea, minDistTo } from './geometry.js';

export function recognize(pts, allowedShapes){
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
  let best=null, bs=1e9;
  for(const s of allowedShapes){ const sc = Math.abs(r-proto[s].r) + 2.2*Math.abs(cd-proto[s].cd); if(sc<bs){bs=sc;best=s;} }
  return {type:'shape', shape:best, bb};
}
