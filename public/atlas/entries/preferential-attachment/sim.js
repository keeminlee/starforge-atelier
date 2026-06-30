/* Preferential Attachment — the Barabási–Albert growing network (1999).
 *
 * Extends Atlas.Sim. The network grows one node at a time. A new node attaches
 * with m edges to existing nodes; under PREFERENTIAL attachment each target is
 * chosen with probability proportional to its current degree ("the rich get
 * richer"), implemented with the classic O(1) trick: keep an "endpoint" array
 * holding every edge endpoint (a node id appears once per unit of degree), and
 * sample it uniformly — that automatically yields degree-proportional draws.
 * Under RANDOM attachment targets are chosen uniformly over nodes, so no hubs
 * form. The emergent contrast — a few giant hubs vs. a flat Poisson-ish degree
 * distribution — is the whole point.
 *
 * The on-screen layout is a force-directed (spring-electrical) relaxation run
 * each frame for visualization ONLY; it is not part of the BA model. Edges pull
 * connected nodes together (Hooke springs); nodes repel (Coulomb). For
 * performance at the node cap, repulsion is approximated: each node is repelled
 * by a random sample of others per frame, plus the hubs (always included),
 * which keeps it smooth at a few hundred nodes. */
(function () {
  'use strict';
  const { Sim, clamp, rand, TAU } = Atlas;

  const SAMPLE = 18;        // repulsion: random partners sampled per node per frame
  const REPULSE = 1400;     // Coulomb constant
  const SPRING = 0.012;     // Hooke constant for edges
  const REST = 26;          // spring rest length (px)
  const CENTER = 0.0009;    // mild pull to the middle so it doesn't drift
  const DAMP = 0.86;        // velocity damping per frame
  const MAXV = 6;           // velocity clamp (px/frame)

  class PrefAttach extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.62 });
      this.dragId = -1;     // node being dragged (-1 = none)
      this.pinned = new Set();
    }

    setup() {
      // node arrays
      this.x = [];
      this.y = [];
      this.vx = [];
      this.vy = [];
      this.degree = [];
      // edges as flat pairs in `edges` plus the endpoint multiset for sampling
      this.edges = [];        // [{a,b}, ...]
      this.endpoints = [];    // node ids, one per degree-unit (preferential pool)
      this.nodeCount = 0;
      this.dragId = -1;
      this.pinned = new Set();
      this._frameAcc = 0;     // fractional-node growth accumulator

      const m0 = Math.max(2, Math.round((this.params && this.params.m) || 2) + 1);
      // Seed: a small connected clique of m0 nodes.
      for (let i = 0; i < m0; i++) this.addNode();
      for (let i = 0; i < m0; i++) {
        for (let j = i + 1; j < m0; j++) this.addEdge(i, j);
      }
      // Pre-grow so the network opens already developed (the scale-free hubs are
      // visible immediately) rather than as a bare handful of nodes; growth then
      // continues from here toward the cap.
      const pre = Math.min(50, Math.round((this.params && this.params.maxnodes) || 200) - m0);
      for (let i = 0; i < pre; i++) this.grow();
    }

    addNode() {
      const cx = this.width * 0.5, cy = this.height * 0.5;
      const a = rand(TAU), r = rand(8, 40);
      const id = this.nodeCount;
      this.x[id] = cx + Math.cos(a) * r;
      this.y[id] = cy + Math.sin(a) * r;
      this.vx[id] = 0;
      this.vy[id] = 0;
      this.degree[id] = 0;
      this.nodeCount++;
      return id;
    }

    addEdge(a, b) {
      if (a === b) return false;
      this.edges.push({ a, b });
      this.degree[a]++;
      this.degree[b]++;
      this.endpoints.push(a, b);
      return true;
    }

    // Add one new node with m fresh edges, choosing targets without duplicates.
    grow() {
      const cap = Math.round(this.params.maxnodes ?? 200);
      if (this.nodeCount >= cap) return false;
      const m = Math.min(Math.round(this.params.m ?? 2), this.nodeCount);
      const mode = this.params.attachment ?? 'preferential';
      const src = this.addNode();

      const chosen = new Set();
      let guard = 0;
      while (chosen.size < m && guard < 400) {
        guard++;
        let t;
        if (mode === 'random') {
          // uniform over existing nodes (exclude the new node itself)
          t = (Math.random() * src) | 0;
        } else {
          // preferential: sample the endpoint multiset → degree-proportional
          if (this.endpoints.length === 0) t = (Math.random() * src) | 0;
          else t = this.endpoints[(Math.random() * this.endpoints.length) | 0];
        }
        if (t === src || chosen.has(t)) continue; // no self-loop, no duplicate
        chosen.add(t);
      }
      for (const t of chosen) this.addEdge(src, t);
      // place the newcomer near one of its targets for a less jumpy layout
      const any = chosen.values().next().value;
      if (any !== undefined) {
        this.x[src] = this.x[any] + rand(-12, 12);
        this.y[src] = this.y[any] + rand(-12, 12);
      }
      return true;
    }

    maxDegree() {
      let m = 0;
      for (let i = 0; i < this.nodeCount; i++) if (this.degree[i] > m) m = this.degree[i];
      return m;
    }

    meanDegree() {
      if (this.nodeCount === 0) return 0;
      return (2 * this.edges.length) / this.nodeCount;
    }

    onResize() { /* nodes keep their positions; layout re-settles */ }

    step() {
      // ---- growth: add `growth` nodes per second (≈60 fps) ----
      const cap = Math.round(this.params.maxnodes ?? 200);
      if (this.nodeCount < cap) {
        this._frameAcc += (this.params.growth ?? 6) / 60;
        let budget = 6; // safety: never add more than a few per frame
        while (this._frameAcc >= 1 && budget-- > 0) {
          this.grow();
          this._frameAcc -= 1;
        }
      }
      this.relax();
    }

    // One frame of spring-electrical relaxation (visualization only).
    relax() {
      const n = this.nodeCount;
      if (n === 0) return;
      const { x, y, vx, vy, degree } = this;
      const w = this.width, h = this.height;
      const cx = w * 0.5, cy = h * 0.5;

      // Identify the few biggest hubs once; everyone repels against them so the
      // sampled approximation never misses the dominant forces.
      const hubs = this._topHubs();

      const ax = new Float64Array(n);
      const ay = new Float64Array(n);

      // Repulsion (Coulomb), approximated by sampling + always-on hubs.
      for (let i = 0; i < n; i++) {
        let fx = 0, fy = 0;
        const push = (j) => {
          if (j === i) return;
          let dx = x[i] - x[j];
          let dy = y[i] - y[j];
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { d2 = 1; dx = rand(-0.5, 0.5); dy = rand(-0.5, 0.5); }
          const f = REPULSE / d2;
          const inv = 1 / Math.sqrt(d2);
          fx += dx * inv * f;
          fy += dy * inv * f;
        };
        for (const j of hubs) push(j);
        const k = Math.min(SAMPLE, n - 1);
        for (let s = 0; s < k; s++) push((Math.random() * n) | 0);
        ax[i] += fx;
        ay[i] += fy;
      }

      // Springs (Hooke) along edges; stiffer for low-degree leaves so hubs sit
      // central and leaves splay outward into a star.
      for (const e of this.edges) {
        const a = e.a, b = e.b;
        let dx = x[b] - x[a];
        let dy = y[b] - y[a];
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = SPRING * (dist - REST);
        const ux = dx / dist, uy = dy / dist;
        ax[a] += ux * force; ay[a] += uy * force;
        ax[b] -= ux * force; ay[b] -= uy * force;
      }

      // Integrate with centering + damping.
      for (let i = 0; i < n; i++) {
        if (i === this.dragId || this.pinned.has(i)) { vx[i] = 0; vy[i] = 0; continue; }
        ax[i] += (cx - x[i]) * CENTER;
        ay[i] += (cy - y[i]) * CENTER;
        let nvx = (vx[i] + ax[i]) * DAMP;
        let nvy = (vy[i] + ay[i]) * DAMP;
        const sp = Math.hypot(nvx, nvy);
        if (sp > MAXV) { nvx = nvx / sp * MAXV; nvy = nvy / sp * MAXV; }
        vx[i] = nvx; vy[i] = nvy;
        x[i] = clamp(x[i] + nvx, 6, w - 6);
        y[i] = clamp(y[i] + nvy, 6, h - 6);
      }
    }

    // Indices of the up-to-6 highest-degree nodes (cached per-frame-ish).
    _topHubs() {
      const n = this.nodeCount;
      const K = Math.min(6, n);
      const top = [];
      for (let i = 0; i < n; i++) {
        if (top.length < K) { top.push(i); top.sort((a, b) => this.degree[a] - this.degree[b]); }
        else if (this.degree[i] > this.degree[top[0]]) {
          top[0] = i; top.sort((a, b) => this.degree[a] - this.degree[b]);
        }
      }
      return top;
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { x, y, degree } = this;
      const n = this.nodeCount;
      if (n === 0) return;
      const maxD = Math.max(1, this.maxDegree());

      // edges: thin, faint
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(120,150,170,0.16)';
      ctx.beginPath();
      for (const e of this.edges) {
        ctx.moveTo(x[e.a], y[e.a]);
        ctx.lineTo(x[e.b], y[e.b]);
      }
      ctx.stroke();

      // nodes: radius + colour scale with degree (leaf = small teal, hub = big amber/white)
      for (let i = 0; i < n; i++) {
        const t = degree[i] / maxD;            // 0 leaf … 1 biggest hub
        const r = 2.2 + Math.sqrt(degree[i]) * 1.7;
        // teal (#46c4c4) → amber (#f0b24a) → near-white at the very top
        let col;
        if (t < 0.5) {
          const u = t / 0.5;
          col = `rgb(${(70 + u * 170) | 0},${(196 + u * (178 - 196)) | 0},${(196 + u * (74 - 196)) | 0})`;
        } else {
          const u = (t - 0.5) / 0.5;
          col = `rgb(${(240 + u * 15) | 0},${(178 + u * 60) | 0},${(74 + u * 150) | 0})`;
        }
        if (t > 0.55) {
          ctx.shadowColor = 'rgba(245,200,120,0.8)';
          ctx.shadowBlur = 8 + t * 14;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x[i], y[i], r, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // pointer → drag the nearest node within grab radius
    pick(px, py) {
      let best = -1, bestD = 22 * 22;
      for (let i = 0; i < this.nodeCount; i++) {
        const dx = this.x[i] - px, dy = this.y[i] - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = i; }
      }
      return best;
    }
  }

  // ---- mount + controls ----
  const sim = new PrefAttach('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.reset(); } });

  sim.select('attachment', [
    { value: 'preferential', label: 'Preferential (rich get richer)' },
    { value: 'random', label: 'Random (uniform)' }
  ], { value: 'preferential' });

  sim.slider('m', { min: 1, max: 5, step: 1, value: 2,
    fmt: v => v + ' edge' + (v > 1 ? 's' : '') + '/node' });
  sim.slider('growth', { min: 1, max: 20, step: 1, value: 6,
    fmt: v => v + ' nodes/s' });
  sim.slider('maxnodes', { min: 50, max: 400, step: 10, value: 200,
    fmt: v => v + ' max' });

  // Drag a node to reposition it; it stays pinned while held.
  sim.onPointer((type, p) => {
    if (type === 'down') {
      sim.dragId = sim.pick(p.x, p.y);
    } else if (type === 'drag' && sim.dragId >= 0) {
      sim.x[sim.dragId] = p.x;
      sim.y[sim.dragId] = p.y;
      if (!sim.running) sim._renderOnce();
    } else if (type === 'up' || type === 'leave') {
      sim.dragId = -1;
    }
  });

  sim.readout(s =>
    `${s.nodeCount} nodes  ·  ${s.edges.length} edges  ·  max degree ${s.maxDegree()} ` +
    `(biggest hub)  ·  mean degree ${s.meanDegree().toFixed(1)}`);
})();
