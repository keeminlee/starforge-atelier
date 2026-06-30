# Diffusion-Limited Aggregation — research notes & provenance

## Sources actually used

1. **Witten, T. A. & Sander, L. M. (1981).** "Diffusion-Limited Aggregation, a Kinetic
   Critical Phenomenon." *Physical Review Letters* 47(19), 1400–1403.
   https://doi.org/10.1103/PhysRevLett.47.1400
   — The originating paper. Introduces the lattice random-walker-sticks model and frames
   it as a "kinetic critical phenomenon." Source for the model definition and the
   far-from-equilibrium framing.

2. **Witten, T. A. & Sander, L. M. (1983).** "Diffusion-limited aggregation."
   *Physical Review B* 27(9), 5686–5697. https://doi.org/10.1103/PhysRevB.27.5686
   — The longer follow-up with the scaling analysis and fractal-dimension discussion.

3. **Niemeyer, L., Pietronero, L. & Wiesmann, H. J. (1984).** "Fractal Dimension of
   Dielectric Breakdown." *Physical Review Letters* 52(12), 1033–1036.
   https://doi.org/10.1103/PhysRevLett.52.1033
   — The dielectric-breakdown model (DBM), which generalizes DLA: growth probability
   ∝ local field raised to an exponent η. Source for the honest lightning / Lichtenberg
   connection (DBM, not literal DLA).

4. **Meakin, P. (1998).** *Fractals, Scaling and Growth Far from Equilibrium.*
   Cambridge University Press. — Standard reference for the wider family (electrodeposition,
   viscous fingering, mineral dendrites) and for the standard simulation accelerations
   (launch circle, kill circle, variable step length).

## Real-world occurrences (used in "In the wild")
- Mineral dendrites (manganese oxide on limestone bedding planes, "moss agate") — DLA-like
  statistics; commonly mistaken for fossils.
- Electrodeposition of metal from solution — one of the cleanest lab realizations of DLA.
- Viscous fingering in a Hele-Shaw cell — maps onto DLA mathematics in the appropriate limit.
- Lightning / Lichtenberg figures — DBM (Niemeyer et al.), not literal DLA. Flagged as such.

## The simulation

Grid model (`Uint8Array` occupancy + `Float32Array` attachment-order for color). Walkers
random-walk in the 8-neighborhood and stick on contact with probability `stickiness`.

Standard performance accelerations implemented:
- **Launch circle**: walkers spawn on a circle of radius R+5 around the seed, not from
  infinity (R = tracked bounding radius from the launch origin).
- **Kill circle**: a walker that escapes past ~2R + margin is discarded and a new one
  launched — otherwise return times explode.
- **Adaptive step length**: far from the cluster front the walker takes larger strides
  (proportional to its gap from the front, capped), reverting to unit steps near the front.
- **Batch growth**: many particles aggregated per frame (speed slider) for visible growth.
- Bottom-line mode launches from a horizontal line above the tallest growth and measures R
  as height, giving an upward forest.

## Caveats (honesty over hype)
- **DLA is an idealized model.** Real dendrites, electrodeposits, and sparks carry extra
  physics — surface tension, anisotropy, finite particle concentration, screening by the
  electric field rather than a diffusing flux — that pure DLA omits.
- **The fractal dimension ≈ 1.71 is for off-lattice (continuum) DLA in 2D.** On a square
  lattice (as in this simulation) the value differs slightly, and at large sizes the cluster
  develops **lattice anisotropy** — preferred growth along the lattice axes, producing a
  more cross-like / dendritic-crystal morphology rather than the perfectly isotropic
  continuum cluster. Our 8-neighborhood sticking softens but does not eliminate this. The
  ≈1.71 figure should be read as the canonical continuum value, not a measurement of this
  particular on-lattice toy.
- **Lightning is the related DBM, not literal DLA.** Stated explicitly in the prose.
- Stickiness < 1 (a "sticking probability" / surface-reaction model) genuinely changes the
  morphology toward denser clusters; this is a real and studied knob (it interpolates toward
  the Eden/compact growth regime), used here as an intuition-building control.
