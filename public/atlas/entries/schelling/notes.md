# Schelling's Segregation Model — notes & provenance

## Sources used

- **Schelling, T. C. (1971). "Dynamic Models of Segregation." *Journal of
  Mathematical Sociology* 1(2), 143–186.** The original paper. Introduces the
  spatial-proximity ("checkerboard") model and the "bounded-neighborhood" model,
  and the central result that a mild same-type preference is sufficient to drive
  near-complete segregation. DOI: 10.1080/0022250X.1971.9989794.
- **Schelling, T. C. (1978). *Micromotives and Macrobehavior*. W. W. Norton.**
  The popular book-length treatment; source of the "micromotives → macrobehavior"
  framing used in the prose.
- **2005 Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel**,
  awarded jointly to Robert J. Aumann and Thomas C. Schelling "for having enhanced
  our understanding of conflict and cooperation through game-theory analysis."
  https://www.nobelprize.org/prizes/economic-sciences/2005/summary/ — Verified: it
  is the Economics memorial prize (commonly called the Nobel in Economics), shared,
  and the citation is about game theory broadly, not specifically the segregation
  model. The prose states the shared-prize fact carefully and does not claim the
  prize was *for* the segregation model.
- **Hatna, E. & Benenson, I. (2012). "The Schelling Model of Ethnic Residential
  Dynamics." *JASSS* 15(1), 6.** http://jasss.soc.surrey.ac.uk/15/1/6.html — a
  modern computational re-examination; cited as an entry point to the substantial
  follow-up literature on the model's variants and limits.

## Implementation choices (documented for honesty / reproducibility)

- **Variant.** "Random relocation": each unhappy agent moves to a *uniformly
  random* empty cell, not necessarily one where it would be happy. This is the
  simplest classic variant and the one that most cleanly shows segregation
  emerging. (Other variants — move to the nearest satisfying cell, or swap pairs —
  segregate too, sometimes faster.)
- **Topology.** Toroidal (the grid wraps at all edges), chosen for simplicity and
  to avoid edge artifacts. Consistent everywhere in the sim.
- **Isolated agents (zero occupied neighbors) are counted as HAPPY.** Rationale:
  the happiness condition is "fraction of *occupied* neighbors that are like me ≥
  τ," and that fraction is undefined when there are no occupied neighbors, so an
  isolated agent has no one to be dissatisfied with. This is a deliberate choice;
  the alternative (treat empty neighbors as unlike, or as a separate "lonely"
  unhappiness) changes dynamics modestly. At the default densities (≥50%) very few
  agents are ever fully isolated, so the choice is not load-bearing for the
  headline result.
- **Segregation index.** Defined as the average, over occupied agents that have at
  least one occupied neighbor, of (same-type neighbors / occupied neighbors). It
  runs from ~0.5 at a well-mixed random start (with a 50/50 mix) toward ~1.0 when
  fully segregated. Agents with no occupied neighbors are excluded from this
  average because the ratio is undefined for them.
- **Sweep semantics.** Each sweep snapshots the set of currently-unhappy agents,
  shuffles them, then relocates each once. Snapshotting avoids biasing the result
  by scan order within a sweep.

## Caveats — the honesty point (most important)

The model proves a **sufficiency** claim, not a **completeness** one: *mild
individual preference is enough to generate segregation.* It does **not** show
that real-world residential segregation is caused only, or mainly, by mild
preference. Real segregation has major structural, economic, legal, and
discriminatory drivers — redlining, exclusionary zoning, lending and housing
discrimination, and large wealth/income disparities — none of which appear in the
model. The entry states this explicitly and respectfully in the "In the wild"
section: the grid is a lens isolating one mechanism, not a full theory of how
actual cities segregated. Presenting it as a complete explanation would be a
serious misreading and is avoided.

The model is a **toy / thought-experiment**, in the VISION sense: it teaches a real
and counterintuitive mechanism, but it is not a calibrated model of any real city.
