# Research notes — Elementary Cellular Automata

Provenance for the claims on this entry's page. Keep it honest: list what was
actually used, and flag anything uncertain or contested.

## Key facts used
- **Definition:** 1D, 2-state (0/1), 3-neighbor (left, center, right) cellular
  automata. 3 binary inputs → 8 neighborhoods → an 8-bit lookup table → a
  **rule number 0–255**. Synchronous update, toroidal (wrap-around) boundaries.
- **Wolfram numbering (convention):** the new state for neighborhood (l,c,r) is
  bit number `l·4 + c·2 + r` of the rule number. So bit 0 (LSB) is the output
  for neighborhood 000, bit 7 (MSB) is the output for 111. The readout prints
  the 8-bit table MSB→LSB (i.e. output for 111,110,…,000). This ordering is the
  standard Wolfram convention; it is just a labeling choice, but a fixed one.
- **Four classes:** Wolfram's classification of CA behavior — I uniform/dead,
  II simple periodic, III chaotic/random, IV complex localized structures.
  Introduced in Wolfram (1984), Physica D 10:1–35. The class assignment of
  specific rules is informal/heuristic, not a theorem; boundary cases exist.
- **Rule 30:** Class III, chaotic. Its center column passes many randomness
  tests and was used as the default random-number generator in Mathematica.
  (Wolfram 1985, "Random sequence generation by cellular automata"; ANKOS.)
- **Rule 90:** Class II (additive/nested) — the **Sierpiński triangle** from a
  single seed; new state = `l XOR r` (additive
  rule, independent of the center cell). Verified in the test suite for all 8
  neighborhoods.
- **Rule 110:** Class IV. Proven **Turing-complete** by Matthew Cook
  (Universality in Elementary Cellular Automata, Complex Systems 15(1):1–40,
  2004). 8-bit table 01101110.
- **Rule 184:** minimal deterministic single-lane traffic / particle model
  (the "rule 184 traffic model").
- **Rule 150:** additive XOR-3 rule, new state = `l XOR c XOR r`.

## Caveats (stated honestly, consistent with the Game of Life entry's tone)
- **Numbering convention:** "rule N" is meaningful only under Wolfram's bit
  ordering. The page and code use that convention throughout.
- **Rule 110 universality is Cook's result**, and it has some history/dispute:
  Cook worked at Wolfram Research; the result was first presented in the late
  1990s but its publication was delayed by a legal/NDA dispute with Wolfram
  Research over disclosure ahead of *A New Kind of Science*. The mathematics is
  accepted; the publication history is the contested part. The construction is
  also notably intricate (it relies on a non-trivial, ultimately-periodic
  background and glider collisions). We credit Cook and cite the 2004 paper.
- **ANKOS / Principle of Computational Equivalence:** the broad claims in
  *A New Kind of Science* (2002) — that simple programs are the right default
  model for nature, and that essentially all complex processes are
  computationally equivalent — are **sweeping and contested**, not settled
  science. The page flags this explicitly rather than endorsing it, matching how
  the Game of Life entry treats ANKOS.
- **Conus textile resemblance:** the visual similarity between rule 30's chaos
  and the textile cone snail's shell pigmentation is a **resemblance**, not an
  established generative mechanism. Shell-pattern CA models exist in the
  literature (e.g. Wolfram's ANKOS; Meinhardt's reaction-diffusion shell models
  are the more biologically grounded account), but "rule 30 makes the snail" is
  not a claim anyone should make. Stated as resemblance only.

## Sources (verify before re-citing)
- Wolfram, S. (1983). "Statistical mechanics of cellular automata." Reviews of
  Modern Physics 55(3):601–644.
- Wolfram, S. (1984). "Universality and complexity in cellular automata."
  Physica D 10(1–2):1–35.
- Cook, M. (2004). "Universality in Elementary Cellular Automata." Complex
  Systems 15(1):1–40.
- Wolfram, S. (2002). A New Kind of Science. Wolfram Media.
- Wolfram, S. (1985). "Random sequence generation by cellular automata."
  Advances in Applied Mathematics 7(2):123–169. (Rule 30 as RNG.)

## TODO / to verify on a later pass
- [ ] Double-check the exact page range of the 1983 RMP paper against a scan.
- [ ] Confirm wording on the Cook publication-dispute history before stating
      anything stronger than "delayed by a dispute."
- [ ] Consider adding the rule-30 longstanding open problems (Wolfram's prizes
      on whether the center column is eventually periodic, etc.).
