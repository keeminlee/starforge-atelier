/* Opinion Dynamics — the Deffuant bounded-confidence model.
 *
 * N agents each hold a CONTINUOUS opinion x_i in [0,1]. The rule (Deffuant,
 * Neau, Amblard & Weisbuch 2000) is pairwise and agent-based:
 *
 *   - pick a random pair (i, j);
 *   - if |x_i − x_j| < ε  (the CONFIDENCE THRESHOLD), they move toward each
 *     other:  x_i += μ·(x_j − x_i),  x_j += μ·(x_i − x_j);
 *   - if |x_i − x_j| ≥ ε, NOTHING happens — they simply ignore each other.
 *
 * The emergence: the threshold ε alone decides the fate of a uniformly random
 * population. Large ε → everyone converges to ONE shared opinion (CONSENSUS).
 * Medium ε → two stable camps (POLARIZATION). Small ε → many isolated clusters
 * that can never talk (FRAGMENTATION). The surviving cluster count grows as ε
 * shrinks, ≈ 1/(2ε) on [0,1]. Less openness → MORE fragments. μ only sets the
 * SPEED of convergence, never the final number of clusters.
 *
 * Optional EXTREMISTS: a couple of stubborn agents pinned near 0 and 1, which
 * can drag a moderate population toward the poles.
 *
 * Render: a space-time trajectory plot. Opinion on the vertical axis (0 bottom,
 * 1 top), time scrolling left→right; each agent is a point each frame, coloured
 * by its CURRENT opinion, so paths trace out and visibly MERGE into 1, 2, or
 * many horizontal bands. A live opinion histogram is drawn on the right edge.
 *
 * No external deps; vanilla ES + Canvas. */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  // Smooth opinion → colour ramp across [0,1]: a vivid cool→warm sweep so
  // distinct bands read as distinct colours (blue → teal → green → amber → red).
  function ramp(t) {
    t = clamp(t, 0, 1);
    const stops = [
      [0.00, 60, 110, 240],   // blue (one pole)
      [0.25, 40, 190, 200],   // teal
      [0.50, 120, 205, 110],  // green (centre)
      [0.75, 245, 180, 60],   // amber
      [1.00, 235, 70, 70],    // red (other pole)
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    const u = (t - a[0]) / span;
    const r = Math.round(a[1] + (b[1] - a[1]) * u);
    const g = Math.round(a[2] + (b[2] - a[2]) * u);
    const bl = Math.round(a[3] + (b[3] - a[3]) * u);
    return `rgb(${r},${g},${bl})`;
  }

  class OpinionDynamics extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.n = 0;
      this.x = null;            // Float64Array of opinions, length n
      this.fixed = null;        // Uint8Array: 1 = stubborn extremist (never moves)
      this.trail = null;        // offscreen canvas: the scrolling space-time plot
      this.tctx = null;
      this.col = 0;             // current write column in the trail
      this._clusters = 1;
    }

    setup() {
      const n = Math.round((this.params && this.params.agents) || 400);
      this.reseed(n);
      this._initTrail();
      this._prefillTrail();
    }

    // Pre-fill the scrolling plot so the entry OPENS already showing the full
    // convergence story (spread → clusters) across the whole canvas, instead of
    // an empty plot that crawls in over ~10s. Re-scatters first so the story
    // starts from a fresh uniform spread. Cheap; runs at setup and on resize.
    _prefillTrail() {
      if (!this.trail) return;
      this.reseed(this.n);                 // fresh spread + clears the trail (col=0)
      const cols = this.trail.width;
      for (let k = 0; k < cols; k++) this.step();
    }

    // (Re)scatter opinions uniformly on [0,1]. Optionally pin a few extremists
    // near 0 and 1 (stubborn — they pull but never move).
    reseed(n) {
      this.n = n;
      this.x = new Float64Array(n);
      this.fixed = new Uint8Array(n);
      for (let i = 0; i < n; i++) this.x[i] = Math.random();
      this.applyExtremists();
      this._clusters = this.clusterCount();
      this.col = 0;
      if (this.trail && this.tctx) {
        this.tctx.fillStyle = '#0a0a12';
        this.tctx.fillRect(0, 0, this.trail.width, this.trail.height);
      }
    }

    // If the "extremists" toggle is on, pin a small number of agents hard at the
    // two poles. They are marked fixed so step() never moves them — but other
    // agents still listen to them when within ε, so they act as attractors.
    applyExtremists() {
      const on = (this.params && this.params.extremists) === 'on';
      const n = this.n;
      for (let i = 0; i < n; i++) this.fixed[i] = 0;
      if (!on || n < 4) return;
      const k = Math.max(1, Math.round(n * 0.02)); // ~2% per pole
      for (let p = 0; p < k; p++) {
        if (p < n) { this.x[p] = 0.0; this.fixed[p] = 1; }
        const q = n - 1 - p;
        if (q > p) { this.x[q] = 1.0; this.fixed[q] = 1; }
      }
    }

    _initTrail() {
      // The trail is sized to the (logical) canvas; we scroll it horizontally.
      const w = Math.max(2, Math.round(this.width));
      const h = Math.max(2, Math.round(this.height));
      const c = (typeof document !== 'undefined' && document.createElement)
        ? document.createElement('canvas') : null;
      if (!c) { this.trail = null; this.tctx = null; return; }
      c.width = w; c.height = h;
      this.trail = c;
      this.tctx = c.getContext('2d');
      if (this.tctx) {
        this.tctx.fillStyle = '#0a0a12';
        this.tctx.fillRect(0, 0, w, h);
      }
      this.col = 0;
    }

    onResize() { this._initTrail(); this._prefillTrail(); }

    // One Deffuant pairwise interaction.
    interact() {
      const n = this.n;
      if (n < 2) return;
      const x = this.x, fixed = this.fixed;
      let i = (Math.random() * n) | 0;
      let j = (Math.random() * n) | 0;
      if (i === j) j = (j + 1) % n;
      const eps = this.params.confidence ?? 0.2;
      const d = x[j] - x[i];
      if (Math.abs(d) >= eps) return;   // too far apart — ignore each other
      const mu = this.params.convergence ?? 0.5;
      // Each moves μ of the way toward the other. Stubborn (fixed) agents do
      // not move, but unfixed partners still converge toward them.
      if (!fixed[i]) x[i] = clamp(x[i] + mu * d, 0, 1);
      if (!fixed[j]) x[j] = clamp(x[j] - mu * d, 0, 1);
    }

    // Count well-separated opinion clusters: sort, then split wherever a gap
    // between consecutive opinions exceeds the confidence threshold ε (beyond
    // which two groups can never again influence one another). This is exactly
    // the "frozen" condition of the bounded-confidence dynamics.
    clusterCount(gap) {
      const n = this.n;
      if (n === 0) return 0;
      const g = gap ?? Math.max(1e-6, (this.params.confidence ?? 0.2) * 0.5);
      const s = Float64Array.from(this.x);
      s.sort();
      let count = 1;
      for (let i = 1; i < n; i++) if (s[i] - s[i - 1] > g) count++;
      return count;
    }

    // Total spread (max − min) of opinions; ~0 means full consensus.
    spread() {
      const n = this.n;
      if (n === 0) return 0;
      let lo = Infinity, hi = -Infinity;
      const x = this.x;
      for (let i = 0; i < n; i++) { if (x[i] < lo) lo = x[i]; if (x[i] > hi) hi = x[i]; }
      return hi - lo;
    }

    step() {
      const n = this.n;
      // Interactions per tick scale with N so dynamics develop at a comparable
      // pace regardless of population (~speed·N/100 pair-meetings per tick).
      const speed = this.params.speed ?? 12;
      const meetings = Math.max(1, Math.round(speed * n / 100));
      for (let m = 0; m < meetings; m++) this.interact();
      this._clusters = this.clusterCount();
      this._writeTrailColumn();
    }

    // Paint the current opinions into the next column of the scrolling trail.
    _writeTrailColumn() {
      const tctx = this.tctx, trail = this.trail;
      if (!tctx || !trail) return;
      const w = trail.width, h = trail.height;
      const col = this.col % w;
      // Clear this column to background, then plot each agent as a dot.
      tctx.fillStyle = '#0a0a12';
      tctx.fillRect(col, 0, 1, h);
      const x = this.x, n = this.n;
      for (let i = 0; i < n; i++) {
        const v = x[i];
        const y = (1 - v) * (h - 1);       // 0 at bottom, 1 at top
        tctx.fillStyle = ramp(v);
        tctx.fillRect(col, y | 0, 1, 1);
      }
      this.col++;
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, w, h);

      const histW = Math.min(86, Math.round(w * 0.13));
      const plotW = w - histW - 6;

      // ---- scrolling space-time trajectory plot ----
      if (this.trail) {
        const tw = this.trail.width, th = this.trail.height;
        const col = this.col % tw;
        // Draw so the newest column is at the RIGHT edge (time flows left→right):
        // the segment [col..tw) is the OLDER part, [0..col) the NEWER part.
        // Render older chunk then newer chunk back-to-back.
        const olderW = tw - col;
        if (olderW > 0)
          ctx.drawImage(this.trail, col, 0, olderW, th, 0, 0, olderW / tw * plotW, h);
        if (col > 0)
          ctx.drawImage(this.trail, 0, 0, col, th, olderW / tw * plotW, 0, col / tw * plotW, h);
      }

      // axis labels for the opinion dial
      ctx.fillStyle = 'rgba(200,205,220,0.5)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('opinion 1', 6, 14);
      ctx.fillText('opinion 0', 6, h - 6);
      ctx.fillText('time →', plotW - 50, h - 6);

      // ---- live opinion histogram on the right edge ----
      const hx = plotW + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(hx, 0, histW, h);
      const bins = 60;
      const counts = new Array(bins).fill(0);
      const x = this.x, n = this.n;
      for (let i = 0; i < n; i++) {
        let b = Math.floor(x[i] * bins);
        if (b >= bins) b = bins - 1; if (b < 0) b = 0;
        counts[b]++;
      }
      let mx = 1;
      for (let b = 0; b < bins; b++) if (counts[b] > mx) mx = counts[b];
      const binH = h / bins;
      for (let b = 0; b < bins; b++) {
        if (!counts[b]) continue;
        const frac = counts[b] / mx;
        const barW = frac * (histW - 4);
        const v = (b + 0.5) / bins;
        const y = (1 - v) * (h - binH);
        ctx.fillStyle = ramp(v);
        ctx.fillRect(hx + 2, y, Math.max(1, barW), Math.max(1, binH - 0.5));
      }
    }
  }

  // ---- mount + controls (construct, start, THEN declare controls) ----
  const sim = new OpinionDynamics('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim._prefillTrail(); if (!sim.running) sim._renderOnce(); } });

  // ε — the star knob. Default ~0.2, near the consensus/polarization boundary.
  sim.slider('confidence', { min: 0.05, max: 0.5, step: 0.01, value: 0.2,
    fmt: v => v.toFixed(2) });

  sim.slider('agents', { min: 50, max: 1000, step: 10, value: 400,
    fmt: v => v + '',
    onInput: v => { sim.reseed(Math.round(v)); if (!sim.running) sim._renderOnce(); } });

  sim.slider('convergence', { min: 0.1, max: 0.5, step: 0.01, value: 0.5,
    fmt: v => v.toFixed(2) });

  sim.slider('speed', { min: 1, max: 40, step: 1, value: 12,
    fmt: v => v + '×' });

  sim.select('extremists', [{ value: 'off', label: 'off' }, { value: 'on', label: 'on' }],
    { value: 'off', onChange: () => { sim.reseed(sim.n); if (!sim.running) sim._renderOnce(); } });

  sim.readout(s => {
    const c = s.clusterCount();
    const eps = (s.params.confidence ?? 0.2);
    const label = c === 1 ? 'consensus' : c === 2 ? 'polarized' : 'fragmented';
    return `ε ${eps.toFixed(2)}  ·  ${c} cluster${c === 1 ? '' : 's'}  ·  ${label}`;
  });
})();
