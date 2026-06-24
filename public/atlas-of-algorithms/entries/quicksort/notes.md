# quicksort — research notes & provenance

## Sources actually used (web-verifiable)

- **Hoare, C. A. R. "Quicksort." *The Computer Journal* 5(1):10–16, 1962.** The original paper.
- **CLRS, *Introduction to Algorithms*, 4th ed., Ch. 7** — Lomuto partition, the partition loop
  invariant (a[lo..i) ≤ pivot, a[i..j) > pivot), average-case Θ(n log n) and worst-case Θ(n²).
- **Musser, D. R. "Introspective Sorting and Selection Algorithms," *Softw. Pract. Exper.*
  27(8):983–993, 1997** — introsort: quicksort with a depth-limit fallback to heapsort.
- **Sedgewick & Wayne, *Algorithms* 4th ed., §2.3** — https://algs4.cs.princeton.edu/23quicksort/
  Partitioning, pivot choice, in-place, **not stable**.

## Implementation note (this entry)

- **Lomuto partition** with pivot = last element, recursive (`yield*` for the two subcalls).
  Lomuto is shown because its single forward scan animates cleanly; Hoare's two-pointer scheme
  does fewer swaps but is harder to read as bars (mentioned, not shown).
- The `placed[]` mask marks elements in their **final** position (each placed pivot, each
  base-case singleton); these render green — the visible invariant.

## Facts asserted in the entry, and their basis

- **Partition invariant** (a[lo..i) ≤ pivot ≤ a[i+1..hi]) and **pivot lands in its final sorted
  position** — verified by the logic test at *every* pivot-placed frame (checks the split AND
  that a[p] equals the p-th element of the sorted oracle).
- **Average Θ(n log n), worst Θ(n²)** with the last-element pivot: an already-sorted input does
  exactly n(n−1)/2 comparisons (each partition peels one element). The test asserts
  cmp(sorted) == n(n−1)/2 and that it is ≫ cmp(random). Recursion depth Θ(n) in that case.
- **Not stable** — Sedgewick; stated plainly.
- **Introsort** is the production reality (depth-limited quicksort → heapsort fallback, +
  insertion-sort cutoff, + median-of-three / pdqsort pivots). C++ `std::sort` worst-case
  guarantee, Rust/Go pdqsort — Musser 1997 + widely documented standard-library behavior.

## Honesty notes (textbook vs production)

- The entry is explicit that the shown last-element-pivot quicksort is *fragile* (the sorted-input
  worst case is demonstrated live) and that **no serious library ships it raw** — they ship
  introsort/pdqsort with safeguards. The "brilliance and fragility" framing is the honest core.

## Verification

- `tools/test-quicksort.mjs`: 200 seeded inputs × 4 distributions × sizes 6–56. Asserts: equals
  the oracle; every frame permutes the input; the partition invariant + final-position property
  at every pivot-placed frame; `draw()` no-throw; the Θ(n²) worst case (sorted → n(n−1)/2
  comparisons, ≫ random); determinism. 11,175 checks green.
