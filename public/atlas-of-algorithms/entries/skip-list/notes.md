# skip-list — research notes & provenance

## Sources actually used (web-verifiable)

- **Pugh, W. "Skip Lists: A Probabilistic Alternative to Balanced Trees." CACM 33(6):668–676, 1990.**
  The original — coin-flip promotion, expected O(log n), the analysis.
- **Morin, P. *Open Data Structures*, §4 (Skiplists)** — https://opendatastructures.org/ — free,
  rigorous height/search-cost analysis. (Skip lists are not in CLRS; corrected from an earlier draft.)
- **Herlihy & Shavit, *The Art of Multiprocessor Programming*.** Lock-free concurrent skip lists.

## The lens (statistical guarantee — ADR-0005)

Level 0 holds all keys; promote to the next level with prob p=½ (geometric). Expected tower height
1/(1−p) = 2 ⇒ O(n) space; expected search O(log n) (≈ log₂ n levels × constant steps each, by the
backward-walk argument). **Correctness never depends on the coins** — the level-0 list is always a
correct sorted list, so search is always exact; randomness governs only speed.

## Implementation note (this entry)

- Seeded keys + geometric levels (capped at ⌈log₂(n+1)⌉). Search rides the top lane down (right while
  next < target, else drop). Viz: stacked lanes (L0 bottom), towers per key, lane links, sentinel −∞;
  search path blue, cursor orange, found node green; lane labels. Reports keys, levels, height, steps.

## Verification

`tools/test-skip-list.mjs` — **7 checks green**:
1. **Correctness:** every present key is found, every absent value rejected (vs a sorted-set oracle),
   across builds and all 1..99 probe values.
2. **Mean tower height ≈ 1/(1−p) = 2** (over ~3600 towers, within 0.25).
3. **Height stays O(log n)** (H ≤ ⌈log₂ n⌉ + 3 across 200 builds).
4. **Search cost logarithmic** (avg steps ≤ 5·log₂ n over many searches). Determinism; draw no-throw.

## Honesty notes

- Frames the guarantee as *expected* (probabilistic), with O(n) worst case — and stresses that
  correctness is independent of the randomness (only speed is probabilistic). Notes the real advantage
  is simplicity / easy concurrency vs balanced BSTs, not a better asymptotic bound (Redis ZSET, Java
  ConcurrentSkipListMap, Lucene, LSM memtables).
