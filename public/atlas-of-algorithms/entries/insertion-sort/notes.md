# insertion-sort — research notes & provenance

## Sources actually used (web-verifiable)

- **CLRS, *Introduction to Algorithms*, 4th ed., §2.1.** The canonical treatment, and
  the source of the *loop-invariant* proof framing (initialization / maintenance /
  termination) that this entry's "The invariant" section follows.
- **Knuth, TAOCP Vol. 3, §5.2.1 "Sorting by Insertion."** Historical + analytical depth;
  insertion sort as one of the oldest sorting methods.
- **Sedgewick & Wayne, *Algorithms* 4th ed., §2.1** — https://algs4.cs.princeton.edu/21elementary/
  Confirms: stable, in-place, ~¼n² compares and ~¼n² exchanges on average for random
  input, best case n−1 compares (already sorted), worst case ~½n² (reversed).
- **CPython `listsort.txt`** (Tim Peters) —
  https://github.com/python/cpython/blob/main/Objects/listsort.txt — Timsort uses binary
  insertion sort to build/extend short runs; this is the "in the wild" claim's primary source.

## Facts asserted in the entry, and their basis

- Best case **Θ(n)** (one comparison per element, zero shifts) on already-sorted input;
  worst case **Θ(n²)** on reversed input with exactly **n(n−1)/2** shifts — arithmetic
  series, verified by the entry's own counter (and by the logic test's monotonicity check).
- **Stable** and **in-place (O(1) extra space)** — CLRS/Sedgewick.
- Production hybrids fall back to insertion sort for small/short runs: **Timsort**
  (Python `sorted`, Java `Arrays.sort` for object arrays) and **introsort** (common C++
  `std::sort`), with the cutoff typically ~16 elements. (Timsort: listsort.txt; introsort
  cutoff is implementation-defined — stated as "~16", hedged as approximate, in the prose.)

## Honesty notes (textbook vs production)

- We are explicit that insertion sort is asymptotically slow yet practically ubiquitous
  *as a subroutine* — not as a standalone general-purpose sort. The "In the wild" section
  frames it that way rather than implying anyone sorts large arrays with it directly.

## Verification

- `tools/test-insertion-sort.mjs`: runs the real generator on 200 seeded inputs across all
  four distributions and sizes 6–60; asserts (a) output equals the ascending sort oracle,
  (b) output is a permutation of the input, (c) the `sorted`-prefix invariant genuinely
  holds at every start/placed/done snapshot, (d) `draw()` never throws across the trace,
  (e) reversed input incurs strictly more comparisons than already-sorted input.
