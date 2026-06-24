# minhash — research notes & provenance

## Sources actually used (web-verifiable)

- **Broder, A. "On the resemblance and containment of documents." SEQUENCES 1997.** The original
  MinHash; near-duplicate web-page detection at AltaVista.
- **Broder, Charikar, Frieze & Mitzenmacher, "Min-wise independent permutations," STOC 1998.** Why
  the hash family must be min-wise independent — the basis for this entry's honesty caveat.
- **Leskovec, Rajaraman & Ullman, *Mining of Massive Datasets* 2nd ed., Ch. 3** — http://www.mmds.org/
  Shingling → MinHash → LSH pipeline.
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021), Lectures 7–9** —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html

## The guarantee (the lens — ADR-0005)

- **P[minhash(A) = minhash(B)] = J(A,B)** for a random (min-wise independent) hash: the global
  minimizer over A∪B is uniform; signatures match iff it is in A∩B ⇒ probability |A∩B|/|A∪B| = J.
- The fraction of matches over m hashes is therefore unbiased with variance J(1−J)/m ⇒ relative
  error ~ 1/√m.

## Implementation note + a bug caught (honesty)

- **Hashes are truly random per element** (a fresh random value per universe element per hash),
  i.e. min-wise independent ⇒ exact P[match]=J. **First attempt used a linear hash
  `(a·x+b) mod p`** (2-universal, the obvious choice) and the test caught a real **~3–4% upward
  bias** in E[estimate] (≈38 SE over 1500 trials — not noise). Linear hashing is NOT min-wise
  independent. Switched to random ranks; bias gone. This is now the entry's "in the wild" caveat
  (production uses better families / one-permutation / bottom-k MinHash). A good example of the
  test gating correctness, not just plausibility.

## Verification — STATISTICAL (ADR-0005)

`tools/test-minhash.mjs` — **9 checks green**:
1. **Unbiasedness:** mean estimate over 1500 seeded hash families within 3% of true J at
   shared = 4, 10, 16 (true J = 0.111, 0.333, 0.667).
2. **Variance shrinks with m:** std at m=128 < ½ std at m=8.
3. **Boundary exactness:** identical sets ⇒ J=1 and estimate=1; disjoint ⇒ J=0 and estimate ≈ 0.
4. **Validity:** estimate ∈ [0,1] across 200 configs. 5. Determinism; draw no-throw.

## Honesty notes

- The min-wise-independence caveat is stated explicitly in the entry (the cheap linear hash biases
  the estimate). The fixed signature size m (independent of set size) is framed as the real win.
