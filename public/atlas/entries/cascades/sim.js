/* Global Cascades — Watts's threshold model (2002).
 *
 * Extends Atlas.Sim. A random Erdős–Rényi network of N nodes: each possible edge
 * is present with probability p chosen so the average degree z = p·(N−1) matches
 * the slider. Every node carries the SAME threshold φ (a fraction in [0,1]) and
 * activates the moment at least a fraction φ of its neighbours are active. This is
 * COMPLEX / THRESHOLD contagion: you need a FRACTION of your neighbours on, not a
 * single one (that would be simple contagion, like forest-fire or a disease).
 *
 * Dynamics: seed ONE random node, then repeatedly activate every inactive node
 * whose active-neighbour fraction ≥ φ, iterating to a fixed point. The "seed & run"
 * button plays this out one wave per tick so you watch the activation front spread
 * — or stall. The cascade size is the fraction of nodes that ended up active.
 *
 * The showpiece is the CASCADE WINDOW: at a fixed φ, a single seed triggers a
 * GLOBAL cascade only when z sits in a middle band.
 *   - z too LOW  → the network is fragmented, the shock dies local.
 *   - z in the WINDOW → one tip cascades across the giant component.
 *   - z too HIGH → each node has so many neighbours that one active one is below
 *     its threshold fraction, so connectivity makes nodes STABLE and the spark
 *     never catches. More connection → more robustness. That inversion is the point.
 *
 * The on-screen layout is a force-directed (spring-electrical) relaxation, reused
 * from the preferential-attachment entry; it is for visualization ONLY and is not
 * part of Watts's model. A small inset plots mean cascade size vs z so the window
 * (lower AND upper boundary) is explicit. */
