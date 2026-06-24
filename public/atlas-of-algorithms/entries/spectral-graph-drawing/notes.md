# spectral-graph-drawing — research notes & provenance

## Sources actually used (web-verifiable)

- **Fiedler, M. "Algebraic connectivity of graphs." Czechoslovak Math. J. 23(2):298–305, 1973.**
  The Fiedler vector (eigenvector of λ₂) and algebraic connectivity.
- **Spielman, D. *Spectral and Algebraic Graph Theory* (Yale)** —
  http://cs-www.cs.yale.edu/homes/spielman/sagt/ — the Laplacian quadratic form xᵀLx, drawing
  graphs with eigenvectors; primary source for the invariant section.
- **von Luxburg, U. "A tutorial on spectral clustering." Stat. Comput. 17(4), 2007** — spectral
  clustering on the bottom Laplacian eigenvectors.
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021), Lectures 13–16** —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html — spectral graph theory; the
  Laplacian-eigenvector layout (Spielman lecture 2 referenced there).

## The idea (the lens)

- Position node i at (v₂[i], v₃[i]), the eigenvectors of the Laplacian L = D − A for its smallest
  nonzero eigenvalues. **v₂ minimizes xᵀLx = Σ_(i~j)(xᵢ−xⱼ)²** subject to Σxᵢ=0, ‖x‖=1 — i.e. the
  centered placement that minimizes total squared edge stretch; its value is λ₂ (algebraic
  connectivity). Edges within communities dominate, so the minimizer clusters them.

## Implementation note (this entry)

- Graph = a **stochastic block model** (C communities, pIntra=0.45, pInter=0.025) plus a backbone
  (a path within each community + one bridge between consecutive ones) that **guarantees
  connectivity** ⇒ λ₂ > 0. Seeded.
- Eigenvectors via `numlib.topEigenpairs` on **M = cI − L** (c = 2·maxDeg+1 ≥ λmax(L)), supplying
  the constant unit vector as a known `against` so we land on v₂ then v₃. The animation morphs node
  positions from a circle to the spectral layout (ease-in-out). **Colors are the planted truth;
  positions are unsupervised** (computed without labels) — stated in the caption.

## Verification

`tools/test-spectral-graph-drawing.mjs` — **12 checks green**:
1. **Eigen-residual:** rebuild L from the frame's edges; the Fiedler coordinate (as a unit vector)
   satisfies ‖Lv − λv‖ < 1e-2 at n,C = (36,3),(24,2),(40,4).
2. **Fiedler ⟂ constant:** coordinates sum to ≈ 0.
3. **Communities separated (the payoff):** average intra-community distance in the (v₂,v₃)
   embedding < 0.7 × average inter-community distance.
4. **Connectivity** λ₂ > 0; determinism for a seed; draw no-throw.

## Honesty notes

- The cost section is explicit that this uses a small DENSE Laplacian + power iteration (fine for
  dozens of nodes); real systems use sparse Lanczos/ARPACK (`eigsh`) on O(edges) nonzeros. We don't
  imply power iteration scales. Colors-are-truth / positions-are-unsupervised is stated so the
  "reveals communities" claim isn't circular.
