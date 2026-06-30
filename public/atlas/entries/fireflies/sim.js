/* Fireflies — pulse-coupled oscillators on a grid (Mirollo–Strogatz / Peskin).
 *
 * Extends Atlas.Sim. A cols×rows grid of integrate-and-fire oscillators. Each
 * firefly carries a phase φ ∈ [0,1) that climbs at a steady rate (φ += dt each
 * step, plus an optional per-firefly frequency jitter). When φ reaches 1 the
 * firefly FLASHES: it resets φ to 0 and pulse-couples to its grid neighbors,
 * bumping each neighbor's phase up by the coupling ε (additive kick, clamped
 * at 1). If a kick pushes a neighbor to ≥ 1 it ALSO flashes this same step — a
 * cascade. Cascades are resolved with a queue and a "flashed-this-step" set so
 * every firefly flashes at most once per step and chains terminate.
 *
 * Excitatory pulse coupling drives the population from random phases into
 * collective synchronized flashing, usually via traveling waves first. Coupling
 * is LOCAL (Moore or von Neumann neighborhood), so waves form and then lock —
 * this is the discrete, concrete cousin of the Kuramoto model's smooth,
 * all-to-all phase coupling. (See the Kuramoto entry.)
 *
 * Synchrony is read two ways, both exposed for headless tests:
 *   • this.R — the Kuramoto-style order parameter r = |⟨e^{i·2π·φ}⟩|, ∈[0,1],
 *     where r≈1 means the phases are bunched (synchronized).
 *   • this.lastFlashFraction — fraction of fireflies that flashed on the most
 *     recent step (spikes toward 1 once the population fires in unison).
 * synchrony() returns this.R.
 *
 * No external deps; vanilla ES + Canvas. */
