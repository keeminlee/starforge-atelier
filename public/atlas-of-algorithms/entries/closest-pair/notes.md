# closest-pair — research notes & provenance

## Sources actually used (web-verifiable)

- **Shamos, M. I. & Hoey, D. "Closest-point problems." FOCS 1975.** The original O(n log n) D&C.
- **Bentley, J. L. & Shamos, M. I. "Divide-and-conquer in multidimensional space." STOC 1976.**
- **CLRS, *Introduction to Algorithms*, 4th ed., §33.4 (Finding the closest pair of points).** The
  strip argument and the constant-neighbors-per-strip-point bound; T(n)=2T(n/2)+O(n).

## The lens

Sort by x; split at the median; δ = min(closest(left), closest(right)); then scan the 2δ strip in
y-order, each point vs its next ≤ 7 neighbors (stop when the y-gap ≥ δ). **Packing argument:** strip
points are ≥ δ apart within each half, so a δ×2δ box holds O(1) of them ⇒ constant work per strip
point ⇒ O(n) merge ⇒ O(n log n) total. Optimal in the comparison model; expected O(n) randomized exists.

## Implementation note (this entry)

- Recursive **generator** (`yield* rec(lo,hi)`) so the animation follows the recursion (base cases →
  merges → strip scans). Points in [0,1]². Viz: dashed median line, shaded δ-strip, green best-pair
  segment, blue strip candidates, current subproblem range highlighted (others dimmed). Reports the
  final closest pair + distance. Strip scan uses the y-gap early-exit (the key bound).

## Verification

`tools/test-closest-pair.mjs` — **302 checks green** (100 runs, n=8–28):
1. **Closest distance == brute-force O(n²) minimum** (the guarantee: strip scan misses nothing).
2. The reported pair actually realizes that distance.
3. No pair is strictly closer than the answer. Determinism; draw no-throw.

## Honesty notes

- States the O(n log n) needs the strip processed in linear time (pre-sort/merge by y), matches the
  comparison-model lower bound (optimal), and that exact strip tricks fade in high dimensions —
  pointing to spatial indexes and approximate methods ([[lsh]]) there.
