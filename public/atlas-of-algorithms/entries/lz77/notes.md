# lz77 — research notes & provenance

## Sources actually used (web-verifiable)

- **Ziv, J. & Lempel, A. "A Universal Algorithm for Sequential Data Compression." IEEE Trans. Inf.
  Theory 23(3):337–343, 1977.** The original sliding-window method.
- **Deutsch, P. "DEFLATE… version 1.3." RFC 1951, 1996.** LZ77 + Huffman as shipped in gzip/zlib/PNG.
- **Salomon, *Data Compression: The Complete Reference*, 4th ed., 2007.** Variants (LZ78/LZW/LZMA/LZ4/
  Zstd), match-finding with hash chains.

## The lens

Emit (offset, length, next-char): copy `length` chars from `offset` back in the already-decoded output,
then a literal. **Lossless** because references only point backward into reconstructed text; the
decoder rebuilds the same window in lockstep. Overlapping matches (offset < length) give RLE for free.
Cost is in match-finding: O(nW) naive, ≈ O(n) with hash chains; decode O(n).

## Implementation note (this entry)

- Repetitive text from short motifs (so back-references exist). Whole-prefix-within-window search,
  longest match (cap 9), overlap allowed. Viz reuses the text-grid: cursor outline splits window/
  lookahead, match source blue, copied run green, next literal orange; emitted tokens list below; a
  window bracket. Window size is a control. Reports text, window, tokens.

## Verification

`tools/test-lz77.mjs` — **363 checks green** (120 runs, window 6–24):
1. **Lossless:** an independent decoder reproduces the text exactly (`decode(tokens) === text`).
2. Every copy token references a **valid earlier position within the window** (1 ≤ offset ≤ min(pos, W)).
3. Decoded length matches.
4. Repetitive text **compresses** (fewer tokens than characters) in all runs. Determinism; draw no-throw.

## Honesty notes

- Clear that LZ77 alone shrinks repetition but leaves tokens uncompressed — it's paired with an entropy
  coder ([[huffman]]) to form DEFLATE (gzip/zlib/PNG/ZIP). Notes that real encoders use hash chains for
  near-linear match-finding (the shown naive O(nW) search is the concept), and the window-size
  time/ratio trade-off. Overlapping-match RLE behavior called out explicitly.
