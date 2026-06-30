# Voter Model — provenance & caveats

## What this entry models

A grid of agents, each holding one of `q` opinions (default 2, up to 5). The
classic voter rule, applied N times per sweep (N = number of cells): pick a
random cell, pick a random one of its four von Neumann neighbours, and copy that
neighbour's opinion onto the cell. From a random start, single-opinion domains
grow and coarsen; the interface density (fraction of disagreeing neighbour pairs)
falls over time, and on a finite lattice the system fixates on one opinion
everywhere — an absorbing state. An optional `zealots` knob marks a small
fraction of cells as never-changing; competing zealots prevent consensus.

## Sources actually used

1. **Clifford, P. & Sudbury, A. (1973).** "A model for spatial conflict."
   *Biometrika* 60(3), 581–588. The original formulation (as a model of two
   species competing for territory). DOI: 10.1093/biomet/60.3.581.
   https://doi.org/10.1093/biomet/60.3.581

2. **Holley, R. A. & Liggett, T. M. (1975).** "Ergodic theorems for weakly
   interacting infinite systems and the voter model." *The Annals of Probability*
   3(4), 643–663. The rigorous interacting-particle-system treatment that coined
   the name "voter model" and established its clustering/consensus behaviour and
   the dimension dependence. DOI: 10.1214/aop/1176996306.
   https://doi.org/10.1214/aop/1176996306

3. **Castellano, C., Fortunato, S. & Loreto, V. (2009).** "Statistical physics of
   social dynamics." *Reviews of Modern Physics* 81(2), 591–646. Comprehensive
   review placing the voter model among opinion-dynamics models; source for the
   substantive physics points used here — the absence of surface tension, the
   rough diffusively-wandering interfaces, and the only-logarithmically-slow
   coarsening in 2D (contrasted with curvature-driven Ising/Glauber coarsening).
   DOI: 10.1103/RevModPhys.81.591. https://doi.org/10.1103/RevModPhys.81.591

## Supporting facts (well established in the literature, summarized in ref. 3)

- The voter model has **no surface tension**: interfaces are not driven by
  curvature and do not minimise boundary length the way Ising/Glauber domain
  walls do. This is the central, substantive contrast made in the prose.
- In 2D it coarsens **logarithmically slowly** and the density of active
  interfaces decays like ~1/ln(t); on a finite lattice it eventually fixates.
- The model is **exactly equivalent to the spatial Moran / neutral model** of
  population genetics: "opinion" ↔ "allele", "copy a neighbour" ↔ "death and
  replacement by a neighbour's offspring", and fixation ↔ a neutral allele
  sweeping to 100%. This equivalence is standard and is why the same math
  describes neutral genetic drift.

## Caveats (honesty over hype)

- This is a **deliberately minimal NEUTRAL model**. There is no persuasion, no
  confidence weighting, no individual stubbornness (except the optional zealots),
  no media, and no opinion is intrinsically more attractive than another. Real
  opinion dynamics involve many additional forces; the voter model is a *null
  baseline*, not a faithful account of human persuasion.
- The two genuinely substantive, defensible scientific points in the entry are
  (a) the **Ising contrast** — the voter model looks like Ising coarsening but
  has no surface tension and coarsens only logarithmically — and (b) the
  **population-genetics equivalence** (spatial Moran / neutral model). Both are
  standard results, summarized in ref. 3 and the genetics literature.
- The simulation uses a **toroidal** lattice and **asynchronous random-sequential
  updating** (one random cell at a time), which is the standard voter-model
  convention. The on-screen "interface density" is computed over right+down
  bonds only (each undirected bond counted once), which is the natural coarsening
  order parameter and is what the headless test checks.
- The "winner is random" framing is correct for the neutral model: with no
  zealots, the probability that a given opinion fixates equals its initial
  fraction (a standard martingale result for the voter model).

## Cross-links

Linked to the other Social Dynamics entries (Schelling, traffic) via the shared
related-nav, and explicitly cross-linked in the prose to the **Ising model**
(ising) as the key physics contrast.
