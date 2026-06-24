# bloom-filter — research notes & provenance

## Sources actually used (web-verifiable)

- **Bloom, B. H. "Space/time trade-offs in hash coding with allowable errors." CACM 13(7):422–426,
  1970.** The original.
- **Broder & Mitzenmacher, "Network applications of Bloom filters: A survey." Internet Math. 1(4),
  2004.** Applications + the k = (m/n)·ln2 optimum.
- **Bose, P. et al. "On the false-positive rate of Bloom filters." IPL 108(4):210–213, 2008.** Shows
  the classic (1−e^(−kn/m))^k is an approximation (a lower bound) — the basis for this entry's honesty note.
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021)** — hashing.

## The guarantee (the lens — ADR-0005)

- **No false negatives (hard, one-sided):** an added item's k bits are all set and never cleared, so
  it always tests positive.
- **False-positive rate:** with fraction p of bits set, a random absent query passes ≈ **p^k**;
  estimating p ≈ 1−e^(−kn/m) gives the classic **(1−e^(−kn/m))^k**. Optimal k = (m/n)·ln2.

## Implementation note + a lesson the test taught

- m-bit array, k near-independent uniform hashes (Murmur-style finalizer, seeded). add sets k bits;
  test ANDs them. Visualize the bit array + a query's k probes (green all-set / orange false positive).
- **The test initially asserted tight agreement with the textbook (1−e^(−kn/m))^k and failed** —
  diagnosis showed the *empirical* rate matches **p^k from the actual measured load** (gap ~0.4%),
  while the closed form under-counts by several % at small m (consistent with Bose et al. 2008). Fixed:
  the entry predicts from the measured load (p^k) and labels the closed form as the large-m
  approximation. A clean example of the test correcting a textbook assumption.

## Verification

`tools/test-bloom-filter.mjs` — **10 checks green**:
1. **No false negatives** across ~thousands of (item × run) queries (the exact guarantee), recomputed
   from the bit data independent of the entry's query.
2. **FP rate ≈ p^k within 6%** and **within ~10% of the classic formula** (approximations — finite-size
   + hash effects), averaged over seeded runs.
3. **More bits ⇒ lower FP rate.** 4. Determinism; draw no-throw.

## Honesty notes

- The classic formula is explicitly called an approximation (under-counts at small m); the real
  driver is the actual load p^k. No deletions (would cause false negatives) — stated. Space win framed
  honestly (≈10 bits/item for ~1% FP, independent of item size).
