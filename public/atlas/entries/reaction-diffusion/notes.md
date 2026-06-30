# Reaction–Diffusion (Gray–Scott) — research notes & provenance

## What the entry models

The simulation is the **Gray–Scott** two-species reaction–diffusion system, a
particular and unusually rich member of the family of models descending from
Alan Turing's 1952 morphogenesis paper. Update rule per cell per tick:

```
U' = U + (Du·∇²U − U·V² + f·(1−U)) · dt
V' = V + (Dv·∇²V + U·V² − (f+k)·V) · dt
```

with Du = 0.16, Dv = 0.08, dt = 1.0, a 3×3 Laplacian stencil (center −1,
orthogonal neighbors +0.2, diagonals +0.05), toroidal wrap, U,V clamped to
[0,1]. `feed` (f) and `kill` (k) are the tunable knobs; the named presets are
standard regimes from the Gray–Scott / Pearson literature:

| Preset            | feed (f) | kill (k) |
|-------------------|----------|----------|
| Coral growth      | 0.0545   | 0.0620   |
| Mitosis           | 0.0367   | 0.0649   |
| Spots             | 0.0300   | 0.0620   |
| Maze              | 0.0290   | 0.0570   |
| Waves / U-skate   | 0.0140   | 0.0540   |

## Sources actually used

1. **Turing, A. M. (1952). "The Chemical Basis of Morphogenesis."** *Phil. Trans.
   R. Soc. Lond. B* 237(641): 37–72. The founding paper: diffusion-driven
   instability ("Turing instability") as a route to biological pattern.
   DOI: 10.1098/rstb.1952.0012 — https://doi.org/10.1098/rstb.1952.0012

2. **Gray, P. & Scott, S. K. (1984).** "Autocatalytic reactions in the
   isothermal, continuous stirred tank reactor: Oscillations and instabilities
   in the system A + 2B → 3B; B → C." *Chemical Engineering Science* 39(6):
   1087–1097. Origin of the cubic-autocatalysis kinetics this model uses.
   (Companion papers: *Chem. Eng. Sci.* 38 (1983) 29–43, and 40 (1985) 1769.)
   DOI: 10.1016/0009-2509(84)87017-7

3. **Pearson, J. E. (1993). "Complex Patterns in a Simple System."** *Science*
   261(5118): 189–192. The paper that mapped the Gray–Scott (f,k) plane and
   named the zoo of regimes (self-replicating spots, stripes, chaos) used for
   the presets here. DOI: 10.1126/science.261.5118.189 —
   https://www.science.org/doi/10.1126/science.261.5118.189

4. **Murray, J. D. (2003). *Mathematical Biology II: Spatial Models and
   Biomedical Applications* (3rd ed.).** Springer. Standard reference for
   reaction–diffusion modeling of animal coat patterns (how geometry/size of a
   domain selects spots vs. stripes). ISBN 978-0-387-95228-4.

5. **Kondo, S. & Miura, T. (2010). "Reaction-Diffusion Model as a Framework for
   Understanding Biological Pattern Formation."** *Science* 329(5999):
   1616–1620. Review + the zebrafish-stripe evidence that a Turing *system*
   (here built from interacting pigment cells, not diffusing chemicals) governs
   a real, manipulable biological pattern. DOI: 10.1126/science.1179047 —
   https://www.science.org/doi/10.1126/science.1179047

### Background / implementation references (algorithm, not cited in prose)
- Karl Sims, "Reaction-Diffusion Tutorial" — clear statement of the Gray–Scott
  discretization and the 3×3 Laplacian weights used here.
  http://www.karlsims.com/rd.html
- Standard treatments of the Turing-instability condition (activator diffuses
  slower than inhibitor → short-range activation, long-range inhibition).

## Caveats and honesty notes

- **Gray–Scott is a toy model.** It is a clean teaching vehicle for the Turing
  idea, not the biochemistry of any specific organism. The two "chemicals" are
  abstract; the constants are tuned for visual richness, not measured.
- **Model vs. mechanism.** Reproducing a leopard's spots with a reaction–
  diffusion model does *not* prove that leopards make spots this way. For most
  mammalian coat patterns the actual morphogens are not identified; the Turing
  account is a strong, well-supported hypothesis, not a demonstrated fact.
- **The confirmed cases are real but specific.** The zebrafish stripe is the
  cleanest experimental confirmation (Kondo & Miura), and notably the
  "diffusing chemicals" there are replaced by interacting pigment cells — the
  mathematics is reaction–diffusion even though the physical players differ from
  Turing's 1952 picture. Skin-appendage spacing (hair, feather buds) and some
  vegetation patterns also have good mechanistic support.
- **"Turing pattern in animals" is supported but not universal.** The entry
  deliberately distinguishes "modeled by" from "demonstrated to be caused by,"
  and flags the leopard/coat-pattern link as suggestive rather than settled.
- The clamp to [0,1] is a numerical safety rail, not part of the ideal
  continuous model; with the chosen constants the dynamics stay in-range anyway
  (verified by `tools/test-reaction-diffusion.mjs`).

## Verification done

- `node --check site/entries/reaction-diffusion/sim.js` → passes.
- `node tools/test-reaction-diffusion.mjs` → all assertions pass, exit 0:
  V-sum positive at seed; after ~8000 reactions every U and V is finite and in
  [−0.01, 1.01]; V-sum changes ~37% from seed (pattern genuinely evolves);
  a second regime (Mitosis) also stays bounded and keeps evolving.
