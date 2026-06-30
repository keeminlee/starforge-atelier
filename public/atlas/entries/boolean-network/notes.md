# Random Boolean Networks (Kauffman NK) — research notes & provenance

## What the sim implements

Kauffman's NK random Boolean network. N nodes, each ON/OFF (1/0). Each node is
wired at construction to K randomly chosen input nodes (self and duplicates
allowed — the standard construction) and assigned a random Boolean function:
a lookup table of 2^K outputs, each entry drawn 0/1 with P(1) = p (default
p = 0.5). Update is **synchronous** (all nodes advance at once from the previous
state), which makes the dynamics deterministic, so the network always falls into
a repeating attractor (state cycle).

The order parameter on display is **damage spreading**: two copies of the *same*
network (identical wiring + identical truth tables) are run from initial states
differing in exactly one node, and the **Hamming distance** between them is
tracked over time. Ordered regime → damage heals to 0; chaotic regime → damage
spreads to a finite fraction of N; criticality → marginal.

## Sources actually used

1. **Kauffman, S. A. (1969).** "Metabolic stability and epigenesis in randomly
   constructed genetic nets." *Journal of Theoretical Biology* 22(3), 437–467.
   The original paper introducing random Boolean networks as a model of gene
   regulation, the attractors-as-cell-types idea, and "order for free."
   DOI: 10.1016/0022-5193(69)90015-0

2. **Kauffman, S. A. (1993).** *The Origins of Order: Self-Organization and
   Selection in Evolution.* Oxford University Press. The comprehensive technical
   treatment of NK networks, the order/chaos/critical regimes, and the edge-of-
   chaos argument.

3. **Derrida, B. & Pomeau, Y. (1986).** "Random networks of automata: a simple
   annealed approximation." *Europhysics Letters* 1(2), 45–49. The "annealed
   approximation" that yields the **critical connectivity Kc = 1/(2p(1−p))**
   (= 2 at p = 0.5) and frames the transition in terms of damage spreading /
   the divergence of nearby trajectories. DOI: 10.1209/0295-5075/1/2/001

4. **Kauffman, S. A. (1995).** *At Home in the Universe: The Search for the Laws
   of Self-Organization and Complexity.* Oxford University Press. The popular-
   audience account of "order for free" and "life at the edge of chaos."

5. **Aldana, M., Coppersmith, S. & Kadanoff, L. P. (2003).** "Boolean Dynamics
   with Random Couplings." In *Perspectives and Problems in Nonlinear Science*
   (Springer/Applied Mathematical Sciences), pp. 23–89. A modern review of
   random Boolean network dynamics, the annealed approximation, the ordered/
   chaotic/critical phases, and damage spreading (Hamming distance) as *the*
   standard order parameter. arXiv: nlin/0204062

Supplementary background (not cited on the page, used to sanity-check claims):
Drossel, B. (2008), "Random Boolean Networks," in *Reviews of Nonlinear Dynamics
and Complexity* (arXiv:0706.3351) — a careful review confirming the Kc formula,
the phase structure, and the standing caveats about synchronous update.

## Caveats and honesty framing (carried into the prose verbatim in spirit)

- **"Order for free" and "life at the edge of chaos" are influential
  HYPOTHESES, not established fact.** The page says so plainly. The NK model is a
  highly idealized cartoon of gene regulation; the claim that real biology is
  tuned to criticality is suggestive but actively contested.

- **The Kc = 1/(2p(1−p)) critical connectivity IS a real, solid result**, via the
  Derrida–Pomeau annealed approximation. This is the load-bearing piece of math
  and is presented as fact (distinct from the grand biological story). At p = 0.5
  it gives Kc = 2; biasing p toward 0 or 1 raises Kc, so order returns at higher K
  — reproducible directly in the sim with the bias slider.

- **Synchronous update is itself an idealization.** It gives clean deterministic
  attractors (which is what makes the model tractable and the demo legible), but
  real gene-regulatory networks are asynchronous, with delays and noise. Some of
  the precise attractor statistics in Kauffman's original work are known to be
  artifacts of synchronous update; the qualitative order→chaos transition and the
  Kc location are robust to update scheme.

- **Damage spreading / Hamming distance is the standard order parameter** for the
  transition, equivalent to the Derrida-map / sensitivity-to-initial-conditions
  picture. That is exactly the quantity the two-copy visualization and the test
  measure.

## Verification

- `node --check site/entries/boolean-network/sim.js` → passes.
- `node tools/test-boolean-network.mjs` → all pass (exit 0). Asserts: states are
  always 0/1; synchronous update is deterministic (identical state ⇒ identical
  trajectory; node-0 lookup matches by hand); and the edge-of-chaos signature —
  averaged over 8 fresh random networks, mean final Hamming damage was ≈ 0.25 of
  N=600 at K=1 (heals) versus ≈ 247 at K=5 (floods), i.e. K=5 damage ≫ K=1; plus
  frozen fraction ≈ 0.998 at K=1 vs ≈ 0.003 at K=5.
