// ---------- Geometry helpers (pure: no DOM, no diagram state) ----------
export const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
export function bbox(pts){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of pts){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);} return {x:x0,y:y0,w:x1-x0,h:y1-y0}; }
export function polyArea(pts){ let a=0; for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length]; a+=p.x*q.y-q.x*p.y;} return Math.abs(a)/2; }
export function pathLen(pts){ let l=0; for(let i=1;i<pts.length;i++) l+=dist(pts[i-1],pts[i]); return l; }
export function minDistTo(pts,c){ let m=1e9; for(const p of pts) m=Math.min(m,dist(p,c)); return m; }
export function segDist(p,a,b){ const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy; let t=l2?((p.x-a.x)*dx+(p.y-a.y)*dy)/l2:0; t=Math.max(0,Math.min(1,t)); return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)); }
export const inNode = (n,p,m=0) => p.x>=n.x-m && p.x<=n.x+n.w+m && p.y>=n.y-m && p.y<=n.y+n.h+m;
export const center = n => ({x:n.x+n.w/2, y:n.y+n.h/2});

// Point where the line from node center towards `to` leaves the node's box
export function borderPoint(n,to){
  const c=center(n), dx=to.x-c.x, dy=to.y-c.y;
  if(!dx&&!dy) return c;
  if(n.shape==='ellipse'){ const a=n.w/2,b=n.h/2, ang=Math.atan2(dy,dx); const r=1/Math.sqrt((Math.cos(ang)/a)**2+(Math.sin(ang)/b)**2); return {x:c.x+r*Math.cos(ang), y:c.y+r*Math.sin(ang)}; }
  if(n.shape==='diamond'){ const a=n.w/2,b=n.h/2; const t=1/(Math.abs(dx)/a+Math.abs(dy)/b); return {x:c.x+dx*t, y:c.y+dy*t}; }
  const sx=(n.w/2)/Math.abs(dx||1e-9), sy=(n.h/2)/Math.abs(dy||1e-9); const t=Math.min(sx,sy); return {x:c.x+dx*t, y:c.y+dy*t};
}
