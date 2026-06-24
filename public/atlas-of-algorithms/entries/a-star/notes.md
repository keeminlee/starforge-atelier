# a-star — research notes & provenance

## Sources actually used (web-verifiable)

- **Hart, P. E., Nilsson, N. J. & Raphael, B. "A Formal Basis for the Heuristic Determination of
  Minimum Cost Paths." IEEE Trans. SSC 4(2):100–107, 1968.** The original A* (from the Shakey robot
  project). Source of admissibility ⇒ optimality.
- **CLRS, *Introduction to Algorithms*, 4th ed.** — shortest paths; A* as Dijkstra with a potential.
- **Russell & Norvig, *AIMA*, Ch. 3 (Informed Search)** — admissibility, consistency, optimality of A*.

## The lens

- f = g + h; with **admissible** h (never over-estimates remaining cost), the first extraction of the
  target has the optimal g. Proof in the entry (a node on an optimal path would have smaller f).
  h ≡ 0 ⇒ Dijkstra. Heuristic here: Manhattan distance × min terrain weight (a valid lower bound).

## Implementation note (this entry)

- Reuses the dijkstra terrain grid + the same best-first `search` helper, parameterized by a
  heuristic function hFn (hFn ≡ 0 gives Dijkstra — used to compute the contrast count). Same
  grid-maze draw (terrain + settled + path). The readout reports "A* settled N vs Dijkstra M".
- (Note: bfs/dijkstra/a-star now share a near-identical grid draw — backlog deslop: extract a shared
  pathfinder grid renderer, as was done for `Algo.bars`.)

## Verification

`tools/test-a-star.mjs` — **153 checks green** (50 seeded grids, widths 12–32, roughness 1–9):
1. **Optimality:** A* cost == an independent Dijkstra oracle's cost.
2. Path valid & cost = dist[tgt].
3. **Efficiency:** A* settles ≤ Dijkstra's cell count (and strictly fewer on ≥27/30 grids).
4. Determinism; draw no-throw.

## Honesty notes

- Explicit that the asymptotic worst case equals Dijkstra (a poor/zero heuristic settles everything);
  the win is the average case. Notes weighted A* trades optimality for speed (inadmissible h), and
  that production routing layers landmark heuristics + contraction hierarchies on top — not this raw form.
