# Fireflies (pulse-coupled oscillators) — research notes & provenance

Category: Synchronization. Complements the **Kuramoto** entry: Kuramoto is
continuous, smooth, all-to-all phase coupling (abstract); fireflies here are
discrete, pulse coupling on a local grid (concrete). Cross-linked both ways.

## The model

Mirollo–Strogatz / Peskin **pulse-coupled integrate-and-fire oscillators** on a
2-D grid. Each firefly has phase φ ∈ [0,1):

- **Integrate:** φ ← φ + dt·freq each step (freq = 1 ± jitter).
- **Fire** when φ ≥ 1.
- **Reset** φ ← 0 on firing.
- **Kick** each grid neighbor: φ ← min(φ + ε, 1) (additive excitatory pulse).
- **Cascade:** a kick that pushes a neighbor to φ ≥ 1 makes it fire the same
  step. Resolved with a BFS queue + a `_flashed` flag so each firefly fires at
  most once per step and chains terminate.

We use the **additive bump** (φ += ε) rather than the Mirollo–Strogatz
*multiplicative* kick. The spec explicitly allows this ("the additive bump is
simplest and works"). The additive version reproduces the essential qualitative
behavior — waves then locking — and is what most "firefly sync" demos use.

Coupling is **local** (Moore-8 default, von Neumann-4 selectable), on a bounded
(non-wrapping) grid so traveling waves are visible as they sweep across.

Synchrony measured two ways, both exposed for tests:
- `this.R` — Kuramoto-style order parameter r = |⟨e^{i·2π·φ}⟩| ∈ [0,1].
- `this.lastFlashFraction` — fraction of fireflies flashing on the last step
  (spikes to ~1 once the population fires in unison).
- `synchrony()` returns the (recomputed) order parameter.

## Caveats (honesty over hype)

- **The Mirollo–Strogatz theorem is for GLOBAL, all-to-all coupling** of a class
  of identical oscillators with a concave charging curve. It proves that *almost
  all* initial conditions synchronize **in that all-to-all setting**. Our grid
  uses **LOCAL** neighbor coupling, which is **not covered by their exact
  theorem.** Local pulse coupling still tends strongly to synchronize and shows
  the characteristic traveling waves, but the rigorous guarantee does not
  transfer. The prose states this distinction (it attributes full-sync proof to
  the identical, all-to-all case).
- We also use a **linear** charging curve (φ += dt) plus an **additive** kick,
  whereas the original Peskin/Mirollo–Strogatz analysis uses a **concave**
  charging function and a multiplicative kick. So this is a *suggestive
  caricature* of their exact model, not a literal implementation of it.
- **Real fireflies** have a richer **phase-response curve** — they can both
  advance and delay their next flash depending on when in their cycle they see a
  neighbor's flash, and species differ (some reset, some adjust period). The
  purely-advancing additive kick is the simplest excitatory version.
- On a **large local grid with weak coupling** the population forms competing
  synchronized domains (separated by phase defects/waves) that can take a very
  long time to merge; strong enough ε (≳ 0.18–0.2 here) locks the whole grid
  quickly. The default coupling (ε = 0.18) is chosen so the live demo locks
  visibly within seconds.

## Behavior observed in headless sweeps (deterministic LCG seed)

On the ~112×85 default grid (≈9576 fireflies), jitter 0, dt 0.02:
- ε = 0   → r stays ≈ 0.02, peak flash fraction ≈ 2% (never syncs). ✓
- ε = 0.12 → partial: r ≈ 0.42–0.54 (competing domains).
- ε = 0.2  → r → 1.000, a single step flashes 100% in unison. ✓
- Raising **jitter** at ε = 0.2 degrades the order parameter: r 1.000 (jitter 0)
  → 0.62 (jitter 0.3). ✓ (coupling vs. disorder, same competition as Kuramoto).

## Tests (`tools/test-fireflies.mjs`, deterministic seed)

1. **Invariants** over 800 steps: every phase ∈ [0,1) and finite; r ∈ [0,1];
   the per-step `_flashed` buffer is always 0/1 (no firefly flashes more than
   once per step).
2. **Sync emerges with coupling, not without:** same seed, ε = 0.2 → r = 1.000
   (from random-start 0.013) with a 100% unison burst; ε = 0 → r = 0.023, no
   burst. Comfortable margins (r > 0.8 vs r < 0.4; coupled beats uncoupled by
   > 0.4).
3. **Jitter degrades sync:** r(jitter 0) > r(jitter 0.3) + 0.1.

All pass, exit 0.

## Sources (verified)

- **Mirollo, R. E. & Strogatz, S. H. (1990).** "Synchronization of Pulse-Coupled
  Biological Oscillators." *SIAM Journal on Applied Mathematics* 50(6),
  1645–1662. Verified vol/issue/pages via SIAM/JSTOR records
  (https://www.jstor.org/stable/2101911 ; author copy:
  https://www.stevenstrogatz.com/articles/synchronization-of-pulse-coupled-biological-oscillators).
  This is the proof that almost all initial conditions synchronize for an
  all-to-all population of identical pulse-coupled oscillators.
- **Peskin, C. S. (1975).** *Mathematical Aspects of Heart Physiology.* Courant
  Institute of Mathematical Sciences, New York University, pp. 268–278. The
  integrate-and-fire cardiac-pacemaker model that Mirollo & Strogatz
  generalized.
- **Buck, J. (1988).** "Synchronous Rhythmic Flashing of Fireflies. II." *The
  Quarterly Review of Biology* 63(3), 265–289. Verified vol/issue/pages via U.
  Chicago Press / PubMed (Q Rev Biol. 1988 Sep;63(3):265-89):
  https://www.journals.uchicago.edu/doi/abs/10.1086/415929 . Review of firefly
  synchrony biology, including *Pteroptyx* and phase-response behavior.
- **Strogatz, S. H. (2003).** *Sync: The Emerging Science of Spontaneous Order.*
  Hyperion, New York. Popular account tying together fireflies, pacemaker cells,
  and pulse coupling.

## Cross-links

- `../kuramoto/` — the other Synchronization entry (continuous/all-to-all phase
  coupling). Linked from the prose's "The rule" and "Try this" sections, and via
  the `data-atlas-nav` related nav.
