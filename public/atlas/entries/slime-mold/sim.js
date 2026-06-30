/* Slime mould (Physarum) — Jones' agent model of transport-network formation.
 * Extends Atlas.Sim. Two coupled layers organize into vein-like networks:
 *
 *   1. Agents (particles). Each has a position (x,y) and a heading θ. Per step
 *      it SENSES the trail field at three points ahead — front-left, front,
 *      front-right — at sensor distance SO and sensor angle SA; ROTATES toward
 *      the strongest of the three by rotation angle RA (front strongest → go
 *      straight; a side strongest → turn that way; none/tie → small random
 *      turn); MOVES forward one step; and DEPOSITS a fixed amount of trail at
 *      its new cell. The world is a torus (wrap at edges).
 *   2. Trail field (grid). After all agents deposit, the field DIFFUSES (a 3×3
 *      mean/box blur) and DECAYS (multiply by <1) each step. Diffuse+decay is
 *      what lets unused trails fade while reinforced paths persist.
 *
 * The emergent result: agents spontaneously weave into evolving, vein-like
 * transport networks. This is the *style* of Physarum network formation, not a
 * biological simulation (see notes.md). The trail field is rendered through a
 * dark → teal → amber color ramp so the reader sees the network, not the dots.
 *
 * Reference parameters (Jones 2010): sensor angle ~22.5°, rotation angle ~45°,
 * sensor offset ~9px, deposit ~5, decay ~0.1/step, a few thousand agents. */
