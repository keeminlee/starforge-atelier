/* L-systems — Lindenmayer systems with turtle-graphics rendering.
 *
 * A deterministic L-system is an axiom string plus a set of rewrite rules
 * applied IN PARALLEL to every character, `iterations` times. The expanded
 * string is then read as turtle-graphics instructions:
 *   F (and other drawing letters) → move forward, drawing a segment
 *   f                              → move forward without drawing
 *   +                              → turn left by `angle`
 *   -                              → turn right by `angle`
 *   [                              → push turtle state (pos, heading, depth)
 *   ]                              → pop turtle state   (this makes branches)
 *   other letters (X, Y, A, B...)  → no turtle action (they only drive rewriting)
 *
 * This is a GENERATIVE drawing rather than a stepping dynamical system: we
 * compute the segment list once (on system/iteration change), re-run the cheap
 * turtle on angle change, and animate the *reveal* by drawing an increasing
 * slice of the precomputed segments over ~1.5 s, then hold.
 *
 * Extends Atlas.Sim. Vanilla ES + Canvas, no external deps. */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  // Classic systems: axiom, rules, default angle (deg), default iterations,
  // an iteration cap (growth-rate aware), and whether the figure is a "plant"
  // (root at bottom, initial heading up) vs a free curve (centered).
  const SYSTEMS = {
    'fractal-plant': {
      label: 'Fractal plant',
      axiom: 'X',
      rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
      angle: 25, iters: 6, maxIters: 7, plant: true,
    },
    'bushy-weed': {
      label: 'Bushy weed',
      axiom: 'F',
      rules: { F: 'FF-[-F+F+F]+[+F-F-F]' },
      angle: 22.5, iters: 4, maxIters: 5, plant: true,
    },
    'koch-snowflake': {
      label: 'Koch snowflake',
      axiom: 'F++F++F',
      rules: { F: 'F-F++F-F' },
      angle: 60, iters: 4, maxIters: 6, plant: false,
    },
    'sierpinski-arrowhead': {
      label: 'Sierpinski arrowhead',
      axiom: 'A',
      // A and B both draw forward; they differ only in rewriting.
      rules: { A: 'B-A-B', B: 'A+B+A' },
      angle: 60, iters: 6, maxIters: 9, plant: false, draws: 'AB',
    },
    'dragon-curve': {
      label: 'Dragon curve',
      axiom: 'FX',
      rules: { X: 'X+YF+', Y: '-FX-Y' },
      angle: 90, iters: 11, maxIters: 14, plant: false,
    },
  };

  // Cap the expanded string so growth can't blow up memory.
  const MAX_LEN = 350000;

  const DEG = Math.PI / 180;

  class LSystem extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.72 });
      this.segments = [];      // [{x1,y1,x2,y2,depth}]
      this.maxDepth = 1;
      this.string = '';
      this.revealT = 0;        // reveal progress in [0,1]
      this._revealDur = 90;    // ticks to fully reveal (~1.5 s at 60 fps)
    }

    // ---- string rewriting (exposed for tests) ----
    // Apply rules in parallel n times. Stops growing if it would exceed MAX_LEN.
    expandString(axiom, rules, n) {
      let s = axiom;
      for (let i = 0; i < n; i++) {
        let out = '';
        for (let c = 0; c < s.length; c++) {
          const ch = s[c];
          out += (rules[ch] !== undefined) ? rules[ch] : ch;
          if (out.length > MAX_LEN) { return out.slice(0, MAX_LEN); }
        }
        s = out;
      }
      return s;
    }

    setup() {
      this.regenerate();
    }

    // Full rebuild: expand the string AND run the turtle. Call on
    // system/iteration change (the expensive path).
    regenerate() {
      const key = (this.params && this.params.system) || 'fractal-plant';
      const sys = SYSTEMS[key] || SYSTEMS['fractal-plant'];
      const iters = Math.round((this.params && this.params.iterations) ?? sys.iters);
      this.string = this.expandString(sys.axiom, sys.rules, iters);
      this.runTurtle();
      this.revealT = 0; // re-grow the reveal on a full rebuild
    }

    // Cheap path: re-run the turtle on the existing string (angle change).
    runTurtle() {
      const key = (this.params && this.params.system) || 'fractal-plant';
      const sys = SYSTEMS[key] || SYSTEMS['fractal-plant'];
      const angle = ((this.params && this.params.angle) ?? sys.angle) * DEG;
      const drawSet = sys.draws || 'F'; // which letters draw a segment

      // Turtle: heading 0 = +x. For plants, start pointing up (-90°).
      let x = 0, y = 0;
      let heading = sys.plant ? -Math.PI / 2 : 0;
      let depth = 0;
      const stack = [];
      const segs = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let maxDepth = 1;

      const s = this.string;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (drawSet.indexOf(ch) !== -1) {
          const nx = x + Math.cos(heading);
          const ny = y + Math.sin(heading);
          segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth });
          x = nx; y = ny;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        } else if (ch === 'f') {
          x += Math.cos(heading); y += Math.sin(heading);
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        } else if (ch === '+') {
          heading -= angle; // turn left (screen y is down, so subtract)
        } else if (ch === '-') {
          heading += angle; // turn right
        } else if (ch === '[') {
          stack.push({ x, y, heading, depth });
          depth++;
          if (depth > maxDepth) maxDepth = depth;
        } else if (ch === ']') {
          const st = stack.pop();
          if (st) { x = st.x; y = st.y; heading = st.heading; depth = st.depth; }
        }
        // any other char: no-op
      }

      // include the origin in bounds even if nothing drew yet
      if (segs.length === 0) { minX = minY = 0; maxX = maxY = 1; }

      this.segments = segs;
      this.maxDepth = maxDepth;
      this._bbox = { minX, minY, maxX, maxY };
      this._isPlant = sys.plant;
      this._computeFit();
    }

    onResize() { this._computeFit(); }

    // Compute scale + translate so the figure fills the canvas with margin.
    // Centered; for plants, the root is anchored near the bottom.
    _computeFit() {
      if (!this._bbox) return;
      const { minX, minY, maxX, maxY } = this._bbox;
      const w = this.width, h = this.height;
      const margin = 0.10;
      const availW = w * (1 - 2 * margin);
      const availH = h * (1 - 2 * margin);
      const bw = Math.max(maxX - minX, 1e-6);
      const bh = Math.max(maxY - minY, 1e-6);
      const scale = Math.min(availW / bw, availH / bh);
      // center horizontally on the bbox center
      const cx = (minX + maxX) / 2;
      const offX = w / 2 - cx * scale;
      let offY;
      if (this._isPlant) {
        // anchor the bottom of the bbox near the canvas bottom
        offY = h * (1 - margin) - maxY * scale;
      } else {
        const cy = (minY + maxY) / 2;
        offY = h / 2 - cy * scale;
      }
      this._fit = { scale, offX, offY };
    }

    step() {
      // advance the reveal until full, then hold
      if (this.revealT < 1) {
        this.revealT = clamp(this.revealT + 1 / this._revealDur, 0, 1);
      }
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#070806';
      ctx.fillRect(0, 0, w, h);
      const fit = this._fit;
      const segs = this.segments;
      if (!fit || segs.length === 0) return;

      const { scale, offX, offY } = fit;
      const isPlant = this._isPlant;
      const maxD = Math.max(this.maxDepth, 1);
      const shown = Math.max(1, Math.floor(segs.length * this.revealT));

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < shown; i++) {
        const sg = segs[i];
        const t = isPlant ? clamp(sg.depth / maxD, 0, 1) : (i / segs.length);
        let stroke, lw;
        if (isPlant) {
          // brown near the root → bright teal/green at the tips
          const hue = 28 + t * 130;          // 28 (brown) → ~158 (teal-green)
          const sat = 35 + t * 45;           // duller trunk, vivid tips
          const lig = 26 + t * 38;
          stroke = `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${lig.toFixed(0)}%)`;
          lw = clamp((1 - t) * 3.2 + 0.55, 0.55, 3.8); // thin toward tips
        } else {
          // curves: sweep a teal→amber gradient along the path
          const hue = 175 - t * 130;         // 175 (teal) → 45 (amber)
          stroke = `hsl(${hue.toFixed(0)}, 72%, 60%)`;
          lw = 1.4;
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(sg.x1 * scale + offX, sg.y1 * scale + offY);
        ctx.lineTo(sg.x2 * scale + offX, sg.y2 * scale + offY);
        ctx.stroke();
      }
    }
  }

  // ---- mount + controls ----
  const sim = new LSystem('#stage');
  sim.start();

  const systemOptions = Object.keys(SYSTEMS).map(k => ({ value: k, label: SYSTEMS[k].label }));

  // Clamp the iterations slider's max to the current system's safe cap,
  // and re-default iterations when switching systems.
  function applySystemDefaults(key) {
    const sys = SYSTEMS[key] || SYSTEMS['fractal-plant'];
    // update the angle slider
    if (angleInput) {
      angleInput.value = sys.angle;
      angleInput.dispatchEvent(new Event('input'));
    }
    // update the iterations slider range + value
    if (iterInput) {
      iterInput.max = sys.maxIters;
      iterInput.value = Math.min(sys.iters, sys.maxIters);
      iterInput.dispatchEvent(new Event('input'));
    }
  }

  sim.standardRail({
    randomize: () => {
      // pick a random system
      const keys = Object.keys(SYSTEMS);
      const key = keys[Math.floor(Math.random() * keys.length)];
      systemSel.value = key;
      sim.params.system = key;
      applySystemDefaults(key);
      sim.regenerate();
      sim._renderOnce();
    },
  });

  const systemSel = sim.select('system', systemOptions, {
    value: 'fractal-plant',
    onChange: (v) => { applySystemDefaults(v); sim.regenerate(); if (!sim.running) sim._renderOnce(); },
  });

  const iterInput = sim.slider('iterations', {
    min: 0, max: SYSTEMS['fractal-plant'].maxIters, step: 1,
    value: SYSTEMS['fractal-plant'].iters, fmt: v => v.toString(),
    onInput: () => { sim.regenerate(); if (!sim.running) sim._renderOnce(); },
  });

  const angleInput = sim.slider('angle', {
    min: 0, max: 120, step: 0.5, value: SYSTEMS['fractal-plant'].angle,
    fmt: v => v + '°',
    // angle only re-runs the (cheap) turtle, not the rewriting
    onInput: () => { sim.runTurtle(); if (!sim.running) sim._renderOnce(); },
  });

  sim.readout(s => {
    const key = s.params.system || 'fractal-plant';
    const label = (SYSTEMS[key] || {}).label || key;
    const iters = Math.round(s.params.iterations ?? 0);
    return `${label}  ·  ${iters} iters  ·  ${s.segments.length.toLocaleString()} segments  ·  |string| ${s.string.length.toLocaleString()}`;
  });
})();
