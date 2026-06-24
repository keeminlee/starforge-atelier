# convex-hull — research notes & provenance

## Sources actually used (web-verifiable)

- **Andrew, A. M. "Another efficient algorithm for convex hulls in two dimensions." IPL 9(5):216–219,
  1979.** The monotone chain used here.
- **Graham, R. L. "An efficient algorithm for determining the convex hull of a finite planar set."
  IPL 1(4):132–133, 1972.** The Graham scan (the sibling O(n log n) method).
- **de Berg, Cheong, van Kreveld & Overmars, *Computational Geometry* 3rd ed., Ch. 1.** The standard
  treatment (incl. the cross-product orientation test).
- **Chan, T. "Optimal output-sensitive convex hull algorithms…", DCG 16, 1996** — the O(n log h) bound.

## The lens

- Cross product cross(O,A,B) = (A−O)×(B−O); > 0 left turn (keep), ≤ 0 right/straight (pop). The chain
  is kept convex (every consecutive triple a left turn); lower + upper chains are the lower/upper
  boundaries, so every point is between them — inside or on the hull.

## Implementation note (this entry)

- Andrew's monotone chain: sort by (x,y); sweep L→R for lower hull, R→L for upper, popping on
  cross ≤ 0. Animated push/pop (the chain retracts when a point makes it non-convex). Custom
  point/polygon draw (y flipped so math-up = screen-up). Seeded random points.

## Verification

`tools/test-convex-hull.mjs` — **322 checks green** (80 seeded point sets, n = 6–40):
1. Hull vertices distinct, valid, subset of input.
2. **Convex:** all consecutive turns have the same non-zero sign.
3. **Encloses all:** every input point is inside or on the hull (consistent cross-product sign).
4. **Matches an independent gift-wrapping (Jarvis march) oracle's vertex set.**
5. Determinism; draw no-throw.

## Honesty notes

- Cost section compares monotone chain O(n log n) vs gift-wrapping O(n·h) vs Chan's optimal
  O(n log h) — no implication this is the only/fastest method. Random floats avoid collinear edge
  cases (noted implicitly; the <=0 pop excludes collinear interior-of-edge points, matching the oracle).
