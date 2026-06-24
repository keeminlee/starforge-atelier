# union-find — research notes & provenance

## Sources actually used (web-verifiable)

- **Tarjan, R. E. "Efficiency of a Good But Not Linear Set Union Algorithm." JACM 22(2):215–225,
  1975.** The O(m·α(n)) amortized bound (inverse Ackermann), known tight.
- **CLRS, *Introduction to Algorithms*, 4th ed., §19 (Disjoint Sets).** Union by rank, path
  compression, the same-root invariant.
- **Sedgewick & Wayne, *Algorithms* 4th ed., §1.5 (Union–Find)** — https://algs4.cs.princeton.edu/15uf/

## The lens

Each set = a rooted tree; find returns the root. **Same set ⇔ same root.** union links two roots
(merging exactly those two sets); find only reshapes the tree (compression re-points to the same root).
union-by-rank keeps height O(log n); + path compression ⇒ O(α(n)) ≤ ~4 amortized per op.

## Implementation note (this entry)

- parent[] + rank[]; find walks to root then path-compresses; union by rank. Animated over a sequence
  of unions (each preceded by the two finds). Viz: elements in a row, parent arcs (child→parent), roots
  green; union edge orange, find path blue. Reports parent[], the union pairs, and find(i) for all i.

## Verification

`tools/test-union-find.mjs` — **244 checks green** (120 runs, n=6–14):
1. **Connectivity matches a reference partition** built (by label flood) from the same union edges —
   same-root ⇔ same-set for ALL pairs.
2. find(i) reaches a genuine root with no cycle.
3. **Path compression keeps trees shallow** (max depth ≤ 3 across runs at n=14).
4. sets = n − successful unions. Determinism; draw no-throw.

## Honesty notes

- Distinguishes the two optimizations: union-by-rank alone gives O(log n); compression on top gives the
  α(n) bound. The inverse-Ackermann result is attributed to Tarjan and noted as tight — not hand-waved
  as "basically O(1)" without the caveat.
