# Excitable Media — research notes & provenance

Entry slug: `excitable-media` · Category: Pattern Formation

## What the sim is

The **Greenberg–Hastings cellular automaton**: the canonical discrete model of an
excitable medium. Each cell is in one of N states — resting (0), excited (1), and a
queue of refractory states (2 … N−1). Synchronous update each tick:

- A resting cell becomes excited iff ≥ `threshold` of its von Neumann (4) neighbors
  are excited (state 1).
- Any non-resting cell in state s advances to s+1; from N−1 it wraps to 0.

Excitation lasts one tick, then the cell is refractory for N−2 ticks (immune to
re-excitation), then rests. This produces traveling waves, target waves (from a
periodic pacemaker), and self-sustaining rotating spiral waves (from a broken
wavefront with a free end).

Seeds: **Spiral** (default — a broken/truncated excited front with a ramped
refractory band behind it, free end at grid center → curls into a rotating spiral
within ~1–2 s and reaches a steady ~12.5% excited fraction that persists
indefinitely); **Target waves** (single periodic pacemaker cell at center,
re-firing every N ticks → concentric rings); **Random** (~12% scatter of
excited/refractory cells → turbulent colliding waves and spontaneous spirals).

## Primary sources (used in the prose & References)

1. Greenberg, J. M. & Hastings, S. P. (1978). "Spatial Patterns for Discrete Models
   of Diffusion in Excitable Media." *SIAM J. Appl. Math.* 34(3), 515–523.
   — The model itself. https://doi.org/10.1137/0134040 (JSTOR: https://www.jstor.org/stable/2100888)

2. Winfree, A. T. (1972). "Spiral Waves of Chemical Activity." *Science* 175(4022),
   634–636. — Spiral waves in the Belousov–Zhabotinsky reaction.
   https://doi.org/10.1126/science.175.4022.634

3. Zaikin, A. N. & Zhabotinsky, A. M. (1970). "Concentration Wave Propagation in
   Two-dimensional Liquid-phase Self-oscillating System." *Nature* 225, 535–537.
   — Traveling concentration waves in the BZ reaction.
   https://doi.org/10.1038/225535b0

4. Davidenko, J. M., Pertsov, A. V., Salomonsz, R., Baxter, W., & Jalife, J. (1992).
   "Stationary and drifting spiral waves of excitation in isolated cardiac muscle."
   *Nature* 355, 349–351. — Direct observation of spiral waves in cardiac tissue;
   the re-entry / arrhythmia connection. https://doi.org/10.1038/355349a0

## Supporting background (for accuracy of "In the wild")

- **FitzHugh–Nagumo** is the classic *continuous* (PDE/ODE) caricature of excitable
  dynamics; the Greenberg–Hastings CA is the discrete analogue. FitzHugh, R. (1961),
  *Biophys. J.* 1, 445–466; Nagumo, Arimoto, Yoshizawa (1962), *Proc. IRE* 50, 2061.
- **Dictyostelium discoideum** cAMP signaling propagates as target and spiral waves
  during aggregation — a living excitable medium (well documented; e.g. work by
  Tomchik & Devreotes, and reviews by Goldbeter on cAMP oscillations/waves).
- **Spreading depression** (cortical/retinal): slow propagating waves of
  depolarization, implicated in migraine aura — Leão, A. A. P. (1944),
  *J. Neurophysiol.* 7, 359–390.
- General reference on spiral waves across chemistry and biology: Winfree, A. T.,
  *When Time Breaks Down* (1987); Mikhailov & Showalter (2006) review on control of
  waves in excitable media.

## Caveats (honesty over hype)

- **The CA is a caricature.** Greenberg–Hastings is a discrete, threshold-and-counter
  toy. Real excitable media are continuous and are modeled by reaction–diffusion PDEs
  (FitzHugh–Nagumo, Beeler–Reuter / Luo–Rudy for cardiac cells, the Oregonator for
  BZ). The CA omits real chemistry, ion channels, conduction velocity restitution,
  curvature effects on wave speed, etc.
- **What IS genuinely shared** is the qualitative phenomenology: a firing threshold,
  a refractory period that makes waves one-directional, target waves from periodic
  sources, and self-sustaining spirals nucleated from broken wavefronts. That
  skeleton is real and is what makes the model worth showing.
- **The cardiac connection is real and important** — re-entrant spiral waves =
  tachycardia, spiral breakup = fibrillation — but it must be stated as a shared
  *phenomenology*, not as a literal electrophysiological model. The prose says so
  explicitly.
- Cross-links: contrast drawn with `rps-spatial` (spirals via cyclic dominance, not
  excitability) and `reaction-diffusion` (stationary Turing patterns, not waves).

## Implementation notes

- Uint8Array grid + back buffer, swapped each tick; von Neumann neighborhood;
  toroidal (wrap-around) edges. Cell size 3 px. ImageData → offscreen canvas →
  scaled blit (same render path as `reaction-diffusion` / `rps-spatial`).
- Palette: resting near-black; excited near-white amber; refractory amber → teal →
  dark fade (glowing front, fading tail). N-entry ramp rebuilt whenever N changes.
- The target pacemaker is re-fired in `step()` whenever it returns to rest, so it is
  a clean periodic source even under neighbor perturbation.
- Controls: standardRail (randomize → Random seed), pattern select, sliders for
  states N (4–16), threshold (1–3), speed (steps/frame, 1–8), pointer paint of
  excited cells, readout (N · threshold · excited %).

## Verification performed

- `node --check site/entries/excitable-media/sim.js` → pass.
- `node tools/test-excitable-media.mjs` → all 7 assertions pass, exit 0:
  valid states; deterministic refractory advance s→(s+1) mod N incl. wrap;
  excitation rule fires with ≥ threshold excited neighbors; resting stays resting
  with none; threshold honored (2 needs 2); Spiral seed sustains activity (≈12.5%
  excited after 600 steps).
- Headless smoke checks confirmed all three seeds sustain (spiral ~12.5%, target
  ~7.1%, random ~12.4% excited at steady state).
