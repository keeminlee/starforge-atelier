# Kuramoto model — research notes & provenance

## What the sim implements

N phase oscillators θ_i with fixed natural frequencies ω_i ~ Normal(0, spread).
Mean-field Kuramoto dynamics, integrated with forward Euler (dt = 0.05):

    dθ_i/dt = ω_i + K·r·sin(ψ − θ_i)

where the complex order parameter is

    r·e^{iψ} = (1/N) Σ_j e^{iθ_j}.

Using r and ψ collapses the all-to-all double sum to an O(N) per-step update.
`this.R` (= r) and `this.psi` (= ψ) are exposed for headless testing.

Controls: coupling K (0–4), oscillators N (50–500, re-seeds), spread / frequency
disorder (0–2, re-seeds), speed (sub-steps/frame). Readout shows N, K, r.

## Sources used

- Kuramoto, Y. (1975). "Self-entrainment of a population of coupled non-linear
  oscillators." In *International Symposium on Mathematical Problems in
  Theoretical Physics* (H. Araki, ed.), Lecture Notes in Physics 39, Springer,
  pp. 420–422. The original model.
- Kuramoto, Y. (1984). *Chemical Oscillations, Waves, and Turbulence.*
  Springer-Verlag. Book-length development including the order parameter and the
  critical-coupling analysis.
- Winfree, A. T. (1967). "Biological rhythms and the behavior of populations of
  coupled oscillators." *J. Theor. Biol.* 16(1):15–42. The intellectual
  predecessor — framed biological synchrony as coupled oscillators; Kuramoto
  made it solvable.
- Strogatz, S. H. (2000). "From Kuramoto to Crawford: exploring the onset of
  synchronization in populations of coupled oscillators." *Physica D*
  143(1–4):1–20. The standard review; source for the phase-transition picture,
  K_c, and dependence on the frequency distribution.
  https://www.sciencedirect.com/science/article/abs/pii/S0167278900000944
- Strogatz, S. H., Abrams, D. M., McRobie, A., Eckhardt, B., Ott, E. (2005).
  "Crowd synchrony on the Millennium Bridge." *Nature* 438:43–44. Source for the
  Millennium Bridge wobble (opened June 2000) modeled as phase oscillators with a
  critical number of walkers.
  https://www.nature.com/articles/438043a
- Strogatz, S. H. (2003). *Sync: The Emerging Science of Spontaneous Order.*
  Hyperion. Popular account; background for fireflies, pacemaker cells,
  metronomes, circadian clocks.

Real-world examples (fireflies *Pteroptyx* in SE Asia; sinoatrial-node pacemaker
cells; suprachiasmatic-nucleus circadian neurons; Huygens' 1665 pendulum-clock
observation; coupled metronomes; applause; power-grid generators) are standard
textbook illustrations covered in the Strogatz review and *Sync*.

## Caveats / honesty notes

- **All-to-all coupling.** The classic model couples every oscillator to every
  other equally. Real systems (fireflies on a tree, pacemaker cells, grid
  generators, bridge walkers) couple locally or through a specific network/medium,
  not globally. The mean-field model is a tractable idealization.
- **Sine interaction.** The interaction is a pure sin(θ_j − θ_i). Real phase
  responses are more complex (e.g. firefly phase-response curves, cardiac
  electrophysiology). The sine is what makes the order parameter close the
  equations exactly.
- **Identical coupling sign/strength, no noise, no delays.** Our sim has no phase
  noise and no transmission delays; adding either changes the transition.
- **Euler integration.** Forward Euler with dt = 0.05 is adequate for the
  qualitative behavior shown but is not a high-accuracy integrator; very large K
  or dt could distort dynamics. Values here are well within the stable range.
- **In the wild = abstraction, not derivation.** Each real example is presented as
  the phenomenon the model abstracts (mutual entrainment → spontaneous sync with a
  threshold), not as a claim that the real system obeys the Kuramoto equations
  literally. The prose flags this explicitly.
