# Phyllotaxis — research notes & provenance

## What this entry models

How the **golden angle (≈137.5°)** and **Fibonacci spirals** of a sunflower head,
pinecone, or leaf arrangement arise from a simple local rule about where each new
bud (primordium) forms. Two selectable modes:

### (A) Emergent — Douady & Couder (the real "why") — DEFAULT
Primordia are emitted one at a time from a small central ring and then drift
radially **outward** as newer buds appear behind them (older buds are farther
out). When a new bud forms, it goes to the angle on the emission ring that is
**farthest from the recent buds** — i.e. it is repelled into the largest
available gap. Implemented as: scan candidate angles and pick the one that
**minimises a Σ 1/distance² repulsion energy** against the most recent
`NEIGHBORS = 10` buds, where each of those buds sits at its true drifted position
(angle `bAngle[k]`, radius `√age` — the same √ law the head packs by) and the new
bud is born on the emission ring at radius `EMIT_R = 1.05`. From this purely local
"grow in the biggest gap" rule, the divergence angle between successive buds
**self-organises to ≈ the golden angle** and the buds settle into interlocking
Fibonacci spirals. No angle is imposed.

- **Measured convergence:** with the tuned parameters the discrete model settles
  on a divergence of **≈138.1°** (tail mean ~138.13°, very low variance), i.e.
  within ~0.6° of the exact golden angle 137.508°. This is the genuine fixed point
  of the discrete repulsion model at this emission radius — it is honest to call
  it "≈137.5° emerges," not "exactly 137.5°." (The true Douady–Couder result is
  likewise a function of the plastochrone/emission geometry and lands near, not
  exactly on, the golden angle for finite parameters.)
- The readout reports an exponentially-smoothed running divergence so the reader
  watches it *settle* rather than be dragged forever by the chaotic first buds.

### (B) Explore — Vogel placement (the geometry) — IMPOSES the angle
Bud `n` is placed directly at angle `n·δ` and radius `c·√n`, where `δ` is the
divergence-angle slider (Vogel 1979). This mode **imposes** the angle to reveal
the *geometry* of why the golden angle packs best:
- At `δ = 137.51°` (golden) the packing is perfect, dense, and gap-free; the
  visible parastichies are consecutive Fibonacci numbers (34/55 at ~700 buds).
- Nudge `δ` a few hundredths of a degree and the spirals reorganise into different
  Fibonacci families.
- Set `δ` to a rational fraction of 360° (e.g. **90° → 4 radial spokes**) or to a
  near-miss like **137.0°** and the packing fails into visible spokes / gaps.

**This is the key honesty point:** Explore mode *imposes* the angle to show the
geometry; Emergent (Douady–Couder) mode is the real story of **where the angle
comes from**. The prose states which is which explicitly.

## The math

- Golden ratio `φ = (1+√5)/2 ≈ 1.6180339887`.
- Golden angle `= 360°/φ² = 360°·(2 − φ) = 137.50776405…°`. (`1/φ² = 2 − φ`.)
- `φ` is the "most irrational" number — its continued fraction is `[1;1,1,1,…]`,
  the slowest-converging possible, so it is the real number least well
  approximated by rationals. Hence successive buds at the golden angle never line
  up into spokes at any scale and the packing stays even.
- **Parastichy (spiral arm) counts** are the denominators of the best rational
  approximations (continued-fraction convergents) of `δ/360°`. For the golden
  angle these convergents are exactly the Fibonacci numbers (…21, 34, 55, 89…);
  the number actually *visible* in a head of `N` buds scales like `√N`. The sim's
  `parastichyLabel()` computes this directly: golden → `34 / 55`, `90°` → `4`.

## Implementation notes

- Vanilla ES + Canvas, extends `Atlas.Sim`. No external deps.
- State: `bAngle` (emission angle per bud), `bx`/`by` (pixel positions, centred),
  `n` (buds placed), `target` (florets slider), `divergenceAngle` (measured in
  emergent mode, set in explore mode). All exposed for tests, plus `sim.GOLDEN_DEG`.
- Both modes use the same `r ∝ √index` radius law so the head fills evenly (equal
  area per bud). In emergent mode index 0 is the oldest/outermost bud; new buds
  start near the centre and the head grows outward.
- Controls: `standardRail({ randomize })`; `select` **mode** (emergent/explore);
  **divergence** slider (135.0–140.0°, 0.01° step, default 137.51° — the star knob
  in explore mode, ignored in emergent mode); **florets / N** (200–1500);
  **size** (floret radius multiplier); **speed** (emission rate, buds/frame).
- Render: each bud is a filled circle, colored by index with a smooth gradient
  (dark seedy centre → warm amber → teal rim) so the interlocking spirals read
  clearly; head centred on a dark ground. Looks like a sunflower / pinecone face.

## Sources (verified)

- **Vogel, H. (1979).** "A better way to construct the sunflower head."
  *Mathematical Biosciences* 44(3–4), 179–189. Origin of the
  `θ = n·137.5°, r = c·√n` parametric placement used in Explore mode.
- **Douady, S. & Couder, Y. (1992).** "Phyllotaxis as a Physical Self-Organized
  Growth Process." *Physical Review Letters* 68(13), 2098–2101. The physical
  self-organisation result behind Emergent mode: the golden angle emerges from
  repulsion of new primordia growing into available space; includes the
  falling-ferrofluid-drop experiment reproducing it with no biology.
- **Jean, R. V. (1994).** *Phyllotaxis: A Systemic Study in Plant Morphogenesis.*
  Cambridge University Press. Comprehensive modern monograph.
- **Adler, I., Barabé, D. & Jean, R. V. (1997).** "A History of the Study of
  Phyllotaxis." *Annals of Botany* 80(3), 231–244. Historical survey.

## Caveats (honesty)

- **Imposed vs. emergent.** Explore (Vogel) mode **imposes** the divergence angle
  to demonstrate the *geometry* of close-packing; it does not explain where the
  angle comes from. Emergent (Douady–Couder) mode is the real account: the angle
  is **selected by a local repulsion rule**, not supplied. Stated clearly in the
  prose and above.
- **Approximate, not exact.** The discrete emergent model converges to ≈138.1°
  (within ~0.6° of the true golden angle) — a genuine emergent value, not exactly
  137.508°. The convergence is robust and seed-independent, which is the point.
- **Real phyllotaxis is statistical.** Not every specimen is perfect; growing
  heads have defects, transitions, and occasional non-Fibonacci (e.g. Lucas)
  arrangements. The Fibonacci dominance is a strong statistical tendency from a
  robust mechanism, not a law obeyed by every plant.
- **Generative/geometric flavor of emergence.** Like the Atlas's L-systems, this
  is a form unfolding under a simple growth rule rather than real-time dynamical
  interaction (boids, Ising, reaction–diffusion). The whole far exceeds the rule —
  a precise global angle the rule never names — but it is fair to flag the flavor.
