# huffman — research notes & provenance

## Sources actually used (web-verifiable)

- **Huffman, D. A. "A Method for the Construction of Minimum-Redundancy Codes." Proc. IRE
  40(9):1098–1101, 1952.** The original (and the famous term-paper origin story).
- **Cover & Thomas, *Elements of Information Theory* 2nd ed., §5.** Optimality and the entropy bounds
  H ≤ avg code length < H+1.
- **CLRS, *Introduction to Algorithms*, 4th ed., §15.3 (Huffman codes).** The greedy exchange-argument
  proof of optimality; O(n log n) build with a priority queue.

## The lens

Merge the two least-frequent trees repeatedly; 0/1 edges give prefix-free codes. Exchange argument:
the two rarest symbols can be sibling leaves at max depth in some optimal code ⇒ greedy merge is
optimal (induction). Average length ∈ [H, H+1) (H = Σ p log₂ 1/p). Savings grow with skew.

## Implementation note (this entry)

- Skewed frequencies from a seeded text (every symbol present ≥ once). Build animated as a forest of
  cards merging two-lightest-first; final frame draws the code tree (in-order leaf layout, 0/1 edge
  labels) + a symbol/freq/code table. Deterministic tie-break by node id.

## Verification

`tools/test-huffman.mjs` — **303 checks green** (60 runs, 3–8 symbols):
1. **Codes are prefix-free** (no codeword is a prefix of another).
2. **decode(encode(text)) === text** (round-trip).
3. **Total bits ≤ fixed-width** ⌈log₂ n⌉·len, and = Σ len·freq (consistency).
4. **Entropy bounds:** H ≤ avg code length < H+1.
5. **Optimality witness:** Huffman total ≤ Shannon–Fano total (ceil(−log₂ p) lengths). Determinism; draw no-throw.

## Honesty notes

- States the one limitation: Huffman spends a whole number of bits/symbol, so it can't reach the
  fractional-bit optimum that arithmetic / range coding (and ANS) achieve — while remaining the simple,
  fast, canonical optimal prefix code (DEFLATE/gzip/PNG/ZIP/JPEG).
