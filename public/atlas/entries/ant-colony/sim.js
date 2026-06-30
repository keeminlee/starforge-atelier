/* Ant-colony foraging by stigmergy — the classic two-pheromone agent model.
 * Extends Atlas.Sim. A NEST and one or more FOOD sources sit on a grid. Many
 * ants wander; each carries a position, a heading, and a state:
 *
 *   SEARCHING — looking for food. Deposits HOME pheromone (marking the way back
 *               to the nest) and steers up the FOOD-pheromone gradient.
 *   RETURNING — carrying food back to the nest. Deposits FOOD pheromone (marking
 *               the way to food) and steers up the HOME-pheromone gradient.
 *
 * Two Float32Array fields (homePhero, foodPhero) both EVAPORATE every step
 * (multiply by <1) so stale/long trails fade and reinforced ones dominate.
 *
 * No ant knows the map. Coordination happens only through traces left in the
 * shared environment — *stigmergy* (Grassé 1959). Stable pheromone trails
 * condense between nest and food; the nearer/easier route accumulates a stronger
 * trail, so efficient paths emerge from purely local deposits.
 *
 * This is the *style* of ant trail-laying, an idealized agent model, not a
 * biological simulation (see notes.md). Companion to the slime-mould entry: that
 * model has no goals (pure sensor-follow trails); here ants have an explicit
 * nest and food and form goal-directed, shortest-ish trails between them. */
