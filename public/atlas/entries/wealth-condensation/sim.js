/* Wealth Condensation — the yard-sale / kinetic wealth-exchange model.
 * Extends Atlas.Sim. N agents each start with EQUAL wealth (1.0). Each
 * transaction picks two distinct agents i, j; stakes a fraction f of the
 * POORER one's wealth, Δ = f·min(w_i, w_j); then flips a FAIR coin — with
 * probability ½, i wins Δ from j, else j wins Δ from i. Every trade is a
 * symmetric, zero-sum, fair bet — no cheating, no skill. Yet wealth
 * *condenses*: almost surely it drains onto a single agent and the Gini
 * coefficient climbs toward 1. A redistribution tax τ (collect τ of every
 * agent's wealth, redistribute equally) arrests the condensation into a stable,
 * Pareto-like spread instead of total collapse.
 *
 * Render: a grid of agent cells colored by wealth on a perceptual dark→warm
 * ramp (the field goes dark while a few cells blaze = condensation), plus a
 * sorted wealth-profile curve (poorest→richest) that bows from flat into a
 * steep hockey-stick. Dark ground. No external deps. */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  // Perceptual-ish dark→warm ramp: black → deep purple → red → orange → white.
  // t in [0,1]. Returns "rgb(r,g,b)".
  function ramp(t) {
    t = clamp(t, 0, 1);
    // piecewise stops on a warm "inferno"-like ladder
    const stops = [
      [0.00, 6, 4, 18],     // near-black with a violet bias
      [0.20, 48, 12, 64],   // deep purple
      [0.40, 120, 20, 78],  // magenta-red
      [0.60, 198, 48, 52],  // red
      [0.78, 240, 120, 32], // orange
      [0.90, 250, 188, 70], // amber
      [1.00, 255, 245, 220] // hot near-white
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

  class WealthCondensation extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.62 });
      this.n = 0;
      this.w = null;          // Float64Array of wealth, length n
      this._giniCache = 0;
    }

    setup() {
      const n = Math.round((this.params && this.params.agents) || 600);
      this.reseed(n);
    }

    // (Re)initialize n agents to perfectly EQUAL wealth (1.0 each; total = n).
    reseed(n) {
      this.n = n;
      this.w = new Float64Array(n);
      for (let i = 0; i < n; i++) this.w[i] = 1.0;
      this._giniCache = 0;
    }

    onResize() { /* grid re-lays-out in draw(); state is index-based, unaffected */ }

    // Total wealth in the system (should be conserved by fair exchange).
    total() {
      let s = 0;
      const w = this.w;
      for (let i = 0; i < this.n; i++) s += w[i];
      return s;
    }

    // Gini coefficient via the sorted "relative mean absolute difference" form.
    // G = ( Σ_i (2i − n − 1) w_sorted[i] ) / ( n · Σ w ).  0 = equality, →1 = one
    // agent owns everything. Returns 0 for a degenerate (zero-total) system.
    gini() {
      const n = this.n;
      if (n === 0) return 0;
      const s = Float64Array.from(this.w);
      s.sort();
      let sum = 0, weighted = 0;
      for (let i = 0; i < n; i++) {
        sum += s[i];
        weighted += (2 * (i + 1) - n - 1) * s[i];
      }
      if (sum <= 0) return 0;
      const g = weighted / (n * sum);
      return clamp(g, 0, 1);
    }

    // One yard-sale transaction between two random distinct agents.
    transact() {
      const n = this.n;
      if (n < 2) return;
      const w = this.w;
      let i = (Math.random() * n) | 0;
      let j = (Math.random() * n) | 0;
      if (i === j) { j = (j + 1) % n; }
      const f = this.params.stake ?? 0.2;
      const stake = f * Math.min(w[i], w[j]);   // fraction of the POORER one
      if (stake <= 0) return;
      // FAIR coin: ½ i wins from j, ½ j wins from i. Symmetric, zero-sum.
      if (Math.random() < 0.5) { w[i] += stake; w[j] -= stake; }
      else { w[i] -= stake; w[j] += stake; }
    }

    // Wealth tax: collect a fraction τ of every agent's wealth into a pot and
    // hand it back EQUALLY to all. Conserves total wealth (just moves it around);
    // pushes the distribution back toward the mean and arrests condensation.
    redistribute(tau) {
      if (tau <= 0) return;
      const n = this.n, w = this.w;
      let pot = 0;
      for (let k = 0; k < n; k++) {
        const t = w[k] * tau;
        w[k] -= t;
        pot += t;
      }
      const share = pot / n;
      for (let k = 0; k < n; k++) w[k] += share;
    }

    step() {
      const n = this.n;
      // Transactions per tick: scale with N so the dynamics develop at a
      // comparable pace regardless of population (~speed·N/100 trades/tick).
      const speed = this.params.speed ?? 4;
      const trades = Math.max(1, Math.round(speed * n / 100));
      for (let t = 0; t < trades; t++) this.transact();
      // One redistribution pass per tick (the wealth tax).
      this.redistribute(this.params.redistribution ?? 0);
      this._giniCache = this.gini();
    }

    // ---- diagnostics for the readout ----
    richestShare() {
      const n = this.n;
      if (n === 0) return 0;
      let mx = 0, sum = 0;
      const w = this.w;
      for (let i = 0; i < n; i++) { sum += w[i]; if (w[i] > mx) mx = w[i]; }
      return sum > 0 ? mx / sum : 0;
    }

    fractionBelowHalfMean() {
      const n = this.n;
      if (n === 0) return 0;
      const mean = this.total() / n;
      const thresh = 0.5 * mean;
      let c = 0;
      const w = this.w;
      for (let i = 0; i < n; i++) if (w[i] < thresh) c++;
      return c / n;
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06060c';
      ctx.fillRect(0, 0, w, h);

      const n = this.n;
      const wealth = this.w;
      const total = this.total();
      const mean = total > 0 ? total / n : 1;

      // Layout: top ~70% = agent field grid; bottom ~30% = sorted wealth profile.
      const pad = 12;
      const fieldH = Math.round(h * 0.66);
      const profileTop = fieldH + pad;
      const profileH = h - profileTop - pad;

      // ---- agent field: grid of cells colored by wealth ----
      // Choose a near-square grid that fits the field area.
      const aspect = (w - pad * 2) / (fieldH - pad * 2);
      let cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
      cols = Math.min(cols, n);
      const rows = Math.ceil(n / cols);
      const cellW = (w - pad * 2) / cols;
      const cellH = (fieldH - pad * 2) / rows;
      const gap = Math.min(cellW, cellH) > 6 ? 1 : 0;

      // Color by wealth relative to the mean, on a compressed (log-ish) scale so
      // the long tail is legible: t = ramp position from w/mean.
      for (let idx = 0; idx < n; idx++) {
        const c = idx % cols;
        const r = (idx / cols) | 0;
        const x = pad + c * cellW;
        const y = pad + r * cellH;
        const rel = wealth[idx] / (mean || 1);
        // map relative wealth → [0,1] with a soft log compression
        const t = clamp(Math.log2(1 + rel) / 4.5, 0, 1);
        ctx.fillStyle = ramp(t);
        ctx.fillRect(x, y, Math.max(1, cellW - gap), Math.max(1, cellH - gap));
      }

      // ---- sorted wealth profile (poorest → richest) as an area curve ----
      if (profileH > 8) {
        const sorted = Float64Array.from(wealth);
        sorted.sort();
        const maxW = sorted[n - 1] || 1;
        const baseY = profileTop + profileH;
        const px0 = pad, pw = w - pad * 2;

        // subtle frame
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px0, profileTop, pw, profileH);

        // area under the sorted-wealth curve
        ctx.beginPath();
        ctx.moveTo(px0, baseY);
        const step = Math.max(1, Math.floor(n / Math.max(1, Math.min(n, pw))));
        for (let i = 0; i < n; i += step) {
          const x = px0 + (i / (n - 1 || 1)) * pw;
          const y = baseY - (sorted[i] / maxW) * (profileH - 2);
          ctx.lineTo(x, y);
        }
        // ensure the last (richest) point is drawn
        ctx.lineTo(px0 + pw, baseY - (sorted[n - 1] / maxW) * (profileH - 2));
        ctx.lineTo(px0 + pw, baseY);
        ctx.closePath();
        const grad = ctx.createLinearGradient(px0, 0, px0 + pw, 0);
        if (grad && grad.addColorStop) {
          grad.addColorStop(0, 'rgba(80,30,90,0.55)');
          grad.addColorStop(1, 'rgba(250,190,90,0.85)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(200,120,80,0.7)';
        }
        ctx.fill();

        // mean line (equality reference) across the profile
        const meanY = baseY - (mean / maxW) * (profileH - 2);
        if (meanY > profileTop && meanY < baseY) {
          ctx.strokeStyle = 'rgba(120,200,220,0.45)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(px0, meanY);
          ctx.lineTo(px0 + pw, meanY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // label
        ctx.fillStyle = 'rgba(200,205,220,0.5)';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText('agents sorted poorest → richest', px0 + 6, profileTop + 14);
      }
    }
  }

  // ---- mount + controls ----
  const sim = new WealthCondensation('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.reseed(sim.n); sim._renderOnce(); } });

  sim.slider('agents', { min: 100, max: 2000, step: 50, value: 600,
    fmt: v => v + '',
    onInput: v => { sim.reseed(Math.round(v)); if (!sim.running) sim._renderOnce(); } });

  sim.slider('stake', { min: 0.05, max: 0.5, step: 0.01, value: 0.2,
    fmt: v => v.toFixed(2) });

  sim.slider('redistribution', { min: 0, max: 0.05, step: 0.001, value: 0,
    fmt: v => v.toFixed(3) });

  sim.slider('speed', { min: 1, max: 30, step: 1, value: 6,
    fmt: v => v + '×' });

  sim.readout(s => {
    const g = s.gini();
    const rich = (s.richestShare() * 100).toFixed(1);
    const poor = (s.fractionBelowHalfMean() * 100).toFixed(0);
    return `Gini ${g.toFixed(3)}  ·  richest holds ${rich}%  ·  ${poor}% below ½ the mean`;
  });
})();
