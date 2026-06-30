# Ising — provenance & caveats

Entry: **The Ising Model** (category: Criticality). The 2D square-lattice Ising
model of ferromagnetism, simulated with Metropolis Monte Carlo — the textbook
example of a phase transition and of spontaneous symmetry breaking.

## Sources actually used

1. **Ising, E. (1925).** "Beitrag zur Theorie des Ferromagnetismus."
   *Zeitschrift für Physik* 31, 253–258.
   DOI: https://doi.org/10.1007/BF02980577 — The original paper. Ising solved the
   *one-dimensional* chain and found (correctly) that it has no finite-temperature
   phase transition, and wrongly conjectured the same for higher dimensions. Cited
   for historical origin; flagged in-page that the 1D model has no transition.
2. **Onsager, L. (1944).** "Crystal Statistics. I. A Two-Dimensional Model with an
   Order-Disorder Transition." *Physical Review* 65, 117–149.
   DOI: https://doi.org/10.1103/PhysRev.65.117 — The exact solution of the 2D model
   in zero field. Source of the critical temperature: the transition occurs where
   sinh(2J/kTc)·sinh(2J'/kTc) = 1, giving for the isotropic square lattice
   Tc = 2/ln(1+√2) ≈ 2.2691853 in units of J/k_B. This exact value is the headline
   fact and the target of the "set T = Tc" button. Volume/pages verified via
   APS / Semantic Scholar / SciRP listings.
3. **Metropolis, N., Rosenbluth, A. W., Rosenbluth, M. N., Teller, A. H., Teller, E.
   (1953).** "Equation of State Calculations by Fast Computing Machines."
   *Journal of Chemical Physics* 21(6), 1087–1092.
   DOI: https://doi.org/10.1063/1.1699114 — The Metropolis Monte Carlo algorithm used
   by the simulation: accept a trial move with probability min(1, exp(−ΔE/T)).
   Volume 21, no. 6, pp. 1087–1092 verified via AIP, ADS, and Wikipedia listings.
4. **Brush, S. G. (1967).** "History of the Lenz–Ising Model." *Reviews of Modern
   Physics* 39(4), 883–893.
   DOI: https://doi.org/10.1103/RevModPhys.39.883 — Historical background (Lenz posed
   the model; Ising solved the 1D case as his thesis), used for the "Why it matters"
   and references framing.

Background (not cited in-page but standard): the Curie temperature of iron (~1043 K)
and the liquid–gas critical-point / critical-opalescence connection and the
lattice-gas / binary-alloy mappings are textbook statistical mechanics (e.g. Goldenfeld,
*Lectures on Phase Transitions and the Renormalization Group*, 1992; Chandler,
*Introduction to Modern Statistical Mechanics*, 1987).

## What the simulation does

- Grid of `Int8Array` spins s ∈ {+1, −1}, toroidal (periodic boundaries via index
  wrapping). Energy E = −J Σ_<ij> s_i s_j with J = 1, plus an optional uniform field
  term −h Σ s_i.
- **Metropolis Monte Carlo.** `_attempt()` picks a random site, computes the four-
  neighbour sum, and flips with probability min(1, exp(−ΔE/T)) where
  ΔE = 2·s_i·(J·nbSum + h). The neighbour sum nbSum ∈ {−4,−2,0,2,4}, so only a small
  table of acceptance probabilities is needed; `_buildExp()` precomputes them and is
  rebuilt only when T or h changes (cheap; avoids a Math.exp per spin).
- One **sweep** = N flip-attempts (N = number of cells); the `speed` slider sets
  sweeps per frame.
- `magnetization()` returns m = (Σ s)/N ∈ [−1, 1]; `energyPerSite()` returns the
  per-site bond energy (counting each bond once). Both exposed for the readout and the
  headless test, along with `this.T`.
- Render: ImageData at spin resolution, blitted through a small offscreen canvas and
  upscaled with smoothing off, so each spin is a crisp ~3 px block. +1 = warm amber
  (224,163,94); −1 = dark teal (32,58,66).
- Controls: `standardRail({randomize})` (randomize = fresh hot/random start);
  `select` initial state (Hot / random, Cold / aligned); `slider` temperature
  (0.5–4.0, the star knob, marks ≈Tc); `slider` speed (sweeps/frame); `slider` field h
  (−1..1); `button` "set T = Tc" (snaps the temperature slider to ≈2.269);
  `onPointer` paints a circular +1 domain; `readout` shows T, m, |m|, and E/N.

## Caveats (honesty over hype)

- **This is a Monte Carlo sampler of equilibrium statistical mechanics, not real-time
  physical dynamics.** A "sweep" is an algorithmic step, not a unit of physical time;
  the visible coarsening looks dynamical and is qualitatively suggestive of real domain
  growth, but Metropolis dynamics is a sampling scheme, not Newtonian (or even
  Langevin) physics. Single-spin-flip dynamics in particular slows critically near Tc
  (cluster algorithms like Wolff or Swendsen–Wang are used for serious work).
- **Finite grid.** The screen holds only ~250×150 spins, so the transition is
  *rounded and slightly shifted* relative to the infinite-lattice Onsager Tc. There is
  no true singularity on a finite lattice; what you see near 2.27 is a smeared
  crossover, and the apparent Tc drifts with system size (finite-size scaling).
  The exact Tc = 2.269 is an infinite-lattice result.
- **Metastable stripes.** On a torus, cooling from a hot start frequently freezes into
  two-stripe metastable states rather than a single domain; this is a finite-size /
  boundary artifact of the geometry, not the equilibrium ground state.
- **Outside-physics uses are analogy.** The Ising mapping into neuroscience (Hopfield /
  "neural" spin models), opinion/voter dynamics, and finance is genuine and useful as a
  modelling tool, but whether real brains or markets are literally Ising systems poised
  near criticality is contested and unproven. The prose flags these explicitly as
  analogy, not established mechanism. The within-physics applications (Curie point,
  liquid–gas critical point, binary alloys, lattice gases) are, by contrast, textbook
  and well established.

## Cross-links

Related to **sandpile** (the other Criticality entry: self-organized criticality vs.
the tuned criticality of the Ising point) — the contrast between *tuning a parameter*
to a critical point and a system *self-organizing* to one is worth drawing.
