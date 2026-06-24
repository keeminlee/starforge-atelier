# count-min-sketch — research notes & provenance

## Sources actually used (web-verifiable)

- **Cormode, G. & Muthukrishnan, S. "An improved data stream summary: the count-min sketch and
  its applications." *Journal of Algorithms* 55(1):58–75, 2005.** The original; source of the
  guarantee (w=⌈e/ε⌉, d=⌈ln 1/δ⌉ ⇒ estimate ≤ true + εn w.p. ≥ 1−δ).
- **Cormode & Muthukrishnan, "Approximating Data with the Count-Min Sketch," *IEEE Software*
  29(1), 2012** — practitioner overview; applications.
- **Andoni, *Advanced Algorithms* (Columbia COMS 4995-8, 2021), Lecture 5 (Heavy Hitters)** —
  https://www.cs.columbia.edu/~andoni/advancedS21/materials.html
- **Charikar, Chen & Farach-Colton, "Finding frequent items in data streams," ICALP 2002** —
  the related Count-Sketch (unbiased, signed).

## The guarantee (the lens — ADR-0005)

- **One-sided (hard) invariant:** estimate(x) = min_r count[r][h_r(x)] ≥ true(x), ALWAYS. Each
  occurrence bumps all d of x's cells; collisions only add; so every cell ≥ true(x), hence the
  min is too. No false negatives.
- **Probabilistic overcount:** E[collision mass in one row's cell] = n/w; Markov ⇒
  P[overcount > εn in one row] ≤ 1/(εw) = 1/e (at w=⌈e/ε⌉); the d rows are independent and we take
  the min, so all must fail: P[overcount > εn] ≤ (1/e)^d = δ (at d=⌈ln 1/δ⌉). More columns → smaller
  ε; more rows → smaller δ.

## Implementation note (this entry)

- d pairwise-independent hashes h_r(x) = ((a_r·x + b_r) mod (2³¹−1)) mod w, seeded for repeatability.
- Stream = a heavy hitter (item 0, ~34%) + a few medium items + uniform noise over a 40-item
  universe; we track item 0 and show true vs estimate (min) vs overcount live. Grid is a heatmap;
  the tracked item's d cells are outlined and the MIN cell (the estimate) is green.

## Verification — invariant + STATISTICAL (ADR-0005)

`tools/test-count-min-sketch.mjs` — 7 checks green:
1. **One-sided invariant** estimate ≥ true for every (item × run) across 120 seeded runs spanning
   w∈[5,20], d∈[1,6] — thousands of queries; a single undercount would fail.
2. The invariant also holds at **every mid-stream frame** for the tracked item.
3. **Probabilistic bound:** across 200 seeded streams, the fraction of queries with
   estimate > true + εn is ≤ δ + small slack, at d=4 and d=6 (ε=e/w, δ=e^−d from the report).
4. **Accuracy improves with width:** average overcount at w=20 < at w=5.
5. **Determinism** for a fixed seed; **draw() no-throw**.

## Honesty notes

- The entry states plainly that the overcount hurts **rare** items most and heavy hitters least —
  which is precisely why CM is a *heavy-hitters* tool, not a general exact-count replacement. The
  "fixed space regardless of #distinct" win and the collision-driven overcount are both shown, not hidden.
