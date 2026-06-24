# johnson-lindenstrauss — research notes & provenance

## Sources actually used (web-verifiable)

- **Johnson, W. B. & Lindenstrauss, J. "Extensions of Lipschitz mappings into a Hilbert space."
  Contemp. Math. 26:189–206, 1984.** The original lemma.
- **Dasgupta, S. & Gupta, A. "An elementary proof of a theorem of Johnson and Lindenstrauss."
  Random Struct. Algorithms 22(1):60–65, 2003.** The clean Gaussian-projection proof + the
  k ≈ (8/ε²)·ln n bound used here.
- **Ailon, N. & Chazelle, B. "The Fast Johnson–Lindenstrauss Transform." STOC 2006** — faster
  (Hadamard-based) projections, cited in "the cost."
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021), Lectures 7–8** —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html — dimension reduction.

## The guarantee (the lens — ADR-0005)

- Projection x ↦ (1/√k)·R·x with R having i.i.d. N(0,1) entries. **E‖proj(u)‖² = ‖u‖²** (the 1/√k
  scaling). ‖proj(u)‖²/‖u‖² is (1/k)·χ²_k ⇒ concentrates; within (1±ε) except w.p. ≈ e^{−kε²/8}.
  Union bound over the \binom{n}{2} pairs ⇒ **k ≈ (8/ε²)·ln n preserves all pairwise distances
  within (1±ε) whp** — independent of the source dimension D.
- The bound is **worst-case / pessimistic**; empirically (and in this demo) concentration is faster.
  Stated as an honest caveat.

## Implementation note (this entry)

- D = 80 source dims; n random Gaussian points; a single kMax=64-row Gaussian matrix (via
  `numlib.gaussianVector`), and dimension-k projection uses its first k rows scaled 1/√k — so
  scrubbing k adds rows (coherent animation). Calibration scatter: (true dist, projected dist) per
  pair; green diagonal = preserved; dashed ±ε band; dots green inside / orange outside. Seeded.

## Verification — STATISTICAL (ADR-0005)

`tools/test-johnson-lindenstrauss.mjs` — **7 checks green**:
1. **Length-preserving:** mean distance ratio ≈ 1 at large k (avg over 12 seeds within 5%).
2. **Concentration improves with k:** std of the ratio at large k < at small k in ≥11/12 seeds.
3. **Within-band rises with k** and ≥ 80% of pairs are within ±ε at large k.
4. Projected distances finite & non-negative across a sweep. 5. Determinism; draw no-throw.

## Honesty notes

- The worst-case-vs-practice gap is stated (real concentration beats the (8/ε²)ln n bound). The
  D-independence of k is highlighted as the surprising, useful core. Pairs naturally with LSH
  (project then index) — cross-linked.