(function () {
  'use strict';
  const { Sim, clamp, rand, TAU } = Atlas;

  const CELL = 2;         // logical pixels per trail-field cell
  const STEP = 1.0;       // agent move distance per step (in field cells)
  const DEPOSIT = 5.0;    // trail deposited per agent per step
  const DEG = Math.PI / 180;

  class SlimeMold extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 1 });
      this.meanTrail = 0;
      this._depositOn = true; // test hook: lets evaporation be isolated
    }

    setup() {
      this.W = Math.max(1, Math.floor(this.width / CELL));
      this.H = Math.max(1, Math.floor(this.height / CELL));
      const cells = this.W * this.H;
      this.trail = new Float32Array(cells);   // the trail field
      this.trail2 = new Float32Array(cells);  // diffuse back-buffer
      const made = this.ctx.createImageData ? this.ctx.createImageData(this.W, this.H) : null;
      this.img = (made && made.data) ? made : null;
      this.seedAgents(Math.round((this.params && this.params.agents) || 4000));
    }

    onResize() { this.setup(); }

    // (Re)seed n agents. Most start in a central disc facing inward-ish, which
    // gives a lively radial bloom that quickly tangles into a network.
    seedAgents(n) {
      this.bx = new Float32Array(n); // position x in field cells
      this.by = new Float32Array(n); // position y in field cells
      this.ba = new Float32Array(n); // heading (radians)
      const cx = this.W * 0.5, cy = this.H * 0.5;
      const r = Math.min(this.W, this.H) * 0.30;
      for (let i = 0; i < n; i++) {
        const ang = rand(TAU);
        const rad = Math.sqrt(Math.random()) * r;
        this.bx[i] = cx + Math.cos(ang) * rad;
        this.by[i] = cy + Math.sin(ang) * rad;
        this.ba[i] = rand(TAU);
      }
      this.n = n;
    }

    // Trail value at a wrapped field cell.
    sampleWrapped(x, y) {
      const W = this.W, H = this.H;
      let xi = Math.floor(x) % W; if (xi < 0) xi += W;
      let yi = Math.floor(y) % H; if (yi < 0) yi += H;
      return this.trail[yi * W + xi];
    }

    step() {
      const W = this.W, H = this.H, n = this.n, trail = this.trail;
      const SA = (this.params.sensorAngle ?? 22.5) * DEG;  // sensor angle (rad)
      const RA = (this.params.rotateAngle ?? 45) * DEG;    // rotation angle (rad)
      const SO = (this.params.sensorDist ?? 9) / CELL;     // sensor offset (cells)
      const decay = clamp(this.params.decay ?? 0.1, 0, 0.99);
      const deposit = this._depositOn ? DEPOSIT : 0;
      const { bx, by, ba } = this;

      // --- 1. sense → rotate → move → deposit, per agent ---
      for (let i = 0; i < n; i++) {
        const x = bx[i], y = by[i], a = ba[i];
        // three sensors ahead
        const fC = this.sampleWrapped(x + Math.cos(a) * SO, y + Math.sin(a) * SO);
        const fL = this.sampleWrapped(x + Math.cos(a - SA) * SO, y + Math.sin(a - SA) * SO);
        const fR = this.sampleWrapped(x + Math.cos(a + SA) * SO, y + Math.sin(a + SA) * SO);

        let na = a;
        if (fC >= fL && fC >= fR) {
          // front is (weakly) strongest → go straight
        } else if (fL > fR) {
          na = a - RA;           // left strongest → turn left
        } else if (fR > fL) {
          na = a + RA;           // right strongest → turn right
        } else {
          // sides tie and beat the front → small random turn
          na = a + (Math.random() < 0.5 ? -RA : RA);
        }

        // move forward by STEP, wrap on the torus
        let nx = x + Math.cos(na) * STEP;
        let ny = y + Math.sin(na) * STEP;
        nx = ((nx % W) + W) % W;
        ny = ((ny % H) + H) % H;

        bx[i] = nx; by[i] = ny; ba[i] = na;

        // deposit at the new cell
        if (deposit) {
          const xi = nx | 0, yi = ny | 0;
          trail[yi * W + xi] += deposit;
        }
      }

      // --- 2. diffuse (3×3 box blur) + decay the whole field ---
      this.diffuseDecay(decay);

      // readout bookkeeping
      let sum = 0;
      for (let i = 0; i < trail.length; i++) sum += trail[i];
      this.meanTrail = trail.length ? sum / trail.length : 0;
    }

    // 3×3 mean filter (wrap) then multiply by (1 - decay).
    diffuseDecay(decay) {
      const W = this.W, H = this.H, src = this.trail, dst = this.trail2;
      const keep = 1 - decay;
      for (let y = 0; y < H; y++) {
        const yU = (y - 1 + H) % H, yD = (y + 1) % H;
        const r0 = yU * W, r1 = y * W, r2 = yD * W;
        for (let x = 0; x < W; x++) {
          const xL = (x - 1 + W) % W, xR = (x + 1) % W;
          const s =
            src[r0 + xL] + src[r0 + x] + src[r0 + xR] +
            src[r1 + xL] + src[r1 + x] + src[r1 + xR] +
            src[r2 + xL] + src[r2 + x] + src[r2 + xR];
          dst[r1 + x] = (s / 9) * keep;
        }
      }
      // swap buffers
      this.trail = dst; this.trail2 = src;
    }

    // Drop a soft blob of trail under the pointer to attract nearby agents.
    paintAt(p) {
      const cx = Math.floor(p.nx * this.W);
      const cy = Math.floor(p.ny * this.H);
      const r = 6;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const x = ((cx + dx) % this.W + this.W) % this.W;
          const y = ((cy + dy) % this.H + this.H) % this.H;
          this.trail[y * this.W + x] += DEPOSIT * 4;
        }
      }
      if (!this.running) this._renderOnce();
    }

    draw(ctx, w, h) {
      const { trail, img } = this;
      if (!img) return; // headless / no canvas: rendering is a no-op
      const data = img.data;
      for (let i = 0; i < trail.length; i++) {
        // tanh-like soft compression so bright veins don't clip too hard
        const t = 1 - 1 / (1 + trail[i] * 0.25);
        const c = ramp(t);
        const j = i << 2;
        data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2]; data[j + 3] = 255;
      }
      this._blit(ctx, w, h);
    }

    _blit(ctx, w, h) {
      if (!this._off || this._off.width !== this.W || this._off.height !== this.H) {
        this._off = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (this._off) { this._off.width = this.W; this._off.height = this.H; }
        this._offCtx = this._off ? this._off.getContext('2d') : null;
      }
      if (!this._offCtx) return; // headless: no-op
      this._offCtx.putImageData(this.img, 0, 0);
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this._off, 0, 0, this.W, this.H, 0, 0, w, h);
    }
  }

  // dark slate (no trail) → teal (mid) → amber (strong vein). Returns [r,g,b].
  function ramp(t) {
    if (t < 0.5) {
      const u = t / 0.5;                 // 0..1 : background → teal
      return [
        Math.round(6 + u * (20 - 6)),
        Math.round(8 + u * (120 - 8)),
        Math.round(12 + u * (128 - 12))
      ];
    }
    const u = (t - 0.5) / 0.5;           // 0..1 : teal → amber
    return [
      Math.round(20 + u * (245 - 20)),
      Math.round(120 + u * (190 - 120)),
      Math.round(128 + u * (60 - 128))
    ];
  }

  // ---- mount + controls ----
  const sim = new SlimeMold('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.seedAgents(sim.n); sim.trail.fill(0); sim._renderOnce(); } });

  sim.slider('sensorAngle', { min: 5, max: 90, step: 2.5, value: 22.5,
    fmt: v => v + '°' });
  sim.slider('rotateAngle', { min: 5, max: 90, step: 2.5, value: 45,
    fmt: v => v + '°' });
  sim.slider('sensorDist', { min: 3, max: 24, step: 1, value: 9,
    fmt: v => v + ' px' });
  sim.slider('decay', { min: 0.0, max: 0.3, step: 0.01, value: 0.1,
    fmt: v => v.toFixed(2) });
  sim.slider('agents', { min: 500, max: 8000, step: 250, value: 4000,
    fmt: v => v + '', onInput: v => { sim.seedAgents(Math.round(v)); if (!sim.running) sim._renderOnce(); } });
  sim.slider('speed', { min: 1, max: 6, step: 1, value: 1, fmt: v => v + ' steps',
    onInput: v => { sim.stepsPerFrame = Math.round(v); } });

  // Drag to deposit a blob of trail the colony grows toward.
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p);
  });

  sim.readout(s => `${s.n} agents  ·  mean trail ${s.meanTrail.toFixed(2)}  ·  ${s.W}×${s.H}`);
})();
