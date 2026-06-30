# Coupled Metronomes — research notes & provenance

Category: **Synchronization**. The concrete, *mechanical* sibling of the abstract
phase coupling in `kuramoto/` and the pulse coupling in `fireflies/`. This entry
cross-links to both, and is itself referenced from the Kuramoto entry's "In the
wild" section.

## The phenomenon

Self-sustaining oscillators (pendulum clocks, wind-up metronomes) sharing a
movable support spontaneously synchronize, coupled only by the support's motion.
First recorded by **Christiaan Huygens, February 1665**, who saw two pendulum
clocks on a common beam lock into *anti-phase* and called it "an odd kind of
sympathy." This is the historical origin of the science of synchronization.

## Model used: small-angle (linearized) Pantaleone (2002)

We use the **linearized** version of the Pantaleone model (sinθ≈θ, cosθ≈1),
which is standard and which synchronizes cleanly and stays numerically stable.
For metronome *i* (angle θ_i) on a platform at position *x*:

    θ_i'' + (b/m)·θ_i' + (g/L)·θ_i = −(1/L)·x'' + μ·(1 − (θ_i/θ0)²)·θ_i'
    (M + Σ m_i)·x'' + B·x'        = −Σ m_i·L·θ_i''

- The escapement is a **van der Pol** drive `μ·(1 − (θ/θ0)²)·θ̇`: it injects
  energy at small amplitude and removes it at large, giving a stable limit-cycle
  amplitude. (With our constants b/m=0.1, μ=0.5, θ0=0.30, the limit cycle settles
  at ≈0.54 rad ≈ 31°, robustly, converging from both larger and smaller starts —
  verified directly with an isolated-pendulum sweep.)
- The platform x'' equation is **implicit** (its RHS contains θ_i'' which contains
  x''). We substitute the θ_i'' expression into the platform equation and collect
  x'' into a closed form; in the linearized case the Σm_i terms cancel and we get
  `M·x'' = −B·x' − Σ m_i·L·a_i`, where `a_i` is the internal angular accel without
  the coupling term. Then each `θ_i'' = a_i − x''/L_i`.
- Integration: **semi-implicit (symplectic) Euler**, dt = 1 ms, sub-stepped
  (default 24 sub-steps/frame, scalable to 48 via the speed knob). Symplectic
  Euler keeps the oscillator energy well-behaved over long runs.

### Why linearized, not full nonlinear

We tested the fuller nonlinear model (keeping sinθ, cosθ, and the centrifugal
θ'²sinθ term, solving the implicit x'' with the cos²θ factor). It is **less
robust**: for N≥5 it blew up (angles ran over the top, |θ|→∞) from many initial
conditions. The linearized model never blows up and synchronizes cleanly, so per
the entry's robustness mandate we ship the linearization. This is honest and
standard (Pantaleone himself analyzes the linearized normal-mode picture).

## In-phase vs anti-phase — depends on parameters

A key, accurate caveat reflected in the prose:

- This minimal model's reliably-reached locked state for **two** identical
  metronomes is **anti-phase** (the rods swing oppositely; their recoils cancel
  and the platform falls still). That is exactly what Huygens observed and what
  Bennett et al. (2002) reproduced experimentally.
- Real **light-board metronome demos** (metronomes on a board on soda cans)
  usually lock **in-phase**. Whether a system locks in- or anti-phase is not
  universal — it depends on platform mass, platform friction, and the coupling
  strength. Our friction sweep confirms the trend: for two metronomes, *low*
  platform friction tends toward in-phase, *high* friction toward anti-phase, and
  a heavier free board favors in-phase. Both are genuine synchronization. The
  order parameter we report (below) reads either as "locked."

## Order parameter

`r` is the **second-harmonic phase-locking coherence**:

    r·e^{i·2ψ} = (1/N) Σ_j e^{i·2φ_j},   φ_j = atan2(θ̇_j/ω0, θ_j)

where ω0 = √(g/L) normalizes the (θ, θ̇) state space so the limit cycle is ~circular.
The second harmonic makes `r → 1` for a **phase-locked** population whether it
settles **in-phase** (all φ equal) or **anti-phase** (two clusters π apart) — the
right "are they synchronized?" measure for a system whose stable locked state is
anti-phase. `r → 0` for an unlocked, drifting scatter. (A first-harmonic r would
read 1 for in-phase but 0 for anti-phase, wrongly calling a perfectly locked
anti-phase pair "unsynchronized.")

## Caveats / honesty

- **Low-dimensional idealization.** Two or a few clean oscillators, one sliding
  board, viscous friction, linearized dynamics. Real clocks/metronomes have
  impulsive escapements, dry friction, finite amplitude, and 3-D supports.
- **N = 2 is the rock-solid case** (and is literally Huygens' experiment): it
  locks to r = 1.000 for every seed and every friction/mass we tested. For **N ≥ 3**
  the *symmetric* model is genuinely multistable — it can settle into **splay /
  rotating-wave states** (oscillators spread evenly around the cycle) or partial
  clusters rather than one global cluster, so r need not reach 1. This is a
  real, well-documented property of symmetric oscillator populations, not a bug;
  the demo defaults to N = 2 and the prose flags the N>2 behavior. (The headless
  test asserts synchronization for the reliable N = 2 case.)
- **Platform drift.** With no restoring spring the board's center can drift slowly
  (a DC offset); the render clamps the displayed slide. Physically harmless — the
  *relative* phase dynamics (what synchronization is about) are unaffected.

## Sources (all real; verify before re-citing)

1. Huygens, C. (1665). "Sympathy of two clocks," letters & notebook entries, in
   *Œuvres Complètes de Christiaan Huygens*, vols. 5 & 17 (Martinus Nijhoff,
   The Hague, 1888–1950). Recounted/translated in the modern sources below.
2. Pantaleone, J. (2002). "Synchronization of metronomes." *American Journal of
   Physics* 70(10), 992–1000. doi:10.1119/1.1501118 — the platform-coupled model.
3. Bennett, M., Schatz, M. F., Rockwood, H., Wiesenfeld, K. (2002). "Huygens's
   clocks." *Proceedings of the Royal Society A* 458(2019), 563–579.
   doi:10.1098/rspa.2001.0888 — modern experimental re-examination; anti-phase.
4. Strogatz, S. H. (2003). *Sync: The Emerging Science of Spontaneous Order.*
   Hyperion, New York — popular account opening with Huygens.
5. Strogatz, S. H., Abrams, D. M., McRobie, A., Eckhardt, B., Ott, E. (2005).
   "Crowd synchrony on the Millennium Bridge." *Nature* 438, 43–44.
   doi:10.1038/438043a — pedestrians + bridge as metronomes + platform.

## Verification

- `node --check site/entries/metronomes/sim.js` → passes.
- `node tools/test-metronomes.mjs` → ALL PASS, exit 0:
  - (1) stable over 1500 steps × 40 sub-steps: r∈[0,1], all state finite, max
    swing ≈0.59 rad, no blow-up.
  - (2) coupled mean r = 1.000 (min 1.000, from random start ≈0.55) vs uncoupled
    mean r ≈ 0.56 over 14 seeds × 1500 steps.
