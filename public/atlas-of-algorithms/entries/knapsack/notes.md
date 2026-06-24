# knapsack — research notes & provenance

## Sources actually used (web-verifiable)

- **Bellman, R. *Dynamic Programming*, Princeton, 1957.** The method (and the name).
- **CLRS, *Introduction to Algorithms*, 4th ed., §14 (Dynamic Programming) + §35.5 (FPTAS for
  subset-sum).** Optimal substructure, the O(nW) table, pseudo-polynomial / NP-hardness, the FPTAS.
- **Kellerer, Pferschy & Pisinger, *Knapsack Problems*, Springer 2004.** Comprehensive reference.

## The lens

dp[i][w] = best value from the first i items within capacity w = max(skip dp[i−1][w], take valueᵢ +
dp[i−1][w−weightᵢ]). Optimal substructure: an optimal packing either excludes item i (optimal for i−1
items) or includes it (the rest is an optimal packing of i−1 items into w−weightᵢ — else swap & beat
it). O(nW) time, O(W) space (only the previous row is read). Pseudo-polynomial (W is a value, not size)
⇒ NP-hard; FPTAS for large W.

## Implementation note (this entry)

- Full (n+1)×(W+1) table. Reuses `Algo.grid` with a header row (capacities) + header column (item
  `i·weight/value`, `∅` for row 0). Fills cell-by-cell showing the SKIP source (blue outline, above)
  and TAKE source (purple outline, above-left); then backtracks, marking taken items green. Seeded items.

## Verification

`tools/test-knapsack.mjs` — **452 checks green** (90 instances, n=3–6, W=6–13):
1. **DP optimum == brute-force 2ⁿ subset maximum.**
2. Backtracked items fit (weight ≤ W) and **realize the optimum** (value == dp[n][W]).
3. Chosen indices distinct (0/1: each item ≤ once).
4. **Recurrence holds at every cell:** dp[i][w] = max(skip, take). Determinism; draw no-throw.

## Honesty notes

- States the pseudo-polynomial subtlety explicitly (O(nW) is exponential in the input *length* because
  W is a number) and that knapsack is NP-hard, with the FPTAS as the polynomial-time approximation.
  The O(W) space optimization is noted but the entry shows the full table for clarity.
