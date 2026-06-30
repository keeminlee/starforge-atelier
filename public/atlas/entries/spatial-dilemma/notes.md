# Spatial Dilemma — research notes & provenance

The Nowak–May spatial Prisoner's Dilemma: cooperation surviving among selfish
agents through spatial clustering, in evolving kaleidoscopic patterns.

## Sources actually used

- **Nowak, M. A. & May, R. M. (1992).** "Evolutionary games and spatial chaos."
  *Nature* 359, 826–829. doi:10.1038/359826a0.
  The foundational paper. Cooperators (C) and defectors (D) on a square lattice;
  each cell plays the PD with its 8 Moore neighbors and with itself; payoffs
  R=1, T=b, S=0, P=0 with 1<b<2; cells synchronously adopt the strategy of the
  highest-scoring cell in their neighborhood (including self). Shows that
  cooperation persists indefinitely via spatial clustering and that the dynamics
  produce evolving, often fractal/chaotic spatial patterns. The single-defector
  seed in an all-cooperator field produces the famous symmetric growing
  kaleidoscope. The b ≈ 1.85 (with self-interaction + Moore) chaotic regime is
  from this and the follow-up paper.
  https://www.nature.com/articles/359826a0

- **Nowak, M. A. & May, R. M. (1993).** "The spatial dilemmas of evolution."
  *International Journal of Bifurcation and Chaos* 3(1), 35–78.
  doi:10.1142/S0218127493000040.
  Extended treatment: parameter regimes as a function of b, classification of
  static vs. chaotic vs. defector-dominated behavior, robustness to update rules
  and neighborhood/self-interaction choices, and the fractal boundary dynamics.

- **Axelrod, R. (1984).** *The Evolution of Cooperation.* Basic Books.
  The classic on the iterated PD and tournament strategies (e.g. tit-for-tat).
  Context for "the evolution of cooperation" as a field; not the spatial model
  itself, but the framing reference for why cooperation among selfish agents is a
  puzzle.

- **Nowak, M. A. (2006).** "Five rules for the evolution of cooperation."
  *Science* 314, 1560–1563. doi:10.1126/science.1133755.
  Names the five mechanisms: kin selection, direct reciprocity, indirect
  reciprocity, network reciprocity, and group selection. The 1992 spatial model
  IS the canonical instance of **network/spatial reciprocity**. Used to honestly
  place this model as one mechanism among several.

## Model specifics as implemented

- **State:** Int8Array, D=0, C=1, toroidal grid, Moore (8) neighborhood.
- **Payoff (play phase):** because S=0 and P=0, a cell only scores against
  cooperator partners. Cell counts cooperators among its 9 cells (8 neighbors +
  self). A cooperator scores 1·(coop count incl. self); a defector scores
  b·(coop count among neighbors) — self is D so it contributes 0 automatically.
- **Update phase:** synchronous; each cell copies the strategy of the
  highest-scoring cell in its Moore neighborhood including itself.
- **Tie-breaking (documented):** self is scanned first and a cell only switches
  on a *strictly greater* score. So on any tie (including self vs. an equally
  good neighbor) the incumbent keeps its current strategy. This is the standard
  "keep current strategy on ties" convention and keeps the deterministic
  single-defector kaleidoscope perfectly symmetric.
- **Seeds:** "Single defector" (all-C field with one D in the center — default,
  the showpiece) and "Random mix" (each cell C with probability = cooperator
  fraction slider).
- **Rendering — iconic Nowak–May 4-color scheme** keyed by (previous, current):
  - C→C cooperator stayed cooperator → **blue**
  - D→D defector stayed defector → **red**
  - C→D just became defector → **yellow**
  - D→C just became cooperator → **green**
  The transition colors (yellow/green) light up the moving boundaries, which is
  what makes the evolving fronts vivid. We therefore keep a `prev` grid alongside
  `grid`. Cell size 3 px, blitted via ImageData + nearest-neighbor upscale.
- **Default b = 1.85** — the classic chaotic regime for Moore + self-interaction.

## Caveats (honesty over hype)

- This is a **minimal model**, not a full account of altruism. It demonstrates
  exactly one mechanism — **spatial / network reciprocity** — among the five in
  Nowak (2006). No kin recognition, memory, reputation, or reward is present.
- Results **depend on the modeling choices**: deterministic imitate-the-best
  update, self-interaction, Moore neighborhood, and the tie-breaking rule. The
  exact b values for the static / chaotic / defector-dominated regimes shift with
  these choices (e.g. without self-interaction, or with a stochastic update, the
  thresholds and the famous b ≈ 1.85 chaos point move). The 1993 paper maps this
  dependence in detail.
- "Cooperation persists" means the cooperator fraction settles to a value
  strictly between 0 and 1 over the b range around the default — it is the
  coexistence, not any particular equilibrium value, that is the point.
- The "in the wild" examples (biofilms, tumors, ecosystems) are real systems
  where spatial structure is argued to favor cooperation, but they are richer
  than this two-strategy lattice; the model is a lens, not a literal simulation
  of them.
