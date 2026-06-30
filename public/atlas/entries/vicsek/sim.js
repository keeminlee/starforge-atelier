/* The Vicsek model — the minimal model of flocking (Vicsek et al., 1995).
 * Extends Atlas.Sim. N point particles in a square torus, all moving at the
 * SAME constant speed v. Each step, a particle's new heading is the average
 * heading of every particle within radius r (itself included), plus a uniform
 * random kick in [-η/2, +η/2]. As the noise η drops, the swarm undergoes an
 * order–disorder phase transition: rainbow confetti condenses into a single
 * drifting flock. The order parameter va = |mean of (cosθ, sinθ)| ∈ [0,1]
 * measures that alignment (0 = disordered, 1 = perfectly aligned). The world
 * is a torus, so neighbor distances wrap across the edges. Compare with the
 * boids entry, which adds separation and cohesion on top of alignment. */
(function () {
  'use strict';
  const { Sim, rand, TAU } = Atlas;

  class Vicsek extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this._va = 0; // last computed order parameter
    }

    setup() {
      const n = Math.round((this.params && this.params.particles) || 400);
      this.spawn(n);
    }

    // (Re)seed n particles at random positions with random headings.
    spawn(n) {
      const w = this.width, h = this.height;
      this.px = new Float32Array(n);   // position x
      this.py = new Float32Array(n);   // position y
      this.th = new Float32Array(n);   // heading θ
      this.nth = new Float32Array(n);  // scratch: next headings
      for (let i = 0; i < n; i++) {
        this.px[i] = rand(w);
        this.py[i] = rand(h);
        this.th[i] = rand(TAU);
      }
      this.n = n;
      this._va = this.order();
    }

    onResize() { /* keep the swarm; positions re-wrap into the new bounds */ }

    // Shortest signed delta on a torus of size L (handles wrap-around).
    wrapDelta(d, L) {
      if (d > L * 0.5) return d - L;
      if (d < -L * 0.5) return d + L;
      return d;
    }

    // Order parameter: magnitude of the mean unit velocity, in [0,1].
    order() {
      const n = this.n, th = this.th;
      if (!n) return 0;
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) { cx += Math.cos(th[i]); cy += Math.sin(th[i]); }
      return Math.hypot(cx, cy) / n;
    }

    step() {
      const w = this.width, h = this.height, n = this.n;
      const px = this.px, py = this.py, th = this.th, nth = this.nth;
      const eta = this.params.noise ?? 0.4;
      const R = this.params.radius ?? 40;
      const v = this.params.speed ?? 2.0;
      const R2 = R * R;

      // 1) compute every particle's next heading from current headings
      for (let i = 0; i < n; i++) {
        // vector sum of neighbor headings, including self
        let sumS = Math.sin(th[i]);
        let sumC = Math.cos(th[i]);
        const xi = px[i], yi = py[i];
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          let dx = px[j] - xi;
          let dy = py[j] - yi;
          dx = this.wrapDelta(dx, w);
          dy = this.wrapDelta(dy, h);
          if (dx * dx + dy * dy <= R2) {
            sumS += Math.sin(th[j]);
            sumC += Math.cos(th[j]);
          }
        }
        // average heading + uniform noise in [-η/2, +η/2]
        const avg = Math.atan2(sumS, sumC);
        nth[i] = avg + (Math.random() - 0.5) * eta;
      }

      // 2) commit headings, then move at constant speed and wrap
      for (let i = 0; i < n; i++) {
        const a = nth[i];
        th[i] = a;
        let x = px[i] + Math.cos(a) * v;
        let y = py[i] + Math.sin(a) * v;
        x = ((x % w) + w) % w;
        y = ((y % h) + h) % h;
        px[i] = x; py[i] = y;
      }

      this._va = this.order();
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const px = this.px, py = this.py, th = this.th, n = this.n;
      for (let i = 0; i < n; i++) {
        const a = th[i];
        const hue = ((a / TAU) * 360 % 360 + 360) % 360;
        ctx.fillStyle = `hsl(${hue.toFixed(0)}, 75%, 60%)`;
        const cx = px[i], cy = py[i];
        const ca = Math.cos(a), sa = Math.sin(a);
        // small arrowhead/triangle pointing along θ
        ctx.beginPath();
        ctx.moveTo(cx + ca * 5, cy + sa * 5);                   // nose
        ctx.lineTo(cx - ca * 3 - sa * 2.4, cy - sa * 3 + ca * 2.4); // left tail
        ctx.lineTo(cx - ca * 3 + sa * 2.4, cy - sa * 3 - ca * 2.4); // right tail
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // ---- mount + controls ----
  const sim = new Vicsek('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.spawn(sim.n); sim._renderOnce(); } });
  // Noise η is THE knob: high → disordered confetti, low → one drifting flock.
  sim.slider('noise', { min: 0, max: 6.3, step: 0.05, value: 0.4,
    fmt: v => v.toFixed(2) });
  sim.slider('particles', { min: 100, max: 600, step: 20, value: 400,
    fmt: v => v + '', onInput: v => { sim.spawn(Math.round(v)); if (!sim.running) sim._renderOnce(); } });
  sim.slider('radius', { min: 10, max: 80, step: 1, value: 40, fmt: v => v + ' px' });
  sim.slider('speed', { min: 0.5, max: 4, step: 0.1, value: 2.0, fmt: v => v.toFixed(1) });

  sim.readout(s =>
    `${s.n} particles  ·  noise η ${(s.params.noise ?? 0).toFixed(2)}  ·  order vₐ ${s._va.toFixed(3)}`);
})();
