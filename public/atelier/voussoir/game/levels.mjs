// ===================== VOUSSOIR — CAMPAIGN LEVELS (data) =====================
// The single source of truth for the campaign. Both the game (game/play.html) and
// the validity harness (tests/levels.test.mjs) import THIS array, so a level can
// never drift between what ships and what is tested. Adding a level = adding one
// data entry here — no engine edits, no game-code edits.
//
// The physics is the tested engine (../engine/statics.mjs), used, never reimplemented
// or altered. Every win/lose verdict routes through solve()/abutmentStability().
//
// A level is:
//   { id, chapter, name, premise, physics, liveHint?,
//     controls:[{key,label,min,max,step,init,fmt,drag?}],
//     geom(state)          -> arch           (buildArch ...)
//     extras(state,arch)   -> [point loads] | null
//     solveOpts(state)     -> opts for solve (e.g. {mu} ) | null
//     pier(state)          -> {b,h} | null   (abutment levels only)
//     objective            -> one-line goal string
//     win(sol,state,arch)  -> boolean        (the real, computed verdict)
//     scoreOf?(state,arch,sol) -> number     (non-binary levels; LOWER is better)
//     medals?              -> [{name,max}]   (score thresholds, best first)
//     lessonWin, lessonFail-> problem-specific messages (like v0's ethic lines) }

"use strict";

import { buildArch, extradosY, abutmentStability } from "../engine/statics.mjs";
import { buildDomeMeridian } from "../engine/dome.mjs";
import { solveCathedralSection } from "../engine/cathedral.mjs";

// total ring weight (Σ voussoir cross-sectional areas) — used to size point loads
// and to score stone volume (unit depth ⇒ area == volume).
export function totalW(arch) { return arch.vouss.reduce((a, v) => a + v.w, 0); }

const PIER_H = 4.0;            // fixed pier height for the buttress level (L6)
const L6_MU = null;           // L6 tests overturning only (friction off)

// ---- THE FINALE (X) — the composed Gothic bay. The nave vault + flying buttress rings
// are FIXED geometry (they do not depend on the player's controls); this IS the canonical
// bay of tests/cathedral.test.mjs, so what ships is exactly what that engine harness
// validates. The two played controls are the pier's WIDTH and the PINNACLE's weight — the
// two levers that steer the buttress resultant home. Built once as module constants and
// reused read-only by solveCathedralSection (which never mutates its inputs).
const CATH_NAVE  = buildArch([-4, 0], [4, 0], [0, 4], 0.9, 16);   // semicircular nave vault, span 8, R=4
const CATH_FLYER = buildArch([0, 4], [6, 2.2], [3, 3.9], 0.6, 12); // raking half-arch: nave crown → pier top
const CATH_PIER_H = 6;        // buttress pier height to the flyer landing (fixed; width is the control)
const CATH_NAVE_SPRING_H = 8; // clerestory height of the nave springing (used only if the flyer is removed)

