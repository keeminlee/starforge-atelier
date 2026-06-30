/* Coupled metronomes on a shared moving platform — Huygens' sympathy of clocks.
 *
 * Extends Atlas.Sim. N self-sustaining pendulum oscillators sit on a board that
 * is free to slide horizontally with mass M and viscous friction B. Each
 * metronome's swing pushes the board (reaction force); the board's acceleration
 * feeds back into every metronome — and that shared motion is the *only* channel
 * coupling them. From random phases they spontaneously lock into step.
 *
 * Model — Pantaleone (2002), Am. J. Phys. 70:992, in the SMALL-ANGLE
 * linearization (sinθ≈θ, cosθ≈1). For metronome i (angle θ_i) on platform x:
 *
 *     θ_i'' + (b/m)·θ_i' + (g/L)·θ_i = −(1/L)·x'' + μ·(1 − (θ_i/θ0)²)·θ_i'
 *     (M + Σm_i)·x'' + B·x' = −Σ m_i·L·θ_i''
 *
 * The escapement term μ·(1 − (θ_i/θ0)²)·θ_i' is a van der Pol drive: it injects
 * energy when |θ_i| < θ0 and removes it when |θ_i| > θ0, so each pendulum settles
 * onto a stable limit-cycle amplitude ≈ θ0 regardless of where it started. That
 * is what makes a metronome keep ticking at fixed amplitude.
 *
 * The x'' equation is implicit (its right side contains θ_i'' which contains x'').
 * Substituting the θ_i'' expression and collecting x'' gives a clean closed form:
 *
 *     x'' = ( −B·x' + Σ m_i·[ (b/m)θ_i' + (g/L)θ_i − μ(1−(θ_i/θ0)²)θ_i' ] )
 *           / ( M + Σm_i − Σ m_i )        ← note Σm_i cancels in the denominator
 *
 * After x'' is known each θ_i'' follows directly. Integrated with a stable
 * semi-implicit (symplectic) Euler, sub-stepped many times per frame.
 *
 * Lighter board ⇒ each recoil moves it more ⇒ stronger coupling ⇒ faster sync.
 * On a light board identical metronomes lock IN-phase; Huygens' heavy pendulum
 * clocks famously locked in ANTI-phase (see notes.md / the prose).
 *
 * Render: the board slides left/right; each metronome is an inverted pendulum
 * (rod + bob) pivoting on it, swinging at θ_i, colored by phase. As they lock the
 * rods swing together (or in two anti-phase groups) and the board settles.
 *
 * Exposed for headless tests: this.theta / this.omega (= θ̇), this.R (order
 * parameter from the swing phases), this.X / this.V (platform state).
 *
 * No external deps; vanilla ES + Canvas. */
