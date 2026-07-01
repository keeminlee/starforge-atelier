// ===================== VOUSSOIR RENDERER =====================
// Pure canvas drawing, factored out of the v0 game (voussoir.html) VERBATIM in visual
// language — same charcoal/parchment/brass/gold palette, the gold thrust glow, the
// per-joint eccentricity coloring (gold <=1/6, brass <=1/2, rust >1/2: the middle-third
// legend), and the four-hinge fold choreography of the collapse.
//
// Every function takes (ctx, view, ...data). No game state, no DOM queries, no globals:
// it draws ANY arch produced by ../engine/statics.mjs, not the four fixed challenges.
// The view transform lives in ./view.mjs (WX/WY/fitCanvas).
//
// Honesty note: the stand/fall VERDICT and the thrust line are the real computation
// (they come from solve()); the collapse MOTION is the documented v0 choreography cut
// (illustrative fold + drop, not solved rigid-body dynamics). See voussoir.NOTES.md §3.

"use strict";

import { WX, WY, fitCanvas } from "./view.mjs";

// ---- palette / eccentricity coloring -------------------------------------------------
// e = |t-0.5|: gold within the middle third, brass within the section, rust once hinged.
export function statusColor(e) { return e <= 1 / 6 ? "#d9b65a" : (e <= 0.5 ? "#b08d57" : "#b04a36"); }

function stoneFill(i, n) {
  const lo = [203, 191, 159], hi = [227, 216, 189];
  const j = 0.5 + 0.5 * Math.sin(i * 2.7);
  const mix = k => Math.round(lo[k] + (hi[k] - lo[k]) * (0.45 + 0.5 * j));
  return "rgb(" + mix(0) + "," + mix(1) + "," + mix(2) + ")";
}

function transformPoly(poly, tr) {
  if (!tr) return poly;
  return poly.map(p => {
    let x = p[0] - tr.px, y = p[1] - tr.py;
    const c = Math.cos(tr.a), s = Math.sin(tr.a);
    return [tr.px + x * c - y * s + tr.dx, tr.py + x * s + y * c + tr.dy];
  });
}

