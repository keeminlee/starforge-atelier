// lens-core.mjs — the optics engine for Lantern-Lens, pure.
//
// A single ray leaves the lantern and is traced segment-by-segment against the
// scene: it reflects off mirrors and refracts through glass by the real 2D
// Snell law (with total internal reflection past the critical angle), until it
// reaches the wick, escapes the frame, or spends its bounce budget. No DOM, no
// clock, no randomness — the beam goes exactly where the physics sends it, so
// "the wick lights" is a geometric fact. The page and lens-verify.mjs both run
// THIS trace.
//
// A scene: { lantern:{x,y,angle}, pieces:[...], wick:{x,y,r}, bounds:{w,h} }
//   mirror piece: { type:'mirror', a:{x,y}, b:{x,y} }
//   glass  piece: { type:'glass', cx,cy, w,h, angle, n? }   (a refractive slab)

export const GLASS_N = 1.5;   // refractive index of the parchment-glass
const EPS = 1e-6;
const NUDGE = 1e-4;           // step off a surface after a hit to avoid re-hitting it

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };

// unit direction from an angle (radians)
export const dirOf = (angle) => ({ x: Math.cos(angle), y: Math.sin(angle) });

// rotate point p around center c by angle
function rot(p, c, angle) {
  const s = Math.sin(angle), co = Math.cos(angle), dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * co - dy * s, y: c.y + dy * co + dx * s };
}

// A glass rectangle → four oriented segments, each carrying the outward normal.
function glassSegments(g) {
  const c = { x: g.cx, y: g.cy }, hw = g.w / 2, hh = g.h / 2, a = g.angle || 0;
  const corners = [
    { x: g.cx - hw, y: g.cy - hh }, { x: g.cx + hw, y: g.cy - hh },
    { x: g.cx + hw, y: g.cy + hh }, { x: g.cx - hw, y: g.cy + hh },
  ].map((p) => rot(p, c, a));
  const segs = [];
  for (let i = 0; i < 4; i++) {
    const A = corners[i], B = corners[(i + 1) % 4];
    // outward normal = perpendicular to edge, pointing away from center
    let nrm = norm({ x: -(B.y - A.y), y: B.x - A.x });
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    if (dot(nrm, sub(mid, c)) < 0) nrm = mul(nrm, -1);
    segs.push({ a: A, b: B, nrm, material: 'glass', n: g.n || GLASS_N });
  }
  return segs;
}

function sceneSegments(scene) {
  const segs = [];
  for (const p of scene.pieces || []) {
    if (p.type === 'mirror') {
      let nrm = norm({ x: -(p.b.y - p.a.y), y: p.b.x - p.a.x });
      segs.push({ a: p.a, b: p.b, nrm, material: p.wall ? 'wall' : 'mirror' });
    } else if (p.type === 'glass') {
      segs.push(...glassSegments(p));
    }
  }
  return segs;
}

// ray (o,d) vs segment (a,b) → t along the ray (>EPS) or null
function raySeg(o, d, a, b) {
  const e = sub(b, a);
  const denom = d.x * e.y - d.y * e.x;
  if (Math.abs(denom) < EPS) return null;         // parallel
  const diff = sub(a, o);
  const t = (diff.x * e.y - diff.y * e.x) / denom; // along ray
  const u = (diff.x * d.y - diff.y * d.x) / denom; // along segment
  if (t > EPS && u >= -EPS && u <= 1 + EPS) return t;
  return null;
}

// closest point distance from segment to a circle center (for the wick test)
function segHitsCircle(a, b, c, r) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(c, a), ab) / (dot(ab, ab) || 1)));
  const p = add(a, mul(ab, t));
  return len(sub(p, c)) <= r;
}

// mirror reflection of unit dir d about unit normal nrm
function reflect(d, nrm) { return norm(sub(d, mul(nrm, 2 * dot(d, nrm)))); }

// 2D Snell refraction. d = incident unit dir; nrm = surface unit normal;
// n1→n2 chosen by which side the ray comes from. Returns the new unit dir
// (refracted, or reflected if total internal reflection).
function refract(d, nrm, indexN) {
  // orient normal against the incoming ray; pick n1/n2 by entering vs exiting
  let n = nrm, cosi = dot(d, nrm);
  let n1 = 1, n2 = indexN;
  if (cosi > 0) { n = mul(nrm, -1); n1 = indexN; n2 = 1; }  // exiting glass
  else cosi = -cosi;
  const eta = n1 / n2;
  const sin2t = eta * eta * (1 - cosi * cosi);
  if (sin2t > 1) return { dir: reflect(d, n), tir: true };   // total internal reflection
  const cost = Math.sqrt(1 - sin2t);
  return { dir: norm(add(mul(d, eta), mul(n, eta * cosi - cost))), tir: false };
}

// Trace the lantern's ray through the scene.
// Returns { path:[{x,y}...], lit:boolean, bounces, escaped, tir }.
export function trace(scene, budget = 40) {
  const segs = sceneSegments(scene);
  const W = scene.bounds.w, H = scene.bounds.h;
  let o = { x: scene.lantern.x, y: scene.lantern.y };
  let d = dirOf(scene.lantern.angle);
  const path = [{ ...o }];
  let lit = false, escaped = false, tirCount = 0;
  let b = 0;
  for (; b < budget; b++) {
    // nearest surface hit ahead
    let best = Infinity, hitSeg = null;
    for (const s of segs) {
      const t = raySeg(o, d, s.a, s.b);
      if (t !== null && t < best) { best = t; hitSeg = s; }
    }
    // distance to frame exit (so the drawn ray stops at the wall)
    const tw = frameExit(o, d, W, H);
    const stop = Math.min(best, tw ?? Infinity);
    const end = add(o, mul(d, stop));

    // did this segment reach the wick?
    if (segHitsCircle(o, end, scene.wick, scene.wick.r)) {
      // clip the path to the wick center for a clean finish
      path.push({ ...scene.wick, x: scene.wick.x, y: scene.wick.y });
      lit = true; break;
    }
    path.push({ ...end });

    if (hitSeg && best <= (tw ?? Infinity)) {
      if (hitSeg.material === 'wall') { break; }  // opaque — the beam dies here (dark)
      // apply the material rule and continue
      let nd;
      if (hitSeg.material === 'mirror') nd = reflect(d, hitSeg.nrm);
      else { const r = refract(d, hitSeg.nrm, hitSeg.n); nd = r.dir; if (r.tir) tirCount++; }
      d = nd;
      o = add(end, mul(d, NUDGE));  // step off the surface
    } else { escaped = true; break; } // left the frame
  }
  return { path, lit, bounces: b, escaped, tir: tirCount };
}

// parametric distance for the ray to leave the [0,W]x[0,H] frame
function frameExit(o, d, W, H) {
  let t = Infinity;
  if (d.x > EPS) t = Math.min(t, (W - o.x) / d.x);
  else if (d.x < -EPS) t = Math.min(t, (0 - o.x) / d.x);
  if (d.y > EPS) t = Math.min(t, (H - o.y) / d.y);
  else if (d.y < -EPS) t = Math.min(t, (0 - o.y) / d.y);
  return t === Infinity ? null : t;
}

// convenience: does this scene solve? (the falsifiable predicate)
export const solves = (scene, budget = 40) => trace(scene, budget).lit;
