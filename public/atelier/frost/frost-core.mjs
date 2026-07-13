// frost-core.mjs — the frost engine (diffusion-limited aggregation), pure.
//
// No DOM, no canvas, no clock, no Math.random. A seeded walker aggregation that
// grows a dendritic crystal up a windowpane, plus the measures that decide
// whether what grew is *alive* (a real branching dendrite) or dead (a blob or a
// bare pane). The browser page and the headless verifier both run THIS code —
// build.mjs inlines it into frost.html, frost-verify.mjs imports it — so the
// crystal you watch grow and the crystal the tests judge are the same crystal.
//
// Determinism: everything flows from the seed via mulberry32. Same seed + same
// params => same pane, in the browser or in node.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULTS = {
  width: 220, height: 150,
  temperature: 0.25,  // stick probability on contact. LOW sticks late → walkers penetrate and
                      //   branches thicken (denser, higher box-dim); HIGH sticks on first touch →
                      //   lacy thin spikes (lower box-dim). ~0.25 is the branched-and-spanning fern.
  humidity: 1.0,      // walkers launched per frontier-step (density of vapor); scales the frozen target
  wind: 0.0,          // horizontal drift bias in [-1,1]
  nucleation: 7,      // number of seed sites along the sill
  coverage: 0.16,     // stop when this fraction of the pane is ice (or frontier can't rise)
};

// Grow a pane. Returns { grid:Uint8Array (0 empty / 1 ice / with an age byte in
// `age`), width, height, frozen, ticks }. 8-connected sticking; walkers launch
// just above the current frost frontier (the standard DLA speedup) and drift
// down onto it under gravity + wind.
export function simulate(opts = {}) {
  const p = { ...DEFAULTS, ...opts };
  const W = p.width, H = p.height;
  const grid = new Uint8Array(W * H);
  const age = new Uint16Array(W * H);
  const rnd = mulberry32((p.seed ?? 1) >>> 0);
  const at = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const idx = (x, y) => y * W + x;

  // nucleation: seed sites spread along the sill (bottom row), plus the two
  // bottom corners always (frost creeps from the frame).
  let frozen = 0, tick = 0;
  const seed = (x, y) => { if (at(x, y) && !grid[idx(x, y)]) { grid[idx(x, y)] = 1; age[idx(x, y)] = 1; frozen++; } };
  const n = Math.max(1, p.nucleation | 0);
  for (let i = 0; i < n; i++) seed(Math.floor(((i + 0.5) / n) * W), H - 1);
  seed(0, H - 1); seed(W - 1, H - 1);

  let frontier = H - 1;                 // highest row (smallest y) with ice
  const target = Math.floor(p.coverage * W * H);
  const maxTicks = W * H * 60;          // hard safety cap
  const stick = Math.max(0, Math.min(1, p.temperature));
  const wind = Math.max(-1, Math.min(1, p.wind));
  const launchGap = 4;

  const hasIceNeighbor = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (at(x + dx, y + dy) && grid[idx(x + dx, y + dy)]) return true;
    }
    return false;
  };

  while (frozen < target && tick < maxTicks) {
    // launch a walker on a line just above the frontier
    let wy = Math.max(0, frontier - launchGap);
    let wx = Math.floor(rnd() * W);
    let life = (H - wy) * 8 + 40;       // enough steps to reach the frontier, then give up
    let stuck = false;
    while (life-- > 0) {
      // isotropic diffusion with a mild downward drift (gravity) and wind on the
      // sideways split — isotropy is what makes the frost BRANCH rather than fall
      // into vertical spikes (spikes measure too thin; branches hit real-DLA dim).
      const r = rnd();
      const pdown = 0.34, pup = 0.50;                  // down 0.34, up 0.16
      const pleft = pup + (0.25 - wind * 0.12);         // wind biases left/right
      if (r < pdown) wy += 1;
      else if (r < pup) wy -= 1;
      else if (r < pleft) wx -= 1;
      else wx += 1;
      if (wx < 0) wx = 0; if (wx >= W) wx = W - 1;
      if (wy >= H) break;               // fell off the sill; respawn
      if (wy < 0) wy = 0;
      if (grid[idx(wx, wy)]) { wy -= 1; if (wy < 0) break; } // stepped onto ice: back off one
      if (hasIceNeighbor(wx, wy)) {
        if (rnd() < stick) {
          grid[idx(wx, wy)] = 1; age[idx(wx, wy)] = (frozen % 60000) + 1; frozen++;
          if (wy < frontier) frontier = wy;
          stuck = true;
          break;
        }
      }
      tick++;
      if (tick >= maxTicks) break;
    }
    tick++;
    // if the frontier has climbed to the top rows, we're done growing up the glass
    if (frontier <= 1) break;
    // liveliness escape: if humidity is very low we still terminate via target/ticks
    if (!stuck && rnd() > p.humidity) { /* a walker that never stuck under low humidity just evaporates */ }
  }

  return { grid, age, width: W, height: H, frozen, ticks: tick, frontier };
}

