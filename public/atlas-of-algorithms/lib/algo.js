/* =====================================================================
 * algo.js — The Atlas of Algorithms engine
 * ---------------------------------------------------------------------
 * Dependency-free. No npm, no CDN, no ES module syntax. This file
 * defines a single global namespace `Algo`. Entry pages load it with:
 *
 *     <script src="../../lib/algo.js"></script>   // this file (the engine)
 *     <script src="./algo.js"></script>           // the entry's algorithm
 *
 * and then mount a player against the entry's exports.
 *
 * =====================================================================
 * THE CORE IDEA (see docs/decisions.md → ADR-0001)
 * ---------------------------------------------------------------------
 * Every algorithm is written exactly once, as an instrumented GENERATOR
 * that `yield`s a snapshot of its state after each meaningful step. That
 * sequence of snapshots is the *trace*. The engine drives playback of
 * the trace; the headless test runs the same generator to completion and
 * asserts the algorithm's invariant. The page and the test execute the
 * EXACT same algorithm code.
 *
 * An ENTRY is an object:
 *
 *     {
 *       metadata: { title, slug, family, oneLiner, invariant,
 *                   cost: {time, space}, controls: [...] },
 *       run(input, params): generator*  // yields snapshot objects
 *       draw(ctx, snapshot, w, h, theme) // renders ONE snapshot to 2D ctx
 *     }
 *
 * IMPORTANT CONTRACT — keep run/draw clean so they also run in Node:
 *   - `run` MUST NOT touch the DOM. It is pure: input + params -> a
 *     sequence of plain-data snapshots. The headless harness calls it
 *     directly. Anything `draw` or the invariant test needs must live in
 *     the snapshot.
 *   - `draw` MAY use the 2D canvas context it is handed, but should not
 *     reach for `document`/`window`; it gets ctx, the snapshot, the
 *     device-independent width/height, and the resolved theme.
 *
 * =====================================================================
 * THE SNAPSHOT SHAPE (what `run` yields; all fields optional)
 * ---------------------------------------------------------------------
 *   {
 *     // --- your algorithm's state (entry-defined; draw reads these) ---
 *     array:      any,     // e.g. the working array for a sort
 *     ...                  // graph, pointers, matrix, whatever you need
 *
 *     // --- lens #3, COST: the engine surfaces these in the readout ---
 *     counters:   { [name:string]: number },  // e.g. {comparisons, swaps, reads}
 *     readout:    [{label, value}],  // ALTERNATIVE to counters: labeled values,
 *                                    // no total (derived quantities — estimate,
 *                                    // error %, bits — for the advanced wing)
 *
 *     // --- lens #2, GUARANTEE/INVARIANT: surfaced + passed to draw ----
 *     highlight:  any,     // entry-defined marker(s) draw uses to paint the
 *                          // invariant region / active comparison. e.g.
 *                          // {range:[lo,hi]} or {indices:[i,j]} or {set:[...]}
 *     annotation: string,  // human-readable line shown under the stage, e.g.
 *                          // "prefix a[0..3) is sorted"
 *     status:     string,  // optional short phase label, e.g. "partitioning"
 *     done:       boolean  // optional; final snapshot may set true
 *   }
 *
 * The engine NEVER requires any of these — an entry that yields bare
 * arrays still plays. `counters`, `annotation`, and `highlight` simply
 * light up the corresponding lens when present.
 *
 * =====================================================================
 * THE CONTROL DECLARATION (metadata.controls)
 * ---------------------------------------------------------------------
 * `metadata.controls` is an array of plain objects, each declaring one
 * widget in the control rail. Every control has a `key` (the param name
 * it writes into `params`) and a `type`. Changing any control re-runs
 * the generator with the new params and rebuilds the trace.
 *
 *   { key:'n',    type:'slider', label:'Size', min:5, max:80, step:1, value:24 }
 *   { key:'dist', type:'select', label:'Order', value:'random',
 *       options:[ {value:'random', label:'Random'},
 *                 {value:'sorted', label:'Sorted'} ] }
 *       // options may also be a plain ['random','sorted'] string array
 *   { key:'animate', type:'toggle', label:'Animate', value:true }
 *   { key:'reshuffle', type:'button', label:'Reshuffle', onClick: (api)=>{...} }
 *
 * `slider`/`select`/`toggle` participate in `params` and the URL hash.
 * `button` is an action: its `onClick(api)` receives the player API
 * (see Algo.mount return value). A common pattern is to bump a hidden
 * "seed"/"nonce" param then call api.rerun() to get a fresh random input.
 *
 * The resolved `params` object passed to `run(input, params)` is:
 *   { ...defaultsFromControls, ...urlHashOverrides, ...liveControlValues }
 *
 * =====================================================================
 * PUBLIC API SURFACE
 * ---------------------------------------------------------------------
 *   Algo.mount(entry, opts) -> playerApi      // build + render a player
 *   Algo.Player                                // the class (mount wraps it)
 *   Algo.rng(seed) -> () => number             // seedable PRNG [0,1) (mulberry32)
 *   Algo.shuffle(arr, rng) -> arr              // in-place Fisher–Yates (seeded)
 *   Algo.randomInt(rng, lo, hi) -> int         // integer in [lo, hi]
 *   Algo.collect(gen, limit) -> snapshot[]     // drain a generator to an array
 *   Algo.clamp(x, lo, hi) -> number
 *   Algo.bars(ctx, {values,w,h,theme,colorFor,sortedRange}) // shared bar chart for draw()
 *   Algo.version                               // engine version string
 *
 * playerApi (returned by Algo.mount):
 *   .play() .pause() .toggle()
 *   .step(+1|-1)  .seek(index)  .restart()
 *   .setSpeed(stepsPerSecond)
 *   .rerun(extraParams?)        // rebuild trace from current params
 *   .params                     // live resolved params (read-only snapshot via getParams())
 *   .getParams()                // current params object (copy)
 *   .setParam(key, value)       // set one param + rerun
 *   .trace                      // the built snapshot array
 *   .index                      // current snapshot index
 *   .destroy()                  // remove listeners / observers
 * ===================================================================== */

