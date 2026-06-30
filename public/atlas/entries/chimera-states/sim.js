/* Chimera states — coexisting synchrony and incoherence among identical oscillators.
 *
 * The two-population model of Abrams, Mirollo, Strogatz & Wiley (2008). Two groups
 * (A and B) of N identical phase oscillators, all with the same natural frequency
 * ω = 0 (we work in the rotating frame). Each oscillator is coupled to every other
 * oscillator through the sine of their phase difference, with a phase lag β, and the
 * coupling is STRONGER within a group (μ) than between groups (ν), with μ > ν:
 *
 *     dθ^σ_i/dt = ω − Σ_σ' (K_σσ'/N) Σ_j sin(θ^σ_i − θ^σ'_j + β),
 *     K_AA = K_BB = μ,   K_AB = K_BA = ν,   μ > ν.
 *
 * The all-to-all sums collapse via each group's complex order parameter
 *     r_σ · e^{iψ_σ} = (1/N) Σ_j e^{iθ^σ_j}
 * into a mean-field form (so the model is O(N), not O(N²)):
 *
 *     dθ^σ_i/dt = −[ μ·r_σ·sin(θ^σ_i − ψ_σ + β) + ν·r_σ'·sin(θ^σ_i − ψ_σ' + β) ].
 *
 * For β slightly below π/2 and a suitable coupling asymmetry, the SYMMETRIC system
 * spontaneously breaks symmetry into a CHIMERA: one group phase-locks (r ≈ 1) while
 * the other stays partially incoherent (r fluctuates well below 1) — and this split
 * persists even though the two groups are identical and identically wired.
 *
 * Integration is RK4 with a small dt (Euler drifts here). r_A and r_B are exposed as
 * `this.rA` / `this.rB` (and via orderParam(g)) so headless tests can read them.
 *
 * Render: two phase circles side by side (left = A, right = B). Each oscillator is a
 * dot on the unit circle placed by its phase and colored by it; each group's order-
 * parameter vector is drawn as an arrow from the centre. The synced group bunches to
 * one point with a long arrow (r ≈ 1); the incoherent group smears around the ring
 * with a short, jittering arrow (r < 1).
 *
 * No external deps; vanilla ES + Canvas. */
