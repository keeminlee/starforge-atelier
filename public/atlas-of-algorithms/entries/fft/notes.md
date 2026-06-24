# fft — research notes & provenance

## Sources actually used (web-verifiable)

- **Cooley, J. W. & Tukey, J. W. "An Algorithm for the Machine Calculation of Complex Fourier Series."
  Math. Comp. 19(90):297–301, 1965.** The paper that launched the modern FFT.
- **Heideman, Johnson & Burrus, "Gauss and the History of the Fast Fourier Transform." IEEE ASSP Mag.,
  1984.** The Gauss-1805 prehistory.
- **CLRS, *Introduction to Algorithms*, 4th ed., §30 (Polynomials and the FFT).** The even/odd identity,
  butterflies, O(n log n), bit-reversal.

## The lens

X[k] = E[k] + W_n^k·O[k], with E/O the DFTs of even/odd subsequences and W_n = e^(−2πi/n). Since
W_n^{k+n/2} = −W_n^k, one product serves X[k] (+) and X[k+n/2] (−) — the butterfly. log₂n stages × n/2
butterflies = O(n log n). Exact (not approximate): ifft(fft(x)) = x; Parseval Σ|x|² = (1/n)Σ|X|².

## Implementation note (this entry)

- Iterative radix-2 decimation-in-time: bit-reversal permutation + log₂n in-place butterfly stages.
  Dependency-free complex arithmetic (separate re/im arrays, twiddle by repeated complex multiply).
  Signal = sum of two cosines (clean peaks). Viz reuses `Algo.bars`: time-domain signal (purple) →
  bit-reversal → stages (blue) → magnitude spectrum (peaks green). N ∈ {8,16,32}. Counts complex mults.

## Verification

`tools/test-fft.mjs` — **228 checks green** (N=8/16/32, 25 seeds each):
1. **FFT == brute-force O(n²) DFT** (max error < 1e-9).
2. **Lossless inverse:** an independent inverse-DFT of the output reproduces the input (< 1e-9).
3. **Spectrum localization:** the 4 bins {f1, n−f1, f2, n−f2} carry the energy; every other bin ≈ 0.
4. **Parseval:** Σ|x|² == (1/n)Σ|X|². Determinism; draw no-throw.

## Honesty notes

- Stresses the FFT is *exact* (the DFT, fast), not an approximation. States the radix-2 power-of-2
  restriction and points to mixed-radix / Bluestein for arbitrary n and FFTW for production. Notes the
  Gauss (1805) prehistory predating both Cooley–Tukey and Fourier — sourced to Heideman et al. 1984.
