// ===================== VOUSSOIR CATHEDRAL SECTION (searched safe-theorem load-path) =====================
// The finale, and the most honesty-fragile piece in the engine. A Gothic bay in 2-D section is a
// CHAIN of masonry elements that must ALL be simultaneously admissible for ONE choice of the single
// indeterminate thrust: the nave vault → the flying buttress → the pinnacle-loaded buttress pier →
// the ground. The verdict is COMPUTED by a real search for an admissible whole-system equilibrium —
// never scripted, never an assumed split. No line of engine/statics.mjs is modified; this module
// only COMPOSES the already-validated arch solver and the pier moment-about-toe primitive.
//
// ───────────────────────────── THE MODEL (limit analysis / safe theorem) ─────────────────────────
// Horizontal equilibrium of the whole chain forces the horizontal thrust H to be CONSTANT along the
// load path: the nave vault delivers H at its springing, the flyer must CATCH exactly that H and
// walk it (plus its own weight) down to the pier, and the pier must resist that same H at its toe.
// So the single static indeterminate of the whole bay is this one number H. That is the DOF the
// engine searches.
//
//   1. THE NAVE VAULT stands with a FAMILY of thrust lines — a RANGE H ∈ [Hmin, Hmax] of horizontal
//      thrusts for which some line of thrust fits inside the nave ring (Heyman's minimum- and
//      maximum-thrust states). This range IS the indeterminacy. naveThrustRange() computes it by
//      sweeping H and testing each with solveFixedThrust (H pinned). Empty ⇒ the nave can't stand.
//
//   2. THE FLYING BUTTRESS is a half-arch that must ACCEPT the nave's thrust at its upper end: it is
//      solved with H FIXED = the candidate H (not free) — solveFixedThrust searches only the
//      remaining DOF (crown height yc, slope sig). It is admissible iff a thrust line of that fixed
//      H fits within the flyer ring. Its lower (outer) end delivers (H outward, V down) to the pier,
//      V read from the SAME solved line (V = |H·sig − W_flyer|), one equilibrium, not a guess.
//
//   3. THE BUTTRESS PIER, loaded at its top by the flyer's delivered (H, V) PLUS a PINNACLE vertical
//      weight, must not overturn about its outer toe. The pinnacle's weight is the real Gothic
//      structural logic: added vertical load steers the (H, V+pinnacle) resultant DOWN inside the
//      pier instead of out over the toe. Same moment-about-toe / base-eccentricity primitive as
//      abutmentStability (statics.mjs:205), here carrying the STACKED flyer + pinnacle load.
//
// ───────────────────────────── THE VERDICT (a searched safe theorem) ─────────────────────────────
// The bay STANDS iff THERE EXISTS an H in the nave's admissible range such that
//     (nave admissible at H) AND (flyer admissible at fixed H) AND (pier does not overturn under the
//     flyer + pinnacle load).
// solveCathedralSection() SCANS the nave H-range at a documented resolution and returns the FIRST H
// for which all three hold (governing "none"); it reports COLLAPSE iff none exists, naming which
// element governs the failure:
//     "nave"          — the nave has no admissible thrust line at any H (it cannot stand at all);
//     "flyer"         — no flyer line of thrust fits for ANY H in the nave range (the thrust is
//                       uncaught; a removed/absent flyer is the degenerate case, and the un-redirected
//                       nave thrust is shown overturning the bare wall);
//     "pier-overturn" — a flyer line exists for some H, but the pier overturns under every such H.
// Because we only need ONE admissible whole-system equilibrium to EXIST (Heyman's safe/lower-bound
// theorem), a genuine scan that exhibits one — or proves none exists — is the honest computation.
//
// ───────────────────────────── HONEST LIMITS (softer than the arch/dome) ─────────────────────────
// This is a FIRST-ORDER, element-by-element composition, inheriting the decoupled-pier caveat of
// NOTES §3.5: solve each element, hand its reaction to the next. There is NO elastic coupling and NO
// arch↔pier feedback (a spreading pier would in reality lengthen the vault span and change H; a
// rigorous treatment is a coupled whole-frame limit-analysis LP). The pinnacle is lumped at the pier
// centroid; the nave delivers only H to the flyer (its vertical runs down the nave wall). The
// validation is QUALITATIVE-BUT-COMPUTED — there is no single classical constant like the arch's
// t/R ≈ 0.106 or the dome's 0.042 — so the tests assert computed structural TRENDS and the
// pinnacle-on/off verdict flip, with every number printed. Said plainly: the whole-system SEARCH is
// real and the safe-theorem logic is sound; the honesty softness is in the first-order decoupling
// and the qualitative (not single-constant) validation, not in a faked verdict. See NOTES §5.

