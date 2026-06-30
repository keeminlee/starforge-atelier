# Research notes — Slime mould networks (Physarum / Jones' agent model)

Provenance for the claims on this entry's page. Keep this honest: this entry's
simulation is an **agent model inspired by Physarum** (Jones' algorithm), *not*
a simulation of the organism. The real mould's documented capabilities (maze,
Tokyo rail) come from separate biological experiments and are reported as such.

## What the simulation actually is

- **Jones' Physarum agent model** (Jones 2010). A population of point agents on a
  2D toroidal grid coupled to a scalar "chemoattractant" trail field. Each agent
  per step: senses the trail at three sensor points ahead (front-left, front,
  front-right) at a sensor offset/distance and sensor angle; rotates toward the
  strongest sample by a rotation angle (front strongest → straight; a side
  strongest → turn that way; otherwise small random turn); moves forward a fixed
  step; deposits a fixed amount of trail at the new cell. The field then diffuses
  (mean/box filter) and decays (multiply by <1) each step.
- **Reference parameters** from the Jones 2010 model, used to tune defaults:
  sensor angle ~22.5°, rotation angle ~45°, sensor offset ~9 units, deposit ~5,
  decay ~0.1 per step, a few thousand agents on a few-hundred-cell field. These
  are the defaults in `sim.js`; sliders expose sensor angle, rotation angle,
  sensor distance, decay, agent count, and steps/frame.
- **This is a caricature.** It reproduces the *style* of Physarum network
  formation — branching, fusing, pruning of unused paths — via pure stigmergy
  (coordination through trail marks). It is not a biological model of the cell's
  mechanics (no cytoplasmic streaming, no membrane, no actual chemistry). The
  prose states this explicitly under "In the wild."

## Real organism — documented experiments (NOT this sim)

These are the real *Physarum polycephalum* results, kept clearly distinct from
the agent model:

- **Maze-solving.** Nakagaki, Yamada & Tóth (2000), *Nature* 407:470. A
  plasmodium spanning a maze with food at two ports retracts from dead ends and
  leaves a tube along the shortest connecting path. Short "Brief Communication."
- **Tokyo rail / adaptive network design.** Tero, Takagi, Saigusa, Ito, Bebber,
  Fricker, Yumiki, Kobayashi & Nakagaki (2010), *Science* 327(5964):439–442. Food
  sources placed in the layout of cities around Tokyo; the mould grew a network
  with efficiency / fault tolerance / cost comparable to the real Tokyo rail
  network, and the authors abstracted it into a mathematical adaptive-network
  model.

## Sources (real citations — verify metadata against primary scans on a later pass)

- Jones, J. (2010). "Characteristics of Pattern Formation and Evolution in
  Approximations of Physarum Transport Networks." *Artificial Life* 16(2):127–153.
  https://doi.org/10.1162/artl.2010.16.2.16202
- Tero, A., et al. (2010). "Rules for Biologically Inspired Adaptive Network
  Design." *Science* 327(5964):439–442.
  https://doi.org/10.1126/science.1177894
- Nakagaki, T., Yamada, H., Tóth, Á. (2000). "Maze-solving by an amoeboid
  organism." *Nature* 407:470. https://doi.org/10.1038/35035159

## Caveats / to verify on a later pass

- Citation metadata (volume/issue/pages, DOIs) recalled from standard references;
  the three core papers are well-known and widely cited, but page numbers and
  DOIs are worth confirming against primary scans on a later pass.
- The relationship between Jones' agent model and ant-colony optimization / other
  pheromone-based shortest-path methods is stated at a high level ("the same
  agent-and-pheromone logic underlies ant-colony optimization"); this is a
  qualitative family resemblance, not a claim that Jones' model and ACO are the
  same algorithm.
- The model's tendency to "reorganize toward more efficient layouts" is reported
  by Jones (2010) for the agent model; we do not claim the sim provably computes
  shortest paths or minimal spanning trees — only that it produces network-like
  structure of that flavor.

## Implementation / test notes

- `sim.js` exposes `this.trail` (Float32Array field), `this.W`/`this.H` (field
  dims), `this.n` (agent count), and `this.bx`/`this.by`/`this.ba` (agent x, y,
  heading). A `this._depositOn` flag lets the headless test isolate evaporation
  by suppressing deposition.
- `tools/test-slime-mold.mjs` asserts browser-independent invariants by driving
  `sim.step()`: (1) trail values stay finite and ≥ 0 throughout; (2) evaporation
  works — with deposition suppressed, total trail strictly decreases; (3) agents
  stay in-bounds on the torus and agent count is conserved.
