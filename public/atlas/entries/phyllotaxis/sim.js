/* Phyllotaxis — how the golden angle and Fibonacci spirals of a sunflower head
 * emerge from a simple local rule about where each new bud (primordium) forms.
 *
 * Two modes, selectable:
 *
 * (A) EMERGENT (default, the real "why") — Douady & Couder (1992). Primordia are
 *     emitted one at a time from a small central circle, then drift radially
 *     OUTWARD over time (older buds are farther out). Each NEW bud appears in the
 *     spot on the emission circle that is FARTHEST from the existing nearby buds —
 *     i.e. it is repelled into the largest available gap (we minimise a Σ 1/r
 *     repulsion energy against the most recent N buds). From this purely local
 *     "grow in the biggest gap" rule the divergence angle between successive buds
 *     self-organises to the golden angle ≈ 137.5°, and the buds settle into
 *     interlocking Fibonacci spirals. The readout shows the measured running
 *     divergence angle converging on 137.5°.
 *
 * (B) EXPLORE (the geometry) — Vogel (1979). Bud n is placed directly at angle
 *     n·δ and radius c·√n, where δ is a divergence-angle slider. At the golden
 *     angle the packing is perfect and dense; nudge δ a few hundredths of a degree
 *     and the spirals reorganise into other Fibonacci families; set δ to a rational
 *     fraction of 360° (90° → 4 spokes, 137.0° → visible arms/gaps) and the packing
 *     fails into wasteful radial spokes. This shows WHY the golden angle — the
 *     "most irrational" number, hardest to approximate by a fraction — packs best.
 *
 * Extends Atlas.Sim. Vanilla ES + Canvas, no external deps. */
