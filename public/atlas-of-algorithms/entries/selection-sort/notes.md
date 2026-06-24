# selection-sort — research notes & provenance

## Sources actually used (web-verifiable)

- **CLRS, *Introduction to Algorithms*, 4th ed.** — selection sort appears as Problem 2-2;
  Chapter 6 develops heapsort, the efficient realization of the same "select the min/max"
  idea. Source for the n(n−1)/2 comparison count and the always-Θ(n²) (non-adaptive) trait.
- **Knuth, TAOCP Vol. 3, §5.2.3 "Sorting by Selection."**
- **Sedgewick & Wayne, *Algorithms* 4th ed., §2.1** — https://algs4.cs.princeton.edu/21elementary/
  Confirms: ~n²/2 compares and exactly n exchanges; **not stable**; insensitive to input order.

## Facts asserted in the entry, and their basis

- **Comparisons are Θ(n²) for every input** (best = average = worst): the double loop runs
  (n−1)+(n−2)+…+1 = n(n−1)/2 comparisons unconditionally. Verified by the logic test, which
  asserts the comparison count is identical across sorted/reversed/random/nearly inputs of
  the same size, and equals n(n−1)/2.
- **At most n−1 swaps** (0 when already sorted in the in-place version that skips i==min):
  the fewest of any comparison sort. The entry's swap counter and the test both check
  swaps ≤ n−1.
- **Not stable** — the standard in-place version can swap an equal key past its twin. Stated
  honestly; we do not claim stability.
- **Heapsort is selection sort with an O(log n) min-extraction** — CLRS Ch. 6. Framed as the
  conceptual legacy rather than implying selection sort itself is used at scale.

## Honesty notes (textbook vs production)

- We state plainly that selection sort is almost never the right general-purpose sort. Its
  only real niche is when *writes* dominate *compares* (the n−1 swap bound), and even that is
  situational. No overclaiming.

## Verification

- `tools/test-selection-sort.mjs`: 200 seeded inputs × 4 distributions × sizes 6–60. Asserts
  output equals the sort oracle; output permutes input; the strong invariant (prefix sorted
  AND max(prefix) ≤ min(tail)) holds at every start/placed/done snapshot; `draw()` never
  throws; comparisons are constant across input orders and equal n(n−1)/2; swaps ≤ n−1;
  determinism for a fixed seed.
