# Lenia — research provenance & caveats

## What it is

Lenia (Bert Chan, 2019) is a **continuous cellular automaton**: a continuous
generalization of Conway's Game of Life in state, space, and time. A single
field A(x,y) ∈ [0,1] on a toroidal grid evolves by:

1. **Potential** `U = K ∗ A` — convolution of A with a smooth radial kernel K
   of radius R (a soft ring, zero at center and edge, peaking between).
2. **Growth** `G(u) = 2·exp(−(u−μ)²/(2σ²)) − 1` — a Gaussian bump in [−1,1]
   centered at target density μ with width σ.
3. **Update** `A ← clip(A + dt·G(U), 0, 1)`, synchronous (double-buffered).

Set dt=1, a 3×3 box kernel, and a hard {2,3} growth step and you recover Life
exactly — Lenia is Life with the integers rounded into smooth curves.

## Seeding — what we actually used

**We used the REAL Orbium creature**, not a random-blob fallback. Orbium is the
canonical Lenia glider from Chan (2019). The embedded `ORBIUM` matrix in `sim.js`
is the published 20×20 Orbium "animal" (values in [0,1], quantized to two
decimals for compactness). Stamped into the field at the canonical parameters it
behaves correctly as a smooth glider:

- Headless probe (190×114 grid, default params): Orbium **mass holds ~75 → ~71
  over 400 steps (~6% drift)** — the hallmark of a stable lifeform — while its
  **center of mass translates ~94 cells** across the grid. It glides. Zero cells
  ever go out of [0,1] or NaN.

The other seeds:
- **Random soup** = many smooth Gaussian blobs of random radius/height. Honestly
  stated in the prose: random initial conditions in Lenia spawn evolving but
  usually **short-lived** lifeforms; in the headless test the seeded soup's mass
  collapses to 0 within ~60 steps. This is real, expected Lenia behavior, not a
  bug — finding a stable creature from random ICs is rare, which is the whole
  point of the catalogued "animals."
- **Clear** = empty field, paint by hand.

## Exact parameters

- Kernel radius **R = 13** cells; cell size **4 logical px**; grid auto-sized to
  the canvas (~190×114 at default width).
- Kernel shell `core(r) = exp(4 − 4/(4r(1−r)))` over normalized radius r∈(0,1),
  evaluated per ring offset, weights normalized so Σ K = 1.
- Canonical Orbium growth: **μ = 0.15, σ = 0.015, dt = 0.1**.
- Live-tunable sliders: μ ∈ [0.10, 0.25], σ ∈ [0.008, 0.030], dt ∈ [0.02, 0.30],
  speed ∈ {1,2,3} updates/frame.
- Kernel offsets are precomputed once into typed arrays (`kOff`, `kW`) for the
  convolution inner loop.

## Honesty / caveats

- Lenia's creatures are **mathematical artificial life**, NOT models of specific
  biological organisms. Orbium is not a microbe; it does not represent a real
  cell. The significance is as an **ALife system and discovery medium**, and
  (because the system is smooth/differentiable) as a target for gradient- and
  learning-based search of creatures — stated in the "Why it matters" / "In the
  wild" sections.
- Mutating μ/σ slightly genuinely mutates or kills the creature (verified:
  σ=0.030 makes Orbium's mass run away to saturation/white). This is surfaced as
  a "Try this" experiment.

## Sources used

- Chan, B. W.-C. (2019). "Lenia: Biology of Artificial Life." *Complex Systems*
  28(3), 251–286. https://www.complex-systems.com/abstracts/v28_i03_a01/
  — model definition, growth/kernel functions, Orbium.
- Chan, B. W.-C. (2020). "Lenia and Expanded Universe." *ALIFE 2020 Proceedings*,
  MIT Press. https://doi.org/10.1162/isal_a_00297 — multi-kernel/channel Lenia.
- Plantec et al. (2023). "Flow-Lenia: Mass conservation for the study of virtual
  creatures in continuous cellular automata." *ALIFE 2023*. — variant + example
  of search/learning applied to Lenia.
- Gardner, M. (1970). *Scientific American* 223(4), 120–123. — discrete ancestor
  (B3/S23).
- Bert Chan, "Lenia" reference implementation and creature library:
  https://github.com/Chakazul/Lenia — source of the Orbium matrix and parameters.

### Uncertainty flags
- *Complex Systems* 28(3) page range (251–286) is per the journal's published
  abstract listing; treat exact pages as best-effort.
- ALIFE proceedings page numbers vary by edition/index; cited best-effort.
- The embedded Orbium matrix is quantized for compactness; it reproduces Orbium's
  gliding behavior faithfully (verified in `tools/test-lenia.mjs`) but is not
  bit-identical to any single published float dump.

## Testing

`tools/test-lenia.mjs` (headless, deterministic) asserts: every A stays finite
and in [0,1] over 400 steps (clip holds, no NaN); Orbium has positive mass, never
collapses to 0, evolves between steps, holds mass roughly constant (<50% drift),
and its center of mass moves >5 cells (it glides); random soup is bounded and
evolves. All 9 assertions pass, exit 0.
