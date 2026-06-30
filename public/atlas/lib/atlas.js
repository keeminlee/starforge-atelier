/* The Atlas of Emergence — shared simulation engine.
 *
 * One small framework so every entry behaves consistently: a requestAnimationFrame
 * loop with play/pause/reset, a fixed simulation tick decoupled from render, a
 * high-DPI canvas, declarative controls, and auto-pause when scrolled off-screen.
 *
 * An entry defines a Sim subclass:
 *
 *   class MySim extends Atlas.Sim {
 *     setup() { ... }                 // build state; called on construct + reset
 *     step()  { ... }                 // advance one simulation tick
 *     draw(ctx, w, h) { ... }         // render current state to the canvas
 *   }
 *   const sim = new MySim('#stage');  // mounts to a .stage element
 *   sim.slider('speed', { ... });     // declare controls
 *   sim.start();
 *
 * No build step, no modules — loaded via <script> as the global `Atlas`.
 */
(function (global) {
  'use strict';

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (const c of kids) n.append(c);
    return n;
  }

  const instances = []; // registry so headless tests can reach constructed sims
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b));
  const TAU = Math.PI * 2;

  // URL-hash state sync: mirror each control's value into the address bar so a
  // tuned simulation can be shared by copying the link. Guarded so headless
  // environments (no `location`/`history`, e.g. the test harness) are untouched.
  const HASH = {
    read() {
      const out = {};
      try {
        const h = ((global.location && global.location.hash) || '').replace(/^#/, '');
        if (!h) return out;
        for (const kv of h.split('&')) {
          const i = kv.indexOf('=');
          if (i < 0) continue;
          out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
        }
      } catch (e) { /* no-op */ }
      return out;
    },
    write(state) {
      try {
        if (!global.history || !global.history.replaceState) return;
        const keys = Object.keys(state);
        if (!keys.length) return;
        const parts = keys.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(state[k]));
        global.history.replaceState(null, '', '#' + parts.join('&'));
      } catch (e) { /* no-op */ }
    },
  };

  class Sim {
    /**
     * @param {string|Element} mount  selector or element of the `.stage`
     * @param {object} opts  { width, aspect, stepsPerFrame, fixed }
     *   width   logical pixel width (default: container width)
     *   aspect  height/width ratio (default 0.6)
     *   stepsPerFrame  sim ticks per rendered frame (default 1)
     */
    constructor(mount, opts = {}) {
      this.host = typeof mount === 'string' ? document.querySelector(mount) : mount;
      if (!this.host) throw new Error('Atlas.Sim: mount not found: ' + mount);
      this.opts = opts;
      this.aspect = opts.aspect ?? 0.6;
      this.stepsPerFrame = opts.stepsPerFrame ?? 1;
      this.running = false;
      this.ticks = 0;
      this.frames = 0;
      this._fps = 0;
      this._lastFpsT = 0;
      this._controlsEl = null;
      this._readoutEl = null;
      this._readout = () => '';

      // Build canvas + control rails inside the host.
      this.canvas = el('canvas');
      this.host.prepend(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this._controlsEl = el('div', { class: 'controls' });
      this._readoutEl = el('div', { class: 'readout' });
      this.host.append(this._controlsEl, this._readoutEl);

      this._resize();
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.host);

      // Auto-pause off-screen to save CPU.
      this._io = new IntersectionObserver((es) => {
        for (const e of es) {
          if (!e.isIntersecting && this.running) { this._wasAuto = true; this.pause(); }
          else if (e.isIntersecting && this._wasAuto) { this._wasAuto = false; this.play(); }
        }
      }, { threshold: 0 });
      this._io.observe(this.canvas);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.running) { this._wasAuto = true; this.pause(); }
        else if (!document.hidden && this._wasAuto) { this._wasAuto = false; this.play(); }
      });

      // Registered controls (for re-applying state) and live URL-hash navigation:
      // clicking a "#param=value" link or editing the hash re-tunes the controls,
      // so the URL is a shareable AND a live remote. (replaceState from dragging a
      // control does NOT fire hashchange, so this only responds to real navigation.)
      this._controls = [];
      this._applyingHash = false;
      if (global.addEventListener) {
        global.addEventListener('hashchange', () => this._applyHash());
      }

      this._loop = this._loop.bind(this);
      instances.push(this);
      // Defer setup to subclass call in start(), so subclass fields exist.
    }

    _resize() {
      const cssW = (this.opts.width ?? this.host.clientWidth) || 760;
      const cssH = Math.round(cssW * this.aspect);
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.width = cssW; this.height = cssH; this.dpr = dpr;
      this.canvas.style.width = cssW + 'px';
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this._setupDone && this.onResize) this.onResize(cssW, cssH);
      if (this._setupDone && !this.running) this._renderOnce();
    }

    // ---- lifecycle hooks (override) ----
    setup() {}
    step() {}
    draw(/* ctx, w, h */) {}
    onResize() {}

    // ---- control API ----
    button(label, onClick, { primary = false, toggle = false } = {}) {
      const b = el('button', primary ? { class: 'primary' } : {}, label);
      if (toggle) b.dataset.on = 'false';
      b.addEventListener('click', () => {
        if (toggle) b.dataset.on = b.dataset.on === 'true' ? 'false' : 'true';
        onClick(b);
      });
      this._controlsEl.append(b);
      return b;
    }

    slider(name, { min = 0, max = 1, step = 0.01, value = (min + max) / 2, fmt, onInput } = {}) {
      this.params = this.params || {};
      this._urlState = this._urlState || {};
      // Override the initial value from the URL hash, if present (shareable state).
      const hp = HASH.read();
      const fromUrl = name in hp && !Number.isNaN(parseFloat(hp[name]));
      if (fromUrl) value = clamp(parseFloat(hp[name]), min, max);
      const format = fmt || (v => (Math.round(v * 100) / 100).toString());
      const valSpan = el('span', { class: 'val' }, format(value));
      // aria-label names the control; aria-valuetext announces the HUMAN-readable
      // value (e.g. "0.0545" or "2.27 ≈Tc") instead of the raw slider number.
      const input = el('input', { type: 'range', min, max, step, value,
        'aria-label': name, 'aria-valuetext': format(value) });
      const wrap = el('div', { class: 'ctl' },
        el('label', {}, el('span', {}, name), valSpan), input);
      // Set the value programmatically (used by URL-hash live navigation).
      const setVal = (raw, fire) => {
        const v = clamp(parseFloat(raw), min, max);
        if (Number.isNaN(v)) return;
        input.value = v;
        valSpan.textContent = format(v);
        input.setAttribute('aria-valuetext', format(v));
        this.params[name] = v;
        this._urlState[name] = v;
        if (fire && onInput) onInput(v);
      };
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        valSpan.textContent = format(v);
        input.setAttribute('aria-valuetext', format(v));
        this.params[name] = v;
        this._urlState[name] = v;
        this._syncUrl();
        if (onInput) onInput(v);
      });
      this.params[name] = value;
      this._urlState[name] = value;
      this._controlsEl.append(wrap);
      (this._controls = this._controls || []).push({ name, apply: (raw) => setVal(raw, true) });
      if (fromUrl && onInput) onInput(value); // apply side effects (re-seed, etc.)
      return input;
    }

    select(name, options, { value, onChange } = {}) {
      this.params = this.params || {};
      this._urlState = this._urlState || {};
      value = value ?? (options[0].value ?? options[0]);
      const valid = options.map(o => String(o.value ?? o));
      const hp = HASH.read();
      const fromUrl = name in hp && valid.includes(hp[name]);
      if (fromUrl) value = hp[name];
      const sel = el('select', { 'aria-label': name });
      for (const o of options) {
        const ov = o.value ?? o;
        const opt = el('option', { value: ov }, o.label ?? o);
        if (String(ov) === String(value)) opt.selected = true;
        sel.append(opt);
      }
      const wrap = el('div', { class: 'ctl' },
        el('label', {}, el('span', {}, name)), sel);
      this.params[name] = value;
      this._urlState[name] = value;
      const setVal = (raw, fire) => {
        if (!valid.includes(String(raw))) return;
        sel.value = raw;
        this.params[name] = raw;
        this._urlState[name] = raw;
        if (fire && onChange) onChange(raw);
      };
      sel.addEventListener('change', () => {
        this.params[name] = sel.value;
        this._urlState[name] = sel.value;
        this._syncUrl();
        if (onChange) onChange(sel.value);
      });
      this._controlsEl.append(wrap);
      (this._controls = this._controls || []).push({ name, apply: (raw) => setVal(raw, true) });
      if (fromUrl && onChange) onChange(value);
      return sel;
    }

    _syncUrl() { if (this._applyingHash) return; HASH.write(this._urlState); }

    // Re-apply control values from the URL hash (fired on hashchange — e.g. a reader
    // clicking a "Try this" link). Suppresses hash writes during the apply.
    _applyHash() {
      const hp = HASH.read();
      this._applyingHash = true;
      for (const c of (this._controls || [])) if (c.name in hp) c.apply(hp[c.name]);
      this._applyingHash = false;
      // Bring the simulation into view (e.g. a reader clicked a "Try this" link in
      // the prose below) so they actually watch the configuration they asked for.
      if (this.canvas.scrollIntoView) this.canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    readout(fn) { this._readout = fn; }

    // pointer helpers: returns sim-space coords from a pointer event
    onPointer(handler) {
      const get = (ev) => {
        const r = this.canvas.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width;
        const py = (ev.clientY - r.top) / r.height;
        return { x: px * this.width, y: py * this.height, nx: px, ny: py, ev };
      };
      let down = false;
      const fire = (type, ev) => { ev.preventDefault(); handler(type, get(ev)); };
      this.canvas.addEventListener('pointerdown', e => { down = true; this.canvas.setPointerCapture(e.pointerId); fire('down', e); });
      this.canvas.addEventListener('pointermove', e => { if (down) fire('drag', e); else fire('move', e); });
      this.canvas.addEventListener('pointerup', e => { down = false; fire('up', e); });
      // 'leave' lets sims clear hover/predator state when the cursor exits.
      this.canvas.addEventListener('pointerleave', e => { down = false; handler('leave', get(e)); });
    }

    // ---- run control ----
    start() {
      this.params = this.params || {};
      this.setup();
      this._setupDone = true;
      this._renderOnce();
      // Accessibility: label the canvas for assistive tech, and honor
      // prefers-reduced-motion by rendering a static first frame and staying
      // paused (the reader can opt in via the play button).
      const h1 = document.querySelector('.entry-head h1');
      this.canvas.setAttribute('role', 'img');
      this.canvas.setAttribute('aria-label',
        (h1 ? h1.textContent.trim() + ' — ' : '') +
        'interactive simulation; use the controls below to run and tune it');
      this.reducedMotion = !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (!this.reducedMotion) this.play();
      // a default play/pause + reset rail is the entry's responsibility, but
      // provide reset() for them to wire up.
      return this;
    }

    play() { if (this.running) return; this.running = true; this._raf = requestAnimationFrame(this._loop); }
    pause() { this.running = false; if (this._raf) cancelAnimationFrame(this._raf); }
    toggle() { this.running ? this.pause() : this.play(); return this.running; }

    reset() {
      const wasRunning = this.running;
      this.pause();
      this.ticks = 0;
      this.setup();
      this._renderOnce();
      if (wasRunning) this.play();
    }

    _renderOnce() {
      this.draw(this.ctx, this.width, this.height);
      this._updateReadout();
    }

    _updateReadout() {
      const extra = this._readout(this) || '';
      this._readoutEl.textContent =
        `t=${this.ticks}  ·  ${this._fps} fps` + (extra ? '  ·  ' + extra : '');
    }

    _loop(t) {
      if (!this.running) return;
      for (let i = 0; i < this.stepsPerFrame; i++) { this.step(); this.ticks++; }
      this.draw(this.ctx, this.width, this.height);
      this.frames++;
      if (t - this._lastFpsT > 500) {
        this._fps = Math.round(this.frames * 1000 / (t - this._lastFpsT));
        this.frames = 0; this._lastFpsT = t;
      }
      this._updateReadout();
      this._raf = requestAnimationFrame(this._loop);
    }
  }

  // A standard play/pause + reset rail many entries want. Returns the buttons.
  Sim.prototype.standardRail = function ({ randomize, clear } = {}) {
    const play = this.button('▶ play / pause', () => {
      const on = this.toggle();
      play.dataset.on = String(on);
      play.textContent = on ? '❚❚ pause' : '▶ play';
    }, { primary: true, toggle: true });
    // Reflect the actual run state (paused under prefers-reduced-motion).
    play.dataset.on = String(this.running);
    play.textContent = this.running ? '❚❚ pause' : '▶ play';
    play.setAttribute('aria-label', 'Play or pause the simulation');
    this.button('↺ reset', () => this.reset());
    if (randomize) this.button('⚄ randomize', () => randomize());
    if (clear) this.button('✕ clear', () => clear());
    return play;
  };

  global.Atlas = { Sim, el, clamp, lerp, rand, randInt, TAU, instances };
})(window);
