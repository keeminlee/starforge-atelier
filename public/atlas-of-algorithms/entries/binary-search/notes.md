# binary-search — research notes & provenance

## Sources actually used (web-verifiable)

- **Knuth, TAOCP Vol. 3, §6.2.1 "Searching an Ordered Table."** The canonical analysis
  (⌊log₂ n⌋+1 worst-case probes) and the noted historical difficulty of correct implementation.
- **CLRS, *Introduction to Algorithms*, 4th ed.** — binary search (Ex. 2.3-6) and the
  O(log n) bound.
- **Bentley, *Programming Pearls*, 2nd ed., Ch. 4.** The famous claim that most professional
  programmers cannot write binary search bug-free on the first attempt; a correctness case study.
- **Bloch, J., "Nearly All Binary Searches and Mergesorts are Broken," Google Research blog,
  2006.** The `mid = (lo + hi) / 2` integer-overflow bug (present in `java.util.Arrays` for ~9
  years); fix is `lo + (hi - lo) / 2`. Source for the "minefield" claim.

## Implementation note (this entry)

- The array is **even values 2,4,…,2n** so that odd targets (and targets > 2n) are genuinely
  *absent*, letting the visualization exercise the empty-window (not-found) case — which the
  invariant section treats as rigorously as the found case.
- The dashed reference line (new `Algo.bars` `refValue` option) draws the target's height, so
  "is a[mid] above or below the line?" maps directly to the left/right decision on screen.

## Facts asserted in the entry, and their basis

- **≤ ⌊log₂ n⌋ + 1 probes** — Knuth §6.2.1. The logic test asserts the probe count never
  exceeds this bound across all sizes/targets, and that the counter grows ~log n, not n.
- **Live-window invariant** (present target always within [lo,hi]) — verified by the test at
  every framed window, for every present target.
- **Correct on absent targets** — verified against a linear-scan oracle, including an exhaustive
  sweep of every target in [1, 2n+1] at n=16.
- **Requires sorted input; sort-once-search-many** — standard precondition (Knuth/CLRS).
- **In the wild + the overflow bug** — B-tree indexes, `lower_bound`/`bisect`, `git bisect`,
  "binary search on the answer"; the JDK overflow bug (Bloch 2006). All attributed.

## Verification

- `tools/test-binary-search.mjs`: 220 seeded (n, target) cases sweeping present-even,
  absent-odd, and absent-too-large targets across sizes 6–56, plus an exhaustive n=16 sweep.
  Asserts: matches the linear-scan oracle for found AND absent; the live-window invariant holds
  for present targets; probes ≤ ⌊log₂ n⌋+1; `draw()` never throws. 875 checks green.
