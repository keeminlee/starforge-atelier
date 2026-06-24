# fisher-yates — research notes & provenance

## Sources actually used (web-verifiable)

- **Fisher & Yates, *Statistical Tables…*, 1938** — the original shuffle.
- **Durstenfeld, R. "Algorithm 235: Random permutation." CACM 7(7):420, 1964** — the modern in-place
  O(n) form used here.
- **Knuth, TAOCP Vol. 2, §3.4.2 (Algorithm P).** Uniformity proof + the modulo-bias / PRNG-state caveats.

## The lens

For i = n−1 down to 1, swap a[i] with a[random j in [0,i]]. Fixing position i picks uniformly among
i+1 candidates ⇒ any final arrangement has probability 1/n·…·1/2·1 = 1/n! ⇒ uniform over all n!.
The **naive** variant (j from [0,n) each time) yields n^(n−1) equally-likely sequences, not divisible
by n! for n>2 ⇒ biased. Verified by chi-square over the permutation distribution.

## Implementation note (this entry)

- Two phases: (1) animate one shuffle (cards; orange = position being fixed, blue = random partner,
  green = locked tail); (2) accumulate R shuffles into an n×n position×value frequency grid (reuses
  `Algo.grid`) that flattens to uniform 1/n (green border when a cell converges). Seeded.

## Verification

`tools/test-fisher-yates.mjs` — **9 checks green**:
1. **Chi-square** over ALL n! permutations below the χ²(0.001) critical value: n=4 (24 perms, df 23,
   crit 49.73) over 24k shuffles; n=5 (120 perms, df 119, crit 168.6) over 36k.
2. **Position×value uniformity:** every value lands in every position within 3% of 1/n (n=4,5,6).
3. Frequency-grid rows & columns each sum to R (every shuffle is a valid permutation).
4. Determinism; draw no-throw (both phases).

## Honesty notes

- Explicitly contrasts with the **biased naive shuffle** (j from [0,n)) and the famous
  `sort(()=>Math.random()-0.5)` bug; notes modulo bias and PRNG-state limits for large decks. The
  uniform-permutation guarantee is the exact claim, checked statistically.