// ---- background / stage --------------------------------------------------------------
export function clear(ctx, view) {
  ctx.clearRect(0, 0, view.w, view.h);
  // soft parchment glow behind the arch
  const g = ctx.createRadialGradient(WX(view, 0), WY(view, 2), 20, WX(view, 0), WY(view, 2), view.w * 0.5);
  g.addColorStop(0, "rgba(233,225,204,.06)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
}

export function drawGround(ctx, view) {
  const DPR = view.DPR;
  ctx.fillStyle = "#1b1c21";
  ctx.fillRect(0, WY(view, 0.02), view.w, view.h - WY(view, 0.02));
  // springing / ground line
  ctx.strokeStyle = "#473f33"; ctx.lineWidth = 2 * DPR;
  ctx.beginPath(); ctx.moveTo(0, WY(view, 0)); ctx.lineTo(view.w, WY(view, 0)); ctx.stroke();
  // hatching
  ctx.strokeStyle = "rgba(90,80,60,.25)"; ctx.lineWidth = 1 * DPR;
  for (let x = -6; x < 6; x += 0.5) { ctx.beginPath(); ctx.moveTo(WX(view, x), WY(view, 0)); ctx.lineTo(WX(view, x + 0.3), WY(view, -0.4)); ctx.stroke(); }
}

// Piers under the two abutment joints of any arch.
export function drawPiers(ctx, view, arch) {
  if (!arch.joints.length) return;
  const DPR = view.DPR;
  const left = arch.joints[0], right = arch.joints[arch.joints.length - 1];
  const baseY = view.bounds.y0 + 0.05;
  for (const j of [left, right]) {
    const inn = j.a, out = j.b;
    ctx.beginPath();
    ctx.moveTo(WX(view, inn[0]), WY(view, inn[1]));
    ctx.lineTo(WX(view, out[0]), WY(view, out[1]));
    const outx = out[0] + (out[0] > 0 ? 0.55 : -0.55);
    const innx = inn[0] + (inn[0] > 0 ? 0.30 : -0.30);
    ctx.lineTo(WX(view, outx), WY(view, baseY));
    ctx.lineTo(WX(view, innx), WY(view, baseY));
    ctx.closePath();
    const g = ctx.createLinearGradient(0, WY(view, 2), 0, WY(view, baseY));
    g.addColorStop(0, "#39383e"); g.addColorStop(1, "#26252a");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "#15151a"; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
    // a few courses
    ctx.strokeStyle = "rgba(20,20,26,.6)"; ctx.lineWidth = 1 * DPR;
    for (let yy = 0.6; yy < 2.4; yy += 0.6) {
      const xa = inn[0] + (inn[0] > 0 ? 0.30 : -0.30), xb = out[0] + (out[0] > 0 ? 0.55 : -0.55);
      if (yy > Math.min(inn[1], out[1])) continue;
      ctx.beginPath(); ctx.moveTo(WX(view, Math.min(xa, xb)), WY(view, yy)); ctx.lineTo(WX(view, Math.max(xa, xb)), WY(view, yy)); ctx.stroke();
    }
  }
}

// The voussoir ring. `collapse` (optional) supplies per-stone transforms/alpha for the fold.
export function drawArch(ctx, view, arch, collapse) {
  const DPR = view.DPR;
  const n = arch.vouss.length;
  for (let i = 0; i < n; i++) {
    const v = arch.vouss[i];
    let tr = null, alpha = 1;
    if (collapse) { tr = collapse.stones[i].tr; alpha = collapse.stones[i].alpha; }
    const poly = transformPoly(v.poly, tr);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(WX(view, poly[0][0]), WY(view, poly[0][1]));
    for (let k = 1; k < poly.length; k++) ctx.lineTo(WX(view, poly[k][0]), WY(view, poly[k][1]));
    ctx.closePath();
    const mid = v.poly[0], top = v.poly[3];
    const g = ctx.createLinearGradient(0, WY(view, top[1]), 0, WY(view, mid[1]));
    g.addColorStop(0, stoneFill(i, n)); g.addColorStop(1, "#bdb094");
    ctx.fillStyle = g; ctx.fill();
    const isKey = (i === Math.floor(n / 2) && n % 2 === 1);
    ctx.strokeStyle = isKey ? "#7a6a44" : "#5a5446"; ctx.lineWidth = (isKey ? 1.8 : 1.2) * DPR; ctx.stroke();
    if (isKey) { ctx.strokeStyle = "rgba(217,182,90,.5)"; ctx.lineWidth = 1 * DPR; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}

// Point-load blocks sitting on the arch back. `collapse` (optional) folds/drops them.
export function drawLoadBlock(ctx, view, extras, collapse) {
  if (!extras) return;
  const DPR = view.DPR, scale = view.scale;
  for (const e of extras) {
    if (!e.block) continue;
    const w = 0.62, h = 0.5;
    const cx = e.x, cy = e.y + h / 2;
    let ang = 0, dx = 0, dy = 0, alpha = 1;
    if (collapse && collapse.load) { ang = collapse.load.a; dx = collapse.load.dx; dy = collapse.load.dy; alpha = collapse.load.alpha; }
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(WX(view, cx) + dx * scale, WY(view, cy) - dy * scale); ctx.rotate(ang);
    ctx.beginPath();
    ctx.rect(-w / 2 * scale, -h / 2 * scale, w * scale, h * scale);
    const g = ctx.createLinearGradient(0, -h / 2 * scale, 0, h / 2 * scale);
    g.addColorStop(0, "#42506a"); g.addColorStop(1, "#2c3647");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "#1b2330"; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
    ctx.fillStyle = "rgba(217,182,90,.85)"; ctx.font = (11 * DPR) + "px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("load", 0, 0);
    ctx.restore();
  }
  ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
}

// The line of thrust + per-joint thrust dots + hinge rings where it exits the stone.
// `sol` is the solve() result (needs .points and .ts). `reveal` in [0,1] draws it
// progressively (for the stand-reveal animation); undefined = fully drawn.
export function drawThrust(ctx, view, arch, sol, reveal) {
  if (!sol) return;
  const DPR = view.DPR;
  const pts = sol.points, ts = sol.ts;
  const upto = reveal === undefined ? pts.length : Math.max(2, Math.floor(reveal * pts.length));
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < Math.min(upto, pts.length) - 1; i++) {
      const e = Math.max(Math.abs(ts[i] - 0.5), Math.abs(ts[i + 1] - 0.5));
      ctx.beginPath();
      ctx.moveTo(WX(view, pts[i][0]), WY(view, pts[i][1]));
      ctx.lineTo(WX(view, pts[i + 1][0]), WY(view, pts[i + 1][1]));
      if (pass === 0) { ctx.strokeStyle = "rgba(217,182,90,.18)"; ctx.lineWidth = 9 * DPR; }
      else { ctx.strokeStyle = statusColor(e); ctx.lineWidth = 2.6 * DPR; }
      ctx.stroke();
    }
  }
  for (let i = 0; i < Math.min(upto, pts.length); i++) {
    const e = Math.abs(ts[i] - 0.5);
    ctx.beginPath(); ctx.arc(WX(view, pts[i][0]), WY(view, pts[i][1]), 2.4 * DPR, 0, 7); ctx.fillStyle = statusColor(e); ctx.fill();
    if (e > 0.5) { // thrust left the stone here: mark the hinge at the face it exited
      const j = arch.joints[i]; const face = ts[i] < 0 ? j.a : j.b;
      ctx.beginPath(); ctx.arc(WX(view, face[0]), WY(view, face[1]), 5.5 * DPR, 0, 7);
      ctx.strokeStyle = "#e06a52"; ctx.lineWidth = 2 * DPR; ctx.stroke();
      ctx.beginPath(); ctx.arc(WX(view, face[0]), WY(view, face[1]), 2 * DPR, 0, 7); ctx.fillStyle = "#e06a52"; ctx.fill();
    }
  }
  ctx.lineCap = "butt";
}

// Persistent hinge rings drawn during the fold (the joints where the best line exited).
export function drawHinges(ctx, view, arch, collapse) {
  if (!collapse) return;
  const DPR = view.DPR;
  for (let i = 0; i < collapse.startTs.length; i++) {
    if (Math.abs(collapse.startTs[i] - 0.5) > 0.5) {
      const j = arch.joints[i]; const face = collapse.startTs[i] < 0 ? j.a : j.b;
      ctx.beginPath(); ctx.arc(WX(view, face[0]), WY(view, face[1]), 5 * DPR, 0, 7);
      ctx.strokeStyle = "#e06a52"; ctx.lineWidth = 2 * DPR; ctx.stroke();
    }
  }
}

// ---- collapse choreography (the documented v0 cut) -----------------------------------
function easeIn(t) { return t * t; }

// Build the fold mechanism from the failing solution: split the ring into rigid links at
// the hinge joints (where the optimal thrust line exits the stone) and assign each stone a
// fold direction + pivot. Pure geometry; ported verbatim from v0 foldCollapse().
export function computeCollapse(arch, sol) {
  const hinge = [];
  for (let i = 0; i < sol.ts.length; i++) if (Math.abs(sol.ts[i] - 0.5) > 0.5) hinge.push(i);
  if (hinge.length === 0) { // safety: take the single worst joint
    let wi = 0; for (let i = 1; i < sol.ts.length; i++) if (Math.abs(sol.ts[i] - 0.5) > Math.abs(sol.ts[wi] - 0.5)) wi = i; hinge.push(wi);
  }
  const n = arch.vouss.length;
  const bounds = [0, ...hinge, n]; // joint indices bounding rigid links
  const stones = [];
  for (let i = 0; i < n; i++) {
    let link = 0; for (let b = 0; b < bounds.length - 1; b++) { if (i >= bounds[b] && i < bounds[b + 1]) { link = b; break; } }
    const dir = (link % 2 === 0) ? 1 : -1;
    const hj = (link % 2 === 0) ? bounds[link] : bounds[link + 1];
    const jp = arch.joints[Math.max(0, Math.min(arch.joints.length - 1, hj))];
    const pivot = [(jp.a[0] + jp.b[0]) / 2, (jp.a[1] + jp.b[1]) / 2];
    stones.push({ dir, pivot, link, alpha: 1, tr: { px: pivot[0], py: pivot[1], a: 0, dx: 0, dy: 0 } });
  }
  return { stones, load: { a: 0, dx: 0, dy: 0, alpha: 1 }, startTs: sol.ts.slice() };
}

// Advance the fold to normalized progress u in [0,1]. Mutates collapse.stones/load
// transforms in place. Verbatim kinematics from v0 foldCollapse()'s step().
export function stepCollapse(collapse, u) {
  const fold = Math.min(1, u / 0.55);          // first: the mechanism rotates
  const fall = Math.max(0, (u - 0.45) / 0.55); // then: everything drops
  for (const s2 of collapse.stones) {
    s2.tr.a = s2.dir * 0.42 * easeIn(fold) + s2.dir * 0.5 * fall * fall;
    s2.tr.dx = 0;
    s2.tr.dy = -3.6 * fall * fall;
    s2.alpha = 1 - 0.85 * Math.max(0, (u - 0.6) / 0.4);
  }
  if (collapse.load) {
    collapse.load.a = 0.5 * fall * fall;
    collapse.load.dy = -3.6 * fall * fall;
    collapse.load.alpha = 1 - 0.85 * Math.max(0, (u - 0.6) / 0.4);
  }
}

// ---- one-call scene composition ------------------------------------------------------
// Draws a full frame given the current data. `state`:
//   { arch, sol, extras, collapse, mode, reveal }
// mode: "edit" (faint live thrust preview) | "revealing"/"stood" (thrust at `reveal`) |
//       "collapsing"/"collapsed" (fold + persistent hinge rings, no thrust line).
export function drawScene(ctx, view, canvas, state) {
  fitCanvas(canvas, view);
  const { arch, sol, extras, collapse, mode, reveal } = state;
  clear(ctx, view);
  drawGround(ctx, view);
  if (arch) {
    drawPiers(ctx, view, arch);
    drawArch(ctx, view, arch, collapse);
    drawLoadBlock(ctx, view, extras, collapse);
    if (collapse) {
      drawHinges(ctx, view, arch, collapse);
    } else if (mode === "edit") {
      ctx.globalAlpha = 0.55; drawThrust(ctx, view, arch, sol); ctx.globalAlpha = 1;
    } else if (mode === "revealing" || mode === "stood") {
      drawThrust(ctx, view, arch, sol, reveal);
    }
  }
}