(function () {
  'use strict';
  const { Sim, TAU, clamp } = Atlas;

  // The golden angle: 360°/φ² = 360°·(2 − φ) = 137.50776…°  (φ = (1+√5)/2).
  const PHI = (1 + Math.sqrt(5)) / 2;
  const GOLDEN_DEG = 360 / (PHI * PHI); // 137.50776405…
  const DEG = Math.PI / 180;

  // How many of the most-recent buds a new bud "feels" when choosing its gap.
  // Phyllotaxis is governed by the front of recently-formed primordia, not the
  // whole (already-spread-out) head, so a local window suffices and is cheap.
  const NEIGHBORS = 10;
  // Angular candidates scanned around the emission circle when placing a bud.
  const SCAN = 1440; // 0.25° resolution
  // Radius at which a new bud is born, relative to the unit radial-drift step.
  // (Tuned so the inverse-square repulsion settles on the golden divergence.)
  const EMIT_R = 1.05;

  class Phyllotaxis extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.82 });
      // Bud positions in canvas pixels (centred), plus the polar bookkeeping.
      this.bx = null;          // Float32Array x (px, centred at canvas middle)
      this.by = null;          // Float32Array y
      this.bAngle = null;      // Float32Array emission angle (radians) of each bud
      this.n = 0;              // number of buds currently placed
      this.target = 0;         // how many buds we want (the N slider)
      this.divergenceAngle = GOLDEN_DEG; // measured (emergent) or set (explore), in DEGREES
      this._emitAccum = 0;     // fractional emission accumulator (speed control)
      this._sumDiv = 0;        // running sum of successive divergence deltas (emergent)
      this._countDiv = 0;      // count for the running mean
      this._emaDiv = GOLDEN_DEG; // exponentially-smoothed running divergence (emergent)
      this._lastEmitAngle = 0; // last bud's emission angle (for divergence measurement)
    }

    // ---- geometry helpers ----
    center() { return { cx: this.width / 2, cy: this.height / 2 }; }

    // Radius (px) of a bud that is `age` emissions old, given `total` buds and
    // the canvas. Buds drift outward as new ones appear behind them. We use the
    // Vogel √ law for radius in BOTH modes (it is the natural close-packing law:
    // equal area per bud → r ∝ √index), so the head fills evenly. `age` is the
    // index counted from the OLDEST bud (oldest = largest radius).
    radiusFor(age, total) {
      const { cx, cy } = this.center();
      const maxR = Math.min(cx, cy) * 0.94;
      const denom = Math.max(total, 1);
      return maxR * Math.sqrt((age + 0.5) / denom);
    }

    setup() {
      const cap = Math.round((this.params && this.params.florets) || 700);
      this.target = cap;
      this.bx = new Float32Array(cap);
      this.by = new Float32Array(cap);
      this.bAngle = new Float32Array(cap);
      this.n = 0;
      this._emitAccum = 0;
      this._sumDiv = 0;
      this._countDiv = 0;
      this._emaDiv = GOLDEN_DEG;
      this._lastEmitAngle = 0;
      this.divergenceAngle = this._mode() === 'explore'
        ? (this.params.divergence ?? GOLDEN_DEG)
        : GOLDEN_DEG;

      if (this._mode() === 'explore') {
        // Explore mode is purely geometric: lay down ALL buds immediately via
        // Vogel placement so the reader sees the finished packing and can drag δ.
        this._placeAllVogel();
      }
      // Emergent mode starts empty and grows bud-by-bud in step().
      this._recomputePositions();
    }

    _mode() {
      return (this.params && this.params.mode) || 'emergent';
    }

    onResize() { this._recomputePositions(); }

    // ---- EXPLORE: Vogel placement (impose the angle) ----
    _placeAllVogel() {
      const delta = (this.params.divergence ?? GOLDEN_DEG) * DEG;
      this.n = this.target;
      for (let i = 0; i < this.n; i++) this.bAngle[i] = i * delta;
      this.divergenceAngle = (this.params.divergence ?? GOLDEN_DEG);
    }

    // ---- EMERGENT: emit one bud into the largest available gap ----
    // The new bud is born on the emission circle at the angle that MINIMISES a
    // Σ 1/distance repulsion energy against the most recent NEIGHBORS buds — i.e.
    // it is pushed into the biggest gap they leave open. No angle is imposed.
    _emitOne() {
      if (this.n >= this.target) return;
      const i = this.n;

      if (i === 0) {
        // First bud: arbitrary seed angle (the convergence is independent of it).
        this.bAngle[0] = Atlas.rand(TAU);
        this._lastEmitAngle = this.bAngle[0];
        this.n = 1;
        return;
      }

      // Douady–Couder inhibition front. Older buds have already drifted OUTWARD,
      // so each recent neighbour sits at its true position in the plane: angle
      // bAngle[k] at a radius that GROWS with how long ago it formed (the same
      // √age law the head packs by, so a bud `age` emissions old sits at √age).
      // The new bud is born on the emission circle at radius EMIT_R. We scan
      // candidate angles and pick the one that MINIMISES Σ 1/distance² to those
      // actual positions — i.e. the new bud lands in the biggest real gap the
      // front leaves open. No angle is imposed: from this purely local repulsion
      // the divergence self-organises to ≈ the golden angle.
      const start = Math.max(0, i - NEIGHBORS);
      let bestAngle = 0;
      let bestEnergy = Infinity;
      for (let s = 0; s < SCAN; s++) {
        const a = (s / SCAN) * TAU;
        const cax = Math.cos(a) * EMIT_R;  // candidate position on emission circle
        const cay = Math.sin(a) * EMIT_R;
        let energy = 0;
        for (let k = start; k < i; k++) {
          const na = this.bAngle[k];
          const age = i - k;               // 1..NEIGHBORS (1 = just emitted)
          const rk = Math.sqrt(age);       // that bud has drifted out to √age
          const dx = cax - Math.cos(na) * rk;
          const dy = cay - Math.sin(na) * rk;
          const d2 = dx * dx + dy * dy + 1e-9;
          energy += 1 / d2;                // inverse-square repulsion
        }
        if (energy < bestEnergy) { bestEnergy = energy; bestAngle = a; }
      }

      this.bAngle[i] = bestAngle;

      // Measure the divergence: the angular step from the previous bud, folded to
      // the unsigned [0, 180°] gap. We report an exponentially-smoothed running
      // value so the readout shows the live angle SETTLING on 137.5° rather than
      // being dragged forever by the chaotic first few buds.
      let d = bestAngle - this._lastEmitAngle;
      d = ((d % TAU) + TAU) % TAU;       // wrap to [0, 2π)
      if (d > Math.PI) d = TAU - d;      // fold to [0, π] (unsigned divergence)
      const ddeg = d / DEG;
      this._sumDiv += ddeg;
      this._countDiv++;
      // Smooth: ignore the first few transient buds, then EMA toward the settled
      // value. _emaDiv tracks the recent running divergence.
      if (this._countDiv <= 3) {
        this._emaDiv = ddeg;
      } else {
        this._emaDiv = this._emaDiv * 0.9 + ddeg * 0.1;
      }
      this.divergenceAngle = this._emaDiv;
      this._lastEmitAngle = bestAngle;

      this.n = i + 1;
    }

    // Recompute pixel positions from the stored emission angles + the √ radius
    // law. In emergent mode, bud index 0 is the OLDEST → largest radius; new buds
    // start near the centre and the head grows outward as more appear.
    _recomputePositions() {
      const { cx, cy } = this.center();
      const total = Math.max(this.n, 1);
      for (let i = 0; i < this.n; i++) {
        // age: oldest bud (i=0) is farthest out. In both modes index increases
        // with time, so radius increases with index (Vogel) — identical law.
        const r = this.radiusFor(i, total);
        const a = this.bAngle[i];
        this.bx[i] = cx + Math.cos(a) * r;
        this.by[i] = cy + Math.sin(a) * r;
      }
    }

    step() {
      if (this._mode() === 'explore') {
        // Static geometry; nothing to advance. (Drag δ / N to change it.)
        return;
      }
      // Emergent: emit buds at the chosen rate, then redraw the growing head.
      const rate = (this.params.speed ?? 2);
      this._emitAccum += rate;
      let guard = 0;
      while (this._emitAccum >= 1 && this.n < this.target && guard < 200) {
        this._emitOne();
        this._emitAccum -= 1;
        guard++;
      }
      this._recomputePositions();
    }

    // Re-place everything for the current explore δ (called when the slider moves).
    refreshExplore() {
      if (this._mode() !== 'explore') return;
      this._placeAllVogel();
      this._recomputePositions();
    }

    // Estimate the visible spiral arm count (parastichy number) by reading the
    // dominant Fibonacci spiral families. We approximate it from the divergence
    // angle's continued-fraction convergents: the parastichy numbers are the
    // denominators of the best rational approximations to δ/360°. For the golden
    // angle these are consecutive Fibonacci numbers, scaled by how many buds are
    // shown. Returns a short label like "34 / 55" or '' if undetermined.
    parastichyLabel() {
      const frac = (this.divergenceAngle / 360) % 1;
      if (!(frac > 0 && frac < 1)) return '';
      // continued-fraction convergents of `frac`
      let x = frac, p0 = 0, p1 = 1, q0 = 1, q1 = 0;
      const conv = [];
      for (let it = 0; it < 25 && conv.length < 12; it++) {
        const a = Math.floor(x);
        const p = a * p1 + p0;
        const q = a * q1 + q0;
        p0 = p1; p1 = p; q0 = q1; q1 = q;
        if (q > 0) conv.push(q);
        const frac2 = x - a;
        if (frac2 < 1e-9) break;
        x = 1 / frac2;
      }
      // Pick the consecutive convergent pair whose arm count best matches what is
      // actually visible. The number of spiral arms a reader counts in a head of
      // N buds scales like √N (each arm holds ~√N buds), so we choose the pair of
      // adjacent convergent denominators that brackets √N. For the golden angle
      // these are consecutive Fibonacci numbers (…21/34, 34/55, 55/89…); off it
      // the convergents stop being Fibonacci (the packing has visibly failed).
      const cap = Math.max(this.n, 1);
      const usable = conv.filter(q => q >= 2 && q <= cap * 0.8);
      if (usable.length < 2) return usable.length === 1 ? String(usable[0]) : '';
      const target = Math.sqrt(cap) * 1.3; // ~ visible arm count
      let bi = 1;
      for (let j = 1; j < usable.length; j++) {
        bi = j;
        if (usable[j] >= target) break;
      }
      return `${usable[bi - 1]} / ${usable[bi]}`;
    }

    draw(ctx, w, h) {
      // dark ground
      ctx.fillStyle = '#0a0806';
      ctx.fillRect(0, 0, w, h);

      const total = Math.max(this.n, 1);
      const { cx, cy } = this.center();
      const maxR = Math.min(cx, cy) * 0.94;

      // floret radius: scale so the head is densely packed. Equal-area packing
      // gives spacing ∝ maxR/√total; the size slider multiplies it.
      const sizeMul = (this.params && this.params.size) || 1;
      const base = (maxR / Math.sqrt(total)) * 0.62 * sizeMul;

      for (let i = 0; i < this.n; i++) {
        const x = this.bx[i], y = this.by[i];
        // color by index: dark seedy centre → warm amber → teal rim, so the
        // interlocking spirals read clearly.
        const t = i / total;            // 0 (oldest/outer) … but i grows outward
        // Map outer (old, large i) to warm rim, inner (young, small i) to dark.
        const u = clamp(t, 0, 1);
        const hue = 18 + u * 150;       // 18 (warm brown/amber) → 168 (teal)
        const sat = 55 + u * 25;
        const lig = 16 + u * 42;        // dark centre → bright rim
        ctx.fillStyle = `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${lig.toFixed(0)}%)`;
        // grow floret size slightly toward the rim (older buds are bigger)
        const r = base * (0.55 + 0.7 * u);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(r, 0.6), 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---- mount + controls ----
  const sim = new Phyllotaxis('#stage');
  sim.start();

  // Toggle the visibility/relevance of the divergence slider by leaving it always
  // present (Atlas has no hide API); in emergent mode it is simply ignored, and
  // the readout makes clear which value is live.
  let divInput, speedInput;

  sim.standardRail({
    randomize: () => {
      // randomize: pick a fresh mode-appropriate configuration
      if (sim._mode() === 'explore') {
        // jump to a random divergence near (but not exactly) the golden angle
        const jitter = (Math.random() - 0.5) * 4; // ±2°
        const v = clamp(GOLDEN_DEG + jitter, 137.0, 138.0);
        if (divInput) { divInput.value = v; divInput.dispatchEvent(new Event('input')); }
      } else {
        sim.reset();
      }
    },
  });

  sim.select('mode', [
    { value: 'emergent', label: 'Emergent (grow in the biggest gap)' },
    { value: 'explore', label: 'Explore (set the divergence angle)' },
  ], {
    value: 'emergent',
    onChange: () => { sim.reset(); if (!sim.running) sim._renderOnce(); },
  });

  // Wide range so the reader can reach dramatic rational angles (90° → 4 spokes,
  // 120°, 144°…) AND the golden neighborhood; the fine 0.01° step still gives
  // hundredth-of-a-degree control around 137.5° where the Fibonacci families flip.
  divInput = sim.slider('divergence', {
    min: 60.0, max: 160.0, step: 0.01, value: GOLDEN_DEG,
    fmt: v => v.toFixed(2) + '°',
    onInput: () => { sim.refreshExplore(); if (!sim.running) sim._renderOnce(); },
  });

  sim.slider('florets', {
    min: 200, max: 1500, step: 50, value: 700, fmt: v => v.toString(),
    onInput: () => { sim.reset(); if (!sim.running) sim._renderOnce(); },
  });

  sim.slider('size', {
    min: 0.5, max: 1.8, step: 0.05, value: 1, fmt: v => v.toFixed(2) + '×',
    onInput: () => { if (!sim.running) sim._renderOnce(); },
  });

  speedInput = sim.slider('speed', {
    min: 0.5, max: 12, step: 0.5, value: 2, fmt: v => v + ' /frame',
  });

  sim.readout(s => {
    const mode = s._mode();
    if (mode === 'explore') {
      const para = s.parastichyLabel();
      return `explore · δ = ${s.divergenceAngle.toFixed(2)}°` +
        ` · N=${s.n}` + (para ? ` · spirals ≈ ${para}` : '');
    }
    const para = s.parastichyLabel();
    const conv = s.n > 4 ? s.divergenceAngle.toFixed(2) + '°' : '…';
    return `emergent · measured δ → ${conv} (golden 137.51°)` +
      ` · buds ${s.n}/${s.target}` + (para ? ` · spirals ≈ ${para}` : '');
  });

  // Expose constants for tests.
  sim.GOLDEN_DEG = GOLDEN_DEG;
})();
