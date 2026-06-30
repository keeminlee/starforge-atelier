# Pedestrian Lanes — research notes & provenance

## What the simulation implements

The **social-force model** of Helbing & Molnár (1995). Pedestrians are particles
in a 2D corridor that is **periodic in x** (exit one end, re-enter the other) and
**walled top and bottom**. Two groups: half want +x (right), half want −x (left).
Each step integrates a social force on each pedestrian i:

- **Driving (goal) force:** `(v0·e_i − v_i) / τ` — relax the velocity toward the
  desired velocity in the goal direction e_i = (±1, 0).
- **Pedestrian repulsion** from each nearby j:
  `A · exp((r_ij − d_ij)/B) · n_ij · w(φ)`, where d_ij is the centre distance,
  r_ij the sum of radii, n_ij the unit vector j→i, and w(φ) an optional anisotropy
  factor `λ + (1−λ)(1+cos φ)/2` that weakens the push from people behind you
  (Helbing's directional weighting). Only neighbours within ~4B are summed.
- **Wall repulsion:** the same exponential form from the top and bottom walls
  (and, in the Bottleneck scene, from a central wall with a gap).

Velocity is clamped to ~1.3·v0; x wraps periodically; y is clamped inside the walls.

### Parameters used (pixel world, 1 m ≈ 16 px)

| symbol | meaning | value |
|---|---|---|
| τ | relaxation time of the driving force | 0.5 s |
| v0 | desired walking speed (slider) | 1.3 m/s default (0.6–2.4) |
| r_i | pedestrian radius | 0.22 m (≈0.44 m shoulder width) |
| A | pedestrian repulsion scale (slider "repulsion") | 20 default (6–36) |
| B | range of pedestrian repulsion | **0.45 m** |
| A_wall, B_wall | wall repulsion scale / range | 9, 0.20 m |
| λ | anisotropy floor (1 = isotropic) | 0.20 when anisotropy on |
| dt | integration timestep | 0.08 s |

**Note on B:** Helbing & Molnár use B ≈ 0.3 m. I use **0.45 m** — a slightly longer
anticipation range — and a relatively large force scale A so that walkers deflect
each other *before* colliding. With Helbing's exact short-range values and this
corridor's modest density, walkers slipped past one another with too little
conflict and lanes formed only weakly; the longer range produces robust,
clearly-visible lane formation while keeping the same functional form. This is a
*presentation* tuning, not a change of mechanism.

### The lane-order metric

`laneOrder()` divides the corridor height into 12 horizontal strips. For each
occupied strip it computes the net polarization `|Σ dir| / Σ|dir|` (1 if every
walker in the strip goes the same way, 0 if perfectly balanced), then averages
over strips weighted by occupancy. A random intermixed crowd scores low (~0.15–0.2
here, not exactly 0 because of finite-strip sampling); clean lanes score high
(~0.6+). The headless test confirms a random start (~0.18) rises to ~0.58 after
1500 steps with no change in any walker's goal direction.

### Scenes

- **Counterflow corridor** (default) — the lane-formation showpiece. Robust across
  random seeds.
- **Bottleneck** — both streams funnel through a gap in a central wall. The crowd
  arches and clogs around the opening and passes through in bursts. It is stable
  (everyone stays in bounds). **Honesty:** the dramatic, clean "faster-is-slower"
  *flow drop* requires the additional body-compression and sliding-friction contact
  forces of Helbing, Farkas & Vicsek (2000), which this simplified model omits.
  What you see here is the arching/clogging that sets the stage for that effect;
  the prose describes faster-is-slower as the documented result of the fuller model
  rather than claiming the slider reproduces a clean throughput collapse.

## Caveats (and how the prose frames them)

- The social-force model is **one caricature among several**. Cellular / floor-field
  models and **vision-based** models (Moussaïd et al. 2011) exist and arguably fit
  real pedestrian trajectories better. The prose says so explicitly.
- **Lane formation itself is robust and real** — seen across model families and in
  actual crowds — so that headline result is solid.
- The original **"escape panic"** framing of crowd disasters has been heavily
  critiqued: real crowd accidents are driven by density / crowd-pressure and by
  poor information and signage, not by irrationality or "panic." The prose treats
  crowd disasters respectfully as engineering/organisational failures.
- Anisotropy is exposed as an on/off control; with it on, lanes sharpen.

## Sources (verified)

1. Helbing, D. & Molnár, P. (1995). "Social force model for pedestrian dynamics."
   *Physical Review E* 51(5), 4282–4286. doi:10.1103/PhysRevE.51.4282
   — the model implemented here (driving + exponential pedestrian/wall repulsion,
   anisotropic directional weighting).
2. Helbing, D., Farkas, I. & Vicsek, T. (2000). "Simulating dynamical features of
   escape panic." *Nature* 407, 487–490. doi:10.1038/35035023
   — adds body-force and friction contact terms; source of the "faster-is-slower"
   result and the (later-critiqued) "panic" framing.
3. Helbing, D., Buzna, L., Johansson, A. & Werner, T. (2005). "Self-organized
   pedestrian crowd dynamics: Experiments, simulations, and design solutions."
   *Transportation Science* 39(1), 1–24. doi:10.1287/trsc.1040.0108
   — lane formation, oscillations at bottlenecks, design solutions.
4. Moussaïd, M., Helbing, D. & Theraulaz, G. (2011). "How simple rules determine
   pedestrian behavior and crowd disasters." *PNAS* 108(17), 6884–6888.
   doi:10.1073/pnas.1016507108 — vision/heuristic-based alternative; cited as a
   model that may fit real trajectories better.

Background (not cited in-page): the critique of the "panic" framing is discussed in
e.g. Sieben, Schumann & Seyfried and in Still's crowd-safety work; the prose
reflects that consensus without a specific in-text citation.
