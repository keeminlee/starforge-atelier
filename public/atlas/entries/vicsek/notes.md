# Vicsek model — research notes

## What the sim implements

The canonical 1995 Vicsek update, faithfully:
- N point particles in a square box with **periodic (toroidal) boundaries**.
- All particles move at the **same constant speed** v; only the heading θ changes.
- Each step (computed for all particles from current state, then applied):
  new θ_i = atan2( Σ_j sin θ_j , Σ_j cos θ_j ) over all j within radius r of i
  (i itself included), **plus** a uniform random perturbation in [−η/2, +η/2].
- Then move: x += v·cos θ, y += v·sin θ, wrapping around the box.
- Neighbor search is naive O(N²); fine for the few-hundred particles used here.
- **Order parameter** va = |(1/N) Σ (cos θ, sin θ)| ∈ [0,1]; 0 = disordered,
  1 = perfectly aligned. Exposed as `sim.order()` and shown in the readout.

This matches the model in Vicsek et al. (1995), eqs. for θ-update and the order
parameter φ (here written va).

## Sources used

1. Vicsek, T., Czirók, A., Ben-Jacob, E., Cohen, I., Shochet, O. (1995).
   "Novel type of phase transition in a system of self-driven particles."
   *Physical Review Letters* 75(6), 1226–1229.
   DOI: https://doi.org/10.1103/PhysRevLett.75.1226
   — The defining paper. Introduces the model, the order parameter, and the
   noise-driven order→disorder transition (originally argued continuous/second
   order).

2. Czirók, A. & Vicsek, T. (2000). "Collective behavior of interacting
   self-propelled particles." *Physica A* 281(1–4), 17–29.
   DOI: https://doi.org/10.1016/S0378-4371(00)00013-3
   — Follow-up review of the model's collective behavior and scaling.

3. Marchetti, M. C., Joanny, J. F., Ramaswamy, S., Liverpool, T. B., Prost, J.,
   Rao, M., Simha, R. A. (2013). "Hydrodynamics of soft active matter."
   *Reviews of Modern Physics* 85(3), 1143–1189.
   DOI: https://doi.org/10.1103/RevModPhys.85.1143
   — Places the Vicsek model in the broader active-matter / flocking-physics
   context; standard modern review.

4. Chaté, H., Ginelli, F., Grégoire, G., Raynaud, F. (2008). "Collective motion
   of self-propelled particles interacting without cohesion."
   *Physical Review E* 77(4), 046113.
   DOI: https://doi.org/10.1103/PhysRevE.77.046113
   — Large-scale study showing the transition is actually **discontinuous
   (first order)** in the proper thermodynamic / large-system limit, with
   travelling high-density bands and giant number fluctuations near threshold.

Toner & Tu (1995, *PRL* 75, 4326) is the relevant continuum theory explaining
why long-range order is possible in 2D for self-propelled particles, contra the
equilibrium Mermin–Wagner result; cited in prose conceptually, not numbered.

## Caveats / honesty

- **It is a physics caricature of flocking, not biology.** Particles are
  dimensionless points with no separation, no cohesion, no attraction — only
  alignment + noise. It captures the *transition to collective motion*, not the
  morphology or rules of any real flock. (Contrast the boids entry, which adds
  separation and cohesion for visual realism but no phase-transition emphasis.)
- **The order of the transition was refined after 1995.** Vicsek et al.
  originally reported a *continuous (second-order)* transition. Later large-scale
  work (notably Grégoire & Chaté 2004; Chaté et al. 2008) found that in the
  large-system limit the transition is actually **discontinuous (first order)**,
  with travelling density bands and "giant number fluctuations," and that the
  apparent continuity in the original study was a finite-size effect. The
  **basic order–disorder transition itself is robust and uncontested**; only its
  finer character (order of the transition, role of density and band structure)
  was debated and refined. The prose states the transition plainly and avoids
  over-committing to "second order."
- Real animal groups interact with a roughly fixed *number* of neighbors
  (topological), not a fixed *distance* (metric); the metric rule here is the
  classic Vicsek convention, kept for fidelity to the 1995 model. See the boids
  notes / Ballerini et al. (2008) for the topological refinement.

## Cross-links

Same category (Collective Motion) as **boids**; mutually relevant. Vicsek =
alignment + noise + phase transition; boids = three rules + behavioral realism.
The boids entry already cites Vicsek (1995); this entry links back to boids in
"The rule." Category-based related nav is handled by `lib/nav.js` via the
manifest.
