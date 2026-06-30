/* Conway's Game of Life — B3/S23 on a toroidal grid.
 * Extends Atlas.Sim. Click or drag to paint cells; choose seed patterns;
 * tune speed and randomization density. Live cells are colored by age, from
 * fresh (teal) to long-lived (amber), so the eye can read the dynamics. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 6; // logical pixels per cell

  class Life extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.gen = 0;
      this._acc = 0;
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      const n = this.cols * this.rows;
      this.cur = new Uint8Array(n);
      this.nxt = new Uint8Array(n);
      this.age = new Uint16Array(n);
      this.gen = 0;
      this._acc = 0;
      this.population = 0;
      const seed = (this.params && this.params.seed) || 'glider-gun';
      this.applySeed(seed);
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    applySeed(kind) {
      this.cur.fill(0); this.age.fill(0); this.gen = 0;
      if (kind === 'random') {
        const d = (this.params && this.params.density) || 0.28;
        for (let i = 0; i < this.cur.length; i++) this.cur[i] = Math.random() < d ? 1 : 0;
      } else if (kind === 'glider-gun') {
        this.stamp(GLIDER_GUN, 2, 2);
      } else if (kind === 'pulsar') {
        this.stamp(PULSAR, (this.cols >> 1) - 6, (this.rows >> 1) - 6);
      } else if (kind === 'pentadecathlon') {
        this.stampCentered(PENTADECATHLON);
      } else if (kind === 'glider') {
        this.stamp(GLIDER, 3, 3);
      } else if (kind === 'lwss') {
        this.stamp(LWSS, 3, this.rows >> 1);
      } else if (kind === 'r-pentomino') {
        this.stampCentered(R_PENTOMINO);
      } else if (kind === 'acorn') {
        this.stampCentered(ACORN);
      } else if (kind === 'diehard') {
        this.stampCentered(DIEHARD);
      } else if (kind === 'empty') {
        /* leave blank — paint by hand */
      }
      this.recount();
    }

    stamp(cells, ox, oy) {
      for (const [x, y] of cells) {
        const cx = (ox + x) % this.cols, cy = (oy + y) % this.rows;
        if (cx >= 0 && cy >= 0) this.cur[this.idx(cx, cy)] = 1;
      }
    }

    // Center a pattern on the grid (used for the small methuselahs/oscillators).
    stampCentered(cells) {
      let mx = 0, my = 0;
      for (const [x, y] of cells) { if (x > mx) mx = x; if (y > my) my = y; }
      this.stamp(cells, (this.cols - mx) >> 1, (this.rows - my) >> 1);
    }

    recount() {
      let p = 0;
      for (let i = 0; i < this.cur.length; i++) if (this.cur[i]) p++;
      this.population = p;
    }

    step() {
      // Throttle generations by the speed slider (1 slow … 10 every frame).
      this._acc += (this.params.speed ?? 6);
      if (this._acc < 10) return;
      this._acc -= 10;
      this.generation();
    }

    generation() {
      const { cols, rows, cur, nxt, age } = this;
      let pop = 0;
      for (let y = 0; y < rows; y++) {
        const yU = (y - 1 + rows) % rows, yD = (y + 1) % rows;
        for (let x = 0; x < cols; x++) {
          const xL = (x - 1 + cols) % cols, xR = (x + 1) % cols;
          const n =
            cur[yU * cols + xL] + cur[yU * cols + x] + cur[yU * cols + xR] +
            cur[y  * cols + xL] +                       cur[y  * cols + xR] +
            cur[yD * cols + xL] + cur[yD * cols + x] + cur[yD * cols + xR];
          const i = y * cols + x;
          const alive = cur[i];
          const live = alive ? (n === 2 || n === 3) : (n === 3);
          nxt[i] = live ? 1 : 0;
          if (live) { age[i] = alive ? Math.min(age[i] + 1, 600) : 0; pop++; }
          else age[i] = 0;
        }
      }
      this.cur.set(nxt);
      this.population = pop;
      this.gen++;
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { cols, rows, cur, age } = this;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (!cur[i]) continue;
          ctx.fillStyle = ageColor(age[i]);
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
    }

    paintAt(p, value) {
      const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const i = this.idx(x, y);
      this.cur[i] = value; this.age[i] = 0;
      if (!this.running) this._renderOnce();
    }
  }

  // age → warm gradient: teal (new) → amber → ember (old)
  function ageColor(a) {
    const t = Math.min(a / 80, 1);
    const r = Math.round(127 + t * (224 - 127));
    const g = Math.round(209 - t * (209 - 140));
    const b = Math.round(193 - t * (193 - 80));
    return `rgb(${r},${g},${b})`;
  }

  // Gosper glider gun (Bill Gosper, 1970) — emits a glider every 30 generations.
  const GLIDER_GUN = [
    [0,4],[0,5],[1,4],[1,5],
    [10,4],[10,5],[10,6],[11,3],[11,7],[12,2],[12,8],[13,2],[13,8],[14,5],
    [15,3],[15,7],[16,4],[16,5],[16,6],[17,5],
    [20,2],[20,3],[20,4],[21,2],[21,3],[21,4],[22,1],[22,5],[24,0],[24,1],[24,5],[24,6],
    [34,2],[34,3],[35,2],[35,3]
  ];
  // Pulsar — period-3 oscillator, the most common of its period.
  const PULSAR = [
    [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
    [0,2],[5,2],[7,2],[12,2],[0,3],[5,3],[7,3],[12,3],[0,4],[5,4],[7,4],[12,4],
    [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],[2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
    [0,8],[5,8],[7,8],[12,8],[0,9],[5,9],[7,9],[12,9],[0,10],[5,10],[7,10],[12,10],
    [2,12],[3,12],[4,12],[8,12],[9,12],[10,12]
  ];
  // The glider — the smallest spaceship; walks diagonally forever.
  const GLIDER = [[1,0],[2,1],[0,2],[1,2],[2,2]];
  // Lightweight spaceship (LWSS) — travels horizontally.
  const LWSS = [[1,0],[4,0],[0,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3]];
  // Pentadecathlon — a period-15 oscillator.
  const PENTADECATHLON = [
    [2,0],[7,0],
    [0,1],[1,1],[3,1],[4,1],[5,1],[6,1],[8,1],[9,1],
    [2,2],[7,2]
  ];
  // R-pentomino — a famous methuselah: 5 cells that churn for 1,103 generations.
  const R_PENTOMINO = [[1,0],[2,0],[0,1],[1,1],[1,2]];
  // Acorn — 7 cells that erupt for over 5,000 generations.
  const ACORN = [[1,0],[3,1],[0,2],[1,2],[4,2],[5,2],[6,2]];
  // Diehard — 7 cells that vanish completely after 130 generations.
  const DIEHARD = [[6,0],[0,1],[1,1],[1,2],[5,2],[6,2],[7,2]];

  // ---- mount + controls ----
  const sim = new Life('#stage');
  sim.start();

  sim.standardRail();
  sim.select('seed', [
    { value: 'glider-gun', label: 'Gosper glider gun' },
    { value: 'glider', label: 'Glider' },
    { value: 'lwss', label: 'Lightweight spaceship' },
    { value: 'pulsar', label: 'Pulsar (period 3)' },
    { value: 'pentadecathlon', label: 'Pentadecathlon (period 15)' },
    { value: 'r-pentomino', label: 'R-pentomino (methuselah)' },
    { value: 'acorn', label: 'Acorn (methuselah)' },
    { value: 'diehard', label: 'Diehard (vanishes)' },
    { value: 'random', label: 'Random soup' },
    { value: 'empty', label: 'Empty (paint it)' }
  ], { value: 'glider-gun', onChange: v => { sim.applySeed(v); sim.recount(); sim._renderOnce(); } });
  sim.slider('speed', { min: 1, max: 10, step: 1, value: 6, fmt: v => v + '×' });
  sim.slider('density', { min: 0.05, max: 0.6, step: 0.01, value: 0.28,
    fmt: v => Math.round(v * 100) + '%' });

  // paint cells with the pointer
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p, 1);
  });

  sim.readout(s => `gen ${s.gen}  ·  pop ${s.population}  ·  ${s.cols}×${s.rows}`);
})();
