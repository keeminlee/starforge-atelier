# The Frost-Grammar

A new frost every night. Cold breathes a dendritic crystal up a dark
windowpane — drifting vapor that freezes where it touches the ice, branching as
real window-frost branches — and no two panes are ever the same. Tune the cold,
the frost, the wind, and the seeding, and see if you can make it *live*.

Open **`frost.html`** and press *breathe a new pane*.

## How it grows (diffusion-limited aggregation)

Real window frost is a textbook case of **diffusion-limited aggregation**: water
vapor wanders until it meets ice, then freezes on contact, and the structure
that results is a self-similar dendrite. The engine is exactly that:

- A few **seed** cells nucleate along the sill (the `seeds` control).
- **Vapor walkers** launch just above the frost frontier and random-walk with a
  mild downward drift (gravity) and a sideways bias (`wind`). Isotropy is what
  makes it *branch* rather than fall into thin spikes.
- When a walker touches the ice it **freezes** with a probability set by the
  `cold` — and, counter-intuitively, *lower* stickiness makes *denser* frost
  (walkers penetrate deeper before catching) while high stickiness makes lacy
  thin spikes. Finding the branched middle is the game.
- The pane grows until the `frost` (coverage) target is reached. The browser
  then reveals the crystal **in the exact order it froze**, so you watch it
  climb the glass the way it actually grew.

Founders' warmth: ice tints warmer near the seeds (older ice), cooler at the
growing tips — a small honest cue to the order of growth.

## Alive is measured, not admired

The anti-slop spine: whether a pane is *alive* is a computed fact, not a vibe.
A lively frost must be **branched** (its box-counting fractal dimension clears a
real floor) **and reach across the glass** (its largest connected crystal spans
most of the pane's height). The page shows all three numbers live.

**The two ways DLA frost actually goes dead are exactly what the gate rejects:**

- a **bare / barely-frosted** pane fails on coverage (it reads dimension ~1.15,
  span ~0.2) — nothing grew;
- **thin over-sticky spikes** fail the low dimension edge (dim < 1.35 — a few
  filaments, not a fern).

A **lively fern** passes — branched *and* spanning. And, honestly, a merely
*dense* frost passes too, and should: dense-but-spanning is real frost, not a
failure. So the gate's two *active* discriminators are the coverage floor and
the dimension floor; the dimension ceiling and span floor are outer guards
against degenerate inputs that rarely bite on the normal control range. (This is
a plainer, truer claim than "it discriminates four ways" — the gate rejects the
two real dead modes, and `frost-verify.mjs` checks both of them *and* that a
dense frost is still admitted.)

**Honest calibration.** 2D DLA's box-counting dimension approaches the textbook
~1.71 only for very large clusters under mass-radius scaling; a *finite*
~220×150 window-frost measures lower, around **1.33–1.55**. So the dimension
floor (`ALIVE.dimMin` in `frost-core.mjs`) is empirical to this pane, not the
asymptotic constant — naming that plainly rather than quoting 1.71 at you is the
point.

## Build + verify

```
node build.mjs        # inline the engine → self-contained frost.html
node frost-verify.mjs # prove the frost is measurably alive (headless)
```

`frost-core.mjs` is the shared engine — no DOM, no clock, no `Math.random`, all
seeded. `build.mjs` inlines it into a single self-contained `frost.html`, so the
crystal you watch grow and the crystal the tests judge are byte-identical code.
`frost-verify.mjs` proves it headless: default params grow lively frost in 12/12
seeds; known-dead configs (bare pane, over-sticky spikes) correctly **fail** the
gate; different seeds differ materially (generative, not a replayed target); the
same seed regrows byte-identically (a *kept pane* is reproducible); and the page
ships the same engine. All checks pass.

## Honest state

- **Built + fully verified 2026-07-08** (autonomous room-night). Chosen by a
  `/diverge-and-rank` brainstorm specifically to leave the "render-the-town /
  legibility" vein a critic flagged — this is the room's first **generative-art**
  piece, and unlike the Carillon (built-but-not-heard), its success is *computed*,
  so it needs no human eye to stand behind it. That was the deciding reason to
  build this one tonight.
- **Internal to Wright-HQ; unpublished.** Zero dependencies — Canvas 2D + a
  hand-rolled seeded PRNG, no CDN, no network, no assets.
- Kin in spirit to Voussoir (a real rule made playable) and the Orrery (a small
  world that moves) — but here the rule *generates* rather than being solved, and
  the "win" is that what grew is measurably alive.

*A Wright-HQ making — cold, a dark window, and a rule that turns out to branch.*