(function () {
  'use strict';
  const { Sim, clamp, rand, TAU } = Atlas;

  const SAMPLE = 16;        // repulsion: random partners sampled per node per frame
  const REPULSE = 1100;     // Coulomb constant
  const SPRING = 0.014;     // Hooke constant for edges
  const REST = 24;          // spring rest length (px)
  const CENTER = 0.0012;    // mild pull to the middle so it doesn't drift
  const DAMP = 0.85;        // velocity damping per frame
  const MAXV = 6;           // velocity clamp (px/frame)

  // Inset "cascade size vs z" curve geometry (fraction of canvas).
  const INSET = { mx: 0.62, my: 0.04, w: 0.34, h: 0.30 };

  class Cascades extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.64 });
      this.dragId = -1;
      this.seedId = -1;
      this._wave = 0;          // 0 = idle; >0 = playing out a cascade
      this._waveAcc = 0;       // fractional-wave accumulator for paced animation
      this._curve = null;      // cached {z[],size[]} for the inset sweep
    }

    setup() {
      this.x = [];
      this.y = [];
      this.vx = [];
      this.vy = [];
      this.adj = [];           // adjacency: adj[i] = array of neighbour ids
      this.active = null;      // Uint8Array activation state
      this.dragId = -1;
      this.seedId = -1;
      this._wave = 0;
      this._waveAcc = 0;

      this.buildNetwork();
      this._curve = null;      // recompute lazily on first draw

      // Auto-seed once on first load so the entry opens already mid-cascade (a
      // strong first impression) rather than as an inert network. Subsequent
      // resets/randomizes leave it un-seeded so the reader drives it.
      if (!this._autoSeeded) {
        this._autoSeeded = true;
        this.seedAndRun(true);
      }
    }

    // ---- network construction (Erdős–Rényi G(N, p), p set so mean degree = z) ----
    buildNetwork() {
      const N = Math.round((this.params && this.params.N) || 220);
      const z = (this.params && this.params.z) != null ? this.params.z : 6;
      this.N = N;
      const p = N > 1 ? clamp(z / (N - 1), 0, 1) : 0;

      const cx = this.width * 0.5, cy = this.height * 0.5;
      this.x = new Array(N);
      this.y = new Array(N);
      this.vx = new Float64Array(N);
      this.vy = new Float64Array(N);
      this.adj = new Array(N);
      for (let i = 0; i < N; i++) {
        const a = rand(TAU), r = rand(10, Math.min(this.width, this.height) * 0.42);
        this.x[i] = cx + Math.cos(a) * r;
        this.y[i] = cy + Math.sin(a) * r;
        this.adj[i] = [];
      }
      let edges = 0;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (Math.random() < p) {
            this.adj[i].push(j);
            this.adj[j].push(i);
            edges++;
          }
        }
      }
      this.edgeCount = edges;
      this.active = new Uint8Array(N);
    }

    // The realised mean degree of the current graph (2E/N).
    meanDegree() {
      if (!this.N) return 0;
      return (2 * this.edgeCount) / this.N;
    }

    activeCount() {
      let c = 0;
      const a = this.active;
      for (let i = 0; i < a.length; i++) c += a[i];
      return c;
    }

    cascadeFraction() {
      return this.N ? this.activeCount() / this.N : 0;
    }

    // ---- the threshold rule (complex contagion) ----
    // A node tips when the fraction of its neighbours that are active ≥ φ. A node
    // with no neighbours (degree 0) never tips unless it was the seed.
    wouldActivate(i, phi) {
      if (this.active[i]) return false;
      const nb = this.adj[i];
      const k = nb.length;
      if (k === 0) return false;
      let on = 0;
      for (let t = 0; t < k; t++) on += this.active[nb[t]];
      return on / k >= phi;
    }

    // One synchronous wave: flip every node that meets its threshold this round.
    // Returns the number of newly-activated nodes (0 ⇒ fixed point reached).
    spreadOnce(phi) {
      const toFlip = [];
      for (let i = 0; i < this.N; i++) if (this.wouldActivate(i, phi)) toFlip.push(i);
      for (const i of toFlip) this.active[i] = 1;
      return toFlip.length;
    }

    // ---- testable cascade: run from a given seed to a fixed point, return active fraction ----
    // Does NOT disturb the visible activation state; operates on a scratch copy.
    cascadeSize(seed, phi) {
      const N = this.N;
      if (N === 0) return 0;
      if (phi == null) phi = (this.params && this.params.phi) != null ? this.params.phi : 0.18;
      const act = new Uint8Array(N);
      act[seed] = 1;
      let changed = true;
      let guard = 0;
      while (changed && guard++ < N + 4) {
        changed = false;
        const flip = [];
        for (let i = 0; i < N; i++) {
          if (act[i]) continue;
          const nb = this.adj[i];
          const k = nb.length;
          if (k === 0) continue;
          let on = 0;
          for (let t = 0; t < k; t++) on += act[nb[t]];
          if (on / k >= phi) flip.push(i);
        }
        for (const i of flip) act[i] = 1;
        if (flip.length) changed = true;
      }
      let c = 0;
      for (let i = 0; i < N; i++) c += act[i];
      return c / N;
    }

    // ---- seed & run: animate the cascade outward, one wave per paced tick ----
    // Picks a random seed; if `preferGlobal` is set, samples a few candidate seeds
    // and keeps one that triggers a global cascade when such a seed exists (used on
    // first load so the entry opens mid-cascade instead of fizzling).
    seedAndRun(preferGlobal) {
      if (this.N === 0) return;
      this.active.fill(0);
      const phi = (this.params && this.params.phi != null) ? this.params.phi : 0.18;
      let seed = (Math.random() * this.N) | 0;
      if (preferGlobal) {
        let best = seed, bestSize = this.cascadeSize(seed, phi);
        for (let tries = 0; tries < 24 && bestSize <= 0.5; tries++) {
          const cand = (Math.random() * this.N) | 0;
          const sz = this.cascadeSize(cand, phi);
          if (sz > bestSize) { bestSize = sz; best = cand; }
        }
        seed = best;
      }
      this.seedId = seed;
      this.active[this.seedId] = 1;
      this._wave = 1;          // arm the animated spread
      this._waveAcc = 0;
      if (!this.running) this.play();
    }

    clearActivations() {
      if (this.active) this.active.fill(0);
      this.seedId = -1;
      this._wave = 0;
      if (!this.running) this._renderOnce();
    }

    onResize() { /* nodes keep positions; layout re-settles */ }

    step() {
      // Paced cascade animation: advance roughly `speed` waves per second.
      if (this._wave) {
        const phi = (this.params.phi != null) ? this.params.phi : 0.18;
        this._waveAcc += (this.params.speed != null ? this.params.speed : 6) / 60;
        let budget = 8;
        while (this._waveAcc >= 1 && budget-- > 0) {
          this._waveAcc -= 1;
          const flipped = this.spreadOnce(phi);
          if (flipped === 0) { this._wave = 0; break; } // fixed point reached
        }
      }
      this.relax();
    }

    // One frame of spring-electrical relaxation (visualization only).
    relax() {
      const n = this.N;
      if (n === 0) return;
      const { x, y, vx, vy } = this;
      const w = this.width, h = this.height;
      const cx = w * 0.5, cy = h * 0.5;

      const ax = new Float64Array(n);
      const ay = new Float64Array(n);

      // Repulsion (Coulomb), approximated by sampling.
      for (let i = 0; i < n; i++) {
        let fx = 0, fy = 0;
        const k = Math.min(SAMPLE, n - 1);
        for (let s = 0; s < k; s++) {
          const j = (Math.random() * n) | 0;
          if (j === i) continue;
          let dx = x[i] - x[j];
          let dy = y[i] - y[j];
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { d2 = 1; dx = rand(-0.5, 0.5); dy = rand(-0.5, 0.5); }
          const f = REPULSE / d2;
          const inv = 1 / Math.sqrt(d2);
          fx += dx * inv * f;
          fy += dy * inv * f;
        }
        ax[i] += fx;
        ay[i] += fy;
      }

      // Springs (Hooke) along edges.
      for (let i = 0; i < n; i++) {
        const nb = this.adj[i];
        for (let t = 0; t < nb.length; t++) {
          const j = nb[t];
          if (j <= i) continue; // each undirected edge once
          let dx = x[j] - x[i];
          let dy = y[j] - y[i];
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = SPRING * (dist - REST);
          const ux = dx / dist, uy = dy / dist;
          ax[i] += ux * force; ay[i] += uy * force;
          ax[j] -= ux * force; ay[j] -= uy * force;
        }
      }

      // Integrate with centering + damping.
      for (let i = 0; i < n; i++) {
        if (i === this.dragId) { vx[i] = 0; vy[i] = 0; continue; }
        ax[i] += (cx - x[i]) * CENTER;
        ay[i] += (cy - y[i]) * CENTER;
        let nvx = (vx[i] + ax[i]) * DAMP;
        let nvy = (vy[i] + ay[i]) * DAMP;
        const sp = Math.hypot(nvx, nvy);
        if (sp > MAXV) { nvx = nvx / sp * MAXV; nvy = nvy / sp * MAXV; }
        vx[i] = nvx; vy[i] = nvy;
        x[i] = clamp(x[i] + nvx, 6, w - 6);
        y[i] = clamp(y[i] + nvy, 6, h - 6);
      }
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { x, y, active } = this;
      const n = this.N;
      if (!n) return;

      // edges: faint, but a touch brighter when both ends are active (the front).
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const nb = this.adj[i];
        for (let t = 0; t < nb.length; t++) {
          const j = nb[t];
          if (j <= i) continue;
          const hot = active[i] && active[j];
          ctx.strokeStyle = hot ? 'rgba(245,150,90,0.30)' : 'rgba(120,150,170,0.12)';
          ctx.beginPath();
          ctx.moveTo(x[i], y[i]);
          ctx.lineTo(x[j], y[j]);
          ctx.stroke();
        }
      }

      // nodes: dim slate when inactive, hot amber when active, white ring for the seed.
      for (let i = 0; i < n; i++) {
        const on = active[i];
        const r = on ? 3.6 : 2.6;
        if (on) {
          ctx.shadowColor = 'rgba(245,170,80,0.85)';
          ctx.shadowBlur = 9;
          ctx.fillStyle = '#f6a542';
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#3a4756';
        }
        ctx.beginPath();
        ctx.arc(x[i], y[i], r, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // seed node: a distinct bright disc with a white ring.
      if (this.seedId >= 0 && this.seedId < n) {
        const i = this.seedId;
        ctx.fillStyle = '#fff4d6';
        ctx.beginPath();
        ctx.arc(x[i], y[i], 4.4, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(x[i], y[i], 7.5, 0, TAU);
        ctx.stroke();
      }

      this.drawInset(ctx, w, h);
    }

    // Sweep z across its range and plot the MEAN single-seed cascade size, so the
    // window (with both a lower and an upper z boundary) is explicit. Cached and
    // recomputed only when N or φ change (cheap because the sweep rebuilds small
    // scratch graphs of its own).
    ensureCurve() {
      const phi = (this.params.phi != null) ? this.params.phi : 0.18;
      const N = Math.round(this.params.N || 220);
      const key = phi.toFixed(3) + '|' + N;
      if (this._curve && this._curve.key === key) return this._curve;

      const zmin = 0.5, zmax = 20;
      const steps = 22;
      const sweepN = Math.min(N, 200);   // keep the sweep snappy
      const trials = 10;                 // random graphs averaged per z
      const z = new Array(steps), size = new Array(steps);
      for (let s = 0; s < steps; s++) {
        const zz = zmin + (zmax - zmin) * s / (steps - 1);
        z[s] = zz;
        let acc = 0;
        for (let tr = 0; tr < trials; tr++) {
          acc += sweepCascade(sweepN, zz, phi);
        }
        size[s] = acc / trials;
      }
      this._curve = { key, z, size, zmin, zmax };
      return this._curve;
    }

    drawInset(ctx, w, h) {
      const c = this.ensureCurve();
      const ix = INSET.mx * w, iy = INSET.my * h;
      const iw = INSET.w * w, ih = INSET.h * h;

      // panel
      ctx.fillStyle = 'rgba(10,14,20,0.78)';
      ctx.strokeStyle = 'rgba(120,150,170,0.25)';
      ctx.lineWidth = 1;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeRect(ix, iy, iw, ih);

      // title
      ctx.fillStyle = 'rgba(200,212,224,0.85)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('cascade size vs avg degree z', ix + 6, iy + 5);

      const plotX = ix + 6, plotY = iy + 22;
      const plotW = iw - 12, plotH = ih - 30;

      // curve
      ctx.strokeStyle = '#f6a542';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let s = 0; s < c.z.length; s++) {
        const px = plotX + plotW * (c.z[s] - c.zmin) / (c.zmax - c.zmin);
        const py = plotY + plotH * (1 - clamp(c.size[s], 0, 1));
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // marker for the current z
      const zNow = clamp(this.meanDegree(), c.zmin, c.zmax);
      const mx = plotX + plotW * (zNow - c.zmin) / (c.zmax - c.zmin);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, plotY);
      ctx.lineTo(mx, plotY + plotH);
      ctx.stroke();
    }

    // pointer → drag the nearest node within grab radius
    pick(px, py) {
      let best = -1, bestD = 20 * 20;
      for (let i = 0; i < this.N; i++) {
        const dx = this.x[i] - px, dy = this.y[i] - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = i; }
      }
      return best;
    }
  }

  // Stand-alone cascade on a fresh ER graph, for the inset sweep. Builds a small
  // adjacency list, seeds one random node, iterates to a fixed point, returns the
  // active fraction. Kept independent of the live sim so the sweep never touches it.
  function sweepCascade(N, z, phi) {
    if (N <= 1) return 0;
    const p = clamp(z / (N - 1), 0, 1);
    const adj = new Array(N);
    for (let i = 0; i < N; i++) adj[i] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (Math.random() < p) { adj[i].push(j); adj[j].push(i); }
      }
    }
    const act = new Uint8Array(N);
    act[(Math.random() * N) | 0] = 1;
    let changed = true, guard = 0;
    while (changed && guard++ < N + 4) {
      changed = false;
      const flip = [];
      for (let i = 0; i < N; i++) {
        if (act[i]) continue;
        const nb = adj[i];
        const k = nb.length;
        if (k === 0) continue;
        let on = 0;
        for (let t = 0; t < k; t++) on += act[nb[t]];
        if (on / k >= phi) flip.push(i);
      }
      for (const i of flip) act[i] = 1;
      if (flip.length) changed = true;
    }
    let c = 0;
    for (let i = 0; i < N; i++) c += act[i];
    return c / N;
  }

  // ---- mount + controls ----
  const sim = new Cascades('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.reset(); } });

  // ★ the star knob: average degree z drives the cascade window.
  sim.slider('z', { min: 1, max: 20, step: 0.5, value: 6,
    fmt: v => 'z = ' + v.toFixed(1), onInput: () => { sim.reset(); } });
  // threshold φ: the fraction of neighbours required to tip.
  sim.slider('phi', { min: 0.05, max: 0.4, step: 0.01, value: 0.18,
    fmt: v => 'φ = ' + v.toFixed(2), onInput: () => { sim._curve = null; sim.clearActivations(); } });
  // network size N.
  sim.slider('N', { min: 60, max: 400, step: 20, value: 220,
    fmt: v => v + ' nodes', onInput: () => { sim.reset(); } });
  // animation speed (waves per second).
  sim.slider('speed', { min: 1, max: 20, step: 1, value: 6,
    fmt: v => v + ' waves/s' });

  // seed & run: light one random node and play the cascade out step by step.
  sim.button('✦ seed & run', () => sim.seedAndRun(), { primary: true });
  sim.button('✕ clear', () => sim.clearActivations());

  // Drag a node to reposition it; it stays pinned while held.
  sim.onPointer((type, p) => {
    if (type === 'down') {
      sim.dragId = sim.pick(p.x, p.y);
    } else if (type === 'drag' && sim.dragId >= 0) {
      sim.x[sim.dragId] = p.x;
      sim.y[sim.dragId] = p.y;
      if (!sim.running) sim._renderOnce();
    } else if (type === 'up' || type === 'leave') {
      sim.dragId = -1;
    }
  });

  sim.readout(s => {
    const z = s.meanDegree().toFixed(1);
    const phi = ((s.params && s.params.phi) != null ? s.params.phi : 0.18).toFixed(2);
    const frac = s.cascadeFraction();
    const pct = (frac * 100).toFixed(0);
    const global = frac > 0.5 ? '  ·  GLOBAL CASCADE' : (frac > 0 ? '  ·  fizzled (local)' : '');
    return `avg degree z=${z}  ·  threshold φ=${phi}  ·  cascade ${pct}% of ${s.N}` + global;
  });
})();
