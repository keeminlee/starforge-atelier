# boyer-moore — research notes & provenance

## Sources actually used (web-verifiable)

- **Boyer, R. S. & Moore, J S. "A Fast String Searching Algorithm." CACM 20(10):762–772, 1977.** The
  original (bad-character + good-suffix rules, right-to-left scanning).
- **Horspool, R. N. "Practical fast searching in strings." Softw. Pract. Exper. 10(6):501–506, 1980.**
  The simplified bad-character-only variant.
- **Gusfield, *Algorithms on Strings, Trees, and Sequences*, §2.** The good-suffix rule and the
  worst-case O(n) bound (with Galil's rule).

## The lens

Compare the pattern right-to-left; on a mismatch at text char c (pattern position j), shift by
max(1, j − last[c]) where last[c] is c's last position in the pattern (−1 if absent). **Safe:** the
rightmost copy of c is the smallest realignment possible; any smaller shift leaves a known-wrong char
over c — so no occurrence is ever skipped. Typical cost ≈ n/m (sublinear); worst O(nm) for bad-char
alone, O(n) with good-suffix.

## Implementation note (this entry)

- Bad-character rule only (good-suffix described in prose). Alphabet {A,B,C,D}, text length 28, pattern
  length m (2–5), 2 planted occurrences. After a full match, shift by 1 to catch overlaps. Viz: text
  row + pattern row aligned at s, right-to-left compares (blue), matched suffix (green), mismatch
  (orange) with the skip annotated; found regions glow green. Custom text-grid draw.

## Verification

`tools/test-boyer-moore.mjs` — **243 checks green** (120 runs, m=2–5):
1. **Match set == brute-force scan** (no missed or spurious matches — the safety invariant).
2. Every reported match is a genuine occurrence.
3. Every run finds ≥1 occurrence (planted). Determinism; draw no-throw.

## Honesty notes

- States clearly that this is the **bad-character rule only**: correct (never misses) but O(nm)
  worst-case; the full Boyer–Moore adds the good-suffix rule (+ Galil) for O(n), and Horspool is the
  simplified production variant. The sublinear ≈ n/m typical case is framed as typical, not guaranteed.
