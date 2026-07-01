// ===================== VOUSSOIR DOME PHYSICS (sliced-lune) =====================
// A first-order sliced-lune (Heyman) lower bound for a cracked hemispherical dome —
// conservative, membrane, axisymmetric. THE PHYSICS IS HONEST: this is a rigorous
// Heyman lower bound, computed by the SAME proven arch solver (engine/statics.mjs),
// never faked. No line of statics.mjs is modified.
//
// THE IDEA (Heyman's sliced dome). A dome carries load two ways at once: a MERIDIONAL
// thrust N_phi (crown→base, always compression, like an arch) and a HOOP force N_theta
// (circumferential). For a hemisphere under self-weight the hoop force goes TENSILE below
// phi ≈ 51.8° from the crown, so a masonry dome cannot resist it and CRACKS along its
// meridians into "orange-segment" lunes. A dome does not hinge like an arch — it SPLITS,
// and the cracked lunes then act as arches.
//
// Assume the dome has ALREADY cracked meridionally (take no hoop tension, and —
// conservatively — credit NO hoop compression either). By axisymmetry, analyse ONE
// diametral lune: base → up over the pole → down to the opposite base. That lune is a
// VARIABLE-WIDTH PLANE ARCH — geometrically the same semicircular ring as a plane arch of
// the same radius, but with each voussoir's WEIGHT scaled by the circumferential band width
// (∝ sin phi, zero at the pole, max at the base). That single change to the weights is the
// entire physics extension: buildDomeMeridian returns the SAME {vouss,joints,R,t,ox,oy}
// shape as buildArch, so prep / eccOf / slideOf / solve consume it VERBATIM.
//
// WHY IT IS A RIGOROUS LOWER BOUND. Ignoring hoop compression throws away a stabilising
// effect. So if the cracked, hoop-free dome stands (a meridional thrust line lies within
// the shell at every parallel joint — the identical Heyman safe-theorem test the arch uses),
// the real dome stands at least as well. The un-credited hoop compression is the honest
// "I don't know" kept inside the instrument: the bound is deliberately conservative.
//
// See voussoir.NOTES.md §"DOME" for the full honesty ledger. Pure computation, no DOM.

"use strict";

import { buildArch, solve } from "./statics.mjs";

// ---------------------------------------------------------------------------
// buildDomeMeridian(R, t, N, opts?)
//   Build the diametral lune of a hemispherical dome as a variable-width plane arch:
//   the SAME semicircular ring geometry as buildArch([-R,0],[R,0],[0,R],t,N), but each
//   voussoir's weight is the circumferential-band weight of its meridian segment
//   instead of the plane cross-sectional area.
//
//   The mid-surface band area of the lune segment spanning meridian angles [phi_a,phi_b]
//   (phi measured from the crown/pole) is, by Archimedes' hat-box theorem, proportional to
//   |cos phi_a − cos phi_b| (constants R², t and the lune's angular width drop out — only the
//   RELATIVE weights matter to the thrust line). In the arch's own (ox,oy) frame the pole sits
//   at the top and cos phi = sin(ang), where `ang` is the standard polar angle of the joint,
//   so the band weight is simply |sin(ang_k) − sin(ang_{k+1})| — exact, not lumped-per-strip.
//
//   The weight is lumped at the SAME planar wedge centroid buildArch computes (the sliced
//   lune is a thin sliver following the meridian, so its centre of mass sits on the meridian
//   arc — this is the point-load form prep already consumes).
//
//   opts.oculusPhi (radians, angle from the pole): open-crown (Pantheon) variant. Removes the
//   crown cap voussoirs and their interior joints with phi < oculusPhi, leaving the two lunes
//   running from the oculus rim down to the base. Over the opening the meridional thrust runs
//   straight across at constant H — the honest stand-in for the oculus compression ring
//   carrying the reaction (the ring's hoop force itself is NOT credited, same conservative
//   spirit as the un-credited hoop compression). See the honesty ledger.
//
//   Returns the buildArch-compatible { vouss, joints, R, t, ox, oy } so solve() runs UNCHANGED.
export function buildDomeMeridian(R, t, N, opts) {
  opts = opts || {};
  const arch = buildArch([-R, 0], [R, 0], [0, R], t, N);

  // Override each voussoir's weight with its circumferential band weight (∝ band area).
  const cphi = arch.joints.map(j => {
    const ang = Math.atan2(j.a[1] - arch.oy, j.a[0] - arch.ox);
    return Math.sin(ang);                      // cos(phi from pole) in the arch frame
  });
  for (let k = 0; k < N; k++) {
    arch.vouss[k].w = Math.abs(cphi[k] - cphi[k + 1]);   // exact mid-surface band area of the segment
  }

  // Optional oculus: drop the crown cap (phi < oculusPhi) — voussoirs and their interior joints.
  if (opts.oculusPhi != null && opts.oculusPhi > 0) {
    const oc = opts.oculusPhi;
    const phiOf = ang => Math.abs(ang - Math.PI / 2);        // angle from the pole (crown at ang=π/2)
    const keepJoint = [];
    for (let k = 0; k <= N; k++) {
      const ang = Math.atan2(arch.joints[k].a[1] - arch.oy, arch.joints[k].a[0] - arch.ox);
      keepJoint[k] = phiOf(ang) >= oc - 1e-9;               // keep rim + base-ward joints
    }
    const keptVouss = [];
    for (let k = 0; k < N; k++) {
      // voussoir k lies between joints k and k+1; keep it iff both its joints survive
      if (keepJoint[k] && keepJoint[k + 1]) keptVouss.push(arch.vouss[k]);
    }
    const keptJoints = arch.joints.filter((_, k) => keepJoint[k]);
    arch.vouss = keptVouss;
    arch.joints = keptJoints;
  }

  return arch;
}

