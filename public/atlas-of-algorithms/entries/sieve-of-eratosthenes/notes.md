# sieve-of-eratosthenes — research notes & provenance

## Sources actually used (web-verifiable)

- **Eratosthenes (c. 200 BC)**, described by Nicomachus, *Introduction to Arithmetic* — the classical
  sieve.
- **CLRS, *Introduction to Algorithms*, 4th ed., §31 (Number-Theoretic Algorithms).**
- **Crandall & Pomerance, *Prime Numbers: A Computational Perspective*, 2nd ed., §3** — sieving,
  segmented sieves, the O(n log log n) analysis.

## The lens

- Invariant: a number stays marked prime iff it has no prime factor < current p. Reaching an
  uncrossed p ⇒ p prime; crossing multiples of p can't strike a prime; once p² > n the survivors are
  prime. Start crossing at p² (smaller multiples already gone); stop sieving at p² > n.
- Cost n·Σ(1/p over primes p≤n) ≈ n·ln ln n (near-linear).

## Implementation note (this entry)

- Numbers 1..n in a √n-ish grid; per-prime rounds (one animation frame per sieving prime), striking
  multiples from p². Colors: current prime green, struck-this-round orange, composites dim, survivors
  green at the end. Numbers drawn in each cell. Deterministic (no RNG); only control is n.

## Verification

`tools/test-sieve-of-eratosthenes.mjs` — **32 checks green** (n = 30..200):
1. **Survivors are exactly the primes** vs a trial-division oracle (for every v ≤ n).
2. 1 is marked non-prime.
3. **π(n) matches** the oracle; explicit π(100)=25, π(30)=10.
4. **Every sieving number is prime** (each round's p is prime).
5. Determinism; draw no-throw.

## Honesty notes

- States that for testing a *single* large number you'd use Miller–Rabin, not a sieve (sieving is for
  generating many primes). Notes modern variants (Atkin, wheel, segmented) trim constants but keep
  the idea — no implication this naive bit-array form scales to billions without segmentation.
