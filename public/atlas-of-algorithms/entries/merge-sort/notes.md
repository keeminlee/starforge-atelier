# merge-sort — research notes & provenance

## Sources actually used (web-verifiable)

- **CLRS, *Introduction to Algorithms*, 4th ed., §2.3** — the merge procedure, its loop
  invariant, and the T(n) = 2T(n/2) + Θ(n) = Θ(n log n) recurrence. Basis for the invariant
  and cost sections.
- **Knuth, TAOCP Vol. 3, §5.2.4 "Sorting by Merging"** — including external/tape merging, the
  source for the external-sort "in the wild" claim.
- **CPython `listsort.txt`** (Tim Peters) — https://github.com/python/cpython/blob/main/Objects/listsort.txt
  Timsort = adaptive natural merge sort (finds runs, merges them, insertion-sort for short
  runs). Source for the Timsort claims (Python `sorted`, Java `Arrays.sort` for objects).
- **Sedgewick & Wayne, *Algorithms* 4th ed., §2.2** — https://algs4.cs.princeton.edu/22mergesort/
  Top-down vs bottom-up, **stability**, the O(n) auxiliary-space cost, ~n lg n compares.

## Implementation note (this entry)

- Shown **bottom-up** (iterative, doubling run width) because it animates as a clean sequence
  of merges without recursion bookkeeping. Top-down recursion is equivalent in cost.
- **No-ghost display model:** during a merge the displayed segment shows
  `merged ++ left-remaining ++ right-remaining`, so each frame is a genuine permutation of the
  input (no transient duplicates). The logic test asserts this on *every* frame.

## Facts asserted in the entry, and their basis

- **Θ(n log n) comparisons in best = average = worst** — ⌈log₂ n⌉ passes × linear merge. The
  test asserts comparisons ≤ n·⌈log₂ n⌉ for all inputs, and that n=48 is far sub-quadratic;
  the prose's "counter barely moves between Random and Reversed" follows from input-independence.
- **O(n) auxiliary space** — the merge needs a buffer; merge sort is the time-for-space trade
  against in-place quadratic sorts (Sedgewick).
- **Stable** — ties go to the left run (`left[i] ≤ right[j]`), preserving original order. This
  is why Timsort/Java use it for objects (stability is a documented guarantee there).
- **External sorting / Timsort** — Knuth §5.2.4 and listsort.txt respectively.

## Honesty notes

- The O(n) space cost is stated plainly (not hidden) as the real trade-off. The entry shows
  the *bottom-up* variant and says so, rather than implying a single canonical form.

## Verification

- `tools/test-merge-sort.mjs`: 200 seeded inputs × 4 distributions × sizes 6–56. Asserts:
  equals the sort oracle; **every frame is a permutation of the input** (no-ghost model); the
  merged sub-range is sorted at every merge/merged/done frame; `draw()` never throws;
  comparisons ≤ n·⌈log₂ n⌉ (the n log n bound); sub-quadratic at n=48; determinism. 802 checks green.
