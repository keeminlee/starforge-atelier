# Wave Function Collapse — provenance & caveats

## What this entry simulates

The **simple tiled model** of Wave Function Collapse (WFC): a grid of cells, each
starting in a superposition of all tiles, resolved by repeating
**observe → collapse → propagate** until every cell holds one tile. The tileset
is a "pipes" set — each tile has a 0/1 socket on each of its four edges
[N, E, S, W], and two tiles may be neighbors iff their touching edges match
(pipe-to-pipe, blank-to-blank). Base tiles (empty, straight, corner/elbow, tee,
cross) and their rotations are generated programmatically by rotating the socket
array. The matching rule guarantees the finished grid is a globally coherent,
connected pipe network. `empty` is weighted ~3× so networks stay sparse and
legible.

## Sources actually used

1. **Gumin, M. (2016). "Wave Function Collapse" algorithm.**
   https://github.com/mxgmn/WaveFunctionCollapse
   The reference implementation that popularized the algorithm and the
   observe/collapse/propagate framing, plus the overlapping and simple-tiled
   models.

2. **Karth, I. & Smith, A. M. (2017). "WaveFunctionCollapse is Constraint Solving
   in the Wild."** Proceedings of the 12th International Conference on the
   Foundations of Digital Games (FDG '17). ACM.
   Establishes that WFC is a constraint solver and that its propagation step is
   arc-consistency (the same idea used in Sudoku-style CSP solvers). Source for
   the "WFC *is* constraint solving" claim in the prose.

3. **Merrell, P. (2007). "Example-Based Model Synthesis."** Proceedings of the
   2007 Symposium on Interactive 3D Graphics and Games (I3D '07), 105–112.
   The earlier "model synthesis" work WFC descends from. Source for the lineage
   claim.

Real-world game examples (Bad North, Townscaper, Caves of Qud) are widely
documented uses of WFC or its descendants for procedural content generation;
mentioned as illustrative, not as primary technical sources.

## Caveats / honesty notes

- **WFC is an ALGORITHM, not a physical dynamical system.** It is a
  constraint-satisfaction / procedural-generation procedure. Unlike the Atlas's
  dynamical-systems entries (boids, Ising, reaction–diffusion), there is no
  time-stepped physics and no equilibrium being sought — a solver resolves a
  consistent assignment. This is the same *generative / algorithmic* flavor of
  emergence as the Atlas's **L-systems** entry, and the prose cross-links to it
  and makes the distinction explicitly.

- **"Wave function collapse" is a metaphor, not quantum mechanics.** The names
  "superposition," "observe," "entropy," and "collapse" borrow physics
  vocabulary for intuition. Nothing here involves actual quantum mechanics.

- **Contradiction handling is the simplest possible.** When propagation drives a
  cell to zero legal tiles, this entry restarts the whole grid from scratch with
  a fresh seed (counting restarts). Real-world implementations often **backtrack**
  (undo the last few choices) rather than discarding everything; restart-on-
  contradiction is chosen here for clarity and because the pipes tileset rarely
  contradicts on modest grids.

- **Determinism for tests.** The sim uses a seeded mulberry32 PRNG so the
  headless harness can drive reproducible runs; in the browser the seed defaults
  to the clock and is reset on randomize / grid change.

## Verification

- `node --check site/entries/wfc/sim.js` — syntax OK.
- `node tools/test-wfc.mjs` — asserts (1) monotonic collapse within a run
  (collapsed count never decreases until a restart, detected via the restart
  counter), (2) **coherence**: after solving to completion, every pair of
  orthogonally-adjacent collapsed cells has matching touching sockets, and
  (3) every collapsed cell holds a valid tile id. All pass.
