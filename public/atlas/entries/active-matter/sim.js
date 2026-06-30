/* Motility-Induced Phase Separation (MIPS) — active Brownian particles.
 * Extends Atlas.Sim. N self-propelled disks in a square torus. Each particle
 * carries a position and a heading θ. There is NO alignment and NO attraction
 * (contrast vicsek/boids). Clustering emerges from one ingredient: a particle
 * moves SLOWER where it is crowded. The local density ρ around a particle is the
 * neighbor count within radius r; its propulsion speed is
 *     v_i = v0 · clamp(1 − ρ_local/ρ_sat, vmin, 1),
 * so a particle in a dense neighborhood crawls and one in open space zips. The
 * positive feedback (slow-where-crowded → particles pile up → even slower) makes
 * the system spontaneously phase-separate into a dense, slow cluster coexisting
 * with a dilute, fast gas — Motility-Induced Phase Separation (Cates–Tailleur).
 * Heading does a slow random walk (rotational diffusion). A short-range soft
 * repulsion (excluded volume) keeps clusters as dense packings, not collapses.
 * Neighbor counting is a coarse spatial grid (cell size = interaction radius),
 * so it stays cheap at 400–800 particles. The world is a torus; distances wrap. */
(function () {
  'use strict';
  const { Sim, clamp, rand, TAU } = Atlas;

  const R = 14;          // interaction radius for density sensing (px)
  const DIAM = 7;        // soft-core particle diameter (px) for excluded volume
  const REPEL = 0.9;     // excluded-volume push strength (fraction of overlap/step)
  const VMIN = 0.05;     // floor on the speed factor (never fully frozen)
  // Gaussian-ish noise: sum of 3 uniforms in [-0.5,0.5] (Irwin–Hall), unit-ish.

  class ActiveMatter extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 5 });
      this._clustering = 0;
    }

    setup() {
      const n = Math.round((this.params && this.params.particles) || 600);
      this.spawn(n);
    }

    // (Re)seed n particles at uniform random positions with random headings.
    spawn(n) {
      const w = this.width, h = this.height;
      this.px = new Float32Array(n);   // position x
      this.py = new Float32Array(n);   // position y
      this.th = new Float32Array(n);   // heading θ
      this.sp = new Float32Array(n);   // last speed factor (for coloring)
      this.dens = new Float32Array(n); // last local neighbor count
      for (let i = 0; i < n; i++) {
        this.px[i] = rand(w);
        this.py[i] = rand(h);
        this.th[i] = rand(TAU);
      }
      this.n = n;
      this._clustering = this.clustering();
    }

    onResize() { /* keep the suspension; positions re-wrap into the new bounds */ }

    // Shortest signed delta on a torus of size L (handles wrap-around).
    wrapDelta(d, L) {
      if (d > L * 0.5) return d - L;
      if (d < -L * 0.5) return d + L;
      return d;
    }

    // Build a coarse spatial grid (cell = R) of particle indices, on a torus.
    // Returns { cells, cols, rows, cw, ch } where cells[c] is an array of indices.
    buildGrid() {
      const w = this.width, h = this.height, n = this.n;
      const cols = Math.max(1, Math.floor(w / R));
      const rows = Math.max(1, Math.floor(h / R));
      const cw = w / cols, ch = h / rows;
      const cells = new Array(cols * rows);
      for (let c = 0; c < cells.length; c++) cells[c] = [];
      for (let i = 0; i < n; i++) {
        let cx = Math.floor(this.px[i] / cw); if (cx >= cols) cx = cols - 1; if (cx < 0) cx = 0;
        let cy = Math.floor(this.py[i] / ch); if (cy >= rows) cy = rows - 1; if (cy < 0) cy = 0;
        cells[cy * cols + cx].push(i);
      }
      return { cells, cols, rows, cw, ch };
    }

    step() {
      const w = this.width, h = this.height, n = this.n;
      const px = this.px, py = this.py, th = this.th, sp = this.sp, dens = this.dens;
      const v0 = this.params.v0 ?? 1.6;
      const dnoise = this.params.noise ?? 0.18;        // rotational diffusion strength
      const rhoSat = this.params.rhoSat ?? 9;          // crowding sensitivity (density at full stop)
      // coupling===0 disables the density-dependent speed (constant speed v0):
      const coupling = this.params.coupling ?? 1;
      const dt = 1;
      const R2 = R * R;
      const D2 = DIAM * DIAM;

      const grid = this.buildGrid();
      const { cells, cols, rows } = grid;

      // Per-particle accumulators: neighbor count (density) and repulsion push.
      const pushX = new Float32Array(n);
      const pushY = new Float32Array(n);

      // One pass over the 3x3 cell neighborhood: count neighbors within R and
      // accumulate soft excluded-volume repulsion within DIAM.
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const here = cells[cy * cols + cx];
          if (here.length === 0) continue;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = (cy + dy + rows) % rows;
              const nx = (cx + dx + cols) % cols;
              const other = cells[ny * cols + nx];
              for (let a = 0; a < here.length; a++) {
                const i = here[a];
                const xi = px[i], yi = py[i];
                for (let b = 0; b < other.length; b++) {
                  const j = other[b];
                  if (j === i) continue;
                  let ddx = this.wrapDelta(px[j] - xi, w);
                  let ddy = this.wrapDelta(py[j] - yi, h);
                  const d2 = ddx * ddx + ddy * ddy;
                  if (d2 > R2 || d2 === 0) continue;
                  dens[i] += 1; // count this neighbor toward i's local density
                  if (d2 < D2) {
                    // soft repulsion: push i away from j, scaled by overlap
                    const d = Math.sqrt(d2);
                    const overlap = (DIAM - d) / DIAM;       // in (0,1]
                    const inv = 1 / d;
                    pushX[i] -= ddx * inv * overlap;
                    pushY[i] -= ddy * inv * overlap;
                  }
                }
              }
            }
          }
        }
      }

      // Integrate: density-dependent propulsion + excluded volume + rotational
      // diffusion, then move and wrap.
      for (let i = 0; i < n; i++) {
        const rho = dens[i];
        // speed factor falls with crowding (the heart of MIPS); coupling=0 → 1.
        let fac = 1 - coupling * (rho / rhoSat);
        fac = clamp(fac, VMIN, 1);
        sp[i] = fac;

        const v = v0 * fac;
        // self-propulsion along the heading
        let mx = Math.cos(th[i]) * v * dt;
        let my = Math.sin(th[i]) * v * dt;
        // soft excluded-volume push (keeps clusters as packings, not collapses)
        mx += pushX[i] * REPEL;
        my += pushY[i] * REPEL;

        let x = px[i] + mx;
        let y = py[i] + my;
        x = ((x % w) + w) % w;
        y = ((y % h) + h) % h;
        px[i] = x; py[i] = y;

        // rotational diffusion: heading random-walks, scaled by sqrt(dt). No
        // alignment to neighbors — that is the whole point of MIPS.
        const g = (Math.random() - 0.5) + (Math.random() - 0.5) + (Math.random() - 0.5);
        th[i] += g * dnoise * Math.sqrt(dt);
        // reset density accumulator for next step
        dens[i] = 0;
      }

      this._clustering = this.clustering();
    }

    // Clustering metric: the "condensed fraction" — the fraction of particles
    // whose local neighbor count (within R) exceeds a threshold. It rises as the
    // system phase-separates (a dense cluster forms) and stays low for a uniform
    // gas. Computed from a fresh grid so it is independent of step() bookkeeping.
    clustering() {
      const w = this.width, h = this.height, n = this.n;
      if (!n) return 0;
      const px = this.px, py = this.py;
      const R2 = R * R;
      const grid = this.buildGrid();
      const { cells, cols, rows } = grid;
      // Threshold: a particle is "condensed" if it has more than THRESH neighbors
      // within R. Scaled to the mean density so it is meaningful across N.
      const area = w * h;
      const meanRho = n * (Math.PI * R2) / area; // expected neighbors if uniform
      const thresh = Math.max(4, meanRho * 1.6);
      let condensed = 0;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const here = cells[cy * cols + cx];
          if (here.length === 0) continue;
          for (let a = 0; a < here.length; a++) {
            const i = here[a];
            const xi = px[i], yi = py[i];
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const ny = (cy + dy + rows) % rows;
                const nx = (cx + dx + cols) % cols;
                const other = cells[ny * cols + nx];
                for (let b = 0; b < other.length; b++) {
                  const j = other[b];
                  if (j === i) continue;
                  const ddx = this.wrapDelta(px[j] - xi, w);
                  const ddy = this.wrapDelta(py[j] - yi, h);
                  if (ddx * ddx + ddy * ddy <= R2) count++;
                }
              }
            }
            if (count > thresh) condensed++;
          }
        }
      }
      return condensed / n;
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const px = this.px, py = this.py, sp = this.sp, n = this.n;
      // Color by speed factor: slow/dense = warm amber/red, fast/dilute = teal.
      for (let i = 0; i < n; i++) {
        const f = sp[i]; // 0 (jammed) .. 1 (free)
        // teal (fast) -> amber/red (slow): interpolate hue 175 -> 28
        const hue = 28 + (175 - 28) * f;
        const light = 45 + 12 * f;
        ctx.fillStyle = `hsl(${hue.toFixed(0)}, 78%, ${light.toFixed(0)}%)`;
        ctx.beginPath();
        ctx.arc(px[i], py[i], 2.6, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---- mount + controls ----
  const sim = new ActiveMatter('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.spawn(sim.n); sim._renderOnce(); } });
  // ρ_sat — the crowding sensitivity, THE knob. Low ρ_sat → speed collapses with
  // little crowding → strong MIPS; high ρ_sat → barely slows → uniform gas.
  sim.slider('rhoSat', { min: 3, max: 30, step: 0.5, value: 9,
    fmt: v => v.toFixed(1) });
  sim.slider('particles', { min: 200, max: 800, step: 20, value: 600,
    fmt: v => v + '', onInput: v => { sim.spawn(Math.round(v)); if (!sim.running) sim._renderOnce(); } });
  sim.slider('v0', { min: 0.5, max: 3, step: 0.1, value: 1.6, fmt: v => v.toFixed(1) });
  sim.slider('noise', { min: 0, max: 0.6, step: 0.01, value: 0.18, fmt: v => v.toFixed(2) });
  sim.slider('speed', { min: 1, max: 10, step: 1, value: 5, fmt: v => v + '×',
    onInput: v => { sim.stepsPerFrame = Math.round(v); } });

  sim.readout(s => {
    const c = s._clustering;
    return `${s.n} particles  ·  ρ_sat ${(s.params.rhoSat ?? 0).toFixed(1)}  ·  ` +
      `condensed fraction ${c.toFixed(3)}`;
  });
})();
