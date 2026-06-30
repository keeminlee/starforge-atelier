# Forest-Fire Model — provenance & caveats

Entry: **The Forest-Fire Model** (category: Criticality). The Drossel–Schwabl
self-organized-critical forest-fire cellular automaton, with an interactive
three-state grid. A cousin of the Atlas's sandpile (the other SOC entry) and of
percolation (fire spreads through connected trees like percolation through
occupied sites).

## Sources actually used

1. **Drossel, B. & Schwabl, F. (1992).** "Self-organized critical forest-fire
   model." *Physical Review Letters* 69(11), 1629–1632.
   DOI: https://doi.org/10.1103/PhysRevLett.69.1629 — The defining paper for the
   model simulated here: empty/tree/burning cells, the four transition rules, the
   growth probability p and lightning probability f, and the result that in the
   double limit f ≪ p (and slow driving) the model self-organizes to criticality
   with power-law fire-size statistics. Source for the "The rule" and "Why it
   matters" sections.
2. **Bak, P., Chen, K., Tang, C. (1990).** "A forest-fire model and some thoughts
   on turbulence." *Physics Letters A* 147(5–6), 297–300.
   DOI: https://doi.org/10.1016/0375-9601(90)90451-S — The earlier Bak–Chen–Tang
   forest-fire model (without the separate lightning term); historical predecessor
   that motivated Drossel–Schwabl. Cited for lineage.
3. **Malamud, B. D., Morein, G., Turcotte, D. L. (1998).** "Forest Fires: An
   Example of Self-Organized Critical Behavior." *Science* 281(5384), 1840–1842.
   DOI: https://doi.org/10.1126/science.281.5384.1840 — Empirical analysis of real
   wildfire frequency–area statistics across several regions, finding approximate
   power laws consistent with SOC. Source for "In the wild."

Background (not cited in-page): the forest-fire model is standard SOC textbook
material; reviews such as Jensen, *Self-Organized Criticality* (Cambridge, 1998)
and the broader SOC critique literature inform the honesty caveats below.

## What the simulation does

- Grid of `Uint8Array` cells, each EMPTY (0), TREE (1), or BURN (2). Toroidal
  (wrap-around) edges. Cell size 3 px.
- `step()` updates all cells synchronously by the four Drossel–Schwabl rules:
  burning→empty; tree with a burning von-Neumann neighbor→burning; tree with no
  burning neighbor→burning with probability f (lightning); empty→tree with
  probability p (growth). Trees and burning cells are recounted each tick.
- **Fire-size tracking (the SOC signature):** each newly lit cell is tagged with a
  `fireId` — a fresh id for a lightning spark or pointer ignition, or the inherited
  id of a burning neighbor when fire spreads. A running per-fire cell count is kept
  in a Map; when no cell carries a given id into the next tick, that fire is
  "finished" and its total size is recorded into `lastFireSize`, `maxFireSize`, and
  a coarse log-binned histogram (bins 1, 2–3, 4–7, 8–15, 16–63, 64–255, 256–1023,
  1024+). Note: when two independently-sparked fronts merge, the merged blaze is
  counted under one of the ids — a deliberate simplification for a live counter,
  not a formal cluster analysis.
- Controls: `standardRail({ randomize })` (play/pause, reset, randomize = fresh
  seed); a `select` preset ("SOC (p ≫ f)" vs "Frequent lightning"); sliders for
  growth **p** (0.001–0.1), lightning **f** (1e-5–1e-2), and **speed** (steps per
  frame, mapped to `stepsPerFrame`); `onPointer` ignites a small patch where you
  click/drag; `readout` shows tree-cover %, currently-burning count, last/max fire
  size, the **p/f ratio** (large in the SOC regime), total fires, and the histogram.
- Coloring: tree = teal-green (#2fae8e), burning = bright amber (#ff8a3c), empty =
  dark background. Sweeping amber fronts through green forest are the visual payoff.
- Exposed for testing: `sim.cur` (the grid), `sim.cols`/`sim.rows`, `sim.treeCount`,
  `sim.burningCount`, and `sim.lastFireSize`.

## Caveats (honesty over hype)

- The forest-fire model is a **well-established, canonical SOC model**. That this
  cellular automaton self-organizes to criticality with power-law fire sizes (in
  the appropriate slow-driving limit) is solid and reproducible.
- **It is an idealized cartoon, not a model of real forests.** Real wildfire
  behavior depends on wind, terrain, fuel type and moisture, weather, seasonality,
  ignition sources, and human suppression — none of which appear here. The grid,
  the synchronous update, the single growth rate, and the uniform lightning
  probability are all caricatures.
- **Whether real forests are truly SOC is debated.** Malamud et al. (1998) and
  others find approximate power laws in real fire records, which is suggestive, but
  a power law is *necessary, not sufficient* evidence for self-organized
  criticality. Power laws can arise from other mechanisms, and the SOC
  interpretation of real wildfire regimes remains an open empirical question — the
  same honest stance taken in the sandpile entry. The page states this explicitly.
- The double separation of timescales that the clean theory requires (f ≪ p ≪ 1,
  and a true slow-driving limit) is only approximated by the interactive sliders;
  the live demo shows the *qualitative* SOC behavior — long calm growth punctuated
  by rare large fires — rather than asymptotically exact power-law exponents.
