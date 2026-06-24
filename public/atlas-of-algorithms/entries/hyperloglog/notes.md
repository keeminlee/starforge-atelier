# hyperloglog — research notes & provenance

## Sources actually used (web-verifiable)

- **Flajolet, Fusy, Gandouet & Meunier, "HyperLogLog: the analysis of a near-optimal cardinality
  estimation algorithm." AofA 2007.** The original — registers, leading-zeros, α_m, the 1.04/√m error.
- **Heule, Nunkesser & Hall, "HyperLogLog in Practice…" EDBT 2013.** HLL++: 64-bit hashing + empirical
  bias correction (the fix for small-m bias).
- **Flajolet & Martin, "Probabilistic counting…" JCSS 31(2), 1985.** The ancestor (FM sketch). +
  Andoni, *Advanced Algorithms* (Columbia, 2021).

## The lens (statistical guarantee — ADR-0005)

Hash → first p bits pick a register (m=2^p); record max (leading-zeros+1) = ρ. Estimate =
α_m·m²/Σ2^(−reg) (bias-corrected **harmonic** mean — suppresses unlucky long-zero registers). Unbiased
with relative SE ≈ 1.04/√m (quadruple m ⇒ halve error). Space O(m·log log N). Small-cardinality
fallback: linear counting m·ln(m/V) over empty registers V.

## Implementation note (this entry)

- 32-bit murmur-style hash; j = top p bits; ρ = clz32(low (32−p) bits) − p + 1 (cap at 32−p+1).
  α_m = {16:0.673, 32:0.697, 64:0.709, else 0.7213/(1+1.079/m)}. Linear-counting branch when
  E ≤ 2.5m and empty registers exist. Viz: register bars (height = leading-zero count); readout shows
  true vs estimate and the % error against 1.04/√m. p and stream size are controls.

## Verification

`tools/test-hyperloglog.mjs` — **15 checks green** (120 seeds per config):
1. **~Unbiased:** mean estimate ≈ true cardinality, tolerance scaled to the per-run error 0.6·(1.04/√m)
   (raw HLL has known small-m bias — the reason HLL++ exists; acknowledged, not hidden).
2. **Error scale:** mean relative error ≤ 1.6·(1.04/√m).
3. **More registers ⇒ tighter** (error at m=128 < m=16).
4. Accurate across cardinalities (n = 200/600/2000 at p=7, within 6%).
5. Registers in valid range. Determinism; draw no-throw.

## Honesty notes

- States plainly that raw HLL is **biased at small m** (HLL++ adds empirical correction) and that the
  demo uses the **linear-counting** fallback at small cardinalities. Merge-by-max (union) noted;
  inability to intersect/delete noted. Space framed honestly (the "log log" in the name).

## Bug caught while building (verify-centrally)

First version masked a single bit (`1 << (32−p)`) instead of the low `(32−p)` bits
(`(1 << (32−p)) − 1`) for the register suffix, so leading-zero counts — and thus every estimate —
were garbage (est 11 for true 1200). The statistical test caught it immediately; fixed the mask.
