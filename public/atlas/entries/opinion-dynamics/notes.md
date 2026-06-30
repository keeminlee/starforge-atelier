# Opinion Dynamics — research notes & provenance

## Model implemented
**Deffuant bounded-confidence model** (pairwise, agent-based). Chosen over
Hegselmann–Krause (HK) because it is the simplest and most genuinely
agent-based formulation: one random pair meets per interaction, rather than every
agent synchronously jumping to the local mean. Both produce the same qualitative
phenomenology (consensus / polarization / fragmentation governed by the
confidence threshold); Deffuant is more legible as a space–time trajectory plot
because individual agents move incrementally.

- N continuous opinions x_i ∈ [0,1], initialised uniformly at random.
- Interaction: pick random pair (i,j); if |x_i − x_j| < ε, move each μ of the way
  toward the other; else nothing.
- ε is the confidence threshold (the star knob); μ ≈ 0.5 is the convergence rate.
- Optional ~2%-per-pole **extremists**: stubborn agents pinned at 0 and 1 that do
  not move but still attract others within ε.

## The central emergent result
The confidence threshold ε alone selects the outcome from a random spread:
- large ε → single consensus cluster;
- moderate ε (~0.2) → two-camp polarization;
- small ε → many frozen clusters.

The number of surviving clusters grows as ε shrinks: for Deffuant on [0,1] the
well-known approximation is **≈ 1/(2ε)** (Deffuant et al. 2000; Weisbuch et al.
2002). Our headless test reproduces this: with ε=0.1 the population freezes into
**5 clusters** (1/(2·0.1) = 5, exact), and with ε=0.5 it collapses to **1**
(consensus, spread → 0). μ changes only the speed of convergence, not the final
cluster count — confirmed by the model and noted in the literature.

## Sources actually used
1. Deffuant, G., Neau, D., Amblard, F. & Weisbuch, G. (2000). "Mixing beliefs
   among interacting agents." *Advances in Complex Systems* 3(01n04), 87–98.
   — The pairwise bounded-confidence rule and the 1/(2ε) cluster-count scaling.
2. Hegselmann, R. & Krause, U. (2002). "Opinion dynamics and bounded confidence
   models, analysis, and simulation." *Journal of Artificial Societies and Social
   Simulation* 5(3), 2. https://www.jasss.org/5/3/2.html
   — The synchronous-averaging variant; same consensus/fragmentation transition.
3. Weisbuch, G., Deffuant, G., Amblard, F. & Nadal, J.-P. (2002). "Meet, discuss,
   and segregate!" *Complexity* 7(3), 55–63.
   — Dependence of the number of opinion clusters on the confidence threshold.
4. Castellano, C., Fortunato, S. & Loreto, V. (2009). "Statistical physics of
   social dynamics." *Reviews of Modern Physics* 81(2), 591–646.
   — Survey situating bounded-confidence models among opinion-dynamics models;
   used for framing and the voter-model contrast.

All four citations verified against their published bibliographic details before
inclusion. The JASSS HK paper is open-access at the URL above.

## Caveats (the most important part — sufficiency, NOT completeness)
This entry mirrors the honesty of the Atlas's Schelling and wealth-condensation
entries. The key caveats, stated plainly in the prose:

- **Sufficiency, not completeness.** Bounded confidence is *sufficient* to
  generate polarization and fragmentation — it is NOT a claim that real
  polarization is only or mainly this mechanism. It isolates one force.
- **Opinions are not 1-D scalars.** Real opinions are multi-dimensional and
  entangled with identity; a single dial in [0,1] is a drastic simplification.
- **People don't literally average.** The linear move-toward-each-other rule is a
  stylised stand-in for influence, not a description of real persuasion.
- **Major real forces are omitted:** group identity, mass and social media,
  institutions, network structure (who is even connected to whom), and motivated
  reasoning (which can push people *further apart* on contact — the opposite of
  the attraction modelled here). None of these are in the model.
- **Deffuant vs HK:** a modelling choice; both give the same qualitative story.
- **μ sets speed, not structure:** the final number of clusters is governed by ε,
  not by the convergence rate μ.
- **Cluster-count rule of thumb:** ≈ 1/(2ε) is an approximation for Deffuant on a
  unit interval with uniform initial conditions, not an exact law for all
  variants/initial distributions.

## Contrast drawn in the entry
Cross-linked to the **voter model** (discrete copy-a-neighbour → always one
consensus on a finite world) to highlight that *continuous* opinions with a
confidence threshold can instead freeze into permanent disagreement.
