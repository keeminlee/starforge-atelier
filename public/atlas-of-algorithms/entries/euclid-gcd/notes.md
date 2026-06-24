# euclid-gcd — research notes & provenance

## Sources actually used (web-verifiable)

- **Euclid, *Elements*, Book VII, Props. 1–2 (c. 300 BC).** Anthyphairesis (repeated subtraction) — the
  geometric origin this entry visualizes.
- **Knuth, TAOCP Vol. 2, §4.5.2–4.5.3.** Analysis (Lamé's theorem: Fibonacci worst case, O(log)),
  extended and binary (Stein) variants.
- **CLRS, *Introduction to Algorithms*, 4th ed., §31.2 (GCD).** The invariant gcd(a,b)=gcd(b, a mod b).

## The lens

gcd(a,b) = gcd(b, a mod b): any d dividing a,b divides a−qb = a mod b, and vice versa — so the common
divisors (hence the greatest) are preserved every step. The remainder strictly shrinks ⇒ termination;
gcd(x,0)=x reads off the answer. O(log min(a,b)) steps (Fibonacci pairs are the worst case). Extended
form gives ax+by=gcd (modular inverses → RSA).

## Implementation note (this entry)

- Numeric Euclid gives the authoritative gcd + division steps; the geometry carves the a×b rectangle
  into the largest squares (side = shorter edge) per round, leaving a remainder rectangle, until it
  tiles exactly — the final square side = gcd. Squares colored by round (alternating), remainder
  dashed-outlined, the gcd squares green when done. Custom rectangle draw (scaled to fit, aspect kept).

## Verification

`tools/test-euclid-gcd.mjs` — **722 checks green** (120 pairs):
1. **gcd == trial-division oracle** (largest d dividing both).
2. gcd **divides both** inputs and is **maximal** (nothing larger divides both).
3. The squares **tile the a×b rectangle exactly** (Σ areas == a·b).
4. Every square side is a **multiple of the gcd**, and the **smallest square == gcd**. Determinism; draw no-throw.

## Honesty notes

- States that the visualized form is anthyphairesis (Euclid's subtraction/squares); the mod form is the
  same with division. Notes Lamé's Fibonacci worst case, and that the extended/binary variants are the
  ones doing cryptographic and hardware work — the bare gcd shown here is the concept.
