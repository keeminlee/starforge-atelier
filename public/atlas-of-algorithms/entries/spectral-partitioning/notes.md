# spectral-partitioning — research notes & provenance

## Sources actually used (web-verifiable)

- **Cheeger's inequality** (discrete) — the cornerstone bound λ₂/2 ≤ φ_G ≤ √(2λ₂) for the
  normalized Laplacian. Standard; see Spielman's SAGT lectures.
- **Spielman, D. *Spectral and Algebraic Graph Theory* (Yale)** —
  http://cs-www.cs.yale.edu/homes/spielman/sagt/ — Cheeger, the sweep/rounding proof, conductance.
- **Shi, J. & Malik, J. "Normalized cuts and image segmentation." IEEE TPAMI 22(8), 2000** —
  the normalized-cut application (in "in the wild").
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021), Lecture 16** —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html — Cheeger & spectral partitioning.

## The guarantee (the lens) + a correctness fix

- **Cheeger:** with λ₂ the 2nd-smallest eigenvalue of the **normalized** Laplacian
  L = I − D^(−1/2) A D^(−1/2), and φ_G the optimal conductance: **λ₂/2 ≤ φ_G ≤ √(2λ₂)**. The upper
  bound is constructive: some prefix of the Fiedler ordering (the sweep) achieves φ ≤ √(2λ₂).
- **Bug caught by the test:** the first version used the *combinatorial* Laplacian L = D − A, whose
  λ₂ does NOT obey Cheeger — the test's lower-bound check (λ₂/2 ≤ φ*) failed (0.658 ≰ 0.104). Fixed
  to the normalized Laplacian: power-iterate N + I (N = D^(−1/2)AD^(−1/2)) deflated against the
  D^(1/2)1 eigenvector to get ν₂; μ₂ = 1 − ν₂; the sweep vector is g = D^(−1/2)·(eigenvector). Now
  the bounds hold. (A second test-caught conceptual bug in the atlas, after MinHash's hash family.)

## Implementation note (this entry)

- 2-community SBM graph (backbone guarantees connectivity); Fiedler-ordering **sweep cut**
  minimizing conductance φ = cut / min(vol). Layout by (g₂, g₃); dashed vertical line = the sweep
  threshold; nodes colored by side; cut edges highlighted. Animation sweeps then settles on φ*.

## Verification

`tools/test-spectral-partitioning.mjs` — **12 checks green**:
1. **Cheeger** λ₂/2 ≤ φ* ≤ √(2λ₂) at n,mix = (30,5%),(20,3%),(40,8%).
2. The sweep's best φ* is the true minimum over all sweep positions.
3. **Recovery:** low mixing ⇒ a balanced split (both sides non-trivial) with φ* < 0.5.
4. λ₂ > 0 (connected); determinism; draw no-throw.

## Honesty notes

- Explicit that exact min-conductance is NP-hard and spectral gives a *provable approximation*
  (≤ √(2λ₂)); and that the **normalized** Laplacian is required for Cheeger (the combinatorial one
  isn't). Notes METIS-style multilevel methods as the practical alternative.
