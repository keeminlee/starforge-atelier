# reservoir-sampling — research notes & provenance

## Sources actually used (web-verifiable)

- **Vitter, J. S. "Random sampling with a reservoir." *ACM TOMS* 11(1):37–57, 1985.** Algorithm R
  (shown here) and the faster Algorithm L (skip-ahead). Source of the k/i mechanic and the
  uniformity proof.
- **Knuth, TAOCP Vol. 2, §3.4.2** — Algorithm R.
- **Efraimidis & Spirakis, "Weighted random sampling with a reservoir," *IPL* 97(5), 2006** — the
  weighted (A-Res) variant cited in "In the wild."

## The guarantee (the lens — ADR-0005)

- **Uniformity:** after processing i items, each is in the reservoir with probability exactly k/i;
  hence k/n at the end. Proof by induction (in the entry): the (i+1)-th item is kept with prob
  k/(i+1); an old item survives with prob (k/i)·(1 − (k/(i+1))/k) = k/(i+1) — the cancellation that
  makes early items no more likely than late ones.

## Implementation note (this entry)

- Algorithm R, exactly: first k items fill the reservoir; item i (0-indexed, i ≥ k) draws
  j ∈ [0,i] and, if j < k, evicts slot j. Seeded for repeatability.
- The visualization shows the guarantee **empirically**: bars = each item's inclusion frequency
  over many seeded runs; the dashed line is the uniform target k/n; bars turn green within 2% of it.

## Verification — STATISTICAL: chi-square uniformity (ADR-0005)

`tools/test-reservoir-sampling.mjs` — **9 checks green**:
1. **Chi-square goodness-of-fit:** incl[i] ~ Binomial(R, k/n), expected R·k/n; the statistic
   Σ(obs−exp)²/exp ~ χ²(n−1). Over 6000 seeded runs the statistic is below the χ²(0.001) critical
   value at n=20 (df 19, crit 43.82), n=10 (df 9, 27.88), and n=32 (df 31, 61.10) — i.e. uniform.
2. **No order bias:** every item's empirical frequency within 3% of k/n; the first and last items
   are equally likely (the crux of the algorithm).
3. **Structural:** every run selects exactly k items (Σincl = R·k) with no item double-counted in a
   run (max incl ≤ R) ⇒ within-run distinctness.
4. **Determinism** for a fixed seed; **draw() no-throw**.

## Honesty notes

- We show Algorithm R (clearest), and note Algorithm L is the faster O(k·(1+log(n/k))) variant —
  not implying R is the production choice for huge n. The O(k)-space / single-pass win is the real claim.
