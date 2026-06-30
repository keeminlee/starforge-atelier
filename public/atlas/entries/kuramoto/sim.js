/* The Kuramoto model — phase oscillators that spontaneously synchronize.
 *
 * Extends Atlas.Sim. N oscillators each carry a phase θ_i and a fixed natural
 * frequency ω_i drawn from a distribution of tunable spread. Each tick (Euler):
 *
 *     dθ_i/dt = ω_i + (K/N) · Σ_j sin(θ_j − θ_i)
 *
 * The double sum is collapsed to O(N) via the complex order parameter
 *     r · e^{iψ} = (1/N) Σ_j e^{iθ_j},
 * which gives the mean-field form
 *     dθ_i/dt = ω_i + K · r · sin(ψ − θ_i).
 * r ∈ [0,1] measures global coherence: 0 = incoherent scatter, 1 = locked.
 * Above a critical coupling K_c (set by the frequency spread) the population
 * synchronizes spontaneously.
 *
 * Render: oscillators are dots on a unit circle placed by phase (angle = θ_i),
 * colored by phase. The order-parameter vector is drawn as an arrow from the
 * centre with length r and angle ψ — watch it grow as the swarm locks.
 *
 * No external deps; vanilla ES + Canvas. The order parameter is exposed as
 * `this.R` (and centroid `this.psi`) so headless tests can read it. */
(function () {
  'use strict';
  const { Sim, TAU } = Atlas;

  class Kuramoto extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.62 });
      // Swappable RNG so headless tests can seed reproducibly. setup() reads it.
      this.rng = Math.random;
      this.R = 0;     // order parameter magnitude r ∈ [0,1]
      this.psi = 0;   // mean-field phase ψ
      this.dt = 0.05; // Euler step (sim time per sub-step)
      this.trail = null;
    }

    setup() {
      const n = Math.round((this.params && this.params.oscillators) || 250);
      this.seed(n);
    }

    // (Re)seed n oscillators: phases uniform on [0,2π), natural frequencies
    // drawn from a normal distribution centred on a common mean with standard
    // deviation = the `spread` control. spread = 0 ⇒ identical frequencies.
    seed(n) {
      const spread = (this.params && this.params.spread) != null ? this.params.spread : 0.6;
      const mean = 0; // common rotating-frame mean; absolute value is irrelevant
      this.theta = new Float32Array(n);
      this.omega = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        this.theta[i] = this.rng() * TAU;
        this.omega[i] = mean + spread * this.gaussian();
      }
      this.n = n;
      this.trail = null;
      this.computeOrder();
    }

    // Box–Muller standard normal using the swappable RNG.
    gaussian() {
      let u = 0, v = 0;
      while (u === 0) u = this.rng();
      while (v === 0) v = this.rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    }

    // Complex order parameter r·e^{iψ} = (1/N) Σ e^{iθ_j}.
    computeOrder() {
      const { theta, n } = this;
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) { cx += Math.cos(theta[i]); cy += Math.sin(theta[i]); }
      cx /= n; cy /= n;
      this.R = Math.hypot(cx, cy);
      this.psi = Math.atan2(cy, cx);
      this._cx = cx; this._cy = cy;
    }

    step() {
      const K = this.params.coupling != null ? this.params.coupling : 1.5;
      const dt = this.dt;
      const { theta, omega, n } = this;
      // Mean field for this tick (uses current phases).
      this.computeOrder();
      const r = this.R, psi = this.psi;
      const kr = K * r;
      for (let i = 0; i < n; i++) {
        // dθ/dt = ω + K·r·sin(ψ − θ)
        const dth = omega[i] + kr * Math.sin(psi - theta[i]);
        let t = theta[i] + dth * dt;
        // keep phase in [0,2π) for numerically clean trig & coloring
        t = t % TAU;
        if (t < 0) t += TAU;
        theta[i] = t;
      }
      this.computeOrder();
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5, cy = h * 0.5;
      const Rad = Math.min(w, h) * 0.38;       // radius of the main phase ring
      const { theta, n } = this;

      // faint guide ring
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, Rad, 0, TAU);
      ctx.stroke();

      // oscillators as dots on the ring, colored by phase
      for (let i = 0; i < n; i++) {
        const a = theta[i];
        const x = cx + Math.cos(a) * Rad;
        const y = cy + Math.sin(a) * Rad;
        const hue = (a / TAU) * 360;
        ctx.fillStyle = `hsl(${hue.toFixed(0)}, 75%, 60%)`;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, TAU);
        ctx.fill();
      }

      // mean-field order-parameter vector: arrow from centre, length r·Rad at ψ
      const r = this.R, psi = this.psi;
      const ex = cx + Math.cos(psi) * Rad * r;
      const ey = cy + Math.sin(psi) * Rad * r;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // arrowhead
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
      // centroid dot
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, TAU);
      ctx.fill();

      // r magnitude bar (bottom-left) — a second read on synchronization
      const bx = 16, by = h - 24, bw = Math.min(160, w * 0.32), bh = 8;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = `hsl(${(200 - 120 * r).toFixed(0)}, 75%, 58%)`;
      ctx.fillRect(bx, by, bw * r, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('r = ' + r.toFixed(3), bx, by - 6);
    }
  }

  // ---- mount + controls ----
  const sim = new Kuramoto('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.seed(sim.n); sim._renderOnce(); } });
  sim.slider('coupling', { min: 0, max: 4, step: 0.05, value: 1.5,
    fmt: v => 'K=' + v.toFixed(2) });
  sim.slider('oscillators', { min: 50, max: 500, step: 10, value: 250,
    fmt: v => v + '', onInput: v => { sim.seed(Math.round(v)); if (!sim.running) sim._renderOnce(); } });
  sim.slider('spread', { min: 0, max: 2, step: 0.05, value: 0.6,
    fmt: v => v.toFixed(2),
    onInput: () => { sim.seed(sim.n); if (!sim.running) sim._renderOnce(); } });
  sim.slider('speed', { min: 1, max: 8, step: 1, value: 3,
    fmt: v => v + '×', onInput: v => { sim.stepsPerFrame = Math.round(v); } });
  sim.stepsPerFrame = sim.params.speed;

  sim.readout(s => `${s.n} oscillators  ·  K=${s.params.coupling.toFixed(2)}  ·  r=${s.R.toFixed(3)}`);
})();
