# kruskal — research notes & provenance

## Sources actually used (web-verifiable)

- **Kruskal, J. B. "On the Shortest Spanning Subtree of a Graph and the Traveling Salesman Problem."
  Proc. AMS 7(1):48–50, 1956.** The original.
- **CLRS, *Introduction to Algorithms*, 4th ed., §21 (Minimum Spanning Trees).** Cut property, cycle
  property, Kruskal + union–find, O(E log E).
- **Sedgewick & Wayne, *Algorithms* 4th ed., §4.3 (MST)** — https://algs4.cs.princeton.edu/43mst/

## The lens

Cut property: the lightest edge crossing any cut is in some MST ⇒ accepting the cheapest edge joining
two components is safe. Cycle property: the heaviest edge on a cycle is in no MST ⇒ rejecting an edge
whose endpoints are already connected (it's the heaviest on the cycle it would close, since we go in
increasing weight) is safe. Sort dominates: O(E log E); union–find work O(E·α(V)) is effectively free.

## Implementation note (this entry)

- Connected weighted graph (random spanning tree + extra edges), seeded. Edges sorted ascending;
  union–find (path-compression + union-by-rank) for the cycle check — a deliberate cross-link to the
  `union-find` entry. Animates each edge: current (blue), accepted (green, thick), rejected (faint
  dashed). Nodes colored by union–find component (HSL) so the forest visibly merges into one tree.
  Reports edges, per-edge status, total weight, mstCount.

## Verification

`tools/test-kruskal.mjs` — **602 checks green** (120 graphs, n=6–10):
1. **MST total weight == an independent Prim's-algorithm oracle.**
2. Accepted-edge weights sum to the reported total.
3. Exactly **n−1 tree edges**.
4. The accepted edges form a **spanning tree** (connected & acyclic — verified by an independent union).
5. Edges processed in non-decreasing weight order. Determinism; draw no-throw.

## Honesty notes

- States that the sort dominates the cost and union–find is effectively free; compares to Prim (same
  asymptotics, Kruskal favors sparse/pre-sorted) and notes Borůvka (parallel) and Karger–Klein–Tarjan
  (randomized linear) as alternatives. The cut/cycle properties are given as the actual proof basis.
