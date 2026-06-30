# Sandpile — provenance & caveats

Entry: **The Abelian Sandpile** (category: Criticality). The Bak–Tang–Wiesenfeld
self-organized-criticality model, with an interactive cellular-automaton sandpile.

## Sources actually used

1. **Bak, P., Tang, C., Wiesenfeld, K. (1987).** "Self-Organized Criticality: An
   Explanation of 1/f Noise." *Physical Review Letters* 59(4), 381–384.
   DOI: https://doi.org/10.1103/PhysRevLett.59.381 — The founding paper; introduces
   SOC and the 1/f-noise connection. Used for the "Why it matters" framing.
2. **Bak, P., Tang, C., Wiesenfeld, K. (1988).** "Self-organized criticality."
   *Physical Review A* 38(1), 364–374.
   DOI: https://doi.org/10.1103/PhysRevA.38.364 — The longer follow-up developing the
   sandpile cellular automaton and its scaling.
3. **Dhar, D. (1990).** "Self-organized critical state of sandpile automaton models."
   *Physical Review Letters* 64(14), 1613–1616.
   DOI: https://doi.org/10.1103/PhysRevLett.64.1613 — Proves the **abelian property**:
   the final stable state and total topplings are independent of toppling order. This
   is the basis for the "abelian = order-independent" claim in the rule section, and it
   justifies the work-queue toppling order used in sim.js.
4. **Bak, P. (1996).** *How Nature Works: The Science of Self-Organized Criticality.*
   Copernicus / Springer-Verlag. ISBN 0-387-94791-4 — Popular-science book; source for
   the broad claims about earthquakes, ecosystems, etc. (and, importantly, for the
   knowledge that those claims are bold and have been contested).
5. **Gutenberg, B., Richter, C. F. (1944).** "Frequency of earthquakes in California."
   *Bulletin of the Seismological Society of America* 34(4), 185–188. — The empirical
   power-law magnitude–frequency relation cited under "In the wild."
6. **Beggs, J. M., Plenz, D. (2003).** "Neuronal avalanches in neocortical circuits."
   *Journal of Neuroscience* 23(35), 11167–11177.
   DOI: https://doi.org/10.1523/JNEUROSCI.23-35-11167.2003 — Power-law cascades in
   cortical tissue; basis for the "neuronal avalanches" example.

Background reference (not cited in-page but informs the abelian-sandpile description):
the abelian sandpile model is standard textbook material; see Dhar's later reviews
(e.g. Dhar, "Theoretical studies of self-organized criticality," *Physica A* 369 (2006)
29–70) for a survey.

## What the simulation does

- Grid of `Int32Array` heights. Toppling rule: any cell with height ≥ 4 sheds 4 grains,
  one to each of its 4 orthogonal neighbors; off-grid grains are lost (open boundary).
- `relax()` uses a work queue (`_queue` indices + `_inq` membership flag + `_qn` tail)
  seeded with currently-unstable cells, so only candidate-unstable cells are revisited —
  no full-grid rescans per pass. A cell topples `floor(h/4)` times per visit for speed.
  By the abelian property this yields the same final state as one-grain-at-a-time.
- `total` grain count is decremented exactly when grains leave the grid edge, so it is
  always an honest accounting (grains are conserved except at the boundary).
- Two modes via a `select`:
  - **soc**: drip one grain at a random site per drop, fully relax, record avalanche size
    into a coarse log-binned histogram (shown in readout).
  - **single**: pour `speed` grains at the center each tick and relax — grows the
    deterministic self-similar fractal pile.
- Controls: `standardRail()` (play/pause, reset); `select` mode; `slider` speed
  (grains/tick); `button` "+1000 at center"; `onPointer` drops grains where you click/drag;
  `readout` shows total grains, drops, last/max avalanche, and (soc) the histogram bins.
- Coloring: height 1 = teal (#7fd1c1), 2 = amber (#e0a35e), 3 = orchid (#c98bd0); empty
  cells left dark. Cell size 4 px.

## Caveats (honesty over hype)

- The abelian sandpile is the **canonical, well-established** model of SOC. That SOC
  *exists* and *looks like this* is not in doubt.
- **Real sand does NOT behave like this model.** Physical grains have inertia, friction,
  and cohesion; experiments on real sand piles give ambiguous/non-power-law results.
  Rice piles (especially long-grained rice) are closer to clean SOC. The model is a
  caricature that teaches the concept, not a description of literal sand.
- **Real-world SOC is contested.** Power laws in earthquakes (Gutenberg–Richter),
  landslides, forest fires, neuronal avalanches, and market crashes are real empirical
  observations, but a power law is *necessary, not sufficient* evidence for SOC.
  Whether any specific system is "truly" self-organized-critical (versus power laws
  arising from other mechanisms) is an open, debated empirical question. The prose flags
  each example as suggestive vs. established, and is explicit that the
  earthquake/biology/finance links are debated. The financial-markets link in particular
  is flagged as the most speculative (a metaphor, not an established mechanism).
- 1/f-noise: BTW *proposed* SOC as an explanation for 1/f noise; it is one candidate
  mechanism among several, and not all 1/f signals are SOC. Stated as a proposal, not a
  settled fact.
