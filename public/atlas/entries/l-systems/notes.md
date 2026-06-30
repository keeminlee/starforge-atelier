# L-Systems — research notes & provenance

## What this entry models

Deterministic, context-free L-systems (D0L-systems): an axiom string plus a set
of parallel rewrite rules, applied `iterations` times, then interpreted as
turtle graphics to produce line segments. Five classic systems are offered:

| System | Axiom | Rules | Angle | Notes |
| --- | --- | --- | --- | --- |
| Fractal plant | `X` | `X → F+[[X]-X]-F[-FX]+X`, `F → FF` | 25° | iconic branching bush; root at bottom, heading up |
| Bushy weed | `F` | `F → FF-[-F+F+F]+[+F-F-F]` | 22.5° | denser plant |
| Koch snowflake | `F++F++F` | `F → F-F++F-F` | 60° | closed fractal curve |
| Sierpiński arrowhead | `A` | `A → B-A-B`, `B → A+B+A` | 60° | A and B both DRAW forward |
| Dragon curve | `FX` | `X → X+YF+`, `Y → -FX-Y` | 90° | X and Y are non-drawing |

Turtle alphabet: `F`/drawing letters = forward + draw; `f` = forward, no draw;
`+`/`-` = turn left/right by `angle`; `[`/`]` = push/pop state (branching);
other letters (`X`, `Y`) = no-op (rewriting only).

## Implementation notes

- **Rewriting** (`expandString`) applies rules in parallel each pass and is
  capped at 350,000 characters so high-growth rules (e.g. `F → FF`, dragon at
  many iterations) can't blow up memory. Per-system `maxIters` caps the slider.
- **Angle vs. iteration split**: changing the **angle** only re-runs the turtle
  (`runTurtle`) over the already-expanded string — cheap and responsive.
  Changing the **system** or **iterations** re-runs the full rewriting
  (`regenerate`). This is why the angle slider morphs the plant smoothly.
- **Auto-fit**: after generating segments, the bounding box is computed and the
  figure is scaled + translated to fill the canvas with a 10% margin. Plants are
  anchored with their root near the bottom; free curves are centered.
- **Reveal animation**: `step()` advances `revealT` from 0→1 over ~90 ticks
  (~1.5 s) and `draw()` renders only the first `segments.length * revealT`
  segments, so each change "grows" the figure, then holds.
- **Color**: plants run brown at the root → teal-green at the tips (by branch
  depth) with strokes thinning toward the tips; curves sweep teal→amber along
  the path.

## Sources (verified)

- Lindenmayer, A. (1968). "Mathematical models for cellular interactions in
  development. I & II." *Journal of Theoretical Biology* 18(3), 280–315.
  The origin paper: L-systems were introduced to model the development of
  filamentous organisms (e.g. the alga *Anabaena*), cell by cell.
- Prusinkiewicz, P. & Lindenmayer, A. (1990). *The Algorithmic Beauty of
  Plants*. Springer-Verlag. The canonical reference; freely available at
  http://algorithmicbotany.org/papers/ . Source of the standard fractal-plant
  and bushy-weed productions and the turtle interpretation.
- Prusinkiewicz, P. (1986). "Graphical applications of L-systems." *Proc.
  Graphics Interface '86*, 247–253. Introduces the turtle interpretation used
  here.
- Smith, A. R. (1984). "Plants, fractals, and formal languages." *Computer
  Graphics (SIGGRAPH '84)* 18(3), 1–10. Early graphics use of L-systems for
  plants ("graftals").
- Standard productions for the Koch snowflake, Sierpiński arrowhead, and dragon
  curve are textbook (cf. *The Algorithmic Beauty of Plants*, ch. 1, and common
  L-system references).

## Caveats (honesty)

- **Different flavor of emergence.** Most Atlas entries are *dynamical /
  interaction-based*: many agents interact in real time and order emerges from
  feedback (boids, Ising, reaction–diffusion). L-systems are *generative /
  developmental*: there is no interaction between parts and no equilibrium — a
  grammar simply unfolds a form by rewriting. The complexity is real and the
  whole far exceeds any single rule, but the mechanism is **rewriting, not
  interaction**. The prose says this explicitly.
- **Real plants are richer.** The classic systems here are *deterministic*.
  Actual plant development is stochastic, environmentally responsive (light,
  gravity, crowding), and hormone/gene regulated. Stochastic and
  context-sensitive L-system variants exist (and Prusinkiewicz/Lindenmayer
  developed them) precisely to narrow this gap; this entry uses the simple
  deterministic core as a clarifying caricature, not a literal biological model.
- The figures are pure geometry (no physics); the "growth" animation is a reveal
  of precomputed segments, not a simulation of biological growth over time.
