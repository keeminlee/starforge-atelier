# Lantern-Lens

A light puzzle. One gold ray leaves the lantern into a dark navy room; you drag
and turn a few glass slabs and mirrors so the ray bends its way onto an unlit
wick. It lights, or it doesn't — the beam obeys real optics, so a solved level
is a geometric fact, not a judgment call.

Open **`lantern-lens.html`**. Drag a piece; scroll or press `[` `]` to turn it.

## The optics are real

The beam is traced segment-by-segment against the scene by the actual 2D laws:

- **Mirrors** reflect the ray about the surface normal.
- **Glass** refracts it by **Snell's law** (`n₁·sinθ₁ = n₂·sinθ₂`, n≈1.5) — bending
  toward the normal on the way in, away on the way out. A rectangular slab
  therefore *slides* the beam sideways without turning it, which is the whole
  trick of "The Shift."
- Past the **critical angle**, glass stops transmitting and **totally internally
  reflects** — the surprising edge that turns a slab into a mirror.
- **Walls** are opaque; the beam dies where it meets one.

The ray is retraced every time you move a piece, so you watch the beam swing,
catch a face, and finally kiss the wick. It lights the instant the traced beam
actually touches the wick's disk — no score, no "close enough."

## The levels

1. **The Turn** — a single mirror; bounce the beam up to the wick. (reflection)
2. **The Shift** — a glass slab; the wick sits just off the beam line, so you
   angle the slab until refraction slides the beam onto it. (refraction)
3. **The Reach** — a pillar hangs in the way; catch the beam before it and bend
   it down past the pillar's foot to a far wick. (precise aim around an obstacle)

Every level is **proven solvable by construction** — `lens-verify.mjs` searches
each movable piece's placement space and confirms at least one arrangement
lights the wick, and that the *starting* arrangement is dark (so there's a real
puzzle). Adding a level is just an entry in `lens-levels.mjs`.

## Build + verify

```
node build.mjs        # inline the engine + levels → self-contained lantern-lens.html
node lens-verify.mjs  # prove the physics + that every level is winnable (headless)
```

`lens-core.mjs` is the pure optics engine (no DOM, no randomness); `lens-levels.mjs`
holds the puzzles; `build.mjs` inlines both into one self-contained page, so the
beam you bend and the beam the tests trace are the same code. The verifier proves
reflection (a 45° mirror turns the ray 90°), refraction (the beam bends toward the
normal entering glass), TIR exists past the critical angle, and every level is
solvable-but-not-pre-solved. All checks pass.

## Honest state

- **Built 2026-07-08** (autonomous room-night; the ranked runner-up of a
  `/diverge-and-rank` brainstorm). The **optics engine and level solvability are
  proven headless** — the falsifiable heart. The one thing not machine-tested is
  the *drag-and-turn interaction itself* (pointer events, canvas hit-testing),
  which was built carefully but wants a real click to confirm feel; it's standard
  pointer handling over a proven core, so the risk is low and named.
- **Published 2026-07-13** in the Starforge atelier at `/atelier/lantern-lens/`. Zero dependencies — Canvas 2D only.
- Sibling to **Voussoir**: another real physical rule made *losable* — there a
  standing arch, here a lit wick, in both cases a fact you can see.

*A Wright-HQ making — a lantern, a dark room, and light that goes exactly where
the physics sends it.*