"use strict";

import { buildArch, prep, eccOf, abutmentStability } from "./statics.mjs";

// ---------------------------------------------------------------------------
// solveFixedThrust(arch, extras, H, passes?)
//   The funicular search with the horizontal thrust H PINNED. Where solve() searches (H, yc, sig)
//   over three DOF, this searches only (yc, sig) — the remaining two — for the line of least maximum
//   eccentricity AT THE GIVEN H. This is exactly the sub-search a downstream element performs when it
//   must ACCEPT an inherited thrust (the flyer catching the nave's H). Admissible ⇔ maxe ≤ 1/2 (the
//   same Heyman safe-theorem test as the arch). Coarse-to-fine over (yc, sig), mirroring solve().
//
//   Returns { stands, maxe, H, yc, sig, ts, points } — like solve() but for the fixed H.
export function solveFixedThrust(arch, extras, H, passes) {
  const P = prep(arch, extras); passes = passes || 6;
  let ylo = Math.min.apply(null, P.ys) - 1.5, yhi = Math.max.apply(null, P.ys) + 1.5;
  let slo = -3, shi = 3, best = null;
  const nY = 26, nS = 15;
  for (let it = 0; it < passes; it++) {
    let cand = null;
    for (let iy = 0; iy < nY; iy++) {
      const yc = ylo + (yhi - ylo) * iy / (nY - 1);
      for (let is = 0; is < nS; is++) {
        const sig = slo + (shi - slo) * is / (nS - 1);
        const r = eccOf(P, H, yc, sig);
        if (!cand || r.maxe < cand.maxe) cand = { maxe: r.maxe, yc, sig, ts: r.ts };
      }
    }
    best = cand;
    ylo = best.yc - 0.5; yhi = best.yc + 0.5; slo = best.sig - 0.4; shi = best.sig + 0.4;
  }
  // thrust-line points (one per joint), for drawing / delivered-reaction reads
  const pts = []; const invH = 1 / H, b0 = best.yc + P.Sx0 * invH;
  for (const j of P.J) {
    const tyc = b0 + best.sig * j.cx - j.Sxc * invH; const m = best.sig - j.Wl * invH;
    let den = j.uy - m * j.ux; if (Math.abs(den) < 1e-9) den = (den < 0 ? -1e-9 : 1e-9);
    const s = (tyc - j.cy) / den; pts.push([j.cx + s * j.ux, j.cy + s * j.uy]);
  }
  return { stands: best.maxe <= 0.5 + 1e-9, maxe: best.maxe, H, yc: best.yc, sig: best.sig, ts: best.ts, points: pts };
}

// ---------------------------------------------------------------------------
// naveThrustRange(arch, extras, opts?) → { Hmin, Hmax, W, found }
//   The [Hmin, Hmax] band of horizontal thrusts for which the nave arch is admissible — its static
//   indeterminacy. Sweep H log-spaced across a wide bracket, test each with solveFixedThrust, and
//   return the admissible interval (Heyman's minimum- and maximum-thrust states bound it; between
//   them the ring stands, so the admissible set is a contiguous interval — the sweep returns
//   [first admissible, last admissible]). found=false ⇒ the nave cannot stand at any H.
//
//   opts: Hlo/Hhi (multiples of total weight W, default 0.02..60 — the same bracket solve() uses),
//         n (samples, default 240), passes (default 6).
export function naveThrustRange(arch, extras, opts) {
  opts = opts || {};
  const P = prep(arch, extras);
  const W = P.W;
  const Hlo = (opts.Hlo != null ? opts.Hlo : 0.02) * W;
  const Hhi = (opts.Hhi != null ? opts.Hhi : 60) * W;
  const n = opts.n || 240;
  const passes = opts.passes || 6;
  let Hmin = null, Hmax = null;
  for (let i = 0; i < n; i++) {
    const H = Hlo * Math.pow(Hhi / Hlo, i / (n - 1));
    if (solveFixedThrust(arch, extras, H, passes).stands) {
      if (Hmin === null) Hmin = H;
      Hmax = H;
    }
  }
  return { Hmin, Hmax, W, found: Hmin !== null };
}

