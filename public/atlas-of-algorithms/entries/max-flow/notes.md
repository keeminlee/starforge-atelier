# max-flow — research notes & provenance

## Sources actually used (web-verifiable)

- **Ford, L. R. & Fulkerson, D. R. "Maximal flow through a network." Canad. J. Math. 8:399–404, 1956.**
  The method + the max-flow/min-cut theorem.
- **Edmonds, J. & Karp, R. M. "Theoretical improvements in algorithmic efficiency for network flow
  problems." JACM 19(2):248–264, 1972.** Shortest-augmenting-path (BFS) ⇒ O(VE²).
- **CLRS, *Introduction to Algorithms*, 4th ed., §24 (Maximum Flow).** Residual graphs, the theorem,
  Edmonds–Karp analysis.

## The lens

Augment along BFS-shortest residual paths until none remains. **Max-flow = min-cut:** at termination,
let A = nodes reachable from S in the residual graph; every A→Aᶜ edge is saturated and every Aᶜ→A edge
is empty, so flow across the cut = its capacity = total flow. Any flow ≤ any cut ⇒ this is optimal.
O(VE²) (Edmonds–Karp); Dinic O(V²E); almost-linear known (2022).

## Implementation note (this entry)

- Fixed 6-node layered network (S, two layers of 2, T), 8 edges; capacities seeded (shuffle reseeds).
  Edmonds–Karp with residual reverse edges. Animates each augmenting path (green) + its bottleneck,
  then the flow update; at the end computes the min cut by residual reachability and paints it orange.
  Custom directed-graph draw (flow/capacity labels, arrowheads). Reports edges, maxflow, cut set/edges/cap.

## Verification

`tools/test-max-flow.mjs` — **602 checks green** (100 seeded networks):
1. **Capacity:** 0 ≤ flow ≤ cap on every edge.
2. **Conservation** at every interior node (inflow = outflow).
3. **max-flow == brute-force min cut** (enumerate all 2⁴ s–t cuts) — the theorem.
4. Reported cut capacity == max flow; cut edges saturated.
5. Net out of S == net into T == flow value. Determinism; draw no-throw.

## Honesty notes

- Notes that BFS (shortest augmenting path) is what makes the bound capacity-independent O(VE²) — naive
  Ford–Fulkerson can run in time proportional to the (possibly huge) max flow. Points to Dinic and the
  2022 almost-linear result as the state of the art; the entry shows the canonical Edmonds–Karp.
