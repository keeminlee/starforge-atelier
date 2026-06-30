/* Pedestrian Lanes — Helbing & Molnár's social-force model (1995).
 * Extends Atlas.Sim. Pedestrians are particles in a 2D corridor that is periodic
 * in x (walk off one end, reappear at the other) and walled top and bottom. There
 * are TWO groups: one wants to go RIGHT (+x), the other LEFT (−x). Each pedestrian
 * just steers toward its own goal at a comfortable speed and pushes gently away
 * from anyone too close. There is NO alignment, no copying of headings (contrast
 * boids/vicsek) — yet within seconds the intermixed crowd self-organizes into
 * horizontal LANES, each almost all one direction, because tucking in behind
 * someone going your way is cheaper than fighting head-on. The lanes are pure
 * self-organization, and they raise everyone's flow.
 *
 * Each step integrates the social force on pedestrian i:
 *   • Driving (goal):  (v0·e_i − v_i)/τ   — relax toward the desired velocity.
 *   • Pedestrian repulsion from each nearby j:
 *         A·exp((r_ij − d_ij)/B) · n_ij · w(φ)
 *     with d_ij = centre distance, r_ij = sum of radii, n_ij = unit j→i, and an
 *     optional anisotropy w(φ) = λ + (1−λ)(1+cosφ)/2 that weakens the push from
 *     people behind you (sharpens lane formation). Only neighbours within ~4B sum.
 *   • Wall repulsion: same exponential form from the top and bottom walls.
 * Velocity is clamped to ~1.3·v0; x wraps periodically; y is kept inside the walls.
 *
 * A "Bottleneck" scene funnels both groups through a gap in a central wall, where
 * the crowd arches and clogs — and pushing harder (higher v0) can make the flow
 * DROP, the famous "faster-is-slower" effect.
 *
 * No external deps; vanilla ES + Canvas. */