(function () {
  'use strict';
  const { Sim, TAU, clamp } = Atlas;

  class Metronomes extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.rng = Math.random;     // swappable for deterministic tests

      // --- fixed physical constants (a clean, well-behaved regime) ---
      this.g = 9.81;              // gravity
      this.L = 0.20;              // pendulum length (sets base frequency ω0=√(g/L))
      this.m = 0.10;              // mass of one metronome
      this.b = 0.010;            // metronome pivot damping (b/m = 0.1)
      this.mu = 0.50;            // escapement drive strength (van der Pol)
      this.theta0 = 0.30;        // van der Pol set-point; limit cycle settles ≈0.54 rad

      this.R = 0;                // order parameter r ∈ [0,1] from swing phases
      this.psi = 0;              // mean phase
      this.X = 0;                // platform position
      this.V = 0;                // platform velocity
      this.dt = 0.0010;          // integration sub-step (seconds of sim time)
      this.subSteps = 8;         // internal sub-steps per call to step()
      this.t = 0;                // accumulated sim time (for phase estimate)
    }

    setup() {
      const n = Math.round((this.params && this.params.metronomes) || 2);
      this.seed(n);
    }

    // (Re)seed n metronomes with random phases and a tunable frequency spread.
    seed(n) {
      n = clamp(Math.round(n), 2, 7);
      const spread = (this.params && this.params.detune) != null ? this.params.detune : 0;
      this.n = n;
      this.theta = new Float64Array(n);   // angle θ_i
      this.omega = new Float64Array(n);   // angular velocity θ̇_i
      this.Li = new Float64Array(n);       // per-metronome length (detuned)
      const omega0 = Math.sqrt(this.g / this.L);
      for (let i = 0; i < n; i++) {
        // random starting phase: random angle within the limit-cycle envelope,
        // random sign of velocity → effectively a uniform phase on the cycle.
        const ph = this.rng() * TAU;
        this.theta[i] = this.theta0 * Math.cos(ph);
        this.omega[i] = -this.theta0 * omega0 * Math.sin(ph);
        // detune: vary each pendulum's length so natural frequencies differ.
        // spread is a fractional ± on L (longer L = slower).
        const f = 1 + spread * (this.rng() * 2 - 1);
        this.Li[i] = this.L * f * f; // square so ω∝1/√L scales ~linearly with f
      }
      this.X = 0; this.V = 0; this.t = 0;
      this.computeOrder();
    }

    // Phase-locking order parameter. Each metronome has an instantaneous phase
    // φ_i = atan2(θ̇_i/ω0, θ_i) in normalized (θ, θ̇) state space (the limit cycle
    // is ~circular there). We measure SECOND-harmonic coherence:
    //
    //     r·e^{i·2ψ} = (1/N) Σ_j e^{i·2φ_j}.
    //
    // r → 1 whenever the population is phase-LOCKED — and crucially that includes
    // BOTH in-phase locking (all φ equal) AND anti-phase locking (two clusters π
    // apart, as Huygens saw and as this minimal model settles into). r → 0 for an
    // unlocked, drifting scatter. This is the right "are they synchronized?" read
    // for a system whose stable locked state is anti-phase. We also expose the
    // first-harmonic mean phase ψ (mod π) so the dial points at the cluster.
    computeOrder() {
      const { theta, omega, n } = this;
      const omega0 = Math.sqrt(this.g / this.L);
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) {
        const ph = Math.atan2(omega[i] / omega0, theta[i]);
        cx += Math.cos(2 * ph); cy += Math.sin(2 * ph);
      }
      cx /= n; cy /= n;
      this.R = Math.hypot(cx, cy);
      this.psi = 0.5 * Math.atan2(cy, cx); // cluster axis (mod π)
    }

    // Compute platform acceleration x'' and each θ_i'' for the CURRENT state.
    // Small-angle Pantaleone: substitute θ_i'' into the platform equation and
    // solve the (now explicit) closed form. Returns { ax, ath: Float64Array }.
    accel() {
      const { theta, omega, Li, n, g, m, b, mu, theta0 } = this;
      const M = (this.params && this.params.platformMass) != null ? this.params.platformMass : 1.0;
      const B = (this.params && this.params.friction) != null ? this.params.friction : 0.6;

      // Per-metronome "internal" angular accel WITHOUT the −x''/L coupling term:
      //   a_i = −(b/m)θ̇_i − (g/L_i)θ_i + μ(1−(θ_i/θ0)²)θ̇_i
      // and the platform sees Σ m L_i (θ_i'' ) = Σ m L_i (a_i − x''/L_i)
      //                                        = Σ m L_i a_i − x'' Σ m.
      // Platform eq: (M+Σm)x'' + B x' = −Σ m L_i θ_i'' = −Σ m L_i a_i + x'' Σ m.
      // ⇒ (M+Σm − Σm) x'' = −B x' − Σ m L_i a_i
      // ⇒ M x'' = −B x' − Σ m L_i a_i.
      let sum = 0;
      const ai = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const damp = -(b / m) * omega[i];
        const grav = -(g / Li[i]) * theta[i];
        const esc = mu * (1 - (theta[i] * theta[i]) / (theta0 * theta0)) * omega[i];
        const a = damp + grav + esc;
        ai[i] = a;
        sum += m * Li[i] * a;
      }
      const ax = (-B * this.V - sum) / M;
      // Now each θ_i'' = a_i − x''/L_i.
      const ath = new Float64Array(n);
      for (let i = 0; i < n; i++) ath[i] = ai[i] - ax / Li[i];
      return { ax, ath };
    }

    step() {
      const dt = this.dt;
      const sub = this.subSteps;
      for (let s = 0; s < sub; s++) {
        const { ax, ath } = this.accel();
        // semi-implicit (symplectic) Euler: update velocities, then positions.
        this.V += ax * dt;
        for (let i = 0; i < this.n; i++) this.omega[i] += ath[i] * dt;
        this.X += this.V * dt;
        for (let i = 0; i < this.n; i++) this.theta[i] += this.omega[i] * dt;
        this.t += dt;
      }
      this.computeOrder();
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);

      const { theta, n } = this;
      // platform geometry
      const baseY = h * 0.74;             // top surface of the board
      const boardH = Math.max(14, h * 0.05);
      const margin = w * 0.10;
      const boardW = w - 2 * margin;
      // map platform displacement X (metres) to pixels; clamp visually
      const pxPerM = w * 0.9;
      const dx = clamp(this.X * pxPerM, -boardW * 0.18, boardW * 0.18);
      const boardX = margin + dx;

      // ground rails / wheels guide line
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin - 12, baseY + boardH + 10);
      ctx.lineTo(w - margin + 12, baseY + boardH + 10);
      ctx.stroke();

      // the sliding board
      ctx.fillStyle = 'rgba(120,130,150,0.30)';
      ctx.strokeStyle = 'rgba(180,200,230,0.55)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, boardX, baseY, boardW, boardH, 4);
      ctx.fill(); ctx.stroke();

      // little wheels under the board to make the sliding legible
      const wheelY = baseY + boardH + 6;
      ctx.fillStyle = 'rgba(180,200,230,0.45)';
      for (let k = 0; k < 4; k++) {
        const wx = boardX + boardW * (0.12 + 0.25 * k);
        ctx.beginPath(); ctx.arc(wx, wheelY, 4, 0, TAU); ctx.fill();
      }

      // metronomes: inverted pendulums pivoting on the board top
      const rodLen = Math.min(h * 0.46, boardW / Math.max(n, 4) * 1.05);
      const slotW = boardW / n;
      for (let i = 0; i < n; i++) {
        const pivotX = boardX + slotW * (i + 0.5);
        const pivotY = baseY;
        const a = theta[i];                       // swing angle from vertical
        // bob position: rod points UP (inverted pendulum), tilts by a
        const bx = pivotX + Math.sin(a) * rodLen;
        const by = pivotY - Math.cos(a) * rodLen;
        // color by phase (atan2 of normalized state) for a per-metronome hue
        const omega0 = Math.sqrt(this.g / this.L);
        const ph = Math.atan2(this.omega[i] / omega0, a);
        const hue = ((ph / TAU) * 360 + 360) % 360;
        const col = `hsl(${hue.toFixed(0)}, 78%, 62%)`;

        // metronome body (a small trapezoid base on the board)
        ctx.fillStyle = 'rgba(200,210,230,0.12)';
        ctx.beginPath();
        ctx.moveTo(pivotX - 9, pivotY);
        ctx.lineTo(pivotX + 9, pivotY);
        ctx.lineTo(pivotX + 5, pivotY - 14);
        ctx.lineTo(pivotX - 5, pivotY - 14);
        ctx.closePath();
        ctx.fill();

        // rod
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(bx, by);
        ctx.stroke();
        // bob
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(bx, by, 6.5, 0, TAU);
        ctx.fill();
        // pivot dot
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, 2.2, 0, TAU);
        ctx.fill();
      }

      // order-parameter dial (top-right): a needle of length r at angle ψ
      const r = this.R, psi = this.psi;
      const dcx = w - 54, dcy = 46, dR = 26;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(dcx, dcy, dR, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `hsl(${(200 - 120 * r).toFixed(0)}, 80%, 60%)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(dcx, dcy);
      ctx.lineTo(dcx + Math.cos(psi) * dR * r, dcy + Math.sin(psi) * dR * r);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('r=' + r.toFixed(2), dcx, dcy + dR + 14);
      ctx.textAlign = 'left';

      // r magnitude bar (bottom-left)
      const bx0 = 16, by0 = h - 22, bw = Math.min(160, w * 0.32), bh = 8;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx0, by0, bw, bh);
      ctx.fillStyle = `hsl(${(200 - 120 * r).toFixed(0)}, 75%, 58%)`;
      ctx.fillRect(bx0, by0, bw * r, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('sync r = ' + r.toFixed(3), bx0, by0 - 6);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- mount + controls ----
  const sim = new Metronomes('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.seed(sim.n); sim._renderOnce(); } });

  sim.slider('metronomes', { min: 2, max: 7, step: 1, value: 2,
    fmt: v => v + '',
    onInput: v => { sim.seed(Math.round(v)); if (!sim.running) sim._renderOnce(); } });

  // Platform mass is the key coupling knob: lighter ⇒ stronger coupling ⇒ faster sync.
  sim.slider('platformMass', { min: 0.4, max: 6, step: 0.1, value: 1.0,
    fmt: v => 'M=' + v.toFixed(1) });

  sim.slider('friction', { min: 0, max: 2, step: 0.05, value: 0.6,
    fmt: v => 'B=' + v.toFixed(2) });

  sim.slider('detune', { min: 0, max: 0.06, step: 0.002, value: 0,
    fmt: v => (v * 100).toFixed(1) + '%',
    onInput: () => { sim.seed(sim.n); if (!sim.running) sim._renderOnce(); } });

  sim.slider('speed', { min: 1, max: 6, step: 1, value: 3,
    fmt: v => v + '×', onInput: v => { sim.subSteps = 8 * Math.round(v); } });
  sim.subSteps = 8 * (sim.params.speed || 3);

  sim.readout(s => `${s.n} metronomes  ·  M=${(s.params.platformMass).toFixed(1)}  ·  ` +
    `r=${s.R.toFixed(3)}  ·  board x=${(s.X * 1000).toFixed(1)}mm`);
})();