export const LEVELS = [
  // -------------------------------------------------------------------------
  {
    id: "L1", chapter: "I", name: "The Half-Round",
    physics: "hinging — ring depth vs. the safe thrust line",
    liveHint: true,                                   // tutorial: a gentle always-on hint
    premise:
      "A true semicircle over a three-metre gap. Drawn thin, its haunches betray it &mdash; " +
      "the line of thrust escapes the stone about a third of the way down. Give the ring enough " +
      "<em>depth</em> that the thrust can lie within it everywhere, then release the load to test it.",
    objective: "Make the half-round stand.",
    controls: [{ key: "t", label: "ring depth", min: 0.22, max: 0.95, step: 0.01, init: 0.30, fmt: v => v.toFixed(2) + " m" }],
    geom: s => buildArch([-3, 0], [3, 0], [0, 3], s.t, 15),
    extras: () => null,
    solveOpts: () => null,
    win: sol => sol.stands,
    lessonWin: "It holds because nothing was asked to carry more than it could, and the thrust came home to the ground.",
    lessonFail: "The ring was too shallow. The thrust crossed out through the haunches and the arch became a mechanism.",
  },
  // -------------------------------------------------------------------------
  {
    id: "L2", chapter: "II", name: "The Gentler Arc",
    physics: "hinging — crown height vs. a thin ring",
    premise:
      "The same gap, but the ring is thin and cannot be made thicker. A full half-circle asks more of " +
      "so slender a stone than it can give. <em>Lower the crown</em> &mdash; let the arc be gentler &mdash; " +
      "until the thrust line finds room to lie down inside the masonry.",
    objective: "Lower the crown until the thin ring stands.",
    controls: [{ key: "rise", label: "crown rise", min: 1.1, max: 3.2, step: 0.02, init: 3.2, fmt: v => v.toFixed(2) + " m" }],
    geom: s => buildArch([-3.2, 0], [3.2, 0], [0, s.rise], 0.34, 15),
    extras: () => null,
    solveOpts: () => null,
    win: sol => sol.stands,
    lessonWin: "Ambition flattened into something the stone could keep. The line needed not strength but room.",
    lessonFail: "Reaching the full half-circle, the thin ring could not contain the thrust. It hinged at the haunches.",
  },
  // -------------------------------------------------------------------------
  {
    id: "L3", chapter: "III", name: "The Burden",
    physics: "hinging — where a concentrated load finds a path to ground",
    premise:
      "A heavy block must cross on the arch&rsquo;s back. Set over the crown or a haunch it levers the ring apart; " +
      "only above a <em>pier</em> can the stone pass its weight straight to the ground. <em>Drag the burden</em> " +
      "along the arch until the ring can carry it, then release.",
    objective: "Move the burden until the ring can carry it.",
    controls: [{ key: "lx", label: "burden position", min: -2.6, max: 2.6, step: 0.02, init: 0.0, drag: true,
      fmt: v => (Math.abs(v) < 0.05 ? "crown" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(2) + " m") }],
    geom: () => buildArch([-3, 0], [3, 0], [0, 3], 0.72, 14),
    extras: (s, arch) => [{ x: s.lx, y: extradosY(arch, s.lx) + 0.18, w: 0.46 * totalW(arch), block: true }],
    solveOpts: () => null,
    win: sol => sol.stands,
    lessonWin: "Weight was never the enemy &mdash; weight with nowhere to go was. Carried over the pier, it became patience.",
    lessonFail: "On the crown of the arch the burden had no honest path to ground. It drove the thrust out and the arch hinged beneath it.",
  },
  // -------------------------------------------------------------------------
  {
    id: "L4", chapter: "IV", name: "The Off-Centre Load",
    physics: "hinging — depth answering an asymmetric load",
    premise:
      "This burden is fixed off to one side and will not be moved. The thrust leans toward the near haunch and " +
      "wants out of the stone. You cannot move the load &mdash; so answer it with <em>depth</em>. Thicken the ring " +
      "until the leaning thrust still lies within every joint.",
    objective: "Deepen the ring until the leaning thrust stays home.",
    controls: [{ key: "t", label: "ring depth", min: 0.40, max: 1.30, step: 0.01, init: 0.58, fmt: v => v.toFixed(2) + " m" }],
    geom: s => buildArch([-3, 0], [3, 0], [0, 3], s.t, 15),
    extras: (s, arch) => [{ x: 1.7, y: extradosY(arch, 1.7) + 0.18, w: 0.60 * totalW(arch), block: true }],
    solveOpts: () => null,
    win: sol => sol.stands,
    lessonWin: "What is asked to carry more must simply be more. The ring deepened, and the lean stayed home.",
    lessonFail: "Too slender for the off-centre weight, the thrust slid out at the loaded haunch and the ring folded.",
  },
  // -------------------------------------------------------------------------
  // L5 — FRICTION made a played mechanic. On a low-friction (icy) foundation the
  // TALL semicircle slides at its two horizontal springings (mode:"slide") — the
  // classic Heyman springing-slip, and exactly what engine test (f) validates.
  // Flattening the arc turns the springing joints steeper, so the thrust meets them
  // closer to their normal and bites: the slide stops. (The ring is left thick, so
  // hinging is never the issue — this level is PURELY about sliding.)
  {
    id: "L5", chapter: "V", name: "The Slipping Springing",
    physics: "finite friction (μ=0.30) — sliding at the springings",
    premise:
      "The foundation here is slick &mdash; low friction, μ&nbsp;=&nbsp;0.30. Built as a tall half-circle the ring " +
      "is thick enough never to hinge, yet it will not stand: at the two horizontal <em>springings</em> the reaction " +
      "leans too far off the joint and the stones <em>slip outward</em>. <em>Flatten the arc</em> &mdash; lower the crown " +
      "&mdash; so the springing joints stand steeper and the thrust bites within the friction. Then release.",
    objective: "Flatten the crown until the springings stop sliding.",
    controls: [{ key: "rise", label: "crown rise", min: 2.0, max: 3.0, step: 0.02, init: 3.0, fmt: v => v.toFixed(2) + " m" }],
    geom: s => buildArch([-3, 0], [3, 0], [0, s.rise], 0.60, 15),
    extras: () => null,
    solveOpts: () => ({ mu: 0.30 }),
    win: sol => sol.stands,
    lessonWin: "Lowered, the springing joints turned to face the thrust, and the force came down within the grip of the stone. It no longer slid.",
    lessonFail: "Too tall for so slick a footing: at the springings the thrust leaned past the friction angle and the stones slid out from under the arch.",
  },
  // -------------------------------------------------------------------------
  // L6 — LATERAL THRUST made a played mechanic. A shallow arch stands on its own,
  // but drives a large horizontal thrust into its piers (engine test (i)). A narrow
  // pier OVERTURNS about its outer toe; the player WIDENS the buttress until the base
  // resultant comes home inside the base. Verdict via abutmentStability().
  {
    id: "L6", chapter: "VI", name: "The Buttress",
    physics: "lateral thrust — a pier overturned by a flat arch's push",
    premise:
      "This flat arch stands as a ring &mdash; but a shallow arc pushes <em>hard sideways</em>, and its thin pier is " +
      "being levered over its outer toe. The stones are sound; the <em>abutment</em> is not. <em>Widen the buttress</em> " +
      "until the base can carry the thrust without overturning. Then release.",
    objective: "Widen the buttress until neither pier overturns.",
    controls: [{ key: "b", label: "buttress width", min: 1.0, max: 2.4, step: 0.02, init: 1.0, fmt: v => v.toFixed(2) + " m" }],
    geom: () => buildArch([-3, 0], [3, 0], [0, 1.2], 0.45, 15),
    extras: () => null,
    solveOpts: () => null,
    pier: s => ({ b: s.b, h: PIER_H }),
    win: (sol, s, arch) => {
      if (!sol.stands) return false;
      const ab = abutmentStability(arch, sol, { b: s.b, h: PIER_H }, {});
      return !ab.left.overturns && !ab.right.overturns;
    },
    lessonWin: "The wider base gathered the sideways push and turned it down into the ground. The pier no longer tips.",
    lessonFail: "The arch held, but its thrust walked the base resultant past the toe: the narrow pier overturned and took the ring with it.",
  },
  // -------------------------------------------------------------------------
  // L7 — NON-BINARY objective. Cross a fixed six-metre gap; the arch must stand, but
  // the SCORE is the stone volume spent (minimise). Two honest levers: a flatter arc
  // needs less stone AND stands thinner, so the frugal answer is a low, thin ring —
  // but go too thin and it collapses. Release is a real optimisation bet.
  {
    id: "L7", chapter: "VII", name: "The Frugal Span",
    physics: "material economy — least stone that still stands",
    premise:
      "Cross the same six-metre gap &mdash; but stone is dear. Any ring that stands wins; the <em>score</em> is the " +
      "volume of stone you spend, and less is better. A flatter arc asks for less stone <em>and</em> stands thinner, " +
      "so frugality lives low and lean &mdash; but a ring too thin has no room for its thrust and will fall. " +
      "Spend as little as you dare, then release.",
    objective: "Make it stand on the LEAST stone. (score = stone volume, lower is better)",
    controls: [
      { key: "rise", label: "crown rise", min: 1.2, max: 3.0, step: 0.02, init: 3.0, fmt: v => v.toFixed(2) + " m" },
      { key: "t", label: "ring depth", min: 0.18, max: 0.90, step: 0.01, init: 0.30, fmt: v => v.toFixed(2) + " m" },
    ],
    geom: s => buildArch([-3, 0], [3, 0], [0, s.rise], s.t, 15),
    extras: () => null,
    solveOpts: () => null,
    win: sol => sol.stands,
    scoreOf: (s, arch) => totalW(arch),        // stone volume (unit depth) — LOWER is better
    medals: [
      { name: "Gold", max: 1.60 },             // demands the flat + thin insight
      { name: "Silver", max: 2.60 },
      { name: "Bronze", max: 4.20 },           // covers thickening the semicircle to stand
    ],
    lessonWin: "It stands, and asks the quarry for little. The load found its short way home, and no stone was spent to soothe your nerves.",
    lessonFail: "Too thin: the thrust had no room inside so slight a ring, and it fell. Frugality is a bet, not a wish &mdash; give the line just enough stone to lie in.",
  },
  // -------------------------------------------------------------------------
  // VIII — THE DOME. The capstone's payoff: a hemisphere fails UNLIKE an arch.
  // Physics: engine/dome.mjs buildDomeMeridian — the SAME solver, run on the
  // diametral sliced lune (a variable-width plane arch, each voussoir's weight ∝
  // circumferential band). isDome:true tells game/play.html to use the dome visual
  // (hemisphere silhouette + the hoop-crack parallels marked at the COMPUTED angle
  // from hoopCrackAngle(), never scripted). Below ~52° from the crown the hoop force
  // turns tensile; masonry cannot pull, so the dome cracks into orange-segment lunes
  // and — drawn too thin — the lunes hinge outward. Primary control = shell thickness
  // (like L1). solve() threshold (R=3, N=24, 7 passes): stands at t≈0.16, falls ≤0.14.
  {
    id: "L8", chapter: "VIII", name: "The Orange Segments", isDome: true, dome: { R: 3, N: 24 },
    physics: "hoop cracking — a dome splits into lunes, it does not hinge like an arch",
    premise:
      "A hemisphere of stone, shown in its diametral <em>section</em>. A dome carries load two ways at once &mdash; " +
      "down the meridians like an arch, and around the <em>hoops</em> like the bands of a barrel. But below the " +
      "golden-ratio parallel &mdash; about 52&deg; from the crown &mdash; the hoop force turns to <em>tension</em>, and " +
      "stone cannot pull. So a dome cracks along its meridians into &ldquo;orange-segment&rdquo; lunes, and each lune " +
      "must then stand as an arch of its own. Drawn too thin, those cracked lunes hinge outward and it falls. " +
      "<em>Thicken the shell</em> until every lune can walk its thrust home, then release.",
    objective: "Thicken the shell until the cracked dome still stands.",
    controls: [{ key: "t", label: "shell thickness", min: 0.08, max: 0.80, step: 0.01, init: 0.10, fmt: v => v.toFixed(2) + " m" }],
    geom: s => buildDomeMeridian(3, s.t, 24),
    extras: () => null,
    solveOpts: () => null,
    win: sol => sol.stands,
    lessonWin: "Deep enough. Though it splits into lunes at the hoop line, each orange segment became an arch of its own and walked its thrust home to the ground. A dome need not resist the crack &mdash; only survive it.",
    lessonFail: "Too thin. Below the 52&deg; parallel the hoop went into tension, the meridians cracked into lunes, and the slender segments had no room for their thrust &mdash; they hinged outward, the way a dome fails and an arch never does.",
  },
  // -------------------------------------------------------------------------
  // IX — THE OCULUS (Pantheon). The open-crown variant: buildDomeMeridian's oculus
  // strikes out the crown cap and spans the opening at constant H (the honest stand-in
  // for the compression ring). Removing the crown weight that helped seat the thrust
  // means an OPEN dome asks for MORE shell than a closed one — solve() threshold
  // (oculus 20°, R=3, N=24, 7 passes): stands at t≈0.22, falls ≤0.18 (vs closed ≈0.16).
  {
    id: "L9", chapter: "IX", name: "The Oculus", isDome: true, dome: { R: 3, N: 24, oculusDeg: 20 },
    physics: "the open crown — the Pantheon's eye needs a deeper shell than a whole dome",
    premise:
      "The Pantheon&rsquo;s dome, open at the crown &mdash; strike out the cap and leave a round <em>eye</em> of sky, " +
      "ringed in stone. But the crown cap was weight that helped press the meridians closed; take it away and the thrust " +
      "wanders more freely, so an open dome asks for <em>more</em> shell than a whole one, not less. Over the opening the " +
      "meridional thrust runs straight across the compression <em>ring</em> at constant push, then down the lunes to the " +
      "ground. <em>Deepen the ring</em> until the open-eyed dome stands, then release.",
    objective: "Deepen the ring until the open-eyed dome stands.",
    controls: [{ key: "t", label: "shell thickness", min: 0.10, max: 0.95, step: 0.01, init: 0.14, fmt: v => v.toFixed(2) + " m" }],
    geom: s => buildDomeMeridian(3, s.t, 24, { oculusPhi: 20 * Math.PI / 180 }),
    extras: () => null,
    solveOpts: () => null,
    win: sol => sol.stands,
    lessonWin: "The eye holds. Across the opening the thrust runs level through the compression ring, then finds the lunes and comes down to the ground &mdash; and with a little more shell than the closed dome asked, the Pantheon has stood nineteen centuries.",
    lessonFail: "Too thin for an open crown. With the cap&rsquo;s weight gone the meridional thrust slid out of so slight a ring; the lunes cracked and hinged, and the eye fell in.",
  },
  // -------------------------------------------------------------------------
  // X — THE CATHEDRAL. The campaign's climax: not one element but the whole Gothic bay
  // as a CHAIN — nave vault → flying buttress → pinnacle-loaded pier → ground. isCathedral
  // tells game/play.html to use the composed-bay render + the solveCathedralSection solve
  // path. The single indeterminate is the horizontal thrust H, constant along the whole
  // load path: the nave delivers it, the FLYER must catch it, the PIER must resist it —
  // and the PINNACLE's dead weight is what steers the (H, V+pinnacle) resultant back inside
  // the pier instead of over its toe. The verdict is a real whole-system search, never
  // scripted. Losing init (narrow pier, light pinnacle) ⇒ governing "pier-overturn"; the
  // player widens the buttress AND/OR loads the pinnacle until the bay stands.
  {
    id: "L10", chapter: "X", name: "Build the Cathedral", isCathedral: true,
    physics: "the whole bay — the flyer catches the nave thrust; the pinnacle steers the pier resultant home",
    premise:
      "The finale: not a single stone but a whole Gothic <em>bay</em> in section. The nave vault throws a great " +
      "sideways <em>thrust</em>; a <em>flying buttress</em> leaps from its crown to catch that push and walk it out to a " +
      "free-standing <em>pier</em>. But the pier alone is too slight &mdash; the leaning thrust levers it over its outer " +
      "toe. The honest Gothic answer is the <em>pinnacle</em>: its dead weight is not ornament but structure &mdash; it " +
      "pulls the buttress&rsquo;s resultant back down <em>inside</em> the pier. <em>Widen the buttress</em> and " +
      "<em>load the pinnacle</em> until the nave&rsquo;s thrust walks all the way home to the ground, then release.",
    objective: "Raise the whole bay: make the nave&rsquo;s thrust walk nave &rarr; flyer &rarr; pier &rarr; ground.",
    controls: [
      { key: "pin", label: "pinnacle weight", min: 0, max: 24, step: 1, init: 3,
        fmt: v => v <= 0 ? "none" : v.toFixed(0) },
      { key: "b", label: "buttress width", min: 1.0, max: 2.2, step: 0.02, init: 1.1,
        fmt: v => v.toFixed(2) + " m" },
    ],
    // The whole-bay spec handed to solveCathedralSection. Fixed nave + flyer rings; the
    // player's controls set only the pier width and the pinnacle weight.
    section: s => ({
      nave: { arch: CATH_NAVE },
      flyer: { arch: CATH_FLYER },
      pier: { b: s.b, h: CATH_PIER_H },
      pinnacle: s.pin,
      naveSpringHeight: CATH_NAVE_SPRING_H,
    }),
    // r is the solveCathedralSection result (not a solve() result); win iff the whole
    // system found an admissible equilibrium.
    win: r => r.stands,
    lessonWin: "It stands as one thing. The nave&rsquo;s thrust ran out along the flyer, the pinnacle&rsquo;s weight pulled the resultant down inside the pier, and the whole line came home to the ground. This is the cathedral&rsquo;s honest secret &mdash; the spire that looks like ornament is the counterweight that keeps the buttress from tipping.",
    lessonFail: "The nave held and the flyer caught its thrust &mdash; but the pier was levered over its outer toe. A buttress this slight, a pinnacle this light, could not steer the resultant home. Widen the base, or load the pinnacle: its weight is what walks the thrust back inside the stone.",
  },
];

// Pick the best-earned medal for a score (levels with a `medals` ladder). Lower score
// is better; returns the highest tier whose threshold the score meets, or null.
export function medalFor(level, score) {
  if (!level.medals) return null;
  for (const m of level.medals) if (score <= m.max) return m;   // listed best→worst: first match is best earned
  return null;
}
