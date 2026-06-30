# Snow-crystal growth (Reiter's model) — research notes & provenance

## Sources actually used

1. **Reiter, C. A. (2005).** "A local cellular model for snow crystal growth."
   *Chaos, Solitons & Fractals* 23(4), 1111–1119.
   https://doi.org/10.1016/j.chaos.2004.06.071
   PDF: https://acoustique.ec-lyon.fr/chaos/Reiter_ChaosSolitonsFractals05.pdf
   — The originating paper. Defines the hexagonal cellular automaton with the
   receptive-set / split / vapour-addition / diffusion / recombine update and the
   three parameters α, β, γ. Source for the model definition and the
   dendrite / stellar / sector / plate morphology classes.

2. **ActiveState Python recipe 578390**, "Snowflake Simulation Using Reiter
   Cellular Automata."
   https://code.activestate.com/recipes/578390-snowflake-simulation-using-reiter-cellular-automat/
   — A compact reference implementation. Used to pin down the *exact* discrete
   diffusion weighting and, crucially, that **receptive cells also collect the
   `(α/12)·Σ` vapour diffusing in from their non-receptive neighbours** (the held
   part `s+γ` is *added to* the diffusion result, not used in place of it). This
   inflow at the boundary is the growth engine; without it the crystal grows only
   as a compact hexagon (see Caveats / debugging note below).
   Reference parameter ranges: α ∈ [0.5, 2.0], β ∈ [0.3, 0.6], γ ∈ [0, 0.01].

3. **dcxSt/snowflake_automaton (GitHub) notes**, restating Reiter's equations,
   including the Laplacian form `u(t+1) = u + (α/12)(−6u + Σ_6 u)` and the example
   figures at α = 2.43, β = 0.35, γ = 0.001 and α = 2.43, β = 0.45, γ = 0.003.
   https://github.com/dcxSt/snowflake_automaton

4. **Libbrecht, K. G. (2005).** "The physics of snow crystals." *Reports on
   Progress in Physics* 68(4), 855–895. — Cited for the *real* physics
   (anisotropic attachment kinetics) that the toy model omits. Source for the
   "qualitative caricature" honesty framing.

5. **Gravner, J. & Griffeath, D. (2009).** "Modeling snow-crystal growth: A
   three-dimensional mesoscopic approach." *Physical Review E* 79, 011601. —
   Cited as the far richer, more faithful model. (They also have a 2008 2D
   mesoscopic-automaton paper in *Physica D*; the 2009 PRE 3-D paper is the one
   cited in the entry.)

6. **Nakaya, U. (1954).** *Snow Crystals: Natural and Artificial.* Harvard
   University Press. — The Nakaya morphology diagram (shape vs temperature &
   supersaturation); first artificial snow crystals.

7. **Witten, T. A. & Sander, L. M. (1981).** "Diffusion-Limited Aggregation, a
   Kinetic Critical Phenomenon." *Physical Review Letters* 47(19), 1400–1403. —
   Cross-linked as the stochastic, symmetry-free cousin (the Atlas's `dla` entry).

## The simulation

Hexagonal lattice stored as a 2-D array. **Coordinate scheme: axial (q, r)**,
stored directly as offset `row = r + centre`, `col = q + centre`. Under this
direct mapping each axial neighbour offset `(dq, dr)` is the array move
`(drow, dcol) = (dr, dq)`, so the six neighbours are exact and a **60° rotation**
about the centre is the exact axial map `(q, r) → (−r, q + r)` — used by the
six-fold-symmetry test. Hex distance from centre is
`(|q| + |q+r| + |r|) / 2`.

Update per tick (Reiter):
1. **Receptive** mask = frozen OR neighbour-of-frozen.
2. Build the diffusion field `u` = `s` on non-receptive cells, `0` on receptive
   cells ("set the receptive sites to zero").
3. For every cell: `diffused = u + (α/12)·(Σ_6 u(neighbour) − 6u)`; held part
   `= s + γ` on receptive cells, else `0`; new `s = held + diffused`. Receptive
   cells thus keep their water, gain γ, **and** absorb diffused vapour from
   neighbours — the boundary inflow that drives branching.
4. Cells reaching `s ≥ 1` freeze.
Boundary: out-of-bounds neighbours reflect the cell's own `u` (Neumann), so the
far field stays at β and water is neither created nor leaked at the edge.

Rendering: pointy-top hexagons via cartesian `x = √3·hexr·(q + r/2)`,
`y = 1.5·hexr·r`, centred on the canvas. Frozen ice is bright pale blue (lightly
brightened by `s`); the un-frozen vapour field is a very dark blue whose
brightness rises with `s`, so the depleted/enriched diffusion halo around the
crystal is faintly visible.

### Presets (α, β, γ) — all on a hexagonal lattice, α = 1.0
- **Dendrite (default):** β = 0.40, γ = 0.0010 — branched six-armed star with
  side-branches. The best all-round dendrite; clearly six-fold and branchy at the
  screenshot timing (~430 steps, radius ~22 hex).
- **Stellar dendrite:** β = 0.35, γ = 0.0010 — the classic clean six-pointed star.
- **Fern (fine dendrite):** β = 0.40, γ = 0.0005 — finer, feathery arms (slower γ
  → more diffusion-limited → more delicate branching).
- **Sectored plate:** β = 0.50, γ = 0.0500 — large γ freezes the receptive
  boundary almost immediately, suppressing the instability into a broad hexagonal
  plate with sectored corners and faint internal ridges.

β is the morphology star knob: low β → dendritic/ferny; high β + high γ →
compact plate. **randomize** re-seeds and jitters β by ±0.03 so each crystal
differs ("no two alike").

## Caveats (honesty over hype)
- **Reiter's model is a qualitative caricature, not real snow physics.** It
  reproduces the *emergence* (local rule → branched, six-fold crystal) and the
  plate-vs-dendrite-with-humidity trend, but it is a single scalar "water" field
  with a freeze threshold — not the real anisotropic surface-attachment kinetics
  (Libbrecht) or faithful mesoscopic dynamics (Gravner–Griffeath).
- **The six-fold symmetry is partly lattice-imposed.** On a perfect hexagonal grid
  with a single centre seed and a deterministic isotropic rule, six-fold symmetry
  is *exact by construction* (verified in the logic test). Real snowflakes' six-fold
  symmetry genuinely comes from ice's hexagonal molecular structure — which the
  lattice here stands in for — so the model gets the *right answer for a partly
  borrowed reason*. Stated explicitly in the prose.
- **Identical arms assume a perfectly uniform environment.** Real arms match
  because they share one growth history, not because anything enforces agreement;
  a fluctuation would desynchronise them.
- **Branching = a diffusion-limited instability**, the same mechanism behind DLA
  (Witten–Sander) and frost ferns. The Atlas cross-links DLA as the stochastic,
  symmetry-free counterpart.

## Debugging note (kept for the next iteration)
The first implementation gave perfectly compact hexagonal plates (never dendrites)
regardless of α, β, γ. Cause: receptive (boundary) cells were updated as `s + γ`
*only*, omitting the `(α/12)·Σ u(neighbours)` vapour diffusing in from their
non-receptive neighbours. With that inflow restored (per the reference recipe),
exposed tips — which have more non-receptive neighbours feeding them — outgrow
valleys, and the crystal branches into a proper six-fold dendrite.