(function () {
  'use strict';
  const { Sim, clamp, TAU } = Atlas;

  const CELL = 6;          // logical pixels per firefly
  const AFTERGLOW = 0.55;  // decay per step of the visual flash glow

  class Fireflies extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      // Swappable RNG so headless tests can seed reproducibly.
      this.rng = Math.random;
      this.R = 0;                 // order parameter r ∈ [0,1]
      this.lastFlashFraction = 0; // fraction flashing on the last step
    }

    setup() {
      this.cols = Math.max(1, Math.floor(this.width / CELL));
      this.rows = Math.max(1, Math.floor(this.height / CELL));
      const n = this.cols * this.rows;
      this.phase = new Float32Array(n);   // φ ∈ [0,1)
      this.freq = new Float32Array(n);    // per-firefly natural rate multiplier
      this.glow = new Float32Array(n);    // visual afterglow, decays each step
      // scratch for cascade resolution
      this._flashed = new Uint8Array(n);  // flashed-this-step flag
      this._queue = new Int32Array(n);    // BFS queue of cells to flash
      this.randomize();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // (Re)draw phases uniformly and frequencies around a common rate. jitter = 0
    // ⇒ every firefly ticks at exactly the base rate (identical oscillators).
    randomize() {
      const n = this.cols * this.rows;
      const jitter = (this.params && this.params.jitter != null) ? this.params.jitter : 0.0;
      for (let i = 0; i < n; i++) {
        this.phase[i] = this.rng();                 // uniform in [0,1)
        this.freq[i] = 1 + jitter * (this.rng() * 2 - 1); // 1 ± jitter
        this.glow[i] = 0;
      }
      this.lastFlashFraction = 0;
      this.computeOrder();
    }

    // Kuramoto-style order parameter over phases mapped onto the unit circle.
    computeOrder() {
      const { phase } = this;
      const n = phase.length;
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) {
        const a = phase[i] * TAU;
        cx += Math.cos(a); cy += Math.sin(a);
      }
      this.R = Math.hypot(cx / n, cy / n);
      return this.R;
    }

    synchrony() { return this.computeOrder(); }

    // Neighbor offsets: von Neumann (4) or Moore (8) per the `range` control.
    neighborhood() {
      const r = (this.params && this.params.range) || 'moore';
      if (r === 'neumann') return VONNEUMANN;
      return MOORE;
    }

    step() {
      const { cols, rows, phase, freq, glow } = this;
      const n = cols * rows;
      const eps = (this.params && this.params.coupling != null) ? this.params.coupling : 0.1;
      const dt = ((this.params && this.params.dt != null) ? this.params.dt : 0.02);
      const offs = this.neighborhood();

      const flashed = this._flashed;
      const queue = this._queue;
      flashed.fill(0);
      let qh = 0, qt = 0; // queue head / tail

      // 1) Integrate every firefly; any that reach threshold are seeded flashers.
      for (let i = 0; i < n; i++) {
        glow[i] *= AFTERGLOW;
        let p = phase[i] + dt * freq[i];
        if (p >= 1) {
          // fires this step
          phase[i] = 0;
          flashed[i] = 1;
          glow[i] = 1;
          queue[qt++] = i;
        } else {
          phase[i] = p;
        }
      }

      // 2) Resolve the flash cascade with a BFS over the queue. Each firing
      //    firefly kicks its neighbors by ε; a neighbor pushed to ≥ 1 fires too,
      //    but only once (guarded by `flashed`). Chains terminate when the queue
      //    empties because each cell enters it at most once.
      while (qh < qt) {
        const i = queue[qh++];
        const x = i % cols;
        const y = (i - x) / cols;
        for (let k = 0; k < offs.length; k++) {
          const nx = x + offs[k][0];
          const ny = y + offs[k][1];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; // bounded grid
          const j = ny * cols + nx;
          if (flashed[j]) continue;       // already fired this step
          let pj = phase[j] + eps;        // additive pulse-coupling kick
          if (pj >= 1) {
            phase[j] = 0;
            flashed[j] = 1;
            glow[j] = 1;
            queue[qt++] = j;              // cascades onward
          } else {
            phase[j] = pj;
          }
        }
      }

      // 3) Bookkeeping for synchrony readouts.
      let fc = 0;
      for (let i = 0; i < n; i++) if (flashed[i]) fc++;
      this.lastFlashFraction = n ? fc / n : 0;
      this.computeOrder();
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, w, h);
      const { cols, rows, phase, glow } = this;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          // Baseline brightness rises with phase (charging), then a bright flash
          // + decaying afterglow when it has just fired.
          const charge = phase[i];
          const g = glow[i];
          // brightness 0..1: a charge curve (rising as it nears threshold) plus
          // the flash glow on top, so the random twinkle is legible and a flash
          // flares brightly above it.
          const b = clamp(0.08 + 0.45 * (charge * charge * charge) + 0.95 * g, 0, 1);
          if (b <= 0.02) continue;
          ctx.fillStyle = fireColor(b, g);
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
    }
  }

  // Warm amber firefly glow on the dark ground. Charging cells read teal-green;
  // a firing cell flares to bright amber/white via the glow term `g`.
  function fireColor(b, g) {
    // base teal-green for charging, shifting to warm amber as it flashes
    const r = Math.round( 40 + b * 215 + g * 0  );
    const gr = Math.round( 90 + b * 150 );
    const bl = Math.round( 60 + (1 - g) * 70 * b );
    return `rgb(${clamp(r,0,255)},${clamp(gr,0,255)},${clamp(bl,0,255)})`;
  }

  const MOORE = [
    [-1,-1],[0,-1],[1,-1],
    [-1, 0],       [1, 0],
    [-1, 1],[0, 1],[1, 1]
  ];
  const VONNEUMANN = [
            [0,-1],
    [-1, 0],       [1, 0],
            [0, 1]
  ];

  // ---- mount + controls ----
  const sim = new Fireflies('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.randomize(); sim._renderOnce(); } });

  // coupling ε — the key knob. 0 = never syncs; higher = syncs faster.
  sim.slider('coupling', { min: 0, max: 0.3, step: 0.005, value: 0.18,
    fmt: v => 'ε=' + v.toFixed(3) });
  // jitter — spread in natural frequencies. 0 = identical oscillators.
  sim.slider('jitter', { min: 0, max: 0.4, step: 0.01, value: 0.0,
    fmt: v => v.toFixed(2),
    onInput: () => { sim.randomize(); if (!sim.running) sim._renderOnce(); } });
  // N — grid scale via cell phase count; expose as a rate proxy on dt.
  sim.slider('speed', { min: 1, max: 8, step: 1, value: 3,
    fmt: v => v + '×', onInput: v => { sim.stepsPerFrame = Math.round(v); } });
  sim.stepsPerFrame = sim.params.speed;
  // dt — base integration rate (how fast fireflies charge to threshold).
  sim.slider('dt', { min: 0.005, max: 0.05, step: 0.001, value: 0.02,
    fmt: v => v.toFixed(3) });
  // coupling range / neighborhood
  sim.select('range', [
    { value: 'moore', label: 'Moore (8 neighbors)' },
    { value: 'neumann', label: 'von Neumann (4)' }
  ], { value: 'moore' });

  sim.readout(s =>
    `${s.cols}×${s.rows}  ·  r=${s.R.toFixed(3)}  ·  flashed ${(s.lastFlashFraction * 100).toFixed(0)}%`);
})();
