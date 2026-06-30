# Cascades — research notes & provenance

Watts's threshold model of global cascades on random networks. The entry pairs a
live force-directed network with the classic single-seed cascade dynamics and an
inset "cascade size vs average degree" sweep that makes the **cascade window**
(both its lower and upper boundary in connectivity) explicit.

## The model implemented

- **Network:** Erdős–Rényi G(N, p), with p chosen so the mean degree z = p·(N−1)
  matches the slider. (Watts uses this and related random-graph ensembles.)
- **Threshold rule:** every node carries the *same* fixed threshold φ ∈ [0,1] and
  activates the instant the *fraction* of its neighbours that are active reaches φ.
  Degree-0 nodes never activate unless seeded. This is **complex / threshold
  contagion** (a fraction must be active), contrasted with **simple contagion**
  (one active neighbour suffices), e.g. the Atlas's forest-fire and disease-style
  spreads.
- **Dynamics:** seed one random node, then iterate synchronous waves to a fixed
  point. Cascade size = fraction of nodes ending active. A "global cascade" is
  reported when > 50% of nodes activate.
- **Showpiece — the cascade window:** at fixed φ, single-seed cascades go global
  only for z in a middle band. Too sparse → fragmented, no paths, shock dies.
  In the window → a seed sweeps the giant component. Too dense → each node has so
  many neighbours that an early mover is below its threshold fraction, so the
  network is *robust* and the spark never catches. **More connectivity can mean
  more stability** — the counter-intuitive core result.

## Sources actually used

1. **Watts, D. J. (2002).** "A simple model of global cascades on random networks."
   *PNAS* 99(9), 5766–5771. — The primary source: threshold rule, the cascade
   window with lower *and* upper boundaries in z, the "vulnerable cluster" analysis,
   and the robust-yet-fragile character of dense networks.
   https://www.pnas.org/doi/10.1073/pnas.082090499
2. **Granovetter, M. (1978).** "Threshold models of collective behavior."
   *American Journal of Sociology* 83(6), 1420–1443. — The intellectual ancestor:
   individual thresholds for joining collective behaviour (riots, strikes, fads)
   and how the *distribution* of thresholds, not average sentiment, decides the
   outcome. https://www.jstor.org/stable/2778111
3. **Centola, D., & Macy, M. (2007).** "Complex contagions and the weakness of
   long ties." *American Journal of Sociology* 113(3), 702–734. — The simple-vs-
   complex contagion distinction used in "In the wild"; why behaviours needing
   reinforcement spread differently from diseases, and why "weak ties" can fail to
   carry them. https://www.journals.uchicago.edu/doi/10.1086/521848
4. **Gleeson, J. P., & Cahalane, D. J. (2007).** "Seed size strongly affects
   cascades on random networks." *Physical Review E* 75, 056103. — Cited in the
   honesty framing: single-seed results are sensitive to seed size; a small finite
   seed fraction can change where (and whether) global cascades occur.
   https://doi.org/10.1103/PhysRevE.75.056103

## Caveats (honesty framing)

- **Stylised model.** ER-random networks, a single fixed and known threshold φ
  shared by all nodes, and a single-node seed. Real networks have heterogeneous
  degree, clustering, and community structure; real thresholds vary across people
  and are not observable.
- **Simple vs. complex contagion is a real distinction but contested in practice.**
  Whether a given empirical cascade (a meme, a bank run, a blackout) is best modelled
  as simple or complex contagion is itself debated (Centola–Macy and subsequent work).
- **The cascade window is qualitative.** Its existence — with a lower boundary
  (need enough paths) *and* an upper boundary (dense networks are robust because no
  early mover is a large enough fraction) — is the robust takeaway. The exact window
  edges depend on φ, the degree distribution, and the seed size (Gleeson–Cahalane);
  this is not a quantitative forecast for any real system.
- **Layout is decorative.** The force-directed spring-electrical relaxation
  (reused from the preferential-attachment entry) is for visualization only and is
  not part of Watts's model. The inset sweep runs its own small scratch graphs.

## Cross-links

- **percolation** — static connectivity / whether a spanning path exists at all
  (contrast: cascades add a dynamic threshold rule on top of connectivity).
- **forest-fire** — *simple* contagion (one burning neighbour ignites a tree);
  contrast with the *complex* threshold contagion here.
- **preferential-attachment** — sibling Networks entry; the force-directed layout
  and node/edge rendering are reused from it.

## Verification performed

- `node --check site/entries/cascades/sim.js` → passes.
- `node tools/test-cascades.mjs` → all pass (exit 0). Asserts (1) monotone spread
  to a stable fixed point and (2) the cascade-window signature: at φ=0.18, N=250,
  mean single-seed cascade ≈ 36% at z=1.5, ≈ 72% at z=5 (window), ≈ 0.4% at z=18
  (dense → robust). Mid-z cascade is large and dwarfs both low-z and high-z.
- `node tools/shoot.mjs cascades` → screenshot confirms the network renders with a
  lit activation cascade and the inset window curve.
