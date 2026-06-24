# pagerank — research notes & provenance

## Sources actually used (web-verifiable)

- **Page, Brin, Motwani & Winograd, "The PageRank Citation Ranking," Stanford InfoLab tech report
  SIDL-WP-1999-0120, 1999.** The original. (The 1998 WWW7 "Anatomy of a Large-Scale Hypertextual Web
  Search Engine" is the separate, related paper.)
- **Langville & Meyer, *Google's PageRank and Beyond*, Princeton 2006.** The Google matrix, power
  iteration, convergence rate ≈ d, teleportation/dangling handling.
- **Spielman, *Spectral and Algebraic Graph Theory* (Yale)** — random walks on graphs.
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021)** — random walks.

## The lens

Google matrix P = d·M + (1−d)/n·𝟙 (column-stochastic). PageRank r = its stationary distribution:
r ≥ 0, Σr = 1, P·r = r (dominant eigenvector, eigenvalue 1). Perron–Frobenius (teleport ⇒ irreducible,
aperiodic) gives existence/uniqueness; power iteration converges geometrically at rate d. Teleport
prevents rank leaking into dangling pages / sink cliques.

## Implementation note (this entry)

- Direct power iteration on the stochastic Google matrix (NOT numlib's symmetric power iteration — the
  Google matrix isn't symmetric; the dominant eigenvector is found by iterating P directly). Iterates
  to residual < 1e-9 (≤200 steps) and animates a ~38-frame sample. Directed graph with out-links biased
  to low indices (hubs); circular layout; node size ∝ √rank; top node green. Dangling mass spread uniformly.

## Verification

`tools/test-pagerank.mjs` — **243 checks green** (60 graphs, n=6–12, d=50–95%):
1. **Probability distribution:** ranks sum to 1 and are non-negative.
2. **Stationary:** ‖P·r − r‖ < 1e-3 (one more step barely moves it).
3. **Matches an independent power-iteration oracle** (re-implemented from the frame's edges).
4. Reported top page = argmax rank. Determinism; draw no-throw.

## Honesty notes

- Notes that at scale PageRank is power iteration on the sparse link matrix (O(edges)/iter, near-linear),
  not a literal eigendecomposition; convergence slows with damping (rate ≈ d). Teleportation's role
  (proper distribution, irreducibility) stated explicitly.
