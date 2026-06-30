# Hopfield Network — research notes & provenance

## What the sim implements
- N = 24×24 = 576 binary neurons, s_i ∈ {+1, −1}, shown as a bitmap (+1 bright teal, −1 dark).
- **Storage (Hebbian):** patterns ξ^p (±1 N-vectors) stored as W_ij = (1/N) Σ_p ξ^p_i ξ^p_j, W_ii = 0.
- **Implementation choice — field-from-patterns, NOT the full matrix.** We never
  materialise the 576×576 weight matrix. We keep the patterns and a running cache of
  the dot products d_p = ξ^p · s, and compute the local field as
      h_i = (1/N) Σ_p ξ^p_i d_p − (L/N) s_i      (the −(L/N)s_i term subtracts W_ii=0's self-coupling)
  This is O(K·N) per sweep and is mathematically identical to s_i·(W s)_i with a zero
  diagonal. Energy is computed the same way:
      E = −½[ (1/N) Σ_p d_p² − L ]   (since Σ_ij W_ij s_i s_j = (1/N)Σ_p(ξ^p·s)² − L).
- **Dynamics (asynchronous):** neurons updated one at a time in a randomly-shuffled
  sweep order, s_i ← sign(h_i), ties (h=0) → +1. Async is required for the monotone
  energy guarantee; synchronous (all-at-once) updates can fall into 2-cycles. We use
  ASYNCHRONOUS updates.

## Patterns (6 defined; "stored" slider loads 1–6 into W)
heart, ring (annulus/O), checker (4×4), v-bars, h-bars, pinwheel (two opposite quadrants).
Chosen to be roughly balanced (≈40–50% +1) and **mutually near-orthogonal** (max
pairwise |overlap| ≈ 0.16, most ≈ 0). Low correlation is what makes each one a clean
attractor under Hebbian storage; correlated patterns produce crosstalk that
destabilizes recall. Verified: all 6 remain exact fixed points even when all 6 are loaded.

## Caveats / honesty framing
- **Toy model.** Binary, symmetric, fully-connected, weights frozen by one Hebbian
  snapshot. Real neurons are not binary, real synapses are not symmetric, and no brain
  region is fully connected. This captures a *principle* (emergent content-addressable
  memory), it is **not a biological brain model**.
- **Capacity ≈ 0.138·N** (Amit–Gutfreund–Sompolinsky, 1985) for random patterns. Beyond
  it, recall breaks down and spurious states dominate. (Our 6 hand-chosen, decorrelated
  patterns are well within capacity for N=576, so they all recall cleanly; the "stored"
  slider is there to *show* interference as it climbs, since correlated/crowded valleys
  still degrade recall.)
- **Spurious / mixture attractors** exist even below capacity — the network can settle
  into blends of stored patterns it was never taught.
- **Energy decreases only under ASYNCHRONOUS updates.** Synchronous updates can cycle.
- Shares its mathematics with the **Ising model / spin glasses**: same energy
  E = −½ Σ J_ij s_i s_j over ±1 spins.

## Sources actually used
1. Hopfield, J. J. (1982). "Neural networks and physical systems with emergent collective
   computational abilities." *PNAS* 79(8), 2554–2558. — original model, energy function,
   asynchronous dynamics, the "emergent collective computational abilities" title.
   https://www.pnas.org/doi/10.1073/pnas.79.8.2554
2. Hopfield, J. J. (1984). "Neurons with graded response have collective computational
   properties like those of two-state neurons." *PNAS* 81(10), 3088–3092.
   https://www.pnas.org/doi/10.1073/pnas.81.10.3088
3. Amit, D. J., Gutfreund, H. & Sompolinsky, H. (1985). "Storing infinite numbers of
   patterns in a spin-glass model of neural networks." *Physical Review Letters* 55(14),
   1530–1533. — capacity α_c ≈ 0.138.
   https://doi.org/10.1103/PhysRevLett.55.1530
4. Hebb, D. O. (1949). *The Organization of Behavior*. Wiley. — the Hebbian learning rule.
5. The Nobel Prize in Physics 2024 (John J. Hopfield and Geoffrey E. Hinton).
   https://www.nobelprize.org/prizes/physics/2024/summary/
6. (Context, not cited in prose as load-bearing) Ramsauer et al. (2020), "Hopfield Networks
   is All You Need" — modern Hopfield networks ↔ Transformer attention equivalence.
   https://arxiv.org/abs/2008.02217

## Verification
- `node --check site/entries/hopfield-network/sim.js` → pass.
- `node tools/test-hopfield-network.mjs` → all pass: states always ±1; every stored
  pattern is a fixed point (0 flips/sweep, overlap 1.0); energy non-increasing on every
  async update (max rise 0.0) with strict drops on some; 15%-corrupted pattern recovers
  to overlap 1.000 (≥ 0.95).
