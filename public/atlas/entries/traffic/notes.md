# Research notes — Phantom Traffic Jams (Nagel–Schreckenberg)

Provenance for the claims on this entry's page. Honest record of what was used.

## The model
- **Nagel–Schreckenberg (NaSch) model:** Kai Nagel & Michael Schreckenberg, "A
  cellular automaton model for freeway traffic," *Journal de Physique I* 2(12),
  2221–2229 (1992). Single-lane road of discrete cells; cars carry integer speed
  0..vmax; parallel update each timestep in four steps: accelerate, brake to gap,
  random dawdle with probability p, move. The random deceleration (step 3) is the
  ingredient that produces spontaneous jams; without it (p=0) the model has no
  phantom jams.
- DOI/URL: https://doi.org/10.1051/jp1:1992277 (Journal de Physique I).
- Standard reference parameters in the literature: vmax=5, p=0.5 on a ring; the
  density–flow "fundamental diagram" peaks near ρ≈0.1 and then declines. Our sim
  uses a tunable p with a default of 0.25 and vmax default 5, chosen so jams form
  visibly but the road still flows at low density.

## Emergent facts used
- **Backward-traveling jams:** stop-and-go waves propagate upstream (against the
  direction of travel) at a characteristic speed roughly independent of vehicle
  speed; empirically ~15–20 km/h backward on real freeways. (Treiber & Kesting,
  *Traffic Flow Dynamics*, Springer 2013; also Kerner's work on traffic phases.)
- **Phase transition / fundamental diagram:** flow = density × mean speed rises,
  peaks at a critical density, then collapses — the canonical free-flow →
  congested transition. (Treiber & Kesting 2013; original NaSch paper shows the
  flow–density curve.)
- **Removing bottlenecks doesn't remove jams:** direct consequence of the model —
  jams form on a homogeneous ring with no bottleneck at all. This is the headline
  point of the Sugiyama experiment.

## The Sugiyama experiment (key real-world anchor)
- Sugiyama, Y., Fukui, M., Kikuchi, M., Hasebe, K., Nakayama, A., Nishinari, K.,
  Tadaki, S. & Yukawa, S. (2008). "Traffic jams without bottlenecks —
  experimental evidence for the physical mechanism of the formation of a jam."
  *New Journal of Physics* 10, 033001.
- URL: https://iopscience.iop.org/article/10.1088/1367-2630/10/3/033001
- ~22 cars on a single-lane circular track of ~230 m circumference; drivers told
  to drive at ~30 km/h keeping a safe distance. Uniform flow was unstable; a jam
  cluster formed spontaneously and propagated backward around the loop, matching
  the predicted instability. (Numbers: 22 vehicles, ~30 km/h, backward wave
  ~20 km/h — verify exact figures against the paper before quoting precisely; the
  page states "about 22 cars" and "~30 km/h" to stay safely within the source.)

## Autonomous-vehicle damping
- Stern, R. E., Cui, S., Delle Monache, M. L., Bhadani, R., Bunting, M.,
  Churchill, M., Hamilton, N., Haulcy, R., Pohlmann, H., Wu, F., Piccoli, B.,
  Seibold, B., Sprinkle, J. & Work, D. B. (2018). "Dissipation of stop-and-go
  waves via control of autonomous vehicles: Field experiments." *Transportation
  Research Part C: Emerging Technologies* 89, 205–221. (Preprint arXiv:1705.01693,
  2017.) URL: https://arxiv.org/abs/1705.01693
- They recreated a Sugiyama-style ring of ~20+ human-driven cars and showed that
  a single autonomously controlled vehicle could dampen the emergent waves and
  reduce fuel use. Stated on the page as "a single autonomously controlled car
  among twenty-odd human-driven ones could substantially smooth the flow."

## Caveats (stated on the page)
- Single-lane NaSch is a MINIMAL model. Real traffic has lane changes, varied
  vehicle/driver types, on-ramps and merges, and heterogeneous behavior. NaSch
  captures the *mechanism* of phantom-jam formation (instability of dense flow
  under random perturbation), NOT quantitative prediction for any real highway.
- Adaptive-cruise-control / AV smoothing is a real, demonstrated effect but is
  bounded: it works by interrupting the instability chain, not by adding capacity
  in the trivial sense. Don't overstate it.

## Sources
- Nagel, K. & Schreckenberg, M. (1992). J. Phys. I France 2:2221–2229.
- Sugiyama, Y. et al. (2008). New J. Phys. 10:033001.
- Stern, R. E. et al. (2018). Transp. Res. Part C 89:205–221 (arXiv:1705.01693).
- Treiber, M. & Kesting, A. (2013). Traffic Flow Dynamics. Springer.

## TODO / to verify on a later pass
- [ ] Confirm exact car count (22?) and track circumference in Sugiyama 2008.
- [ ] Confirm the quantitative backward-wave speed figure against a primary source
      before stating a precise km/h number (page currently gives a careful range).
