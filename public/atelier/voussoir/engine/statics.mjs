// ===================== VOUSSOIR STATICS CORE =====================
// Extracted VERBATIM from voussoir.html (the working v0 game). Same formulas,
// same constants, same coarse-to-fine search grid (nH=26, nY=26, nS=15, 6 passes
// default). No numerics were changed during extraction — the honesty of the physics
// is the whole point. The honesty ledger is voussoir.NOTES.md (see §2 for the
// validation facts these functions must reproduce).
//
// Pure computation only: no DOM, no canvas, no globals. Imports cleanly under Node.

"use strict";

export function fitCircle(p1,p2,p3){
  const [ax,ay]=p1,[bx,by]=p2,[cx,cy]=p3;
  const d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));
  const ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d;
  const uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d;
  return {ox:ux,oy:uy,R:Math.hypot(ax-ux,ay-uy)};
}
export function unwrap(a,r){ while(a-r>Math.PI)a-=2*Math.PI; while(a-r<-Math.PI)a+=2*Math.PI; return a; }
// Build the voussoir ring from left spring PL, right spring PR, crown PC, ring thickness t, N stones.
export function buildArch(PL,PR,PC,t,N){
  const {ox,oy,R}=fitCircle(PL,PR,PC);
  let aL=Math.atan2(PL[1]-oy,PL[0]-ox), aR=Math.atan2(PR[1]-oy,PR[0]-ox), aC=Math.atan2(PC[1]-oy,PC[0]-ox);
  aC=unwrap(aC,aL); aR=unwrap(aR,aC);
  const intra=[],extra=[];
  for(let k=0;k<=N;k++){
    const ang=aL+(aR-aL)*k/N, dx=Math.cos(ang), dy=Math.sin(ang);
    intra.push([ox+R*dx,oy+R*dy]); extra.push([ox+(R+t)*dx,oy+(R+t)*dy]);
  }
  const vouss=[];
  for(let k=0;k<N;k++){
    const p=[intra[k],intra[k+1],extra[k+1],extra[k]];
    let A=0,cx=0,cy=0;
    for(let i=0;i<4;i++){const[x0,y0]=p[i],[x1,y1]=p[(i+1)%4];const cr=x0*y1-x1*y0;A+=cr;cx+=(x0+x1)*cr;cy+=(y0+y1)*cr;}
    A*=0.5; cx/=6*A; cy/=6*A;
    vouss.push({poly:p,cx:cx,cy:cy,w:Math.abs(A)});   // weight proportional to cross-sectional area
  }
  const joints=[];
  for(let k=0;k<=N;k++) joints.push({a:intra[k],b:extra[k]});
  return {vouss,joints,R,t,ox,oy};
}
// Pre-compute per-joint constants and the sorted load list (stone weights + optional extra point loads).
export function prep(arch,extras){
  let loads=arch.vouss.map(v=>[v.cx,v.cy,v.w]);
  if(extras) for(const e of extras) loads.push([e.x,e.y,e.w]);
  loads.sort((p,q)=>p[0]-q[0]);
  const J=[];
  for(const j of arch.joints){
    const a=j.a,b=j.b, cx=(a[0]+b[0])/2, cy=(a[1]+b[1])/2;
    const dx=b[0]-a[0], dy=b[1]-a[1], Ln=Math.hypot(dx,dy);
    let Wl=0,Sxc=0;
    for(const L of loads){ if(L[0]<cx){ Wl+=L[2]; Sxc+=L[2]*(cx-L[0]); } }
    J.push({cx,cy,ux:dx/Ln,uy:dy/Ln,Ln,Wl,Sxc});
  }
  let Sx0=0,W=0;
  for(const L of loads){ if(L[0]<0) Sx0+=L[2]*(-L[0]); W+=L[2]; }
  const ys=[]; for(const j of arch.joints){ys.push(j.a[1],j.b[1]);}
  return {J,Sx0,W,ys};
}
// A trial thrust line is y(x)=b0+sig*x - Sx(x)/H, with b0=yc+Sx0/H (yc=crown height, H=horizontal thrust,
// sig=overall slope/asymmetry). Returns each joint's normalized position t (0=intrados,1=extrados) and the
// worst eccentricity |t-0.5| (0.5 = a face; 1/6 = edge of the middle third).
export function eccOf(P,H,yc,sig){
  const invH=1/H, b0=yc+P.Sx0*invH; let me=0; const ts=[];
  for(const j of P.J){
    const tyc=b0+sig*j.cx-j.Sxc*invH;       // thrust height at the joint's centroid x
    const m=sig-j.Wl*invH;                  // local slope of the thrust line there
    let den=j.uy-m*j.ux; if(Math.abs(den)<1e-9) den=(den<0?-1e-9:1e-9);
    const s=(tyc-j.cy)/den;                 // signed distance centroid->thrust, measured along the joint
    const t=0.5+s/j.Ln;
    ts.push(t); const e=Math.abs(t-0.5); if(e>me) me=e;
  }
  return {maxe:me,ts};
}
// Coulomb sliding along a given trial thrust line, joint by joint (mirrors eccOf).
// The compressive resultant at a joint points along the local thrust slope, direction f=(1,m),
// m = sig − W_left/H (same m as eccOf). The joint has unit direction u=(ux,uy) and unit normal
// n=(−uy,ux). Decompose f: tangential T = f·u = ux+m·uy ; normal N = f·n = m·ux−uy. The ratio
// r = |T|/|N| = |tan(angle between the force and the joint normal)| is independent of |f|. Coulomb:
// the joint does NOT slide iff r ≤ μ (angle-to-normal ≤ friction angle φ = atan μ). Returns each
// joint's r and the worst r across the ring.
export function slideOf(P,H,yc,sig){
  const invH=1/H; let mr=0; const rs=[];
  for(const j of P.J){
    const m=sig-j.Wl*invH;
    const T=j.ux+m*j.uy;                 // f·u  (tangential, along the joint)
    const N=m*j.ux-j.uy;                 // f·n  (normal, across the joint)
    let den=Math.abs(N); if(den<1e-12) den=1e-12;
    const r=Math.abs(T)/den;            // |tan(angle to joint normal)|
    rs.push(r); if(r>mr) mr=r;
  }
  return {maxr:mr,rs};
}
// Heyman's safe theorem: the arch stands iff SOME thrust line fits inside the masonry. Search the funicular
// family (H,yc,sig) coarse-to-fine for the line of least maximum eccentricity.
//
// opts.mu — Coulomb friction coefficient. ABSENT or Infinity ⇒ infinite friction, EXACTLY the original
// hinge-only behaviour (the score below reduces to maxe, so the search is byte-identical). When mu is
// finite the arch must ALSO satisfy no-sliding everywhere: the search minimises the worst COMBINED
// violation — each constraint normalised to its own limit and taken worst-case (∞-norm):
//   score = max( maxe / (1/2) , maxr / mu )   ( ≤ 1 ⇔ both constraints met ).
// This finds a single thrust line admissible for BOTH hinging and sliding if one exists. It is a
// first-order combined criterion, NOT a rigorous coupled non-associative limit analysis (see NOTES §3).
export function solve(arch,extras,passes,opts){
  const P=prep(arch,extras); passes=passes||6;
  const mu = (opts && opts.mu!=null && isFinite(opts.mu)) ? opts.mu : Infinity;
  const useFric = isFinite(mu);
  let Hlo=0.02*P.W, Hhi=60*P.W;
  let ylo=Math.min.apply(null,P.ys)-1.5, yhi=Math.max.apply(null,P.ys)+1.5;
  let slo=-3, shi=3, best=null;
  const nH=26,nY=26,nS=15;
  for(let it=0;it<passes;it++){
    let cand=null;
    for(let ih=0;ih<nH;ih++){
      const H=Hlo*Math.pow(Hhi/Hlo,ih/(nH-1));
      for(let iy=0;iy<nY;iy++){
        const yc=ylo+(yhi-ylo)*iy/(nY-1);
        for(let is=0;is<nS;is++){
          const sig=slo+(shi-slo)*is/(nS-1);
          const r=eccOf(P,H,yc,sig);
          let score, sr=null;
          // With no friction score===r.maxe, so cand selection is identical to the original.
          if(useFric){ sr=slideOf(P,H,yc,sig); score=Math.max(2*r.maxe, sr.maxr/mu); }
          else { score=r.maxe; }
          if(!cand||score<cand.score) cand={score,maxe:r.maxe,H,yc,sig,ts:r.ts,maxr:sr?sr.maxr:0,rs:sr?sr.rs:null};
        }
      }
    }
    best=cand;
    Hlo=best.H*0.6; Hhi=best.H*1.6; ylo=best.yc-0.5; yhi=best.yc+0.5; slo=best.sig-0.4; shi=best.sig+0.4;
  }
  // thrust-line points (one per joint), for drawing
  const pts=[]; const invH=1/best.H, b0=best.yc+P.Sx0*invH;
  for(const j of P.J){
    const tyc=b0+best.sig*j.cx-j.Sxc*invH; const m=best.sig-j.Wl*invH;
    let den=j.uy-m*j.ux; if(Math.abs(den)<1e-9) den=(den<0?-1e-9:1e-9);
    const s=(tyc-j.cy)/den; pts.push([j.cx+s*j.ux, j.cy+s*j.uy]);
  }
  best.points=pts;
  best.stands = best.maxe<=0.5+1e-9 && (!useFric || best.maxr<=mu+1e-9);
  best.comfy = best.maxe<=1/6+1e-9;
  if(useFric){
    best.mu=mu;
    const hinge=[], slide=[];
    for(let i=0;i<best.ts.length;i++){ if(Math.abs(best.ts[i]-0.5)>0.5+1e-9) hinge.push(i); }
    for(let i=0;i<best.rs.length;i++){ if(best.rs[i]>mu+1e-9) slide.push(i); }
    best.hingeJoints=hinge; best.slideJoints=slide;
    const hingeViol=2*best.maxe, slideViol=best.maxr/mu;   // each normalised to its own limit
    best.mode = best.stands ? "stands" : (slideViol>hingeViol ? "slide" : "hinge");
  } else {
    best.mode = best.stands ? "stands" : "hinge";
  }
  return best;
}

