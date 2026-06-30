# Research notes — Self-Replication (the Fredkin parity rule)

Provenance for the claims on this entry's page. Keep this honest: list what was
actually used, and flag anything uncertain or simplified.

## The simulation

- **Rule:** 2-state, toroidal CA. Each cell's next state is the **parity (XOR)**
  of its neighbors, NOT including itself:
  - von Neumann (default): parity of the 4 orthogonal neighbors → replicates into
    **4 copies**.
  - Moore (optional): parity of all 8 neighbors → replicates into **8 copies**.
- **Linearity over GF(2):** because XOR is additive, the evolution of any
  configuration is the XOR-superposition of the evolutions of its individual live
  cells. This is why *any* pattern is reproduced (Fredkin's replication theorem;
  Amoroso–Cooper for arbitrary patterns).
- **Empirically verified in this repo** (see `tools/test-self-replication.mjs`,
  all assertions green):
  - A single live cell at t = 2ⁿ is exactly 4 cells at offsets (±2ⁿ, 0) and
    (0, ±2ⁿ) — distance 2ⁿ in the four cardinal directions. Confirmed for
    t = 2, 4, 8, 16.
  - A compact asymmetric seed (arrow=9 cells, F-glyph=10, glider=5) resolves at
    t = 16 into **exactly 4 well-separated clusters, each an exact translated
    copy** of the seed (live-cell count = seedCells × 4). Confirmed by clustering
    + translation-invariant signature match.
  - Moore parity → **exactly 8** exact copies at t = 16.
  - The rule is the parity of the 4 neighbors with the cell's own state ignored
    (2 neighbors → 0, 3 → 1; hand-checked).

### Honest nuance about "4 → 16 → 64 …"

The intuitive story is that 4 copies each make 4 more (16, then 64, …) in an
ever-multiplying fractal. The **actual** XOR dynamics for a *single compact seed*
keep it at **4 receding copies** at every power-of-two step (verified out to
t = 512 on a large grid): the would-be extra copies are cancelled by the
XOR-superposition of the constituent cells' overlapping fractals, leaving four
clean copies that simply double their separation each time. Between the
power-of-two moments the configuration is a churning Pascal-triangle-mod-2
(Sierpiński) texture whose live-cell count peaks (e.g. a single cell reaches
1024 live cells at t = 31) before snapping back to 4 at t = 32. The prose is
written to describe what actually happens — "four copies that recede and keep
doubling apart" — rather than over-claiming a runaway cascade.

## Key facts and the trivial-vs-non-trivial distinction (the central honesty point)

- **Trivial vs non-trivial self-replication is Langton's distinction** (Langton
  1984, Physica D 10:135–144, bibcode 1984PhyD...10..135L):
  - **Trivial** — like this parity rule — the rule's linear structure duplicates
    the pattern "for free"; the copies carry **no encoded instructions**. Nothing
    in a copy describes how to make a copy.
  - **Non-trivial** — the configuration **contains a description of how to build
    itself**, plus the machinery to read and execute it. Von Neumann's universal
    constructor, Langton's loops, and biological reproduction (DNA + ribosome)
    are all of this kind.
  - The entry states clearly that the parity rule is the *trivial* case and that
    real biological / von-Neumann replication is qualitatively harder. This is the
    required honesty framing.
- **Von Neumann's universal constructor:** designed 1940s; published posthumously
  in von Neumann (1966), *Theory of Self-Reproducing Automata*, ed. A. W. Burks,
  University of Illinois Press. 29-state CA; description-tape + constructor; the
  architecture biology embodies (DNA = tape, ribosome = constructor).
- **Langton's loops (1984):** a small self-reproducing CA pattern storing its
  description in a circulating loop rather than a static tape — simpler than von
  Neumann's, still non-trivial.
- **Game of Life replicators** (cross-link): Life hosts non-trivial replicators
  (Gemini, Andrew Wade, 2010) but they are huge and elaborate — the opposite
  extreme from this one-line parity rule.

## Caveats (flagged in the prose)

- The parity rule is **trivial** self-replication (Langton's term) — the linear
  rule duplicates patterns with no encoded instructions. It is **not** a model of
  DNA / cell division / von Neumann reproduction, which are qualitatively
  different and much harder. The entry says this explicitly.
- **Toroidal wrap eventually overlaps the receding copies.** The grid is sized
  large (cell size 3px → hundreds of cells per side) specifically to delay this,
  but run long enough and the copies fold around the torus and the XOR pattern
  scrambles. Noted in the prose ("sized large so the receding copies don't fold
  back and overlap for a long while").

## Sources

- von Neumann, J. (1966). *Theory of Self-Reproducing Automata* (ed. A. W. Burks).
  University of Illinois Press.
- Langton, C. G. (1984). "Self-reproduction in cellular automata." *Physica D*
  10(1–2):135–144. https://ui.adsabs.harvard.edu/abs/1984PhyD...10..135L/abstract
  (full text: https://www-users.york.ac.uk/~gt512/BIC/langton84.pdf)
- Amoroso, S. & Cooper, G. (1971). "Tessellation structures for reproduction of
  arbitrary patterns." *Journal of Computer and System Sciences* 5(5):455–464.
  (Follow-up confirming the line: "A note on pattern reproduction in tessellation
  structures," JCSS 1978, https://www.sciencedirect.com/science/article/pii/0022000078900296)
- Wolfram, S. (2002). *A New Kind of Science*. Wolfram Media. (Additive/parity CA
  and pattern replication; rule-90 / Pascal-mod-2 family.)
- Fredkin's parity replication is widely attributed to Edward Fredkin and
  discussed in the additive-CA literature (Amoroso–Cooper above; Wolfram NKS).

## TODO / to verify on a later pass

- [ ] Confirm exact page range (455–464) of the Amoroso–Cooper 1971 JCSS article
      against a primary scan (vol. 5, issue 5).
- [ ] Trace the earliest explicit statement attributing the parity-rule
      replication to Fredkin (often cited via Banks / Amoroso–Cooper / Wolfram).