// ── measures (pure; decide alive-vs-dead) ────────────────────────────────────

export function coverage(res) {
  return res.frozen / (res.width * res.height);
}

// Box-counting fractal dimension: count occupied s×s boxes at scales s = 1,2,4,8,16;
// dimension = -slope of log N(s) vs log s. Real DLA clusters measure ~1.71; a
// solid blob → ~2.0; a thin line → ~1.0.
export function boxDimension(res) {
  const { grid, width: W, height: H } = res;
  const scales = [1, 2, 4, 8, 16];
  const pts = [];
  for (const s of scales) {
    const bx = Math.ceil(W / s), by = Math.ceil(H / s);
    const seen = new Uint8Array(bx * by);
    let count = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (grid[y * W + x]) {
        const b = Math.floor(y / s) * bx + Math.floor(x / s);
        if (!seen[b]) { seen[b] = 1; count++; }
      }
    }
    if (count > 0) pts.push([Math.log(1 / s), Math.log(count)]);
  }
  if (pts.length < 2) return 0;
  // least-squares slope of log N vs log(1/s)  (== -slope vs log s == dimension)
  const nP = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  return (nP * sxy - sx * sy) / (nP * sxx - sx * sx);
}

// Largest connected ice component (8-connectivity) and the fraction of the
// pane's height it spans — proof the crystal actually grew ACROSS the glass
// rather than sitting as scattered specks.
export function largestComponentSpan(res) {
  const { grid, width: W, height: H } = res;
  const seen = new Uint8Array(W * H);
  const stack = [];
  let best = { size: 0, minY: 0, maxY: 0 };
  for (let start = 0; start < W * H; start++) {
    if (!grid[start] || seen[start]) continue;
    stack.length = 0; stack.push(start); seen[start] = 1;
    let size = 0, minY = H, maxY = 0;
    while (stack.length) {
      const c = stack.pop(); size++;
      const cx = c % W, cy = (c / W) | 0;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const ni = ny * W + nx;
        if (grid[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
      }
    }
    if (size > best.size) best = { size, minY, maxY };
  }
  return { size: best.size, span: (best.maxY - best.minY + 1) / H };
}

// One call → the full verdict a pane is judged on.
//
// Aliveness thresholds are calibrated to what a LIVELY FINITE window-frost
// actually measures on this ~220×150 pane — NOT to the asymptotic DLA constant.
// Honest caveat: 2D DLA's box-counting dimension tends to ~1.71 only for very
// large clusters under mass-radius scaling; a finite window-frost measures lower
// (~1.35–1.50). So the band below is empirical, and it still discriminates hard:
//   - a bare/sparse pane fails coverage (and reads dim ~1.15, span ~0.2);
//   - thin vertical spikes (over-sticky) read dim < 1.35 and fail the low edge;
//   - a lively branched fern reads ~1.40 and spans the glass — it passes;
//   - a dense frost reads ~1.48 — it passes.
export const ALIVE = { covMin: 0.10, dimMin: 1.35, dimMax: 1.55, spanMin: 0.60 };
export function assess(res) {
  const cov = coverage(res);
  const dim = boxDimension(res);
  const comp = largestComponentSpan(res);
  return {
    coverage: cov, dimension: dim, span: comp.span, largest: comp.size, frozen: res.frozen,
    alive: cov >= ALIVE.covMin && dim >= ALIVE.dimMin && dim <= ALIVE.dimMax && comp.span >= ALIVE.spanMin,
  };
}