(function () {
  'use strict';
  const { Sim, TAU } = Atlas;

  class Chimera extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.52 });
      // Swappable RNG so headless tests / first-load can seed reproducibly.
      this.rng = Math.random;
      this._firstSeed = 2024;   // a known chimera-forming seed for the first paint
      this.dt = 0.05;           // RK4 step (small — Euler drifts on this system)
      this.rA = 0; this.psiA = 0;
      this.rB = 0; this.psiB = 0;
      // scratch arrays reused by the RK4 stages (allocated in seed())
      this._k = null;
    }

    setup() {
      const n = Math.round((this.params && this.params.N) || 160);
      // First paint uses a fixed, reliably-chimeric seed so the gate shows on load;
      // the randomize button swaps in true Math.random for the coin-flip experience.
      const useSeed = this._usedFirst ? null : this._firstSeed;
      this._usedFirst = true;
      this.seed(n, useSeed);
    }

    // (Re)seed both groups. Group A starts tightly clustered (a near-synchronous
    // seed); group B starts spread uniformly at random. This reliably lands in the
    // chimera basin: one group locks, the other never does. Which group ends up
    // coherent is decided by the initial conditions — spontaneous symmetry breaking.
    seed(n, fixedSeed) {
      const rng = fixedSeed != null ? makeLcg(fixedSeed) : this.rng;
      this.n = n;
      this.A = new Float64Array(n);
      this.B = new Float64Array(n);
      const clusterW = 0.30;                 // half-width of group A's initial cluster
      const phi = rng() * TAU;               // random cluster centre (cosmetic)
      for (let i = 0; i < n; i++) {
        this.A[i] = phi + (rng() - 0.5) * clusterW;
        this.B[i] = rng() * TAU;
      }
      // RK4 scratch buffers
      this._tmpA = new Float64Array(n);
      this._tmpB = new Float64Array(n);
      this._k1A = new Float64Array(n); this._k1B = new Float64Array(n);
      this._k2A = new Float64Array(n); this._k2B = new Float64Array(n);
      this._k3A = new Float64Array(n); this._k3B = new Float64Array(n);
      this._k4A = new Float64Array(n); this._k4B = new Float64Array(n);
      this.computeOrder();
    }

    // Current coupling constants from the controls: intra-group μ and inter-group ν.
    // Exposed as an asymmetry knob A = μ − ν with μ + ν fixed at 1 (the standard
    // normalization), so μ = (1 + A)/2, ν = (1 − A)/2.
    couplings() {
      const asym = this.params && this.params.asymmetry != null ? this.params.asymmetry : 0.2;
      const mu = (1 + asym) / 2;
      const nu = (1 - asym) / 2;
      return { mu, nu };
    }

    beta() {
      return this.params && this.params.beta != null ? this.params.beta : (Math.PI / 2 - 0.1);
    }

    // Complex order parameter of a phase array: r·e^{iψ} = (1/N) Σ e^{iθ_j}.
    orderOf(arr) {
      let cx = 0, cy = 0;
      const n = arr.length;
      for (let i = 0; i < n; i++) { cx += Math.cos(arr[i]); cy += Math.sin(arr[i]); }
      cx /= n; cy /= n;
      return { r: Math.hypot(cx, cy), psi: Math.atan2(cy, cx) };
    }

    computeOrder() {
      const a = this.orderOf(this.A), b = this.orderOf(this.B);
      this.rA = a.r; this.psiA = a.psi;
      this.rB = b.r; this.psiB = b.psi;
    }

    // Per-group order-parameter magnitude, the key observable (one ≈1, one <1).
    orderParam(group) {
      const a = this.orderOf(group === 'B' || group === 1 ? this.B : this.A);
      return a.r;
    }

    // Fill outSelf/outOther derivatives for the current self/other phase arrays.
    // dθ_i/dt = −[ μ·r_self·sin(θ_i − ψ_self + β) + ν·r_other·sin(θ_i − ψ_other + β) ]
    _deriv(self, other, outSelf) {
      const { mu, nu } = this.couplings();
      const beta = this.beta();
      const os = this.orderOf(self), oo = this.orderOf(other);
      const rs = os.r, ps = os.psi, ro = oo.r, po = oo.psi;
      const n = self.length;
      for (let i = 0; i < n; i++) {
        outSelf[i] = -(mu * rs * Math.sin(self[i] - ps + beta) +
                       nu * ro * Math.sin(self[i] - po + beta));
      }
    }

    // One RK4 step advancing both groups together (each group's "other" is the peer).
    step() {
      const dt = this.dt, n = this.n;
      const A = this.A, B = this.B;
      const tA = this._tmpA, tB = this._tmpB;
      const k1A = this._k1A, k1B = this._k1B, k2A = this._k2A, k2B = this._k2B;
      const k3A = this._k3A, k3B = this._k3B, k4A = this._k4A, k4B = this._k4B;

      // k1
      this._deriv(A, B, k1A); this._deriv(B, A, k1B);
      for (let i = 0; i < n; i++) { tA[i] = A[i] + 0.5 * dt * k1A[i]; tB[i] = B[i] + 0.5 * dt * k1B[i]; }
      // k2
      this._deriv(tA, tB, k2A); this._deriv(tB, tA, k2B);
      for (let i = 0; i < n; i++) { tA[i] = A[i] + 0.5 * dt * k2A[i]; tB[i] = B[i] + 0.5 * dt * k2B[i]; }
      // k3
      this._deriv(tA, tB, k3A); this._deriv(tB, tA, k3B);
      for (let i = 0; i < n; i++) { tA[i] = A[i] + dt * k3A[i]; tB[i] = B[i] + dt * k3B[i]; }
      // k4
      this._deriv(tA, tB, k4A); this._deriv(tB, tA, k4B);
      for (let i = 0; i < n; i++) {
        let a = A[i] + dt / 6 * (k1A[i] + 2 * k2A[i] + 2 * k3A[i] + k4A[i]);
        let b = B[i] + dt / 6 * (k1B[i] + 2 * k2B[i] + 2 * k3B[i] + k4B[i]);
        a %= TAU; if (a < 0) a += TAU;
        b %= TAU; if (b < 0) b += TAU;
        A[i] = a; B[i] = b;
      }
      this.computeOrder();
    }

    // ---- render: two labelled phase circles, synced vs incoherent ----
    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);

      const Rad = Math.min(w * 0.22, h * 0.36);
      const cyc = h * 0.46;
      const cxA = w * 0.27, cxB = w * 0.73;

      this._drawGroup(ctx, cxA, cyc, Rad, this.A, this.rA, this.psiA, 'group A');
      this._drawGroup(ctx, cxB, cyc, Rad, this.B, this.rB, this.psiB, 'group B');

      // which group is the coherent one (label it)
      const cohB = this.rB >= this.rA;
      const cohX = cohB ? cxB : cxA;
      const incX = cohB ? cxA : cxB;
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(120,230,170,0.95)';
      ctx.fillText('synchronized', cohX, cyc + Rad + 28);
      ctx.fillStyle = 'rgba(240,150,120,0.95)';
      ctx.fillText('incoherent', incX, cyc + Rad + 28);
      ctx.textAlign = 'left';

      // r magnitude bars (one per group) — the chimera signature: watch them split
      this._drawBar(ctx, 16, h - 30, Math.min(150, w * 0.28), this.rA, 'r_A', this.rA >= this.rB);
      this._drawBar(ctx, w - 16 - Math.min(150, w * 0.28), h - 30, Math.min(150, w * 0.28), this.rB, 'r_B', this.rB > this.rA);
    }

    _drawGroup(ctx, cx, cy, Rad, arr, r, psi, label) {
      // faint guide ring
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, Rad, 0, TAU);
      ctx.stroke();

      // oscillators as dots on the ring, colored by phase
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        const a = arr[i];
        const x = cx + Math.cos(a) * Rad;
        const y = cy + Math.sin(a) * Rad;
        const hue = (a / TAU) * 360;
        ctx.fillStyle = `hsl(${hue.toFixed(0)}, 78%, 62%)`;
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, TAU);
        ctx.fill();
      }

      // order-parameter vector: arrow from centre, length r·Rad at angle ψ
      const ex = cx + Math.cos(psi) * Rad * r;
      const ey = cy + Math.sin(psi) * Rad * r;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (r > 0.02) {
        const ah = 9, aw = 0.4;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(psi - aw) * ah, ey - Math.sin(psi - aw) * ah);
        ctx.lineTo(ex - Math.cos(psi + aw) * ah, ey - Math.sin(psi + aw) * ah);
        ctx.closePath();
        ctx.fill();
      }

      // group label
      ctx.font = '13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(label, cx, cy - Rad - 14);
      ctx.textAlign = 'left';
    }

    _drawBar(ctx, bx, by, bw, r, label, coherent) {
      const bh = 8;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = coherent ? 'hsl(150, 70%, 55%)' : 'hsl(20, 80%, 60%)';
      ctx.fillRect(bx, by, bw * r, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`${label} = ${r.toFixed(3)}`, bx, by - 6);
    }
  }

  // Deterministic LCG in [0,1) for reproducible first-load / test seeding.
  function makeLcg(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---- mount + controls ----
  const sim = new Chimera('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.seed(sim.n); sim._renderOnce(); } });

  // β / phase lag — the knob that makes or breaks the chimera. Near π/2 the chimera
  // is sharpest; pushed away from π/2, both groups fall into the same behaviour.
  sim.slider('beta', { min: 1.0, max: Math.PI / 2, step: 0.005, value: Math.PI / 2 - 0.1,
    fmt: v => 'β=' + v.toFixed(3) + ' (π/2−' + (Math.PI / 2 - v).toFixed(2) + ')' });

  // Coupling asymmetry A = μ − ν, with μ + ν fixed at 1. A small positive asymmetry
  // (stronger within-group coupling) is what allows the chimera.
  sim.slider('asymmetry', { min: 0.0, max: 0.6, step: 0.01, value: 0.2,
    fmt: v => 'A=μ−ν=' + v.toFixed(2) });

  sim.slider('N', { min: 60, max: 320, step: 20, value: 160,
    fmt: v => v + '/group',
    onInput: v => { sim.seed(Math.round(v)); if (!sim.running) sim._renderOnce(); } });

  sim.slider('speed', { min: 1, max: 8, step: 1, value: 3,
    fmt: v => v + '×', onInput: v => { sim.stepsPerFrame = Math.round(v); } });
  sim.stepsPerFrame = sim.params.speed;

  sim.readout(s => {
    const cohB = s.rB >= s.rA;
    return `|r_A|=${s.rA.toFixed(3)}  ·  |r_B|=${s.rB.toFixed(3)}  ·  ` +
      `coherent: group ${cohB ? 'B' : 'A'}  ·  incoherent: group ${cohB ? 'A' : 'B'}`;
  });
})();
