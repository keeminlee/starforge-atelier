# Ant Colony Foraging — research notes & provenance

## What the simulation is

A classic **two-pheromone stigmergy** agent model of ant foraging. A nest sits at
the centre of a grid; a few food sources sit near the edges. Several hundred ants
each carry a position, heading, and state (SEARCHING / RETURNING). Two evaporating
`Float32Array` pheromone fields:

- **homePhero** — deposited by SEARCHING ants (marks the way back to the nest).
- **foodPhero** — deposited by RETURNING ants carrying food (marks the way to food).

Searching ants steer up the foodPhero gradient (toward food) while exploring
randomly; returning ants steer up the homePhero gradient (toward the nest). On
reaching food a searcher flips to returning and turns around; on reaching the nest
a returner flips to searching, turns around, and increments `delivered`. Both
fields evaporate (`× (1 − evaporation)`) every step. Stable trails condense
between nest and food; the nearer/easier route accumulates a stronger trail.

## Sources actually used

1. **Goss, S., Aron, S., Deneubourg, J.-L., & Pasteels, J. M. (1989).**
   "Self-organized shortcuts in the Argentine ant." *Naturwissenschaften* 76(12),
   579–581. doi:10.1007/BF00462870.
   - The double-bridge experiment: Argentine ants converge on the shorter of two
     branches via trail reinforcement + evaporation. Foundational empirical result.
   - https://link.springer.com/article/10.1007/BF00462870 (PDF mirror:
     https://dipot.ulb.ac.be/dspace/bitstream/2013/19271/1/042GossNaturwissenschaften89.pdf)
   - Verified via web search: authors, journal, volume 76, pages 579–581, year 1989.

2. **Deneubourg, J.-L., Aron, S., Goss, S., & Pasteels, J. M. (1990).**
   "The self-organizing exploratory pattern of the Argentine ant." *Journal of
   Insect Behavior* 3(2), 159–168. doi:10.1007/BF01417909.
   - The model paper accompanying the double-bridge work: a nonlinear
     trail-recruitment rule reproduces the observed branch-choice probabilities.
   - https://link.springer.com/article/10.1007/BF01417909
   - Verified via web search: authors (Deneubourg, Aron, Goss, Pasteels), journal,
     vol. 3 no. 2, pp. 159–168, 1990. (The task brief listed "Deneubourg et al.,
     ...3:159"; corrected to the full author list and page range 159–168.)

3. **Grassé, P.-P. (1959).** "La reconstruction du nid et les coordinations
   interindividuelles chez *Bellicositermes natalensis* et *Cubitermes* sp. La
   théorie de la stigmergie." *Insectes Sociaux* 6(1), 41–80.
   - Origin of the term **stigmergy** (coined for termite nest-building, later
     generalized to ant trail-following): coordination via traces left in the
     environment rather than direct communication.

4. **Dorigo, M., & Stützle, T. (2004).** *Ant Colony Optimization.* MIT Press.
   - The computer-science algorithm family (ACO) inspired by ant trail-laying.
     Used only to support the "family resemblance" claim — explicitly framed as
     bio-inspired engineering, not a claim about how ants compute.

## Caveats & honesty notes

- **This is an idealized agent model, not biology.** Real ant trail-laying chemistry
  and behaviour are far richer: multiple pheromone species with different volatilities,
  trail-modulation by food quality, individual memory and path integration,
  U-turns, tandem running, and antennal contact. We compress all of that into two
  scalar fields and a three-sensor steering rule. This captures the *style* of
  stigmergic foraging, not its physiology.

- **"ACO derives from this" is a family resemblance, not identity.** Ant Colony
  Optimization is an engineered metaheuristic inspired by the biology. Ants do not
  run ACO; ACO is not a literal model of ants. The prose states this explicitly.

- **The shortest-path result is robust for the double-bridge, weaker here.** The
  Goss/Deneubourg experiments use a controlled two-branch maze, where positive
  feedback statistically drives the colony onto the shorter branch (a *tendency*,
  not a guarantee — the long branch can win if marked first). Our open-grid version
  shows trail **formation** and a bias toward easier/nearer routes, *not* a clean
  proof of shortest-path optimality. Stated honestly in the "In the wild" section.

## Implementation notes (robustness — keeping ants from getting stuck)

The central tuning problem is making sure food actually gets found and delivered so
trails form within a few seconds, rather than the colony stalling.

- **No outward "explore" drive for searchers.** An early version pushed searching
  ants radially outward from the nest when they smelled no trail. This pinned all
  ants against the walls (they reflected back and forth at the edges) and the food
  trail evaporated to zero — the colony stalled with every ant searching and zero
  deliveries. Removing it and letting searchers do a **pure correlated random walk**
  (heading + random jitter) when no trail is nearby fixed the stall: searchers
  circulate through the interior and keep rediscovering food.

- **Directional home-assist for returners only.** A returning ant with no home-trail
  nearby blends its heading toward the nest (by a small fraction). This guarantees
  food gets delivered even before a return trail exists, seeding the feedback loop.
  Searchers get no such assist — their job is undirected search.

- **Returners deposit a stronger food trail (×2).** This makes the route to food
  persist against evaporation and reliably recruit more searchers, which is what
  lets delivery accelerate as trails consolidate.

- **Walls reflect; the world is bounded, not a torus.** Ants stay in `[0,cols)×[0,rows)`,
  so the ant count is conserved and bounds invariants hold.

With these, delivery accelerates over time as expected for stigmergy (e.g. a
deterministic-seed headless run delivers ~190 parcels by 1500 steps and keeps
climbing — 14 → 148 → 372 → … over 3000 steps — rather than plateauing).

## Tests

`tools/test-ant-colony.mjs` (deterministic via a seeded `Math.random` shim) asserts:
1. both pheromone fields stay finite and ≥ 0 over 200 steps;
2. evaporation works — with deposition suppressed (`sim._depositOn = false`), the
   total pheromone strictly decreases each step;
3. ants stay in-bounds and the ant count is conserved;
4. foraging works — after 1500 steps `sim.delivered > 0` (ants find food and
   return it), and a food trail has formed.
