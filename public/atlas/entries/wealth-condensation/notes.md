# Wealth Condensation — provenance & caveats

## The model

The **yard-sale model** (a.k.a. kinetic wealth-exchange model). N agents each
start with equal wealth (1.0 here; total = N). Each transaction:

1. Pick two distinct agents i, j uniformly at random.
2. Stake Δ = f · min(w_i, w_j) — a fraction f of the **poorer** agent's wealth.
3. Flip a **fair** coin: with probability ½, i gains Δ and j loses Δ; otherwise
   the reverse.

Every trade is symmetric, zero-sum, and fair. Total wealth is conserved exactly
(modulo floating-point). The deeply counter-intuitive result: wealth
**condenses** — almost surely onto a single agent — and the Gini coefficient
climbs toward 1. The mechanism is multiplicative compounding: equal-sized
absolute wins and losses do not cancel as *fractions* of wealth, so repeated fair
gambles drift wealth downward for most and upward for a vanishing few.

**Redistribution τ** (the key knob): each step, collect a fraction τ of every
agent's wealth into a pot and redistribute it equally to all (a flat wealth tax
with a flat per-capita rebate). This conserves total wealth (just moves it
around) but adds a mean-reverting drift. With τ = 0 → runaway condensation
(oligarchy). With τ > 0 → condensation is arrested into a stable, Pareto-like
distribution.

## Sources actually used

- Dragulescu, A. & Yakovenko, V. M. (2000). "Statistical mechanics of money."
  *The European Physical Journal B* 17, 723–729.
  https://doi.org/10.1007/s100510070114 (arXiv:cond-mat/0001432).
  Foundational kinetic-exchange paper; money-conserving random exchange yields a
  Boltzmann–Gibbs (exponential) distribution.
- Chakraborti, A. (2002). "Distributions of money in model markets of economy."
  *International Journal of Modern Physics C* 13(10), 1315–1321.
  https://doi.org/10.1142/S0129183102003905 (arXiv:cond-mat/0205221).
  Introduces saving propensity; the no-saving limit is the condensing yard-sale
  case.
- Boghosian, B. M. (2014). "Kinetics of wealth and the Pareto law."
  *Physical Review E* 89, 042804. https://doi.org/10.1103/PhysRevE.89.042804.
  Derives the Fokker–Planck (Boltzmann-type) equation for the yard-sale model;
  redistribution enters as a drift term; condensation proven without it; with it,
  a Pareto-like steady state that fits data.
- Boghosian, B. M. (2019). "The Inescapable Casino." *Scientific American*
  321(5), 70–77. https://doi.org/10.1038/scientificamerican1119-70.
  Accessible account of the yard-sale model, condensation, and the role of a
  redistribution term; reports reasonable fits to real wealth data (e.g. US/EU).
- Hayes, B. (2002). "Follow the Money." *American Scientist* 90(5), 400–405.
  https://doi.org/10.1511/2002.5.400.
  Early popular exposition of the yard-sale/asset-exchange condensation result.

## Caveats (the most important part)

This is a **SUFFICIENCY result**, mirroring the Atlas's Schelling entry. It
shows that fair, random exchange is *sufficient* to generate inequality and even
total wealth condensation — **NOT** that real-world inequality is only, or
mainly, the product of fair random luck.

Real economies include wages and labor, production and growth, inheritance,
structural advantage, policy, progressive/regressive taxation, discrimination,
fraud, and many transactions that are not fair, not random, and not zero-sum.
None of these are in the model. The entry must say so plainly and respectfully —
it is a lens that isolates one mechanism (fairness in the small need not aggregate
to fairness in the large), not a complete theory of observed wealth distribution.

What IS a proven property of the basic model:
- **Condensation without redistribution**: with τ = 0, the yard-sale model
  condenses wealth onto a single agent almost surely (Boghosian 2014).
- **τ-stabilized distribution is Pareto-like**: a positive redistribution term
  yields a stable steady state with an approximately Pareto (power-law) tail,
  which fits real wealth-distribution data reasonably well (Boghosian 2014, 2019).

## Implementation notes

- Wealth stored in a `Float64Array`; Gini via the sorted relative-mean-absolute-
  difference form `G = Σ_i (2i−n−1) w_sorted[i] / (n · Σw)`.
- Transactions per tick scale as ~`speed · N / 100` so dynamics develop at a
  comparable pace across population sizes.
- Render: agent grid colored by `log2(1 + w/mean)` on a dark→warm ramp (vivid
  condensation), plus a sorted-wealth area curve (poorest→richest) with a dashed
  mean line. Dark ground (#06060c).
- Tested headlessly in `tools/test-wealth-condensation.mjs` with a deterministic
  LCG: asserts money conservation (τ=0 and τ>0), finiteness/non-negativity, Gini
  emergence (τ=0 → Gini > 0.6 from ~0), and that τ>0 substantially lowers the
  final Gini.

## Cross-links

- `schelling` — the Atlas's other "fair/mild micro, surprising macro" social
  entry; same honest sufficiency framing.
