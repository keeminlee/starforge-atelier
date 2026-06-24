# gradient-descent — research notes & provenance

## Sources actually used (web-verifiable)

- **Cauchy (1847)** — the original gradient method.
- **Boyd & Vandenberghe, *Convex Optimization*, §9** — https://web.stanford.edu/~boyd/cvxbook/ —
  descent methods, smoothness, step-size conditions, O(1/ε) / O(log 1/ε) rates.
- **Nesterov, *Lectures on Convex Optimization*, 2nd ed., 2018** — rates, acceleration.
- **Vishnoi, *Algorithms for Convex Optimization* (2021)** + **Andoni, *Advanced Algorithms*
  (Columbia COMS 4995-8, 2021)** gradient-descent lectures —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html

## The lens

x ← x − η∇f. Convex + L-smooth + η ≤ 1/L ⇒ loss monotone ↓ and converges (gap O(1/t); exponential if
strongly convex). η > 2/L ⇒ overshoot/divergence. Conditioning (ratio of curvatures) sets the speed.

## Implementation note (this entry)

- Three surfaces: **bowl** x²+y² (well-conditioned), **elongated** x²+12y² (ill-conditioned, zig-zag),
  **rosenbrock** (non-convex banana). Step η = base[func] × (slider/10); the slider reaches past the
  η = 2/L cliff on the elongated surface so divergence is explorable. Contour heatmap (sample f on a
  56×56 grid, range-compressed shading) + descent path + min (green) + current point (orange). Seeded start.

## Verification

`tools/test-gradient-descent.mjs` — **74 checks green**:
1. **Monotone non-increasing loss** on the convex surfaces (bowl, elongated) at the stable step, over
   many seeded starts.
2. **Convergence:** bowl reaches final loss < 1e-3 and within 0.05 of the true minimum; elongated cuts
   loss to < 20% of initial.
3. **Divergence** with a too-large step on the elongated surface (loss grows / diverged flag).
4. Determinism; draw no-throw across all three surfaces.

## Honesty notes

- Explicit that convexity is required for the global-min guarantee (Rosenbrock keeps per-step decrease
  but not convergence to global), that conditioning controls speed, and that momentum/Nesterov/Adam and
  SGD are the practical refinements — this raw full-gradient form is the concept, not the production tool.