// ===================== ABUTMENT / PIER STABILITY  (Phase 2, rung c) =====================
// OPT-IN, off by default. A first-order limit-equilibrium check of the piers that carry the
// arch thrust. solve() is NOT touched: this is a pure post-hoc evaluation of an already-solved
// arch, so the arch-only verdict is byte-identical whether or not you ever call this.
//
// WHAT THE ARCH DELIVERS TO EACH PIER TOP. The chosen thrust line delivers to each springing a
// reaction with a horizontal component = the constant arch thrust H (pushing the pier OUTWARD,
// away from the span) and a vertical component V (that springing's share of the total weight).
// We read the vertical reactions straight from the SAME solved line so H and V are mutually
// consistent (one equilibrium, not a separate half-weight guess): the line is
// y(x)=b0+sig·x−S(x)/H, whose slope is `sig` at the left springing (nothing to its left) and
// `sig−W/H` at the right springing (all weight W to its left). The arch's vertical push on each
// pier is the vertical component of the thrust there:
//     V_left = H·|sig|          V_right = |H·sig − W|            (= W/2 each for a symmetric arch)
// and V_left + V_right = W (total load) by construction.
//
// THE PIER. Each pier is a rigid rectangular block: width b, height h (springing down to the
// foundation), unit depth and unit density ⇒ self-weight Wp = b·h at its centroid. We apply the
// arch reaction (H outward + V down) at the springing, taken as the pier's INNER top edge; the
// pier body extends OUTWARD by b to the outer toe it would overturn about. Taking moments about
// that outer toe (base level, height h below the springing):
//     restoring   = V·b + Wp·(b/2)             (V at the inner edge, arm b; pier weight, arm b/2)
//     overturning = H·h                        (thrust at height h, pushing the pier outward)
// so the vertical base reaction (V+Wp) crosses the base a distance `a` inboard of the toe:
//     a  = ( V·b + Wp·(b/2) − H·h ) / (V + Wp)
// Eccentricity of that crossing from the base centre, normalised to the half-width b/2:
//     ep = |a − b/2| / (b/2)
//     ep ≤ 1/3  → resultant in the middle third (no tension at the base)
//     ep ≤ 1    → resultant within the base: the pier STANDS
//     ep > 1    → resultant has left the base at the toe: the pier OVERTURNS
// Under this outward-only loading `a` only ever moves toward the toe, so a < 0 ⇔ ep > 1.
//
// BASE SLIDING (optional; tied to rung-b friction μ). If opts.mu is finite, the pier also slides
// on its foundation iff the driving thrust beats friction on the whole vertical load:
//     H > μ·(V + Wp)
//
// HONEST LIMITS (see NOTES §3.5): rigid pier, rigid foundation, no settlement, no passive earth
// pressure behind the pier, static limit equilibrium only. This is a FIRST-ORDER decoupled check
// (solve the arch, then load its reaction onto an independent pier), NOT a coupled arch+pier LP —
// pier spread would in reality feed back into the arch thrust, which this does not model.
//
// pier = {b, h}                      applied to both abutments, or
// pier = {left:{b,h}, right:{b,h}}   per-side.
// opts.mu       — finite ⇒ also test base sliding (reuse rung-b μ); absent ⇒ overturning only.
// opts.extras   — the same point-load array passed to solve(), so W includes deck/block loads.
//
// Returns { mu, W, Vleft, Vright, left:{…}, right:{…} } where each side reports:
//   b,h,Wp,V,H, baseResultant_a, ep, overturns, slides, governing ("none"/"overturn"/"slide"),
//   and minStableWidth {bOverturn, bSlide, b} — the smallest width that would keep the pier safe.
export function abutmentStability(arch, sol, pier, opts){
  const mu = (opts && opts.mu!=null && isFinite(opts.mu)) ? opts.mu : Infinity;
  const H = sol.H, sig = sol.sig;
  const Nj = arch.joints.length - 1;                 // last joint index = right springing
  let W = 0; for(const v of arch.vouss) W += v.w;     // total load = Σ voussoir weights …
  if(opts && opts.extras) for(const e of opts.extras) W += e.w;   // … + any point loads solve saw
  const Vleft  = Math.abs(H*sig);                    // vertical reaction from the solved thrust line
  const Vright = Math.abs(H*sig - W);
  const pierL = pier.left  || pier;
  const pierR = pier.right || pier;

  function minStableWidth(V, h){
    // Smallest b with ep ≤ 1 (no overturn): solve (h/2)b² + V·b − H·h = 0 for b > 0.
    const bOverturn = (-V + Math.sqrt(V*V + 2*H*h*h)) / h;
    // Smallest b with H ≤ μ(V + b·h) (no base slide): b ≥ (H/μ − V)/h.
    const bSlide = isFinite(mu) ? Math.max(0, (H/mu - V)/h) : 0;
    return { bOverturn, bSlide, b: Math.max(bOverturn, bSlide) };
  }

  function evalPier(p, V, spr){
    const b = p.b, h = p.h;
    const Wp = b*h;                                  // pier self-weight (unit depth & density)
    const Ntot = V + Wp;                             // total vertical on the base
    const a  = (V*b + Wp*(b/2) - H*h) / Ntot;        // resultant crossing, inboard from outer toe
    const ep = Math.abs(a - b/2) / (b/2);            // eccentricity / half-width
    const overturns = ep > 1 + 1e-9;                 // resultant left the base at the toe (a < 0)
    const slides = isFinite(mu) ? (H > mu*Ntot + 1e-12) : false;
    const overturnViol = ep;                         // both violations normalised to their limit 1
    const slideViol = isFinite(mu) ? H/(mu*Ntot) : 0;
    let governing = "none";
    if(overturns || slides) governing = (slideViol > overturnViol) ? "slide" : "overturn";
    return {
      b, h, Wp, V, H,
      springX: spr ? spr[0] : null, springY: spr ? spr[1] : null,
      baseResultant_a: a, ep, noTension: ep <= 1/3 + 1e-9,
      overturns, slides, governing,
      overturnViol, slideViol,
      minStableWidth: minStableWidth(V, h)
    };
  }

  const ptL = sol.points ? sol.points[0]  : null;
  const ptR = sol.points ? sol.points[Nj] : null;
  return {
    mu, W, Vleft, Vright,
    left:  evalPier(pierL, Vleft,  ptL),
    right: evalPier(pierR, Vright, ptR)
  };
}

// ===================== CHALLENGES (extradosY lives here in the HTML) =====================
export function extradosY(arch,x){ // top surface height of the ring at horizontal position x
  const r=arch.R+arch.t, dx=x-arch.ox, v=r*r-dx*dx;
  return v>0 ? arch.oy+Math.sqrt(v) : arch.oy;
}
