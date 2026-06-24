# lsh — research notes & provenance

## Sources actually used (web-verifiable)

- **Indyk, P. & Motwani, R. "Approximate nearest neighbors: towards removing the curse of
  dimensionality." STOC 1998.** The original LSH.
- **Leskovec, Rajaraman & Ullman, *Mining of Massive Datasets* 2nd ed., §3.4** — http://www.mmds.org/
  The banding technique and the S-curve P = 1 − (1 − s^r)^b with threshold ≈ (1/b)^(1/r). Primary
  source for this entry's formula and tuning discussion.
- **Datar, Indyk, Immorlica & Mirrokni, "LSH based on p-stable distributions," SoCG 2004** —
  Euclidean LSH (cited in "in the wild").
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021), Lectures 9–10** —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html

## The guarantee (the lens — ADR-0005)

- Each MinHash row matches with probability s (the Jaccard similarity). A band of r rows all match
  with prob s^r; a pair is a candidate unless all b bands fail ⇒ **P(candidate) = 1 − (1 − s^r)^b**,
  an S-curve with inflection near **s* = (1/b)^(1/r)**. More bands lower s* (recall ↑); more rows
  raise it (precision ↑).

## Implementation note (this entry)

- Faithful to the MinHash-LSH model: a per-row match is simulated as **Bernoulli(s)** (justified
  because MinHash guarantees P[row match]=s), then banded. The empirical collision rate at 21
  similarities converges onto the theoretical curve. Seeded for repeatability.

## Verification — STATISTICAL (ADR-0005)

`tools/test-lsh.mjs` — **12 checks green** (4000 trials/point):
1. **Empirical matches the S-curve** (max error < 4%) at (b,r) = (10,4), (5,5), (20,2).
2. **Boundaries + monotonicity:** P(s=0)=0, P(s=1)=1, theoretical curve non-decreasing.
3. **Threshold:** s* = (1/b)^(1/r) exactly; the curve is near 0.5 there (∈[0.45,0.75]).
4. **Tuning:** more bands ⇒ lower s* (b=20 < b=5); more rows ⇒ higher s* (r=8 > r=2).
5. Determinism; draw no-throw.

## Honesty notes

- The b,r dial is framed as an explicit recall/precision trade-off (more bands → more candidates to
  verify). The "in the wild" section notes that for dense embeddings, graph indexes (HNSW) often
  beat LSH in practice, while LSH remains the provable, tunable, streaming-friendly baseline — not
  overclaiming LSH as universally best.
