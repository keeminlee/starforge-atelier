# Active Matter / Motility-Induced Phase Separation (MIPS) — research notes

## What the sim implements

An idealized **active Brownian particle (ABP)** model in a square box with
**periodic (toroidal) boundaries**, exhibiting **Motility-Induced Phase
Separation**. Per particle, per step:

- **Density-dependent self-propulsion.** Count neighbors ρ within an interaction
  radius R (=14 px). The propulsion speed is
  `v = v0 · clamp(1 − coupling·ρ/ρ_sat, vmin, 1)` with `vmin = 0.05`. A particle
  in open space moves at ~v0; one in a dense neighborhood crawls. This
  density-dependent speed is the heart of MIPS (Cates–Tailleur).
- **Rotational diffusion.** The heading θ random-walks: `θ += g · noise · √dt`,
  where g is an Irwin–Hall (sum of three uniforms) Gaussian-ish kick. There is
  **no alignment** to neighbors — unlike Vicsek/boids.
- **Soft excluded volume.** A short-range repulsion pushes particles apart when
  closer than a particle diameter (DIAM = 7 px), scaled by overlap. This keeps
  dense clusters as packings rather than singular collapses.
- **Move + wrap:** `x += v·cosθ + push`, `y += v·sinθ + push`, then wrap on the
  torus.

Neighbor counting uses a **coarse spatial grid** (cell size = R, 3×3 cell
neighborhood scan on the torus), so it stays cheap at the 400–800 particles used
here — O(N) in practice rather than O(N²).

A `coupling` parameter (default 1) multiplies the density term; setting it to 0
gives **constant speed v0** and disables MIPS — used by the headless test to
prove the density–motility coupling is what causes clustering.

**Clustering metric** (`sim.clustering()`): the *condensed fraction* — the
fraction of particles whose local neighbor count within R exceeds a
density-scaled threshold (`max(4, 1.6·mean-uniform-density)`). It is ~0 for a
uniform gas and rises sharply as a dense cluster forms. Exposed in the readout
and asserted by the test. Test result (deterministic seed, 900 steps, N=760,
ρ_sat=6): coupling ON 0.012 → 0.630; coupling OFF 0.012 → 0.009.

## Sources used

1. Cates, M. E. & Tailleur, J. (2015). "Motility-Induced Phase Separation."
   *Annual Review of Condensed Matter Physics* 6, 219–244.
   DOI: https://doi.org/10.1146/annurev-conmatphys-031214-014710
   — The defining review. Names MIPS and lays out the mechanism: particles
   accumulate where they move slowly, and (if they) move slowly where they
   accumulate, the positive feedback maps onto an effective phase-separation
   instability — phase separation with no microscopic attraction.

2. Tailleur, J. & Cates, M. E. (2008). "Statistical Mechanics of Interacting
   Run-and-Tumble Bacteria." *Physical Review Letters* 100, 218103.
   DOI: https://doi.org/10.1103/PhysRevLett.100.218103
   — Run-and-tumble bacteria with density-dependent swim speed; the original
   route to motility-induced clustering, the biological motivation.

3. Fily, Y. & Marchetti, M. C. (2012). "Athermal Phase Separation of
   Self-Propelled Particles with No Alignment." *Physical Review Letters* 108,
   235702. DOI: https://doi.org/10.1103/PhysRevLett.108.235702
   arXiv: https://arxiv.org/abs/1201.4847
   — Self-propelled repulsive disks with rotational noise and NO alignment phase
   separate well below close packing; shows clustering is a generic property of
   locally self-propelled systems. Closest in spirit to this sim's ABP setup.

4. Buttinoni, I., Bialké, J., Kümmel, F., Löwen, H., Bechinger, C. & Speck, T.
   (2013). "Dynamical Clustering and Phase Separation in Suspensions of
   Self-Propelled Colloidal Particles." *Physical Review Letters* 110, 238301.
   DOI: https://doi.org/10.1103/PhysRevLett.110.238301
   — Experimental Janus colloids fueled by light forming living, dynamic
   clusters — an experimental signature of MIPS, cited under "In the wild."

The broader active-matter context (Marchetti et al., *Rev. Mod. Phys.* 85, 1143,
2013) is the same review cited in the Vicsek entry; not numbered here.

## Caveats / honesty

- **Idealized active-Brownian caricature, not a faithful model of any real
  system.** Particles are featureless disks; the only physics is propulsion,
  rotational diffusion, soft repulsion, and a phenomenological speed-density law.
- **The density-dependent-speed form is a modeling choice.** Real bacteria,
  colloids and cells slow down for steric, chemical, or hydrodynamic reasons;
  the `clamp(1 − ρ/ρ_sat)` law is the simplest functional form that captures the
  Cates–Tailleur mechanism, not a measured constitutive relation.
- **Real active matter has hydrodynamics, particle shape, and chemistry this
  omits.** No fluid backflow, no torque alignment from flow, no chemotaxis.
- **The clusters here are dynamic, not static.** Particles continually join and
  leave the dense phase; a cluster is a steady coexistence, not a frozen solid.
  This is true of real MIPS too (Buttinoni et al. call them "dynamical
  clusters"), and is part of why MIPS is genuinely a *phase* phenomenon.
- The "cell tissues" example in the prose is flagged as suggestive, not literal —
  tissue jamming involves adhesion and active shape changes beyond this model.

## Cross-links

Same category (Collective Motion) as **vicsek** and **boids**. The contrast is
the point: vicsek/boids get order from *alignment* (and boids from cohesion);
this entry has neither, and clustering emerges from *motility + crowding* alone.
The prose links explicitly to both vicsek and boids in "The rule." Category-based
related nav is handled by `lib/nav.js` via the manifest.
