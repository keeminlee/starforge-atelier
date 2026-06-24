# bubble-sort — research notes & provenance

## Sources actually used (web-verifiable)

- **Knuth, TAOCP Vol. 3, §5.2.2 "Sorting by Exchanging."** Source of the analysis and the
  oft-quoted verdict: *"the bubble sort seems to have nothing to recommend it, except a
  catchy name and the fact that it leads to some interesting theoretical problems."*
- **CLRS, *Introduction to Algorithms*, 4th ed., Problem 2-2.** Bubble sort correctness via a
  loop invariant — the basis for this entry's invariant section.
- **Sedgewick & Wayne, *Algorithms* 4th ed., §2.1** — https://algs4.cs.princeton.edu/21elementary/
  Elementary sorts and the compare/exchange cost model; bubble sort is stable and in-place.

## Facts asserted in the entry, and their basis

- **Best case n−1 comparisons / 0 swaps** with the `swapped`-flag early exit on already-sorted
  input; **worst case n(n−1)/2 comparisons AND n(n−1)/2 swaps** on reversed input. Verified by
  the logic test (sorted → exactly n−1 comparisons, 0 swaps; reversed → comparisons == swaps ==
  n(n−1)/2).
- Bubble sort does **as many swaps as comparisons** in the worst case (every out-of-order pair
  is swapped), unlike insertion sort (same comparisons, fewer moves) and selection sort (n−1
  swaps) — the entry's central honest comparison.
- **Stable** and **in-place** — Sedgewick/CLRS.
- The Knuth quote is widely cited from §5.2.2; presented as his assessment, attributed.

## Honesty notes (textbook vs production)

- The "In the wild" section states plainly that bubble sort is essentially used nowhere by
  design, and that it is dominated by insertion sort on the same inputs. It is included as a
  *teaching tool* (cleanest adaptive early-exit + suffix-growing invariant), explicitly labeled
  as such — not dressed up as practical.

## Verification

- `tools/test-bubble-sort.mjs`: 200 seeded inputs × 4 distributions × sizes 6–60. Asserts
  output equals the sort oracle; output permutes input; the suffix invariant (a[lo..n) sorted
  AND min(suffix) ≥ max(prefix)) holds at every start/pass-end/done/early-exit snapshot;
  `draw()` never throws; the adaptive best case (sorted → n−1 comparisons, 0 swaps); the worst
  case (reversed → comparisons == swaps == n(n−1)/2); determinism.