(function () {
  'use strict';
  const { Sim, clamp, rand, TAU } = Atlas;

  const CELL = 3;           // logical pixels per pheromone-field cell
  const STEP = 1.0;         // ant move distance per step (in field cells)
  const SENSE = 3.0;        // sensor offset ahead (field cells)
  const SENSE_ANG = 0.5;    // half-angle between the three forward sensors (rad)
  const NEST_R = 5;         // nest radius (cells)
  const FOOD_R = 4;         // food radius (cells)

  class AntColony extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.65, stepsPerFrame: 1 });
      this.delivered = 0;     // food parcels delivered to the nest (test hook)
      this._depositOn = true; // test hook: lets evaporation be isolated
    }

    setup() {
      this.cols = Math.max(8, Math.floor(this.width / CELL));
      this.rows = Math.max(8, Math.floor(this.height / CELL));
      const cells = this.cols * this.rows;
      this.homePhero = new Float32Array(cells);
      this.foodPhero = new Float32Array(cells);
      const made = this.ctx.createImageData ? this.ctx.createImageData(this.cols, this.rows) : null;
      this.img = (made && made.data) ? made : null;

      // Nest in the centre; food blobs out near the edges.
      this.nest = { x: this.cols * 0.5, y: this.rows * 0.5 };
      this.food = [];
      this.addFood(this.cols * 0.18, this.rows * 0.24);
      this.addFood(this.cols * 0.83, this.rows * 0.30);
      this.addFood(this.cols * 0.62, this.rows * 0.82);

      this.delivered = 0;
      this.seedAnts(Math.round((this.params && this.params.ants) || 500));
    }

    onResize() { this.setup(); }

    addFood(x, y) {
      this.food.push({ x: clamp(x, 1, this.cols - 2), y: clamp(y, 1, this.rows - 2), amount: 1 });
    }

    // (Re)seed n ants, all starting at the nest facing random directions.
    seedAnts(n) {
      this.ax = new Float32Array(n);   // position x (cells)
      this.ay = new Float32Array(n);   // position y (cells)
      this.ah = new Float32Array(n);   // heading (radians)
      this.as = new Uint8Array(n);     // state: 0 = SEARCHING, 1 = RETURNING
      for (let i = 0; i < n; i++) {
        this.ax[i] = this.nest.x;
        this.ay[i] = this.nest.y;
        this.ah[i] = rand(TAU);
        this.as[i] = 0;
      }
      this.n = n;
    }

    // Clamped (non-wrapping) field sample. The world has walls, not a torus,
    // so ants reflect off edges rather than teleport across them.
    sample(field, x, y) {
      const C = this.cols, R = this.rows;
      let xi = x | 0, yi = y | 0;
      if (xi < 0) xi = 0; else if (xi >= C) xi = C - 1;
      if (yi < 0) yi = 0; else if (yi >= R) yi = R - 1;
      return field[yi * C + xi];
    }

    step() {
      const C = this.cols, R = this.rows, n = this.n;
      const evap = clamp(this.params.evaporation ?? 0.04, 0.001, 0.3);
      const deposit = this._depositOn ? (this.params.deposit ?? 1.2) : 0;
      const wander = clamp(this.params.randomness ?? 0.35, 0, 1.2);
      const home = this.homePhero, food = this.foodPhero;
      const { ax, ay, ah, as } = this;

      for (let i = 0; i < n; i++) {
        const searching = as[i] === 0;
        // SEARCHING ants follow foodPhero (toward food); RETURNING follow homePhero.
        const guide = searching ? food : home;

        const a = ah[i], x = ax[i], y = ay[i];
        // three sensors ahead: front-left, front, front-right
        const cx = x + Math.cos(a) * SENSE,            cy = y + Math.sin(a) * SENSE;
        const lx = x + Math.cos(a - SENSE_ANG) * SENSE, ly = y + Math.sin(a - SENSE_ANG) * SENSE;
        const rx = x + Math.cos(a + SENSE_ANG) * SENSE, ry = y + Math.sin(a + SENSE_ANG) * SENSE;
        const fC = this.sample(guide, cx, cy);
        const fL = this.sample(guide, lx, ly);
        const fR = this.sample(guide, rx, ry);

        let na = a;
        // Steer toward the strongest-smelling sensor, but keep exploring.
        const maxF = fC > fL ? (fC > fR ? fC : fR) : (fL > fR ? fL : fR);
        if (maxF > 0.02) {
          // There IS a trail to follow → climb its gradient.
          if (fC >= fL && fC >= fR) {
            // front strongest → mostly straight
          } else if (fL > fR) {
            na = a - SENSE_ANG;
          } else {
            na = a + SENSE_ANG;
          }
        } else if (!searching) {
          // RETURNING ant with no home-trail nearby → head straight for the nest
          // so food reliably gets delivered even before a trail forms.
          const tx = this.nest.x - x, ty = this.nest.y - y;
          if (tx * tx + ty * ty > 1) {
            const want = Math.atan2(ty, tx);
            let d = want - a;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            na = a + d * 0.5;
          }
        }
        // SEARCHING ants with no food-trail just do the correlated random walk
        // below — a true undirected search. (No outward drive: it would pin them
        // against the walls and they'd never circle back to the food.)
        // always add some random jitter so trails explore and don't lock up
        na += rand(-wander, wander);

        let nx = x + Math.cos(na) * STEP;
        let ny = y + Math.sin(na) * STEP;

        // Reflect off walls (keep ants in-bounds, conserve the count).
        if (nx < 0.5)      { nx = 0.5;      na = Math.PI - na; }
        else if (nx > C - 1.5) { nx = C - 1.5; na = Math.PI - na; }
        if (ny < 0.5)      { ny = 0.5;      na = -na; }
        else if (ny > R - 1.5) { ny = R - 1.5; na = -na; }

        ax[i] = nx; ay[i] = ny; ah[i] = na;

        const xi = nx | 0, yi = ny | 0;
        const idx = yi * C + xi;

        // Deposit on the field that records where this ant has just BEEN:
        //   searching ants came from the nest → lay HOME pheromone;
        //   returning ants came from food     → lay FOOD pheromone.
        if (deposit) {
          // Returning ants lay a stronger food trail so the route to food
          // persists against evaporation and reliably recruits more searchers.
          if (searching) home[idx] += deposit;
          else food[idx] += deposit * 2.0;
        }

        // Reached food? A searcher picks up and flips to RETURNING, turning around.
        if (searching) {
          for (let f = 0; f < this.food.length; f++) {
            const fd = this.food[f];
            if (fd.amount <= 0) continue;
            const dx = nx - fd.x, dy = ny - fd.y;
            if (dx * dx + dy * dy <= FOOD_R * FOOD_R) {
              as[i] = 1;
              ah[i] = na + Math.PI;       // about-face toward home
              break;
            }
          }
        } else {
          // Reached the nest? Deliver, flip back to SEARCHING, turn around.
          const dx = nx - this.nest.x, dy = ny - this.nest.y;
          if (dx * dx + dy * dy <= NEST_R * NEST_R) {
            as[i] = 0;
            ah[i] = na + Math.PI;
            this.delivered++;
          }
        }
      }

      // Evaporate both fields. keep = 1 - evap. This is the engine of the model:
      // it lets stale and long trails fade so shorter/fresher ones dominate.
      const keep = 1 - evap;
      for (let i = 0; i < home.length; i++) { home[i] *= keep; food[i] *= keep; }
    }

    // Total pheromone across both fields — a sense of overall trail strength.
    trailTotal() {
      let s = 0;
      const home = this.homePhero, food = this.foodPhero;
      for (let i = 0; i < home.length; i++) s += home[i] + food[i];
      return s;
    }

    // Drop a new food source where the user clicks.
    dropFood(p) {
      const x = clamp(p.nx * this.cols, 1, this.cols - 2);
      const y = clamp(p.ny * this.rows, 1, this.rows - 2);
      this.addFood(x, y);
      if (!this.running) this._renderOnce();
    }

    draw(ctx, w, h) {
      const { img, homePhero, food } = this;
      if (!img) return; // headless: no-op
      const data = img.data;
      const foodPhero = this.foodPhero;
      for (let i = 0; i < homePhero.length; i++) {
        // soft compression so bright trails don't clip too hard
        const th = 1 - 1 / (1 + homePhero[i] * 0.18);  // home trail (teal)
        const tf = 1 - 1 / (1 + foodPhero[i] * 0.18);  // food trail (amber)
        const j = i << 2;
        // dark base + additive teal (home) + amber (food)
        data[j]     = clamp(8  + tf * 235 + th * 18,  0, 255); // R
        data[j + 1] = clamp(10 + tf * 150 + th * 130, 0, 255); // G
        data[j + 2] = clamp(14 + tf * 40  + th * 140, 0, 255); // B
        data[j + 3] = 255;
        void food;
      }
      this._blit(ctx, w, h);

      // Markers in CSS pixels over the upscaled field.
      const sx = w / this.cols, sy = h / this.rows;

      // Food sources — bright green squares, shrinking is not modelled (infinite),
      // but we draw a clear distinct marker.
      ctx.lineWidth = 2;
      for (const fd of this.food) {
        ctx.fillStyle = '#7CFFB0';
        ctx.strokeStyle = '#0a3a22';
        const r = FOOD_R * sx;
        ctx.beginPath();
        ctx.arc(fd.x * sx, fd.y * sy, r, 0, TAU);
        ctx.fill(); ctx.stroke();
      }

      // Nest — a clear ringed marker.
      ctx.fillStyle = '#ffd27a';
      ctx.strokeStyle = '#5a3a08';
      ctx.beginPath();
      ctx.arc(this.nest.x * sx, this.nest.y * sy, NEST_R * sx, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a2606';
      ctx.beginPath();
      ctx.arc(this.nest.x * sx, this.nest.y * sy, NEST_R * sx * 0.45, 0, TAU);
      ctx.fill();

      // Ants — tiny dots, coloured by state.
      const { ax, ay, as, n } = this;
      const dot = Math.max(1.2, sx * 0.6);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = as[i] === 0 ? 'rgba(220,235,255,0.9)' : 'rgba(255,170,70,0.95)';
        ctx.fillRect(ax[i] * sx - dot * 0.5, ay[i] * sy - dot * 0.5, dot, dot);
      }
    }

    _blit(ctx, w, h) {
      if (!this._off || this._off.width !== this.cols || this._off.height !== this.rows) {
        this._off = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (this._off) { this._off.width = this.cols; this._off.height = this.rows; }
        this._offCtx = this._off ? this._off.getContext('2d') : null;
      }
      if (!this._offCtx) return; // headless: no-op
      this._offCtx.putImageData(this.img, 0, 0);
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this._off, 0, 0, this.cols, this.rows, 0, 0, w, h);
    }
  }

  // ---- mount + controls ----
  const sim = new AntColony('#stage');
  sim.start();

  // randomize: re-seed ants + clear pheromone, keep nest/food.
  sim.standardRail({ randomize: () => {
    sim.seedAnts(sim.n);
    sim.homePhero.fill(0); sim.foodPhero.fill(0);
    sim.delivered = 0;
    sim._renderOnce();
  } });

  sim.slider('ants', { min: 100, max: 900, step: 50, value: 500, fmt: v => v + '',
    onInput: v => { sim.seedAnts(Math.round(v)); sim.homePhero.fill(0); sim.foodPhero.fill(0); sim.delivered = 0; if (!sim.running) sim._renderOnce(); } });
  sim.slider('evaporation', { min: 0.005, max: 0.15, step: 0.005, value: 0.04,
    fmt: v => v.toFixed(3) });
  sim.slider('deposit', { min: 0.3, max: 3, step: 0.1, value: 1.2,
    fmt: v => v.toFixed(1) });
  sim.slider('randomness', { min: 0.05, max: 1.0, step: 0.05, value: 0.35,
    fmt: v => v.toFixed(2) });
  sim.slider('speed', { min: 1, max: 6, step: 1, value: 2, fmt: v => v + ' steps',
    onInput: v => { sim.stepsPerFrame = Math.round(v); } });
  sim.stepsPerFrame = 2;

  // Click to drop a new food source.
  sim.onPointer((type, p) => { if (type === 'down') sim.dropFood(p); });

  sim.readout(s =>
    `${s.n} ants  ·  delivered ${s.delivered}  ·  trail ${(s.trailTotal() / 1000).toFixed(1)}k  ·  ${s.cols}×${s.rows}`);
})();
