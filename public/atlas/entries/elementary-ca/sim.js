/* Elementary Cellular Automata — Wolfram's 256-rule, 1D universe.
 *
 * A single row of binary cells (Uint8Array, toroidal wrap). Each generation,
 * a cell's next state is a function of THREE inputs — its left neighbor, itself,
 * and its right neighbor:
 *
 *     (l, c, r)  →  index = l*4 + c*2 + r   ∈ {0..7}
 *     newState   =  bit `index` of the rule number (0..255)
 *
 * There are 8 possible neighborhoods, so the lookup table is 8 bits → a single
 * "rule number" 0..255 names the entire automaton (Wolfram numbering). Rule 30
 * is chaotic; rule 90 is the Sierpiński XOR (l XOR r); rule 110 is proven
 * Turing-complete (Cook 2004); rule 184 is the minimal traffic model.
 *
 * Visualization: a SPACE-TIME DIAGRAM. Row 0 (top) is the initial condition;
 * each new generation is drawn one row down. When the canvas fills, we scroll
 * the ImageData buffer up by one row and paint the newest generation along the
 * bottom — the same scrolling technique used by the traffic entry. The classic
 * triangular / fractal / chaotic textures accrete as it runs. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  // Wolfram class labels for the rules we surface (best-known classification).
  const KNOWN_CLASS = {
    0: 'I (uniform)', 250: 'I/II (uniform fill)', 255: 'I (uniform)',
    90: 'III (fractal / Sierpiński)', 30: 'III (chaos)', 150: 'III (XOR-3)',
    110: 'IV (complex / universal)', 54: 'IV (complex)', 184: 'II (traffic)',
  };

  class ElementaryCA extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.62 });
      this.cols = 0;
      this.row = null;        // Uint8Array: current generation
      this._next = null;
      this.rule = 90;
      this.generation = 0;
      this._img = null;       // ImageData for the scrolling diagram
      this._rng = mulberry32(0x1234abcd);
    }

    setup() {
      // One cell per ~CELL logical pixels of width; a few hundred cells fit.
      const CELL = 3;
      this.cols = Math.max(64, Math.floor(this.width / CELL));
      this.row = new Uint8Array(this.cols);
      this._next = new Uint8Array(this.cols);
      this.rule = (this.params && this.params.rule != null)
        ? (this.params.rule | 0) : this.rule;
      this.seedRow();
      this._initDiagram();
    }

    onResize() { this.setup(); }

    // deterministic RNG control for tests / reproducible "Random" rows
    seedRng(s) { this._rng = mulberry32(s >>> 0); }

    // Build the initial generation (row 0) per the chosen initial condition.
    seedRow() {
      const init = (this.params && this.params.init) || 'single';
      this.row.fill(0);
      if (init === 'random') {
        for (let i = 0; i < this.cols; i++) this.row[i] = this._rng() < 0.5 ? 1 : 0;
      } else {
        // single live cell in the center → the classic clean triangles
        this.row[this.cols >> 1] = 1;
      }
      this.generation = 0;
    }

    // ---- the rule ----
    // bit `n` (0..7) of the rule number = output for neighborhood index n.
    ruleBit(neighborhood) { return (this.rule >> (neighborhood & 7)) & 1; }
    // new state for the (left, center, right) triple.
    nextState(l, c, r) { return this.ruleBit((l << 2) | (c << 1) | r); }

    // The rule's 8-bit output pattern as a binary string (MSB = neighborhood 7
    // = 111, LSB = neighborhood 0 = 000), e.g. rule 110 → "01101110".
    ruleBits() {
      let s = '';
      for (let n = 7; n >= 0; n--) s += this.ruleBit(n);
      return s;
    }

    // Compute the next generation from `src` into `dst` (toroidal wrap).
    computeNextRow(src, dst) {
      const n = this.cols;
      for (let i = 0; i < n; i++) {
        const l = src[(i - 1 + n) % n];
        const c = src[i];
        const r = src[(i + 1) % n];
        dst[i] = this.nextState(l, c, r);
      }
      return dst;
    }

    step() {
      this.computeNextRow(this.row, this._next);
      const tmp = this.row; this.row = this._next; this._next = tmp;
      this.generation++;
      this._pushDiagramRow();
    }

    // Restart the diagram from a fresh first row (rule / init / randomize change).
    restart() {
      this.seedRow();
      this._initDiagram();
      if (!this.running) this._renderOnce();
    }

    // ---- space-time diagram (scrolling ImageData, native cols×rows) ----
    _initDiagram() {
      const w = Math.max(1, this.cols);
      const rows = Math.max(16, Math.round(this.height / (this.width / this.cols)));
      this._stRows = rows;
      this._stFilled = 0;       // how many rows have real data yet
      if (this.ctx && this.ctx.createImageData) {
        try { this._img = this.ctx.createImageData(w, rows); }
        catch (e) { this._img = null; }
      } else this._img = null;
      if (this._img) {
        const d = this._img.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = BG[0]; d[i + 1] = BG[1]; d[i + 2] = BG[2]; d[i + 3] = 255;
        }
        // paint the initial condition (row 0) into the top row
        this._paintRowAt(0, this.row);
        this._stFilled = 1;
      }
    }

    _paintRowAt(rowIndex, cells) {
      const img = this._img;
      if (!img) return;
      const w = img.width, d = img.data;
      const base = rowIndex * w * 4;
      for (let x = 0; x < w; x++) {
        const o = base + x * 4;
        const c = cells[x] ? LIVE : BG;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }

    _pushDiagramRow() {
      const img = this._img;
      if (!img) return;
      const w = img.width, h = img.height, d = img.data;
      const rowBytes = w * 4;
      if (this._stFilled < h) {
        // still filling downward — draw newest generation at the next free row
        this._paintRowAt(this._stFilled, this.row);
        this._stFilled++;
      } else {
        // full: scroll up by one row, paint newest at the bottom
        d.copyWithin(0, rowBytes, h * rowBytes);
        this._paintRowAt(h - 1, this.row);
      }
    }

    draw(ctx, w, h) {
      ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
      ctx.fillRect(0, 0, w, h);
      if (this._img) {
        const off = this._offscreen();
        off.ctx.putImageData(this._img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off.canvas, 0, 0, this._img.width, this._img.height, 0, 0, w, h);
      }
    }

    _offscreen() {
      if (!this._off || this._off.canvas.width !== this._img.width ||
          this._off.canvas.height !== this._img.height) {
        const canvas = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (canvas) {
          canvas.width = this._img.width; canvas.height = this._img.height;
          this._off = { canvas, ctx: canvas.getContext('2d') };
        } else {
          this._off = { canvas: { width: this._img.width, height: this._img.height },
            ctx: { putImageData() {} } };
        }
      }
      return this._off;
    }

    classOf() { return KNOWN_CLASS[this.rule] || null; }
  }

  // live = light teal on a near-black background (light-on-dark classic look)
  const LIVE = [120, 226, 209];
  const BG = [8, 10, 13];

  // small deterministic PRNG so "Random" init + tests are reproducible
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- mount + controls ----
  const sim = new ElementaryCA('#stage');
  sim.start();

  const FAMOUS = [
    { value: '90', label: 'Rule 90 (Sierpiński)' },
    { value: '30', label: 'Rule 30 (chaos)' },
    { value: '110', label: 'Rule 110 (complex / universal)' },
    { value: '184', label: 'Rule 184 (traffic)' },
    { value: '250', label: 'Rule 250 (uniform)' },
    { value: '54', label: 'Rule 54 (class IV)' },
    { value: '150', label: 'Rule 150 (XOR-3)' },
  ];

  sim.standardRail({ randomize: () => { sim.seedRng((Math.random() * 2 ** 32) >>> 0); sim.restart(); } });

  // THE dial: the rule number.
  const ruleSlider = sim.slider('rule', {
    min: 0, max: 255, step: 1, value: 90,
    fmt: v => (v | 0) + '',
    onInput: v => { sim.rule = v | 0; sim.restart(); },
  });
  sim.rule = 90;

  // set the rule from a preset: sync the slider widget + params, then restart.
  function setRule(r) {
    r = r | 0;
    sim.params.rule = r;
    sim.rule = r;
    ruleSlider.value = String(r);
    // keep the slider's visible value label in sync
    const valSpan = ruleSlider.parentNode &&
      ruleSlider.parentNode.querySelector('.val');
    if (valSpan) valSpan.textContent = String(r);
    sim.restart();
  }

  // famous-rule presets drive the rule (and thus a restart)
  sim.select('famous rule', FAMOUS, {
    value: '90',
    onChange: v => setRule(parseInt(v, 10)),
  });

  sim.select('initial', [
    { value: 'single', label: 'Single cell' },
    { value: 'random', label: 'Random' },
  ], { value: 'single', onChange: () => sim.restart() });

  sim.slider('speed', { min: 1, max: 8, step: 1, value: 2, fmt: v => v + ' rows/frame',
    onInput: v => { sim.stepsPerFrame = v; } });
  sim.stepsPerFrame = 2;

  sim.readout(s => {
    const cls = s.classOf();
    return `rule ${s.rule}  ·  ${s.ruleBits()}  ·  gen ${s.generation}` +
      (cls ? `  ·  class ${cls}` : '');
  });
})();
