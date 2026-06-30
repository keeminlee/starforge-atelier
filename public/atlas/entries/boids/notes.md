# Research notes — Boids (flocking)

Provenance for the claims on this entry's page. Keep this honest: list what was
actually used, and flag the model-vs-reality distinction explicitly.

## Key facts used
- **Origin:** Craig W. Reynolds, "Flocks, herds and schools: A distributed
  behavioral model," presented at SIGGRAPH '87 and published in *Computer
  Graphics* 21(4):25–34 (the SIGGRAPH '87 conference proceedings). The model was
  developed at Symbolics; "boid" = "bird-oid object." Reynolds dates the work to
  1986–87.
- **The three rules:** separation (collision avoidance / steer away from close
  flockmates), alignment (velocity matching toward the average heading of local
  flockmates), cohesion (flock centering / steer toward the average position of
  local flockmates). Each is local — computed only over neighbors within a
  perception radius/zone.
- **Steering formulation:** desired velocity = normalize(rule vector) * maxSpeed;
  steering force = desired − current velocity, clamped to a max force; sum the
  weighted forces, integrate, clamp speed. This is the standard Reynolds steering
  formulation (see his "Steering Behaviors For Autonomous Characters," GDC 1999,
  and the boids page).
- **Film use:** Reynolds-style flocking was used in *Batman Returns* (1992) for
  bat swarms and penguin flocks (Tim Burton / VIFX). Widely cited on Reynolds'
  boids page and standard CG histories.

## Real-world connections (stated carefully)
- Boids is a **behavioral model**, not derived from physics or animal biology. The
  page says this explicitly ("behavioral caricature, not a derivation").
- **Topological vs metric interaction:** Ballerini et al. (2008, PNAS) analyzed
  real starling flocks in 3D (the STARFLAG project) and found interaction depends
  on a fixed *number* of nearest neighbors (~6–7), i.e. *topological* distance,
  not a fixed metric radius. Classic boids uses a metric radius — the page draws
  this contrast.
- **Collective regimes:** Couzin et al. (2002, J. Theor. Biol.) showed a zonal
  model transitions between swarm, torus (mill), and parallel/dynamic-parallel
  states as zone widths change; relevant to real fish schools.
- **Active-matter phase transition:** Vicsek et al. (1995, PRL) — minimal
  self-propelled-particle model with alignment + noise shows an
  order–disorder phase transition; foundational for the physics of active matter.

## Sources (verified as real citations)
- Reynolds, C. W. (1987). *Computer Graphics* 21(4):25–34. SIGGRAPH '87.
- Reynolds' boids page — http://www.red3d.com/cwr/boids/
- Ballerini, M., et al. (2008). PNAS 105(4):1232–1237.
  https://doi.org/10.1073/pnas.0711437105
- Couzin, I. D., et al. (2002). J. Theor. Biol. 218(1):1–11.
  https://doi.org/10.1006/jtbi.2002.3065
- Vicsek, T., et al. (1995). Phys. Rev. Lett. 75(6):1226–1229.
  https://doi.org/10.1103/PhysRevLett.75.1226

## Caveats / to verify on a later pass
- Citation metadata (volume/issue/pages, DOIs) recalled from standard references;
  worth confirming page numbers against primary scans on a later pass.
- *Batman Returns* attribution is well-established in CG folklore and on Reynolds'
  page; exact studio/credit detail not independently re-verified here.
- This sim uses a *metric* perception radius (classic boids) for clarity and
  performance; the topological alternative (fixed neighbor count) is noted in the
  prose as the empirically-supported real-bird rule.
