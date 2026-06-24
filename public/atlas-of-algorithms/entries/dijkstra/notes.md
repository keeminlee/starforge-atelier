# dijkstra — research notes & provenance

## Sources actually used (web-verifiable)

- **Dijkstra, E. W. "A note on two problems in connexion with graphs." Numerische Mathematik
  1:269–271, 1959.** The original algorithm.
- **CLRS, *Introduction to Algorithms*, 4th ed., §22.3 (Dijkstra's algorithm).** Priority-queue
  implementation, the O((V+E)log V) bound, and the proof that a settled node's distance is final
  (requires non-negative weights) — basis for this entry's invariant.
- **Fredman & Tarjan, "Fibonacci heaps…", JACM 34(3), 1987** — the O(E + V log V) bound.
- **Sedgewick & Wayne, *Algorithms* 4th ed., §4.4** — https://algs4.cs.princeton.edu/44sp/

## The lens

- Settle the min-distance unfinished node; its distance is final because any alternative path leaves
  the settled set at some node with distance ≥ d and then adds only **non-negative** weight. Breaks
  with negative edges (→ Bellman–Ford). Equal weights ⇒ Dijkstra = BFS.

## Implementation note (this entry)

- Weighted grid; terrain costs 1..(1+roughness) from a smoothed random field (valleys & ridges).
  Edge cost = weight to ENTER the destination cell; dist[src]=0. **O(V²) scan** for clarity (the
  shipped/standard version uses a binary-heap PQ — stated in the cost section). Reuses the grid-maze
  visualization; settled region shaded over the terrain, cheapest path in green.

## Verification

`tools/test-dijkstra.mjs` — **153 checks green** (50 seeded grids, widths 12–32, roughness 1–9):
1. **dist[tgt] matches an independent Dijkstra oracle** (least cost).
2. **Every settled cell's distance is final/correct** (settled ⇒ final, vs oracle).
3. **Path is least-cost & valid:** cost = Σ entered weights = dist[tgt]; adjacent steps; right endpoints.
4. **Finalized invariant:** settle order is non-decreasing in distance.
5. Determinism; draw no-throw.

## Honesty notes

- The invariant section is explicit that the non-negative-weight assumption is load-bearing (negative
  edges break it → Bellman–Ford). The O(V²) demo vs the O((V+E)log V) heap version is stated; A* /
  contraction hierarchies named as the production descendants — no implication this raw version is
  what routes a continent.
