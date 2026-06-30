# Langton's Ant — research notes & provenance

## What it is

A two-dimensional Turing machine / agent on a grid. One ant with a position and
a heading (N/E/S/W) on a grid of colored cells. Classic two-state rule from an
all-white grid:

- On **white**: turn **right** 90°, flip cell to **black**, step forward.
- On **black**: turn **left** 90°, flip cell to **white**, step forward.

From a blank grid the ant produces a roughly symmetric, chaotic-looking blob
for ~10,000 steps, then spontaneously enters a periodic **104-step** cycle that
translates, building a diagonal **"highway"** that recurs forever.

Generalized to **turmites**: a rule string over {L,R} (one char per cell color);
the cell cycles colors 0→1→…→0 and the ant turns per the char for the current
color. "RL" is Langton's ant. Other strings give chaos, symmetric art, or
different highways.

## Sources actually used

1. **Langton, C. G. (1986).** "Studying artificial life with cellular automata."
   *Physica D: Nonlinear Phenomena* 22(1–3), 120–149.
   doi:10.1016/0167-2789(86)90237-X — original "vant"/ant model.
2. **Bunimovich, L. A. & Troubetzkoy, S. E. (1992).** "Recurrence properties of
   Lorentz lattice gas cellular automata." *Journal of Statistical Physics*
   67(2–3), 289–302. doi:10.1007/BF01049035 — the **unbounded-trajectory**
   theorem (the ant cannot be confined to a bounded region forever).
3. **Gajardo, A., Moreira, A., Goles, E. (2002).** "Complexity of Langton's
   ant." *Discrete Applied Mathematics* 117(1–3), 41–50.
   doi:10.1016/S0166-218X(00)00334-6 — **Turing-completeness** of the
   generalized ant system (prediction problem is P-complete; can compute any
   Boolean circuit / simulate a Turing machine).
4. **Stewart, I. (1994).** "The Ultimate in Anty-Particles." *Scientific
   American* 271(1), 104–107 — popular account of the highway and its
   ~10,000-step emergence.
5. **Wolfram, S. (2002).** *A New Kind of Science.* Wolfram Media — computational
   irreducibility (you must run the steps; no shortcut).
6. Background / cross-check: Wikipedia "Langton's ant"
   (https://en.wikipedia.org/wiki/Langton%27s_ant) and "Turmite"
   (https://en.wikipedia.org/wiki/Turmite) — for the 104-step highway period,
   the ~10,000-step onset, and example turmite strings. Used only to corroborate
   the primary literature above, not as a primary citation.

## Caveats (honesty)

- **The highway is empirical, not proved-from-arbitrary-configs.** From a blank
  grid the highway *always* emerges in practice (consistently around step
  9,977–10,000, period 104). What is *proved* (Bunimovich–Troubetzkoy 1992) is
  only that the trajectory is **unbounded**. A general proof that the highway
  must appear from *arbitrary* initial conditions is, as of writing, open. The
  entry states this distinction explicitly.
- **Not a biological ant.** This is an artificial-life abstraction. No real ant,
  and nothing else in nature, is known to follow this exact rule. Its worth is
  as the simplest demonstration that simple deterministic rules can hide long,
  unpredictable transients that resolve into structure.
- **Toroidal wrap.** This implementation wraps at the edges. With wrapping the
  highway will *eventually* run off an edge, reappear, and self-interact,
  re-entering chaos. To keep the headline phenomenon clean we use a large grid
  (cell size 3px → ~250×150 cells at default width, larger on wide screens), so
  the highway has plenty of room before any wrap. The headless test uses an even
  larger grid (~466×280) so wrap cannot interfere within the ~13,000 steps it
  checks.

## Implementation notes

- `sim.js`: `class Ant extends Atlas.Sim`. Headings 0=N,1=E,2=S,3=W; right=+1,
  left=−1 (mod 4). General rule string parsed to an `Int8Array` of ±1; "RL" is
  the special case. Toroidal wrap. `step()` runs many ant-steps per frame
  (speed slider, default 800) so the highway appears within seconds.
- Controls: `standardRail({ randomize })` (randomize picks a random preset rule
  + sprinkles starting cells); `rule` select (RL + 5 turmites); `speed` slider
  (ant-steps/frame); `ants` slider (1–6); `onPointer` paints/cycles cells;
  `readout` shows steps, colored-cell count, and a heuristic chaos/escaping/
  HIGHWAY phase label. Exposed for tests: `grid`, `ants`, `steps`, `cols`,
  `rows`, `antPos()`, `bboxSpan()`, `highwayBegun()`, `stepAnt()`.
- Render: cells via ImageData (palette: white→light, others→dark + a few hues),
  scaled to the canvas with smoothing off; ant drawn as a bright accent dot.
- `tools/test-langtons-ant.mjs`: determinism (two fresh runs identical), an
  exact 4-step checkpoint (4 right-turns return the ant to start with 4 black
  cells), and highway emergence (bounding-box span small at 9k, clearly growing
  through 12k→13k; `highwayBegun()` true by 13k; bbox stays off the edges).

## Cross-links

Related to **game-of-life** (the other discrete CA; a single agent on a CA grid
vs. a synchronous field) and **lenia** (the continuous-CA cousin). Suggested
manifest `related`: `["game-of-life", "lenia"]`.

## Observed in this build

On the default-width grid (~253×152) the chaotic blob spans ~87–92 cells through
step 10,000; the ant then escapes and `highwayBegun()` first fires at **step
12,222** (span 87→110→142→180 across steps 9k→13k). On the test grid (~466×280)
the same onset occurs with the bounding box staying well inside the interior.