// ---------------------------------------------------------------------------
// domeMembrane(phi, opts?) → { Nphi, Ntheta }
//   Closed-form membrane forces (force per unit length) of a hemispherical shell of radius R
//   under self-weight w per unit area, at angle phi from the crown/pole:
//
//       Nphi   = − w·R / (1 + cos phi)                     (meridional)
//       Ntheta =   w·R · [ 1/(1 + cos phi) − cos phi ]     (hoop)
//
//   SIGN CONVENTION: negative = COMPRESSION, positive = TENSION.
//   Nphi is compression everywhere (crown→base thrust, like an arch). Ntheta is compression
//   near the crown (small phi) and turns TENSILE below the hoop-crack angle (~51.8°). Display
//   and validation only — the stand/fall verdict comes from solve() on the sliced lune.
export function domeMembrane(phi, opts) {
  opts = opts || {};
  const w = opts.w != null ? opts.w : 1;
  const R = opts.R != null ? opts.R : 1;
  const c = Math.cos(phi);
  return {
    Nphi: -w * R / (1 + c),
    Ntheta: w * R * (1 / (1 + c) - c),
  };
}

// ---------------------------------------------------------------------------
// hoopCrackAngle() → phi (radians)
//   The angle from the crown where the hoop force N_theta changes sign (compression→tension):
//   1/(1+cos phi) − cos phi = 0  ⇔  cos²phi + cos phi − 1 = 0  ⇔  cos phi = (√5 − 1)/2 (golden
//   ratio) ≈ 0.6180, phi ≈ 51.83°. Below this parallel a masonry dome cannot carry the hoop
//   tension and cracks along its meridians into orange-segment lunes.
export function hoopCrackAngle() {
  return Math.acos((Math.sqrt(5) - 1) / 2);
}

// ---------------------------------------------------------------------------
// domeMinThickness(R, N, opts?) → { t, tOverR, maxe, R, N, found } | null
//   Sweep ring thickness t on a fine grid and return the stand/collapse threshold: the
//   smallest t at which the sliced-lune dome stands (Heyman safe theorem, via solve()).
//   For a hemisphere this lands near the classic t/R ≈ 0.042 (plus the usual discretisation
//   excess). Helper for the validation harness and the game.
export function domeMinThickness(R, N, opts) {
  opts = opts || {};
  const passes = opts.passes || 6;
  const tMinR = opts.tMinR != null ? opts.tMinR : 0.005;
  const tMaxR = opts.tMaxR != null ? opts.tMaxR : 0.20;
  const dR = opts.dR != null ? opts.dR : 0.002;
  for (let r = tMinR; r <= tMaxR + 1e-9; r += dR) {
    const t = r * R;
    const dome = buildDomeMeridian(R, t, N, opts.build);
    const s = solve(dome, null, passes);
    if (s.stands) return { t, tOverR: t / R, maxe: s.maxe, R, N, found: true };
  }
  return null;
}