(function () {
  'use strict';
  const { Sim, clamp, TAU } = Atlas;

  // World scale: 1 metre ≈ this many pixels (so corridor maths reads in metres).
  const PX = 16;
  const RADIUS = 0.22 * PX;   // pedestrian radius r_i (≈0.22 m → shoulder ~0.44 m)
  const TAU_RELAX = 0.5;      // τ, relaxation time of the driving force (s)
  const DT = 0.08;            // integration timestep (s) — small for stability
  const B_PED = 0.45 * PX;    // range B of pedestrian repulsion (m); a touch longer
                              // than Helbing's 0.3 m so walkers anticipate and
                              // deflect early — this is what lets lanes form.
  const B_WALL = 0.20 * PX;   // range of wall repulsion (m)
  const A_WALL = 9.0;         // wall force scale (strong; keeps people in corridor)
  const NEIGH = 4 * B_PED;    // only sum neighbours within ~4B (force is tiny beyond)
  const LAMBDA = 0.20;        // anisotropy: 1 = isotropic, <1 = weaker behind you
  const MARGIN = 0.10 * PX;   // wall-padding for spawning / clamping

  class Pedestrians extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.46, stepsPerFrame: 4 });
      this._order = 0;
      this._flow = 0;
    }

    setup() {
      const n = Math.round((this.params && this.params.density) || 240);
      this.spawn(n);
    }

    // (Re)seed n pedestrians, intermixed, half going right (+1) and half left (−1).
    spawn(n) {
      const w = this.width, h = this.height;
      this.px = new Float32Array(n);   // position x
      this.py = new Float32Array(n);   // position y
      this.vx = new Float32Array(n);   // velocity x
      this.vy = new Float32Array(n);   // velocity y
      this.dir = new Int8Array(n);     // goal direction: +1 right, −1 left
      this.spd = new Float32Array(n);  // last speed (for streaks/colour)
      const scene = (this.params && this.params.scene) || 'corridor';
      const v0 = (this.params && this.params.v0) || 1.3;
      const top = this.wallTop(), bot = this.wallBot();
      for (let i = 0; i < n; i++) {
        this.dir[i] = (i % 2 === 0) ? 1 : -1;
        this.px[i] = this.rng() * w;
        this.py[i] = top + MARGIN + this.rng() * (bot - top - 2 * MARGIN);
        // start drifting toward the goal so it doesn't look frozen at t=0
        this.vx[i] = this.dir[i] * v0 * (0.4 + 0.4 * this.rng());
        this.vy[i] = (this.rng() - 0.5) * 0.2 * v0;
      }
      this.n = n;
      this._buildScene(scene);
      this._order = this.laneOrder();
      this._flow = 0;
    }

    // A small swappable RNG so headless tests can seed it deterministically.
    rng() { return Math.random(); }

    onResize() { if (this.params) this._buildScene(this.params.scene || 'corridor'); }

    // Corridor walls (px). The drawable corridor lives between wallTop and wallBot.
    wallTop() { return 0.06 * this.height; }
    wallBot() { return 0.94 * this.height; }

    // Build scene geometry. The bottleneck adds a central vertical wall with a gap.
    _buildScene(scene) {
      this.scene = scene;
      const w = this.width, h = this.height;
      if (scene === 'bottleneck') {
        this.gap = {
          x: w * 0.5,                 // central wall x
          half: 0.10 * this.height,   // half-height of the opening
          cy: (this.wallTop() + this.wallBot()) / 2,
          thick: 0.012 * w,
        };
      } else {
        this.gap = null;
      }
    }

    // Driving force toward the goal: relax current velocity to v0·e_i over τ.
    // Returns the desired velocity magnitude actually used (per group, with the v0
    // slider). e_i = (dir, 0).
    step() {
      const w = this.width, n = this.n;
      const px = this.px, py = this.py, vx = this.vx, vy = this.vy, dir = this.dir;
      const v0 = (this.params.v0 ?? 1.3) * PX;          // desired speed (px/s)
      const A = this.params.repulsion ?? 6.0;            // ped force scale
      const aniso = (this.params.anisotropy ?? 1) > 0.5; // anisotropy on/off
      const vmax = 1.3 * v0;
      const top = this.wallTop(), bot = this.wallBot();
      const r2 = RADIUS + RADIUS;                        // r_ij for two pedestrians
      const NEIGH2 = NEIGH * NEIGH;
      const gap = this.gap;

      // accumulators for this step
      const fx = new Float32Array(n);
      const fy = new Float32Array(n);

      // --- driving force: (v0·e_i − v_i)/τ ---
      for (let i = 0; i < n; i++) {
        fx[i] += (dir[i] * v0 - vx[i]) / TAU_RELAX;
        fy[i] += (0 - vy[i]) / TAU_RELAX;
      }

      // --- pedestrian–pedestrian repulsion (capped neighbour loop) ---
      // O(n²) but only the cheap distance check runs for far pairs; a few hundred
      // agents stay well above 55 fps. Symmetric: apply +f to i and −f to j.
      for (let i = 0; i < n; i++) {
        const xi = px[i], yi = py[i];
        for (let j = i + 1; j < n; j++) {
          let dx = xi - px[j];
          // periodic in x: take the shortest signed separation
          if (dx > w * 0.5) dx -= w; else if (dx < -w * 0.5) dx += w;
          const dy = yi - py[j];
          const d2 = dx * dx + dy * dy;
          if (d2 > NEIGH2 || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;          // unit vector j → i
          let mag = A * Math.exp((r2 - d) / B_PED); // exponential repulsion
          if (aniso) {
            // weaken the push from people BEHIND i (i's heading ≈ its velocity).
            // φ is the angle between i's motion and the direction TO j (= −n).
            let hx = vx[i], hy = vy[i];
            const hm = Math.hypot(hx, hy);
            if (hm > 1e-6) {
              hx /= hm; hy /= hm;
              const cosphi = hx * (-nx) + hy * (-ny); // toward j
              const wphi = LAMBDA + (1 - LAMBDA) * (1 + cosphi) * 0.5;
              mag *= wphi;
            }
          }
          fx[i] += mag * nx; fy[i] += mag * ny;
          // Newton's third law (use j's own anisotropy would cost a second calc;
          // the symmetric isotropic part dominates lane formation, so reuse mag).
          fx[j] -= mag * nx; fy[j] -= mag * ny;
        }
      }

      // --- wall repulsion (top & bottom; exponential in distance to the wall) ---
      for (let i = 0; i < n; i++) {
        const dTop = py[i] - top;                  // >0 inside
        const dBot = bot - py[i];
        fy[i] += A_WALL * Math.exp((RADIUS - dTop) / B_WALL);   // push down (+y)
        fy[i] -= A_WALL * Math.exp((RADIUS - dBot) / B_WALL);   // push up (−y)
      }

      // --- central bottleneck wall (two segments with a gap) ---
      if (gap) {
        const gx = gap.x, half = gap.half, cy = gap.cy;
        for (let i = 0; i < n; i++) {
          // horizontal distance to the wall plane
          let dx = px[i] - gx;
          // periodic wrap shouldn't matter near centre, but guard anyway
          if (dx > w * 0.5) dx -= w; else if (dx < -w * 0.5) dx += w;
          const inGapBand = Math.abs(py[i] - cy) < half;
          if (inGapBand) continue; // free to pass through the opening
          // nearest point on the wall is at the same y (it's a vertical wall);
          // push horizontally away from the wall plane.
          const ad = Math.abs(dx) || 1e-3;
          const sgn = dx >= 0 ? 1 : -1;
          fx[i] += sgn * A_WALL * Math.exp((RADIUS - ad) / B_WALL);
          // also nudge toward the opening so people funnel rather than pile flat
          const toGap = cy - py[i];
          const td = Math.abs(toGap) || 1e-3;
          if (ad < 0.06 * w) fy[i] += Math.sign(toGap) * A_WALL * 0.25 *
            Math.exp((half - td) / (B_WALL * 4));
        }
      }

      // --- integrate: v += f·dt (clamp speed), x += v·dt, wrap x, clamp y ---
      let speedSum = 0, flowSum = 0;
      for (let i = 0; i < n; i++) {
        let nvx = vx[i] + fx[i] * DT;
        let nvy = vy[i] + fy[i] * DT;
        const sp = Math.hypot(nvx, nvy);
        if (sp > vmax && sp > 0) { nvx = nvx / sp * vmax; nvy = nvy / sp * vmax; }
        vx[i] = nvx; vy[i] = nvy;

        let x = px[i] + nvx * DT;
        let y = py[i] + nvy * DT;
        x = ((x % w) + w) % w;
        // hard clamp keeps y inside even if the soft wall force is overwhelmed
        if (y < top + 0.5) { y = top + 0.5; if (vy[i] < 0) vy[i] = 0; }
        else if (y > bot - 0.5) { y = bot - 0.5; if (vy[i] > 0) vy[i] = 0; }
        px[i] = x; py[i] = y;

        const s = Math.hypot(vx[i], vy[i]);
        this.spd[i] = s;
        speedSum += s;
        flowSum += dir[i] * vx[i]; // forward progress along each agent's own goal
      }
      this._order = this.laneOrder();
      // average forward speed in m/s (progress toward goal), never negative-mean
      this._flow = n ? (flowSum / n) / PX : 0;
    }

    // laneOrder(): horizontal-strip polarization. Split the corridor height into
    // strips; for each strip compute |Σ dir| / Σ|dir| (1 = all one way, 0 =
    // balanced); average over strips weighted by how many people occupy them.
    // Random mix → ~0; clean lanes → →1.
    laneOrder() {
      const n = this.n;
      if (!n) return 0;
      const top = this.wallTop(), bot = this.wallBot();
      const STRIPS = 12;
      const span = (bot - top) || 1;
      const net = new Float64Array(STRIPS);
      const cnt = new Int32Array(STRIPS);
      for (let i = 0; i < n; i++) {
        let s = Math.floor(((this.py[i] - top) / span) * STRIPS);
        if (s < 0) s = 0; else if (s >= STRIPS) s = STRIPS - 1;
        net[s] += this.dir[i];
        cnt[s] += 1;
      }
      let wsum = 0, osum = 0;
      for (let s = 0; s < STRIPS; s++) {
        if (cnt[s] === 0) continue;
        const pol = Math.abs(net[s]) / cnt[s]; // Σ|dir| = cnt since |dir|=1
        osum += pol * cnt[s];
        wsum += cnt[s];
      }
      return wsum ? osum / wsum : 0;
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const top = this.wallTop(), bot = this.wallBot();

      // corridor band
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(0, top, w, bot - top);
      // walls
      ctx.strokeStyle = 'rgba(150,160,180,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, top); ctx.lineTo(w, top);
      ctx.moveTo(0, bot); ctx.lineTo(w, bot);
      ctx.stroke();

      // bottleneck wall
      if (this.gap) {
        const g = this.gap;
        ctx.fillStyle = 'rgba(150,160,180,0.42)';
        ctx.fillRect(g.x - g.thick / 2, top, g.thick, (g.cy - g.half) - top);
        ctx.fillRect(g.x - g.thick / 2, g.cy + g.half, g.thick, bot - (g.cy + g.half));
      }

      // pedestrians, coloured by goal direction (warm = right, cool = left)
      const px = this.px, py = this.py, vx = this.vx, vy = this.vy, dir = this.dir, n = this.n;
      const r = RADIUS;
      for (let i = 0; i < n; i++) {
        const right = dir[i] > 0;
        // short velocity streak
        const s = this.spd[i] || 0;
        if (s > 0.3) {
          ctx.strokeStyle = right ? 'rgba(255,165,80,0.30)' : 'rgba(80,210,205,0.30)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px[i], py[i]);
          ctx.lineTo(px[i] - vx[i] * 0.10, py[i] - vy[i] * 0.10);
          ctx.stroke();
        }
        ctx.fillStyle = right ? 'hsl(30, 95%, 60%)' : 'hsl(178, 70%, 52%)';
        ctx.beginPath();
        ctx.arc(px[i], py[i], r, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---- mount + controls ----
  const sim = new Pedestrians('#stage');
  sim.start();

  const reseed = () => { sim.spawn(sim.n); if (!sim.running) sim._renderOnce(); };

  sim.standardRail({ randomize: reseed });
  sim.select('scene', [
    { value: 'corridor', label: 'Counterflow corridor' },
    { value: 'bottleneck', label: 'Bottleneck' },
  ], { value: 'corridor', onChange: () => reseed() });
  // density — number of pedestrians; more agents → more, thinner lanes (or jams).
  sim.slider('density', { min: 60, max: 420, step: 20, value: 240, fmt: v => v + '',
    onInput: v => { sim.spawn(Math.round(v)); if (!sim.running) sim._renderOnce(); } });
  // desired speed v0 (m/s) — in the bottleneck, pushing this up can LOWER flow.
  sim.slider('v0', { min: 0.6, max: 2.4, step: 0.1, value: 1.3, fmt: v => v.toFixed(1) + ' m/s' });
  sim.slider('repulsion', { min: 6, max: 36, step: 1, value: 20, fmt: v => v.toFixed(0) });
  sim.select('anisotropy', [
    { value: '1', label: 'On (sharper lanes)' },
    { value: '0', label: 'Off (isotropic)' },
  ], { value: '1' });
  sim.slider('speed', { min: 1, max: 6, step: 1, value: 4, fmt: v => v + '×',
    onInput: v => { sim.stepsPerFrame = Math.round(v); } });

  sim.readout(s =>
    `${s.n} walkers  ·  lane order ${s._order.toFixed(2)}  ·  mean forward speed ${s._flow.toFixed(2)} m/s`);
})();
