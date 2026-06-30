# rps-spatial — research notes & provenance

**Category:** Pattern Formation
**Phenomenon:** Spatial rock-paper-scissors / cyclic dominance. A lattice where
three (or five) species stand in a non-transitive cycle of dominance; local
invasion self-organizes into rotating spiral waves and sustains coexistence.

## The model implemented

- Toroidal grid, `Int8Array` of species ids (0..N-1), cell size 3px.
- Cyclic dominance: species `a` beats `b` iff `(b - a) mod N` is in `1..floor(N/2)`.
  - N=3 (default): rock-paper-scissors. 0→beats→1→beats→2→beats→0.
  - N=5 (optional): rock-paper-scissors-lizard-Spock; each beats the next two.
- Microstep: pick random cell + random neighbor; if neighbor dominates the cell,
  the cell converts to the neighbor's species. This is the standard "invasion"
  or "May–Leonard / cyclic Lotka–Volterra" lattice caricature (here without the
  empty-site/reproduction/diffusion split — the minimal variant that still gives
  spirals). `speed` = full-grid sweeps per frame.
- Render: each species a distinct palette color via ImageData, scaled up through
  an offscreen canvas (same pattern as reaction-diffusion).

## Sources used (verified June 2026)

1. **Sinervo, B. & Lively, C. M. (1996).** "The rock–paper–scissors game and the
   evolution of alternative male strategies." *Nature* 380, 240–243.
   - Side-blotched lizard *Uta stansburiana*: three male throat colors
     (orange/blue/yellow) with three mating strategies that cycle in dominance;
     morph frequencies oscillate. The canonical real-world RPS example.
   - https://www.nature.com/articles/380240a0 (DOI 10.1038/380240a0)

2. **Kerr, B., Riley, M. A., Feldman, M. W., Bohannan, B. J. M. (2002).** "Local
   dispersal promotes biodiversity in a real-life game of rock–paper–scissors."
   *Nature* 418, 171–174.
   - Three *E. coli* strains (colicin producer / resistant / sensitive) in a
     cyclic dominance relationship. Key spatial result: coexist on a static plate
     (local dispersal/interaction); diversity collapses when well-mixed (flask).
     This is THE experimental evidence that spatial structure promotes coexistence.
   - DOI 10.1038/nature00823
   - https://www.scirp.org/reference/referencespapers?referenceid=1261979 (citation)
   - https://oa.mg/work/10.1038/nature00823 (OA copy)

3. **Reichenbach, T., Mobilia, M., Frey, E. (2007).** "Mobility promotes and
   jeopardizes biodiversity in rock–paper–scissors games." *Nature* 448, 1046–1049.
   - Theory: in a spatial RPS with mobility, there is a CRITICAL mobility
     threshold. Below it, traveling spiral waves form and biodiversity is
     maintained; above it, the spirals are too large for the system and one
     species takes over — biodiversity is lost. The mobility caveat.
   - DOI 10.1038/nature06095
   - https://www.nature.com/articles/nature06095

## Caveats (kept honest in the prose)

- **The lattice invasion model is a caricature.** Real cyclic systems (lizards,
  bacteria, reef organisms) differ enormously in their mechanisms; this grid is a
  minimal abstraction, not a literal model of any of them. The prose says so.
- **The robust, established takeaway is "spatial structure promotes coexistence."**
  Kerr et al. 2002 is the cleanest empirical demonstration (plate vs. flask). State
  it as established; that is what the literature supports.
- **Mobility caveat (Reichenbach et al. 2007).** "Spatial = stable" is not
  unconditional. If species mix/move too much, the protective spatial separation
  breaks down past a critical mobility and one species wins. Coexistence depends on
  interactions staying sufficiently *local*. Noted in prose ("In a well-mixed soup
  … it drifts … one species is knocked out") and here.
- **Reef / sessile-organism non-transitivity** is more case-by-case than the lizard
  and bacterial systems; the prose flags it as suggestive rather than settled.

## Test invariants (tools/test-rps-spatial.mjs)

- Every cell always holds a valid species id (0..N-1).
- Total cell count is constant (invasion converts cells, never creates/destroys).
- Coexistence: from a deterministic ~equal random seed at the default rule (N=3),
  after many steps all three species are still present and fractions stay balanced
  (none ~0, none ~1) — wide stochastic margin.