(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /* ---------------------------------------------------------------
   * Shared utilities (entries reuse these for reproducibility)
   * ------------------------------------------------------------- */

  /**
   * mulberry32 — a tiny, fast, seedable PRNG. Returns a function that
   * yields a float in [0, 1). Deterministic for a given integer seed,
   * which is what makes randomized entries reproducible (and testable).
   */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Integer in [lo, hi] inclusive, using a [0,1) rng. */
  function randomInt(rngFn, lo, hi) {
    return lo + Math.floor(rngFn() * (hi - lo + 1));
  }

  /** In-place Fisher–Yates shuffle driven by a seeded rng. Returns arr. */
  function shuffle(arr, rngFn) {
    var r = rngFn || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function clamp(x, lo, hi) {
    if (x < lo) return lo;
    if (x > hi) return hi;
    return x;
  }

  /**
   * Drain a generator into an array of snapshots. `limit` guards against
   * a runaway generator (default 200k steps). Used by the player to build
   * the trace and by the headless test harness.
   */
  function collect(gen, limit) {
    var cap = limit || 200000;
    var out = [];
    var step = gen.next();
    while (!step.done) {
      out.push(step.value);
      if (out.length >= cap) break;
      step = gen.next();
    }
    // A generator may `return` a final value; include it if present.
    if (step.done && step.value !== undefined) out.push(step.value);
    return out;
  }

  /* ---------------------------------------------------------------
   * Shared bar chart — the canonical visualization for array
   * algorithms (sorts, search). Entries pass their per-index color
   * via colorFor(idx); the helper owns layout, scaling, rounded bars,
   * and the optional sorted-range underline (the invariant cue).
   *   Algo.bars(ctx, { values, w, h, theme,
   *                    colorFor: idx => cssColor,        // default: muted
   *                    sortedRange: [lo, hi),            // optional underline
   *                    refValue, refColor,               // optional dashed h-line at a value
   *                    maxVal, padX, padTop, padBottom } )
   * ------------------------------------------------------------- */
  function roundBar(ctx, x, y, w, h, r) {
    if (h <= 0 || w <= 0) return;
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  }

  function bars(ctx, opts) {
    opts = opts || {};
    var values = opts.values || [];
    var n = values.length;
    if (!n) return;
    var w = opts.w, h = opts.h, theme = opts.theme || {};
    var colorFor = opts.colorFor || function () { return theme.muted || '#888'; };
    var sortedRange = opts.sortedRange || null;
    var padX = opts.padX != null ? opts.padX : 16;
    var padTop = opts.padTop != null ? opts.padTop : 18;
    var padBottom = opts.padBottom != null ? opts.padBottom : 26;
    var availW = w - padX * 2;
    var availH = h - padTop - padBottom;
    var maxVal = opts.maxVal || 0;
    if (!maxVal) { for (var t = 0; t < n; t++) { if (values[t] > maxVal) maxVal = values[t]; } }
    if (maxVal === 0) maxVal = 1;
    var gap = Math.max(1, Math.min(7, Math.floor((availW / n) * 0.2)));
    var bw = (availW - gap * (n - 1)) / n;
    var baseY = padTop + availH;

    if (sortedRange && sortedRange[1] > sortedRange[0]) {
      var ux = padX + sortedRange[0] * (bw + gap);
      var uw = (sortedRange[1] - sortedRange[0]) * (bw + gap) - gap;
      ctx.save();
      ctx.strokeStyle = theme.invariant || '#3ddc97';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ux, baseY + 6); ctx.lineTo(ux + uw, baseY + 6); ctx.stroke();
      ctx.restore();
    }

    for (var idx = 0; idx < n; idx++) {
      var bh = (values[idx] / maxVal) * availH;
      var x = padX + idx * (bw + gap);
      var y = baseY - bh;
      ctx.fillStyle = colorFor(idx);
      roundBar(ctx, x, y, bw, bh, Math.min(3, bw / 2));
    }

    // Optional horizontal reference line at a given value (e.g. a search
    // target or a threshold). Dashed; skipped if it falls outside the chart.
    if (opts.refValue != null) {
      var ry = baseY - (opts.refValue / maxVal) * availH;
      if (ry >= padTop - 0.5 && ry <= baseY + 0.5) {
        ctx.save();
        ctx.strokeStyle = opts.refColor || theme.warn || '#f4a259';
        ctx.lineWidth = 1.5;
        if (ctx.setLineDash) ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(padX, ry); ctx.lineTo(w - padX, ry); ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ---------------------------------------------------------------
   * Shared cell grid — layout for grid/maze visualizations (pathfinders,
   * number grids, sketch tables). Owns the centered layout + cell sizing;
   * the entry's `paintCell(x, y, cell, r, c)` does all the per-cell drawing
   * (so coloring stays entry-specific). Returns {cell, ox, oy, gap}.
   *   Algo.grid(ctx, { rows, cols, w, h, pad?, gap? }, paintCell)
   * ------------------------------------------------------------- */
  function grid(ctx, opts, paintCell) {
    opts = opts || {};
    var rows = opts.rows, cols = opts.cols, w = opts.w, h = opts.h;
    if (!rows || !cols) return null;
    var pad = opts.pad != null ? opts.pad : 14;
    var gap = opts.gap != null ? opts.gap : 2;
    var cell = Math.min((w - 2 * pad - gap * (cols - 1)) / cols, (h - 2 * pad - gap * (rows - 1)) / rows);
    var gw = cols * cell + (cols - 1) * gap, gh = rows * cell + (rows - 1) * gap;
    var ox = (w - gw) / 2, oy = (h - gh) / 2;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      paintCell(ox + c * (cell + gap), oy + r * (cell + gap), cell, r, c);
    }
    return { cell: cell, ox: ox, oy: oy, gap: gap };
  }

  /* ---------------------------------------------------------------
   * Theme — read CSS custom properties so draw() can match the
   * design system. Falls back to sensible dark defaults if the
   * stylesheet is absent (e.g. in a bare test page).
   * ------------------------------------------------------------- */
  function readTheme(el) {
    var def = {
      bg: '#0f1117',
      panel: '#161922',
      ink: '#e7e9ee',
      muted: '#9aa3b2',
      grid: '#262b38',
      accent: '#6ea8fe',      // active comparison / motion
      invariant: '#3ddc97',   // the guarantee region
      warn: '#f4a259',
      cost: '#c792ea',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    };
    if (typeof global.getComputedStyle !== 'function' || !el) return def;
    try {
      var cs = global.getComputedStyle(el);
      function v(name, fallback) {
        var got = cs.getPropertyValue(name);
        return got && got.trim() ? got.trim() : fallback;
      }
      return {
        bg: v('--bg', def.bg),
        panel: v('--panel', def.panel),
        ink: v('--ink', def.ink),
        muted: v('--muted', def.muted),
        grid: v('--grid', def.grid),
        accent: v('--accent', def.accent),
        invariant: v('--invariant', def.invariant),
        warn: v('--warn', def.warn),
        cost: v('--cost', def.cost),
        mono: v('--font-mono', def.mono)
      };
    } catch (e) {
      return def;
    }
  }

  /* ---------------------------------------------------------------
   * URL hash state — reflect slider/select/toggle params into the
   * URL so a configured view is linkable. Format: #k=v&k2=v2
   * ------------------------------------------------------------- */
  function readHashParams() {
    var out = {};
    if (typeof global.location === 'undefined') return out;
    var h = (global.location.hash || '').replace(/^#/, '');
    if (!h) return out;
    h.split('&').forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      if (eq < 0) return;
      var k = decodeURIComponent(pair.slice(0, eq));
      var raw = decodeURIComponent(pair.slice(eq + 1));
      out[k] = raw;
    });
    return out;
  }

  /* Coerce a hash string to the type implied by a control's default. */
  function coerceLike(raw, sample) {
    if (typeof sample === 'number') {
      var n = Number(raw);
      return isNaN(n) ? sample : n;
    }
    if (typeof sample === 'boolean') {
      return raw === 'true' || raw === '1';
    }
    return raw;
  }

  function writeHashParams(params, controls) {
    if (typeof global.history === 'undefined' || !global.history.replaceState) return;
    var parts = [];
    controls.forEach(function (c) {
      if (c.type === 'button') return;
      if (!(c.key in params)) return;
      parts.push(encodeURIComponent(c.key) + '=' + encodeURIComponent(String(params[c.key])));
    });
    var hash = parts.length ? '#' + parts.join('&') : '';
    try {
      global.history.replaceState(null, '', global.location.pathname + global.location.search + hash);
    } catch (e) { /* non-fatal */ }
  }

  /* ---------------------------------------------------------------
   * Small DOM helpers (only used inside the player, never in run/draw)
   * ------------------------------------------------------------- */
  function el(tag, cls, attrs) {
    var node = global.document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  /* Sum up a counters object for a compact total (used in the readout). */
  function totalCounters(counters) {
    var sum = 0;
    if (!counters) return 0;
    for (var k in counters) {
      if (Object.prototype.hasOwnProperty.call(counters, k)) {
        var v = counters[k];
        if (typeof v === 'number') sum += v;
      }
    }
    return sum;
  }

  /* ===============================================================
   * Player — drives playback of one entry's trace.
   * =============================================================== */
  function Player(entry, opts) {
    if (!entry || typeof entry.run !== 'function' || typeof entry.draw !== 'function') {
      throw new Error('Algo.Player: entry must have run() and draw() functions.');
    }
    opts = opts || {};
    this.entry = entry;
    this.metadata = entry.metadata || {};
    this.controls = (this.metadata.controls || []).slice();

    // Mount points: prefer explicit roots, else query by id within `root`.
    var doc = global.document;
    var root = opts.root || doc;
    this.stageHost = opts.stage || root.querySelector(opts.stageSelector || '#stage');
    this.railHost = opts.rail || root.querySelector(opts.railSelector || '#controls');
    this.readoutHost = opts.readout || root.querySelector(opts.readoutSelector || '#readout');
    this.annotationHost = opts.annotation || root.querySelector(opts.annotationSelector || '#annotation');
    // Accessibility: announce each step's narration to screen readers as it updates.
    if (this.annotationHost && this.annotationHost.setAttribute) {
      this.annotationHost.setAttribute('role', 'status');
      this.annotationHost.setAttribute('aria-live', 'polite');
    }

    if (!this.stageHost) throw new Error('Algo.Player: no #stage element found to mount the canvas.');

    // Playback state
    this.trace = [];
    this.index = 0;
    this.playing = false;
    this.speed = opts.speed || 6;          // snapshots per second
    this._accumulator = 0;
    this._rafId = null;
    this._lastTs = 0;
    this._controlEls = {};                 // key -> input element (for live read)
    this._destroyed = false;

    // Resolve initial params: control defaults < URL hash overrides.
    this.params = this._initialParams();

    // Build DOM scaffolding.
    this._buildCanvas();
    this._buildRail();
    this._buildTransport();
    this._buildReadout();

    // Build first trace and paint.
    this.rerun();

    // Responsive + HiDPI handling.
    this._installResize();
    // Keyboard shortcuts (space / arrows / R).
    this._installKeys();
  }

  /* ---- Keyboard shortcuts: space = play/pause, ←/→ = step, R = restart.
   * Ignored while a form control is focused, or with modifier keys held. ---- */
  Player.prototype._installKeys = function () {
    if (typeof global.addEventListener !== 'function') return;
    var self = this;
    this._onKey = function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t && t.tagName && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return;
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') { e.preventDefault(); self.toggle(); }
      else if (k === 'ArrowRight') { e.preventDefault(); self.pause(); self.step(1); }
      else if (k === 'ArrowLeft') { e.preventDefault(); self.pause(); self.step(-1); }
      else if (k === 'r' || k === 'R') { self.restart(); }
    };
    global.addEventListener('keydown', this._onKey);
  };

  Player.prototype._initialParams = function () {
    var params = {};
    this.controls.forEach(function (c) {
      if (c.type === 'button') return;
      params[c.key] = c.value;
    });
    var hash = readHashParams();
    this.controls.forEach(function (c) {
      if (c.type === 'button') return;
      if (c.key in hash) params[c.key] = coerceLike(hash[c.key], c.value);
    });
    return params;
  };

  /* ---- Canvas (the #stage figure) ---- */
  Player.prototype._buildCanvas = function () {
    var canvas = el('canvas', 'algo-canvas');
    // Accessibility: label the canvas (its live step narration is in #annotation).
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Visualization' + (this.metadata.title ? ' of ' + this.metadata.title : '') + (this.metadata.oneLiner ? ': ' + this.metadata.oneLiner : ''));
    this.stageHost.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = readTheme(this.stageHost);
  };

  Player.prototype._installResize = function () {
    var self = this;
    this._onResize = function () { self._resizeCanvas(); self._paint(); };
    if (typeof global.ResizeObserver === 'function') {
      this._ro = new global.ResizeObserver(this._onResize);
      this._ro.observe(this.stageHost);
    } else if (typeof global.addEventListener === 'function') {
      global.addEventListener('resize', this._onResize);
    }
    this._resizeCanvas();
    this._paint();
  };

  Player.prototype._resizeCanvas = function () {
    var dpr = global.devicePixelRatio || 1;
    var rect = this.stageHost.getBoundingClientRect();
    var cssW = Math.max(1, Math.round(rect.width));
    // Maintain a pleasant aspect ratio if the host has no explicit height.
    var cssH = Math.max(1, Math.round(rect.height || cssW * 0.5));
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    // Draw in CSS pixels; the context is scaled for the device.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /* ---- Control rail (declarative widgets from metadata.controls) ---- */
  Player.prototype._buildRail = function () {
    if (!this.railHost) return;
    this.railHost.innerHTML = '';
    var self = this;
    this.controls.forEach(function (c) {
      var field = el('div', 'algo-field');
      if (c.type === 'slider') self._buildSlider(field, c);
      else if (c.type === 'select') self._buildSelect(field, c);
      else if (c.type === 'toggle') self._buildToggle(field, c);
      else if (c.type === 'button') self._buildButton(field, c);
      self.railHost.appendChild(field);
    });
  };

  Player.prototype._buildSlider = function (field, c) {
    var self = this;
    var id = 'ctl-' + c.key;
    var label = el('label', 'algo-label', { 'for': id });
    var valOut = el('span', 'algo-value');
    valOut.textContent = String(this.params[c.key]);
    label.textContent = c.label || c.key;
    label.appendChild(valOut);
    var input = el('input', 'algo-slider', {
      type: 'range', id: id,
      min: String(c.min), max: String(c.max), step: String(c.step || 1)
    });
    input.value = String(this.params[c.key]);
    input.addEventListener('input', function () {
      var v = Number(input.value);
      valOut.textContent = String(v);
      self.setParam(c.key, v);
    });
    this._controlEls[c.key] = input;
    field.appendChild(label);
    field.appendChild(input);
  };

  Player.prototype._buildSelect = function (field, c) {
    var self = this;
    var id = 'ctl-' + c.key;
    var label = el('label', 'algo-label', { 'for': id });
    label.textContent = c.label || c.key;
    var select = el('select', 'algo-select', { id: id });
    var opts = c.options || [];
    opts.forEach(function (o) {
      var value = (o && typeof o === 'object') ? o.value : o;
      var text = (o && typeof o === 'object') ? (o.label || o.value) : o;
      var opt = el('option');
      opt.value = String(value);
      opt.textContent = String(text);
      if (String(value) === String(self.params[c.key])) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      self.setParam(c.key, select.value);
    });
    this._controlEls[c.key] = select;
    field.appendChild(label);
    field.appendChild(select);
  };

  Player.prototype._buildToggle = function (field, c) {
    var self = this;
    var id = 'ctl-' + c.key;
    var wrap = el('label', 'algo-toggle', { 'for': id });
    var input = el('input', '', { type: 'checkbox', id: id });
    input.checked = !!this.params[c.key];
    var text = el('span');
    text.textContent = c.label || c.key;
    input.addEventListener('change', function () {
      self.setParam(c.key, input.checked);
    });
    this._controlEls[c.key] = input;
    wrap.appendChild(input);
    wrap.appendChild(text);
    field.appendChild(wrap);
  };

  Player.prototype._buildButton = function (field, c) {
    var self = this;
    var btn = el('button', 'algo-btn algo-btn-action', { type: 'button' });
    btn.textContent = c.label || c.key;
    btn.addEventListener('click', function () {
      if (typeof c.onClick === 'function') c.onClick(self.api());
    });
    field.appendChild(btn);
  };

  /* ---- Transport (play / pause / step / scrub / speed) ---- */
  Player.prototype._buildTransport = function () {
    if (!this.railHost) return;
    var self = this;
    var bar = el('div', 'algo-transport');

    function tbtn(symbol, title, fn) {
      var b = el('button', 'algo-btn algo-btn-transport', { type: 'button', title: title, 'aria-label': title });
      b.textContent = symbol;
      b.addEventListener('click', fn);
      return b;
    }

    this._playBtn = tbtn('▶', 'Play / Pause (space)', function () { self.toggle(); });
    bar.appendChild(tbtn('⏮', 'Restart (R)', function () { self.restart(); }));
    bar.appendChild(tbtn('◀', 'Step back (←)', function () { self.pause(); self.step(-1); }));
    bar.appendChild(this._playBtn);
    bar.appendChild(tbtn('▶|', 'Step forward (→)', function () { self.pause(); self.step(1); }));

    // Scrubber over the trace.
    var scrub = el('input', 'algo-scrub', { type: 'range', min: '0', max: '0', step: '1', 'aria-label': 'Scrub trace' });
    scrub.value = '0';
    scrub.addEventListener('input', function () {
      self.pause();
      self.seek(Number(scrub.value));
    });
    this._scrub = scrub;

    // Speed control.
    var speedWrap = el('label', 'algo-speed');
    speedWrap.textContent = 'Speed';
    var speed = el('input', 'algo-speed-input', { type: 'range', min: '1', max: '60', step: '1', 'aria-label': 'Playback speed' });
    speed.value = String(this.speed);
    speed.addEventListener('input', function () { self.setSpeed(Number(speed.value)); });
    speedWrap.appendChild(speed);

    bar.appendChild(scrub);
    bar.appendChild(speedWrap);
    this.railHost.appendChild(bar);

    // Subtle keyboard-shortcut hint (keys bound in _installKeys).
    var hint = el('div', 'algo-keyhint');
    hint.textContent = '⌨  space play / pause  ·  ← → step  ·  R restart';
    this.railHost.appendChild(hint);
  };

  /* ---- Readout (cost counters + step position) ---- */
  Player.prototype._buildReadout = function () {
    if (!this.readoutHost) return;
    this.readoutHost.innerHTML = '';
    this._countsEl = el('div', 'algo-counts');
    this._stepEl = el('div', 'algo-step');
    this.readoutHost.appendChild(this._countsEl);
    this.readoutHost.appendChild(this._stepEl);
  };

  /* ---------------------------------------------------------------
   * Build (or rebuild) the trace from current params, then reset.
   * ------------------------------------------------------------- */
  Player.prototype.rerun = function (extraParams) {
    if (extraParams) {
      for (var k in extraParams) {
        if (Object.prototype.hasOwnProperty.call(extraParams, k)) this.params[k] = extraParams[k];
      }
    }
    // The generator gets a fresh params object each run; input is built
    // by the entry from params (entries that take an explicit input can
    // read params instead). We pass params as both input and params for
    // convenience — entries typically only read `params`.
    var gen = this.entry.run(this.params, this.params);
    this.trace = collect(gen);
    if (this.trace.length === 0) this.trace = [{}];
    this.index = 0;
    if (this._scrub) {
      this._scrub.max = String(Math.max(0, this.trace.length - 1));
      this._scrub.value = '0';
    }
    writeHashParams(this.params, this.controls);
    this._paint();
  };

  /* ---- Playback controls ---- */
  Player.prototype.play = function () {
    if (this.playing || this._destroyed) return;
    if (this.index >= this.trace.length - 1) this.index = 0; // replay from start
    this.playing = true;
    if (this._playBtn) this._playBtn.textContent = '⏸';
    this._lastTs = 0;
    this._accumulator = 0;
    this._loop();
  };

  Player.prototype.pause = function () {
    this.playing = false;
    if (this._playBtn) this._playBtn.textContent = '▶';
    if (this._rafId != null && typeof global.cancelAnimationFrame === 'function') {
      global.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  };

  Player.prototype.toggle = function () { this.playing ? this.pause() : this.play(); };

  Player.prototype._loop = function () {
    var self = this;
    if (typeof global.requestAnimationFrame !== 'function') {
      // No rAF (e.g. odd environments): fall back to a timer.
      this._rafId = global.setTimeout(function () { self._tick(Date.now()); }, 1000 / 60);
      return;
    }
    this._rafId = global.requestAnimationFrame(function (ts) { self._tick(ts); });
  };

  Player.prototype._tick = function (ts) {
    if (!this.playing) return;
    if (!this._lastTs) this._lastTs = ts;
    var dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    this._accumulator += dt * this.speed;
    while (this._accumulator >= 1) {
      this._accumulator -= 1;
      if (this.index >= this.trace.length - 1) { this.pause(); break; }
      this.index++;
    }
    this._paint();
    if (this.playing) this._loop();
  };

  /** Move by delta snapshots (clamped). Pauses implicitly via callers. */
  Player.prototype.step = function (delta) {
    this.seek(this.index + (delta || 1));
  };

  Player.prototype.seek = function (i) {
    this.index = clamp(Math.round(i), 0, this.trace.length - 1);
    this._paint();
  };

  Player.prototype.restart = function () {
    this.pause();
    this.index = 0;
    this._paint();
  };

  Player.prototype.setSpeed = function (stepsPerSecond) {
    this.speed = clamp(stepsPerSecond, 0.5, 240);
  };

  Player.prototype.setParam = function (key, value) {
    this.params[key] = value;
    this.pause();
    this.rerun();
  };

  Player.prototype.getParams = function () {
    var copy = {};
    for (var k in this.params) {
      if (Object.prototype.hasOwnProperty.call(this.params, k)) copy[k] = this.params[k];
    }
    return copy;
  };

  /* ---------------------------------------------------------------
   * Paint the current snapshot: clear, hand off to entry.draw, then
   * surface the lenses (annotation + cost) into their readouts.
   * ------------------------------------------------------------- */
  Player.prototype._paint = function () {
    var snap = this.trace[this.index] || {};
    var ctx = this.ctx;
    // Clear in CSS pixels (context is already dpr-scaled).
    ctx.save();
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.restore();

    try {
      this.entry.draw(ctx, snap, this.cssW, this.cssH, this.theme);
    } catch (e) {
      // A draw error should not wedge the player; report it on the canvas.
      ctx.save();
      ctx.fillStyle = this.theme.warn;
      ctx.font = '14px ' + this.theme.mono;
      ctx.fillText('draw() error: ' + (e && e.message ? e.message : e), 12, 24);
      ctx.restore();
      if (global.console && global.console.error) global.console.error(e);
    }

    this._renderLenses(snap);
    if (this._scrub) this._scrub.value = String(this.index);
  };

  Player.prototype._renderLenses = function (snap) {
    // Cost lens. Two modes:
    //   snap.readout = [{label, value}, …]  → labeled values, NO total (for
    //     derived quantities like estimate/error/bits — the advanced wing).
    //   snap.counters = { name: number }    → op counts, with a total when >1
    //     (the classic comparison/swap counters).
    if (this._countsEl) {
      var html = '';
      if (Array.isArray(snap.readout)) {
        snap.readout.forEach(function (r) {
          html += '<span class="algo-count"><span class="algo-count-k">' + escapeHtml(r.label) +
            '</span><span class="algo-count-v">' + escapeHtml(String(r.value)) + '</span></span>';
        });
      } else {
        var counters = snap.counters || {};
        var keys = Object.keys(counters);
        keys.forEach(function (name) {
          html += '<span class="algo-count"><span class="algo-count-k">' + escapeHtml(name) +
            '</span><span class="algo-count-v">' + formatNum(counters[name]) + '</span></span>';
        });
        if (keys.length > 1) {
          html += '<span class="algo-count algo-count-total"><span class="algo-count-k">total</span>' +
            '<span class="algo-count-v">' + formatNum(totalCounters(counters)) + '</span></span>';
        }
      }
      this._countsEl.innerHTML = html;
    }
    // Step position.
    if (this._stepEl) {
      this._stepEl.textContent = 'step ' + (this.index + 1) + ' / ' + this.trace.length;
    }
    // Annotation (the invariant/guarantee text).
    if (this.annotationHost) {
      this.annotationHost.textContent = snap.annotation || '';
      this.annotationHost.style.visibility = snap.annotation ? 'visible' : 'hidden';
    }
  };

  /* The stable external API object handed to button onClick + returned by mount. */
  Player.prototype.api = function () {
    var self = this;
    return {
      play: function () { self.play(); return this; },
      pause: function () { self.pause(); return this; },
      toggle: function () { self.toggle(); return this; },
      step: function (d) { self.pause(); self.step(d); return this; },
      seek: function (i) { self.pause(); self.seek(i); return this; },
      restart: function () { self.restart(); return this; },
      setSpeed: function (s) { self.setSpeed(s); return this; },
      rerun: function (p) { self.rerun(p); return this; },
      setParam: function (k, v) { self.setParam(k, v); return this; },
      getParams: function () { return self.getParams(); },
      destroy: function () { self.destroy(); },
      get params() { return self.getParams(); },
      get trace() { return self.trace; },
      get index() { return self.index; },
      _player: self
    };
  };

  Player.prototype.destroy = function () {
    this._destroyed = true;
    this.pause();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    else if (typeof global.removeEventListener === 'function' && this._onResize) {
      global.removeEventListener('resize', this._onResize);
    }
    if (typeof global.removeEventListener === 'function' && this._onKey) {
      global.removeEventListener('keydown', this._onKey); this._onKey = null;
    }
  };

  /* ---------------------------------------------------------------
   * Tiny formatting helpers for the readout.
   * ------------------------------------------------------------- */
  function formatNum(n) {
    if (typeof n !== 'number') return String(n);
    return n.toLocaleString ? n.toLocaleString('en-US') : String(n);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ---------------------------------------------------------------
   * Algo.mount — the convenient entry point. Builds a Player and
   * returns its stable API object.
   * ------------------------------------------------------------- */
  function mount(entry, opts) {
    var player = new Player(entry, opts);
    return player.api();
  }

  /* ---------------------------------------------------------------
   * Export the namespace as a global. (No ES module syntax — entries
   * load this via a <script> tag, not import.)
   * ------------------------------------------------------------- */
  var Algo = {
    version: VERSION,
    Player: Player,
    mount: mount,
    rng: rng,
    randomInt: randomInt,
    shuffle: shuffle,
    clamp: clamp,
    collect: collect,
    bars: bars,
    grid: grid,
    readTheme: readTheme
  };

  global.Algo = Algo;
  // Also expose for CommonJS-style consumers (e.g. a future Node harness
  // that wants the utilities) without requiring it.
  if (typeof module !== 'undefined' && module.exports) module.exports = Algo;

})(typeof globalThis !== 'undefined' ? globalThis : this);