// ---------------------------------------------------------------------------
// pierOverturn({b, h}, H, loads) → { a, ep, overturns, N, Wp, Mrest, Mover }
//   The moment-about-outer-toe / base-eccentricity primitive (identical formula to
//   abutmentStability, statics.mjs:228), generalised to carry a STACK of vertical loads at the pier
//   top. The pier is a rigid rectangular block width b, height h, unit depth & density ⇒ self-weight
//   Wp = b·h at its centroid (arm b/2 from the outer toe). Each applied vertical load i contributes a
//   restoring moment Vi·armi; the horizontal thrust H acts at the pier top (height h), the sole
//   overturning moment H·h. The base reaction crosses a distance `a` inboard of the outer toe:
//       a  = ( Σ Vi·armi + Wp·(b/2) − H·h ) / ( Σ Vi + Wp )
//       ep = |a − b/2| / (b/2)     ep ≤ 1 ⇒ resultant within the base, pier STANDS; ep > 1 ⇒ OVERTURNS.
//   loads = [{ V, arm }] measured from the OUTER toe (arm = b at the inner top edge, b/2 at centroid).
export function pierOverturn(pier, H, loads) {
  const b = pier.b, h = pier.h;
  const Wp = b * h;
  let sumV = 0, Mrest = 0;
  for (const L of loads) { sumV += L.V; Mrest += L.V * L.arm; }
  Mrest += Wp * (b / 2);
  const Mover = H * h;
  const N = sumV + Wp;
  const a = (Mrest - Mover) / N;
  const ep = Math.abs(a - b / 2) / (b / 2);
  return { a, ep, overturns: ep > 1 + 1e-9, noTension: ep <= 1 / 3 + 1e-9, N, Wp, Mrest, Mover };
}

