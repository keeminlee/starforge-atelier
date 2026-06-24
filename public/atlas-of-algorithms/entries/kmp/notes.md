# kmp — research notes & provenance

## Sources actually used (web-verifiable)

- **Knuth, Morris & Pratt, "Fast pattern matching in strings." SIAM J. Comput. 6(2):323–350, 1977.**
  The original linear-time matcher + failure function.
- **CLRS, *Introduction to Algorithms*, 4th ed., §32.4.** The prefix function, the amortized
  linear-time argument (basis for this entry's invariant section).
- **Sedgewick & Wayne, *Algorithms* 4th ed., §5.3** — https://algs4.cs.princeton.edu/53substring/

## The lens

- failure[i] = longest proper prefix of pat[0..i] that is also a suffix. On mismatch after matching j
  chars, set j ← failure[j−1] (slide pattern, keep text pointer). **Invariant: the text index i never
  decreases.** j rises ≤1 per text char ⇒ falls ≤ as often ⇒ ≤ 2n comparisons + O(m) table.

## Implementation note (this entry)

- 2-letter alphabet {A,B} so partial matches (and failure jumps) are frequent and visible; the
  pattern is embedded once to guarantee ≥1 occurrence. Animated per comparison incl. failure jumps.
  Custom text viz: text row + pattern row aligned at offset i−j; matched prefix green, current compare
  blue/orange, found occurrences green. Overlapping matches reported (j ← failure[m−1] after a hit).

## Verification

`tools/test-kmp.mjs` — **602 checks green** (120 cases, text 16–44, pattern 2–6):
1. **Matches == a brute-force oracle** (all overlapping occurrences).
2. ≥ 1 occurrence (embedded); **failure function correct** vs reference.
3. **THE INVARIANT: the text pointer never decreases** across all frames.
4. Comparisons ≤ 2(n+m) (linear). 5. Determinism; draw no-throw.

## Honesty notes

- Notes Boyer–Moore is often faster in practice (big skips) and Rabin–Karp uses hashing; KMP is the
  clean linear-worst-case guarantee and the streaming-friendly one (never rewinds). No overclaiming
  of universal superiority.
