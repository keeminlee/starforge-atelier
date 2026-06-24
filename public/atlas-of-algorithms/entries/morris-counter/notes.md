# morris-counter — research notes & provenance

## Sources actually used (web-verifiable)

- **Morris, R. "Counting large numbers of events in small registers." *CACM* 21(10):840–842,
  1978.** The original algorithm (motivated by counting large numbers of events in a small 8-bit register).
- **Flajolet, P. "Approximate counting: a detailed analysis." *BIT* 25:113–134, 1985.** The
  rigorous analysis — confirms E[2^X − 1] = n and the variance n(n−1)/2.
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021), Lecture 1** —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html — approximate counting framing
  (the spine of this atlas's advanced wing).
- **Flajolet, Fusy, Gandouet & Meunier, "HyperLogLog," AofA 2007** — a direct descendant in
  production (Redis/Presto/BigQuery/Druid cardinality estimation).

## The guarantee (this is the lens — ADR-0005)

- **Unbiased: E[2^X − 1] = n, exactly.** One-line induction (in the entry): with C = 2^X,
  E[C_new | X] = (1−2^−X)·2^X + 2^−X·2^(X+1) = 2^X + 1, so each event adds 1 to E[C];
  C_0 = 1 ⇒ E[C_n] = n+1 ⇒ E[2^X−1] = n.
- **Variance n(n−1)/2** ⇒ single-counter relative error ≈ 1/√2 ≈ 0.707 (large). Averaging m
  independent counters keeps it unbiased and divides variance by m ⇒ rel.err ≈ 0.707/√m. The
  base can be tuned (Morris-α) to trade space for lower variance.
- **Space: Θ(log log n) bits** (store X ≈ log₂ n, which needs ≈ log₂ log₂ n bits) vs Θ(log n)
  exact.

## Verification — STATISTICAL (the architectural proof for the whole advanced wing)

`tools/test-morris-counter.mjs` asserts the *theorem's* bounds across many SEEDED trials (not a
hand-tuned threshold), via the real generator:

1. **Unbiasedness:** average of single-counter estimates over 2500 seeded trials at n=500 (and
   2000 trials at n=2000) is within 8–10% of n. (Per-run rel.std ≈ 0.707 ⇒ SE of the mean
   ≈ 0.707/√T ≈ 1.4% at T=2500, so the tolerance is ~6 SE — robust, and deterministic given the seeds.)
2. **The spread is real:** measured single-counter relative std ∈ [0.4, 1.0] (theory ≈ 0.707) —
   confirming the guarantee is about the *expectation*, not individual runs.
3. **Averaging works:** avg relative error with 64 counters < ½ that of 1 counter, and < 15%.
4. **Form:** every estimate is 2^X − 1 (estimate+1 is a power of two).
5. **Space:** Morris bits < exact bits at n=4000 (read from the live readout).
6. **Determinism** for a fixed seed; **draw() no-throw** across a full trace.

10 checks; runs in <1s.

## Honesty notes

- The entry is explicit that the answer is **unbiased, not exact** (±71% per single counter), and
  that the space win is *only* meaningful at scale (millions of counters) — not for one counter.
  No overclaiming of accuracy.