// ---------------------------------------------------------------------------
// solveCathedralSection(spec) → { stands, chosenH, nave, flyer, pier, governing, naveRange }
//   The composer. Computes the nave's admissible H-range, then SCANS it for an H at which the flyer
//   (fixed-H) is admissible AND the pier (flyer + pinnacle load) does not overturn. Returns the first
//   admissible whole-system H (governing "none"), or COLLAPSE with the governing element named.
//
//   spec = {
//     nave:    { arch, extras? }            — the nave vault ring (buildArch) and any point loads
//     flyer:   { arch, extras? } | null     — the flying buttress ring; null ⇒ REMOVED (no catcher)
//     pier:    { b, h }                     — buttress pier: width b, height h to the flyer landing
//     pinnacle: number                      — pinnacle vertical weight on the pier top (0 ⇒ none)
//     naveSpringHeight?: number             — height of the nave springing above ground; used ONLY in
//                                             the no-flyer case to show the un-redirected nave thrust
//                                             overturning the bare wall (defaults to pier.h).
//     hSteps?: number (default 160)         — resolution of the H scan across [Hmin, Hmax]
//     passes?: number (default 6)           — funicular refinement passes
//     naveSamples?: number (default 240)    — nave H-range sweep samples
//     pinnacleArm?: number (default b/2)    — pinnacle load arm from the outer toe (centroid default)
//   }
export function solveCathedralSection(spec) {
  const passes = spec.passes || 6;
  const hSteps = spec.hSteps || 160;
  const pier = spec.pier;
  const pinW = spec.pinnacle || 0;
  const pinArm = spec.pinnacleArm != null ? spec.pinnacleArm : pier.b / 2;

  // (1) The nave's admissible horizontal-thrust range — its indeterminacy.
  const naveRange = naveThrustRange(spec.nave.arch, spec.nave.extras, { passes, n: spec.naveSamples || 240 });
  const naveOut = { admissible: naveRange.found, Hmin: naveRange.Hmin, Hmax: naveRange.Hmax, W: naveRange.W };
  if (!naveRange.found) {
    return { stands: false, chosenH: null, governing: "nave", nave: naveOut, flyer: null, pier: null, naveRange };
  }
  const Hmin = naveRange.Hmin, Hmax = naveRange.Hmax;

  // --- Flyer removed: the nave thrust is UNCAUGHT — the load path has a gap, so by the safe theorem
  // --- no whole-system equilibrium exists. We make that computed and legible by showing the
  // --- un-redirected nave thrust acting on the bare clerestory wall (width b, standing to the full
  // --- nave springing height) with ONLY its own weight — the flyer's stabilising vertical and the
  // --- pinnacle both belong to the removed buttress assembly, so neither resists here. With no
  // --- applied top load the wall's base eccentricity is ep = 2H/b² (independent of height: pier
  // --- weight and overturning moment both scale with h), and it overturns decisively across the
  // --- whole nave range. governing = "flyer".
  if (!spec.flyer) {
    const hWall = spec.naveSpringHeight != null ? spec.naveSpringHeight : pier.h;
    // Worst (smallest) ep over the range — if even the best H overturns, the bare wall cannot stand.
    let bestEp = Infinity, atH = null;
    for (let i = 0; i <= hSteps; i++) {
      const H = Hmin + (Hmax - Hmin) * (hSteps ? i / hSteps : 0);
      const po = pierOverturn({ b: pier.b, h: hWall }, H, []);   // bare wall: self-weight only
      if (po.ep < bestEp) { bestEp = po.ep; atH = H; }
    }
    const stands = bestEp <= 1 + 1e-9;
    return {
      stands, chosenH: stands ? atH : null,
      governing: stands ? "none" : "flyer",
      nave: naveOut,
      flyer: { present: false, admissibleSomewhere: false },
      pier: { wall: true, h: hWall, epBest: bestEp, atH, overturns: !stands },
      naveRange,
    };
  }

  // (2) Scan the nave H-range for an admissible whole-system equilibrium.
  const flyerArch = spec.flyer.arch, flyerExtras = spec.flyer.extras || null;
  let Wflyer = 0; for (const v of flyerArch.vouss) Wflyer += v.w;
  if (flyerExtras) for (const e of flyerExtras) Wflyer += e.w;

  let anyFlyerOK = false;
  let bestPier = null;          // track the least-eccentric pier among flyer-OK H (for reporting)
  let flyerSample = null;       // a representative flyer solution (for reporting)
  for (let i = 0; i <= hSteps; i++) {
    const H = Hmin + (Hmax - Hmin) * (hSteps ? i / hSteps : 0);
    const fs = solveFixedThrust(flyerArch, flyerExtras, H, passes);
    if (!flyerSample) flyerSample = fs;
    if (!fs.stands) continue;
    anyFlyerOK = true;
    flyerSample = fs;
    // Vertical the flyer dumps on the pier: the outer-end (higher-x, pier side) reaction of the same line.
    const Vflyer = Math.abs(H * fs.sig - Wflyer);
    const loads = [{ V: Vflyer, arm: pier.b }];               // flyer lands at the inner top edge (arm b)
    if (pinW) loads.push({ V: pinW, arm: pinArm });           // pinnacle at the pier centroid (arm b/2)
    const po = pierOverturn(pier, H, loads);
    if (!bestPier || po.ep < bestPier.ep) bestPier = { ...po, H, Vflyer };
    if (!po.overturns) {
      return {
        stands: true, chosenH: H, governing: "none",
        nave: naveOut,
        flyer: { present: true, admissible: true, H, sig: fs.sig, maxe: fs.maxe, Vdelivered: Vflyer, Wflyer },
        pier: { ...po, H, Vflyer, Vpinnacle: pinW },
        naveRange,
      };
    }
  }

  // (3) No admissible whole-system H. Name the governing failure.
  const governing = anyFlyerOK ? "pier-overturn" : "flyer";
  return {
    stands: false, chosenH: null, governing,
    nave: naveOut,
    flyer: {
      present: true, admissible: false, admissibleSomewhere: anyFlyerOK,
      maxe: flyerSample ? flyerSample.maxe : null, Wflyer,
    },
    pier: bestPier ? { ...bestPier, Vpinnacle: pinW } : null,
    naveRange,
  };
}

// ---------------------------------------------------------------------------
// Re-export the pier primitive we compose so callers can cross-check the no-pinnacle case against the
// validated abutmentStability (they must agree — same moment-about-toe formula).
export { abutmentStability };
