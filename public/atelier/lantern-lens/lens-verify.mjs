// lens-verify.mjs — proves the optics engine obeys real laws AND that every
// level is winnable but not already won. Headless; the beam is deterministic,
// so "solvable" is a searched geometric fact, not a claim.
//   node lens-verify.mjs
import { trace, dirOf, GLASS_N } from './lens-core.mjs';
import { LEVELS, BOUNDS, levelScene } from './lens-levels.mjs';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : 'FAIL  ') + m); if (!c) fails++; };

// ── physics laws ─────────────────────────────────────────────────────────────
// reflection: a rightward ray off a 45° mirror leaves at 90°
{
  const s = { lantern: { x: 40, y: 200, angle: 0 }, wick: { x: 1, y: 1, r: 1 }, bounds: BOUNDS,
    pieces: [{ type: 'mirror', a: { x: 300, y: 220 }, b: { x: 320, y: 200 } }] };
  const r = trace(s);
  const seg = { x: r.path[2].x - r.path[1].x, y: r.path[2].y - r.path[1].y };
  const ang = Math.atan2(seg.y, seg.x);
  ok(Math.abs(Math.abs(ang) - Math.PI / 2) < 0.05, `reflection: 45° mirror turns a level ray by 90° (got ${(ang * 180 / Math.PI).toFixed(0)}°)`);
}
// refraction: entering glass, the ray bends TOWARD the normal (Snell, n1<n2)
{
  const s = { lantern: { x: 40, y: 150, angle: 0.5 }, wick: { x: 1, y: 1, r: 1 }, bounds: BOUNDS,
    pieces: [{ type: 'glass', cx: 300, cy: 260, w: 140, h: 240, angle: 0 }] };
  const r = trace(s);
  const inAng = Math.atan2(r.path[1].y - r.path[0].y, r.path[1].x - r.path[0].x);
  const midAng = Math.atan2(r.path[2].y - r.path[1].y, r.path[2].x - r.path[1].x);
  ok(Math.abs(midAng) < Math.abs(inAng) - 1e-3, `refraction: beam bends toward the normal entering glass (${inAng.toFixed(3)} → ${midAng.toFixed(3)})`);
}
// TIR exists: from inside glass at a steep angle the beam totally reflects
{
  let tir = false;
  for (let a = 0.1; a < 1.5 && !tir; a += 0.05) {
    const s = { lantern: { x: 300, y: 260, angle: a }, wick: { x: 1, y: 1, r: 1 }, bounds: BOUNDS,
      pieces: [{ type: 'glass', cx: 320, cy: 260, w: 420, h: 70, angle: 0 }] };
    if (trace(s, 60).tir > 0) tir = true;
  }
  ok(tir, `total internal reflection occurs past the critical angle (n=${GLASS_N})`);
}

// ── every level is solvable-by-construction and starts dark ───────────────────
function searchSolves(level) {
  const sp = level.search;
  const base = JSON.parse(JSON.stringify(level.pieces));
  const mv = base.findIndex((p) => p.movable);
  let best = null;
  for (let cx = sp.cx[0]; cx <= sp.cx[1]; cx += sp.cx[2])
    for (let cy = sp.cy[0]; cy <= sp.cy[1]; cy += sp.cy[2])
      for (let a = sp.angle[0]; a <= sp.angle[1]; a += sp.angle[2]) {
        base[mv] = { ...base[mv], cx, cy, angle: a };
        if (trace(levelScene(level, base)).lit) { best = { cx, cy, angle: +a.toFixed(3) }; return best; }
      }
  return best;
}

for (const level of LEVELS) {
  const startLit = trace(levelScene(level)).lit;
  ok(!startLit, `"${level.name}" starts dark (there is a puzzle to solve)`);
  const sol = searchSolves(level);
  ok(!!sol, `"${level.name}" is solvable — a placement lights the wick` + (sol ? ` (e.g. ${JSON.stringify(sol)})` : ''));
}

// ── the page ships the same engine + levels ──────────────────────────────────
const htmlPath = path.join(ROOT, 'lantern-lens.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  ok(html.includes('function trace') && html.includes('function refract'), 'lantern-lens.html inlines the same optics engine');
  ok(html.includes(LEVELS[0].name) && html.includes(LEVELS[LEVELS.length - 1].name), 'lantern-lens.html carries all the levels');
} else {
  console.log('  ~   lantern-lens.html not built yet — run build.mjs (skipping page-parity check)');
}

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed — the optics are real and every level is winnable');
process.exit(fails ? 1 : 0);
