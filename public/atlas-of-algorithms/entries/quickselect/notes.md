# quickselect — research notes & provenance

## Sources actually used (web-verifiable)

- **Hoare, C. A. R. "Algorithm 65: FIND." CACM 4(7):321–322, 1961.** The original selection algorithm.
- **Blum, Floyd, Pratt, Rivest & Tarjan, "Time bounds for selection." JCSS 7(4):448–461, 1973.**
  Median-of-medians → worst-case O(n).
- **CLRS, *Introduction to Algorithms*, 4th ed., §9 (Medians and Order Statistics).** The expected-O(n)
  analysis and the partition property.

## The lens

Partition places the pivot at its final sorted position p (left smaller, right larger) — a true rank.
Compare p to k; recurse into the ONE side holding k. Window invariant: "rank k ∈ [lo,hi]," shrinking
to a single cell. Average work n + n/2 + … ≈ 2n = O(n); worst O(n²) (mitigated by random pivot /
median-of-medians). Correctness is non-probabilistic; randomness only affects speed.

## Implementation note (this entry)

- Lomuto partition (pivot = a[hi]); recurse into one side by moving lo/hi. Reuses `Algo.bars` with a
  `colorFor`: pivot orange, current compare blue, confirmed-smaller region purple, discarded bars
  dimmed, the answer green when the pivot lands on rank k. k is 1-indexed in the UI, 0-indexed inside.

## Verification

`tools/test-quickselect.mjs` — **328 checks green** (80 runs over varied n and k, + extremes):
1. **Result = the true k-th smallest** (vs a fully-sorted oracle).
2. The answer ends at sorted **position k−1**.
3. The array is a **permutation** of the input (no value invented/lost).
4. **Partition property:** left of position k all ≤ answer, right all ≥.
5. **Extremes:** k=1 finds the min, k=n the max. Determinism; draw no-throw.

## Honesty notes

- States the O(n²) worst case honestly and the two standard fixes (random pivot; median-of-medians for
  guaranteed worst-case O(n), used as a fallback in introselect — `std::nth_element`, `numpy.partition`).
  Correctness is independent of pivot choice; only speed depends on it.
