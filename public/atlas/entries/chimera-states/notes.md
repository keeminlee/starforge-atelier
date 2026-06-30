# Chimera States — research provenance & caveats

## Model

Two-population model of identical phase oscillators (Abrams, Mirollo, Strogatz &
Wiley 2008). Two groups A and B of N oscillators each, all with the same natural
frequency ω = 0 (rotating frame). Phase of oscillator i in group σ:

    dθ^σ_i/dt = − Σ_σ' (K_σσ'/N) Σ_j sin(θ^σ_i − θ^σ'_j + β)

with intra-group coupling K_AA = K_BB = μ and inter-group K_AB = K_BA = ν, μ > ν,
and a phase lag β just below π/2. Collapsed to mean-field form via each group's
complex order parameter r_σ e^{iψ_σ} = (1/N) Σ_j e^{iθ^σ_j}:

    dθ^σ_i/dt = −[ μ·r_σ·sin(θ^σ_i − ψ_σ + β) + ν·r_σ'·sin(θ^σ_i − ψ_σ' + β) ]

For suitable (μ, ν, β) the symmetric system spontaneously breaks symmetry into a
chimera: one group locks (r ≈ 1) while the other stays partially incoherent
(r fluctuates below 1).

## Parameters actually used

- μ = 0.6, ν = 0.4  (exposed as asymmetry A = μ − ν = 0.2, with μ + ν fixed at 1;
  μ = (1+A)/2, ν = (1−A)/2). Standard AMSW choice.
- β = π/2 − 0.1 ≈ 1.471  (the phase-lag knob; sharpest chimera near π/2).
- dt = 0.05, integrator = RK4 (fourth-order Runge–Kutta).
- N = 160 oscillators per group by default (60–320 selectable).
- Initial condition: group A tightly clustered (half-width 0.30 rad — a
  near-synchronous seed); group B spread uniformly at random. This reliably lands
  in the chimera basin. First page load uses a fixed RNG seed (2024) so the
  chimera is guaranteed visible on arrival; the "randomize" button uses true
  Math.random for the coin-flip / symmetry-breaking demonstration.

### Measured behaviour (headless, deterministic seed 2024, N=160)
- After 1200 RK4 steps: |r_A| ≈ 0.72 (incoherent, fluctuating ~0.5–0.85),
  |r_B| ≈ 1.00 (locked). Gap ≈ 0.28. The two identical groups end in different
  states — the chimera. Group B (the uniformly-seeded one) becomes coherent and
  group A (the clustered seed) becomes the incoherent group; which group wins is
  set by initial conditions, not by the rules.
- Chimera forms within ~400 steps (the coherent group locks quickly; the
  incoherent group's r then breathes/fluctuates indefinitely).

## Caveats (honesty)

- **Transients in finite N.** This is a finite system (N per group). In finite
  populations chimeras can be long-lived *transients* rather than truly eternal
  states; small N (e.g. 60) sometimes collapses to full synchrony instead. The
  asymptotic chimera is rigorous only in the N → ∞ limit.
- **Spontaneous symmetry breaking.** The equations are symmetric under A↔B. For
  every "A-synced" chimera there is a mirror "B-synced" one; the system falls into
  one based on initial conditions (a coin flip on randomize). No asymmetry is built
  into the model.
- **Idealization.** All-to-all coupling within and between groups, a single global
  phase lag, perfectly identical oscillators — a clean abstraction, not a literal
  physical system.
- **Brain / unihemispheric-sleep links are suggestive analogies, not established
  mechanism.** Dolphins and some birds do show unihemispheric slow-wave sleep
  (one hemisphere synchronized/asleep, the other awake), and the coexistence of
  synchronized and desynchronized regions makes chimeras a tempting analogy. But
  real neural tissue is not a population of identical phase oscillators, and no
  one has shown a literal chimera state implements unihemispheric sleep. Treat as
  analogy.
- **Integrator stability.** Forward Euler drifts on this system; RK4 (or at least
  midpoint) with small dt is required for stable, faithful dynamics.

## Sources (used)

1. Kuramoto, Y. & Battogtokh, D. (2002). "Coexistence of coherence and incoherence
   in nonlocally coupled phase oscillators." *Nonlinear Phenomena in Complex
   Systems* 5(4), 380–385. — First report of the coexistence state (nonlocal ring).
2. Abrams, D. M. & Strogatz, S. H. (2004). "Chimera states for coupled
   oscillators." *Physical Review Letters* 93(17), 174102. — Coined the name
   "chimera" after the mythological beast.
3. Abrams, D. M., Mirollo, R., Strogatz, S. H. & Wiley, D. A. (2008). "Solvable
   model for chimera states of coupled oscillators." *Physical Review Letters*
   101(8), 084103. — The two-population model implemented in sim.js; gives the
   μ, ν, β setup and analytic chimera/breathing solutions.
4. Panaggio, M. J. & Abrams, D. M. (2015). "Chimera states: coexistence of
   coherence and incoherence in networks of coupled oscillators." *Nonlinearity*
   28(3), R67–R87. — Review; background on realizations and the transient caveat.
5. Martens, E. A., Thutupalli, S., Fourrière, A. & Hallatschek, O. (2013).
   "Chimera states in mechanical oscillator networks." *Proceedings of the
   National Academy of Sciences* 110(26), 10563–10567. — Two-platform metronome
   experiment; physical realization of the two-population chimera.

Background also drawn from the parent Atlas entry on the Kuramoto model
(site/entries/kuramoto/) for the phase-oscillator / order-parameter framing.
