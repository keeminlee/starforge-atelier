# edit-distance — research notes & provenance

## Sources actually used (web-verifiable)

- **Wagner, R. A. & Fischer, M. J. "The String-to-String Correction Problem." JACM 21(1):168–173,
  1974.** The O(mn) DP algorithm.
- **Levenshtein, V. I. (1966)** — the distance metric.
- **CLRS, *Introduction to Algorithms*, 4th ed., §14 (Dynamic Programming).** Optimal substructure +
  overlapping subproblems; LCS (the sibling DP).
- **Needleman–Wunsch (1970) / Smith–Waterman (1981)** — sequence alignment (the "in the wild" claim).

## The lens

dp[i][j] = edit distance of A[0..i), B[0..j). Base: dp[0][j]=j, dp[i][0]=i. Recurrence: free diagonal
on match, else 1 + min(diag/up/left). Invariant: every cell is the true distance of its prefixes (so
the corner is the answer). DP = optimal substructure + overlapping subproblems ⇒ Θ(mn) replaces
exponential recursion.

## Implementation note (this entry)

- Reuses **`Algo.grid`** for the (m+1)×(n+1) matrix (with a header margin for the A/B characters drawn
  via the returned geometry). Fills row-major (one frame/cell), highlighting the current cell + its 3
  source neighbors; then backtracks an optimal alignment (green path). Cells shaded by value. Random
  strings over {a,b,c,d}; lengths controllable; seeded.

## Verification

`tools/test-edit-distance.mjs` — **366 checks green** (120 string pairs, lengths 3–8):
1. **Corner dp[m][n] == a memoized recursive oracle.**
2. **Every dp cell == the oracle's distance for that prefix pair.**
3. **Backtrack path valid:** (0,0)→(m,n), each step a unit diagonal/vertical/horizontal move.
4. Known distances: kitten→sitting=3, abc→abc=0, abc→abd=1, ""→abc=3.
5. Determinism; draw no-throw.

## Honesty notes

- States the Θ(min(m,n))-space variant exists if only the distance is needed, and Hirschberg's
  algorithm for alignment in linear space — so the Θ(mn) full table isn't the only option. Frames the
  grid as the canonical DP shape (shared with LCS / sequence alignment).
