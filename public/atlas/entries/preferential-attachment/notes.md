# Preferential Attachment — research notes & provenance

## The model

The Barabási–Albert (BA) model. Network grows by **two** ingredients:

1. **Growth** — start from a small seed of m0 connected nodes; add one node per step.
2. **Preferential attachment** — each new node forms *m* edges; the probability of
   linking to existing node *i* is proportional to its degree *k_i*:
   Π(i) = k_i / Σ_j k_j.

Repeated, this produces a **scale-free** degree distribution P(k) ∼ k^−γ with
γ ≈ 3, dominated by a few high-degree **hubs**. The contrast mode (uniform/random
attachment) keeps growth but drops the degree bias, giving a narrow exponential (light-tailed)
degree distribution with **no hubs** — the key teaching contrast at fixed *m*.

### Implementation notes
- Preferential selection uses the standard **O(1) endpoint-array trick**: an
  array holds every edge endpoint (each node appears once per unit of degree);
  sampling it uniformly yields degree-proportional draws automatically. No need
  to recompute a cumulative distribution each step.
- A new node's *m* targets are drawn **without duplicates and without self-loops**
  (a `Set` of chosen targets, re-sampling on collision).
- Seed is a small connected clique of size m0 = m + 1 so every node starts with
  positive degree (so even the first preferential draws are well-defined).

## Caveats (honesty over hype)

- **BA is a minimal mechanism**, not a faithful model of any particular real
  network. Real networks add effects BA omits: node **fitness** (intrinsic
  attractiveness, so latecomers can sometimes overtake), **aging** (old nodes
  stop attracting links), spatial/resource **constraints**, rewiring, and decay.
- The **"scale-free everywhere" claim is contested.** Broido & Clauset (2019),
  analysing ~1,000 real networks, found strictly scale-free structure is *rare*;
  most networks are better fit by other heavy-tailed or non-power-law forms.
  BA should be presented as an influential *mechanism* for hub formation, not a
  universal law. The entry states this explicitly.
- Cumulative advantage **predates** BA: Price (1976) for citations, and earlier
  Yule (1925) / Simon (1955) for related "rich get richer" processes. BA
  reframed and popularized it for networks.
- The **force-directed layout is for visualization only** — springs along edges +
  Coulomb repulsion between nodes, relaxed each frame. It has nothing to do with
  the BA model; it only makes the graph structure legible. Node *positions* are
  not meaningful and not tested.

## Performance

- Node count is capped (50–400). O(n²) repulsion would be the natural choice but
  is approximated for smoothness near the cap: each node is repelled by a small
  **random sample** of others per frame **plus** the handful of top-degree hubs
  (always included, so the dominant forces are never missed). This is an
  approximation, noted in the sim header comment.

## Sources

- Barabási, A.-L. & Albert, R. (1999). "Emergence of scaling in random networks."
  *Science* 286(5439), 509–512. https://doi.org/10.1126/science.286.5439.509
- Albert, R. & Barabási, A.-L. (2002). "Statistical mechanics of complex
  networks." *Reviews of Modern Physics* 74(1), 47–97.
  https://doi.org/10.1103/RevModPhys.74.47
- Price, D. J. de Solla (1976). "A general theory of bibliometric and other
  cumulative advantage processes." *Journal of the American Society for
  Information Science* 27(5), 292–306. https://doi.org/10.1002/asi.4630270505
- Broido, A. D. & Clauset, A. (2019). "Scale-free networks are rare."
  *Nature Communications* 10, 1017. https://doi.org/10.1038/s41467-019-08746-5

## Cross-links
- Cross-linked in prose to **slime-mold** (Networks): another no-designer
  network-formation mechanism, but via agent trails / reinforcement rather than
  explicit node-by-node growth.
