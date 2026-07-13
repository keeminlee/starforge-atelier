// build.mjs — the Frost-Grammar.
//
// Grows a dendritic crystal up a dark windowpane by diffusion-limited
// aggregation: drifting vapor-walkers that freeze where they touch the ice, so
// a new, never-repeating lantern-gold frost blooms each time — and the maker's
// game is tuning the cold, the frost, the wind, and the seeding to reliably
// birth a *lively* crystal (branched and spanning) rather than a dead blob or a
// bare pane. Whether it's alive is not a vibe; it's measured (fractal box-
// dimension + connected span), in-page and identically in frost-verify.mjs.
//
// This generator inlines the shared engine (frost-core.mjs) into a single
// self-contained frost.html — the crystal you watch grow and the crystal the
// tests judge are the same code. Zero dependencies; Canvas 2D + a seeded PRNG.
//   node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const core = fs.readFileSync(path.join(ROOT, 'frost-core.mjs'), 'utf8')
  .replace(/^export\s+/gm, '');           // inline the module into a plain script scope

const OUT = path.join(ROOT, 'frost.html');
fs.writeFileSync(OUT, page(core), 'utf8');
console.log('wrote', OUT, `(${fs.statSync(OUT).size} bytes)`);

function page(coreSrc) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Frost-Grammar — a new frost every night</title>
<style>
:root{--bg:hsl(222 34% 7%);--bg2:hsl(222 32% 5%);--ink:hsl(40 28% 92%);--muted:hsl(35 12% 60%);--line:hsl(28 20% 20%);--lantern:hsl(42 74% 66%);--gold:hsl(44 90% 74%);--glass:#0c1119;--parch:hsl(40 30% 90%)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;color:var(--ink);font:15px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  background:radial-gradient(60% 40% at 50% 0%,hsla(210,60%,40%,.10),transparent 70%),radial-gradient(circle at 50% 96%,hsla(42,70%,60%,.06),transparent 50%),linear-gradient(to bottom,var(--bg),var(--bg2))}
.wrap{max-width:760px;margin:0 auto;padding:0 20px 60px}
header{text-align:center;padding:48px 10px 6px}
h1{margin:0;font-size:32px;letter-spacing:.02em;color:var(--gold);font-weight:600}
.sub{color:var(--lantern);font-size:12px;letter-spacing:.22em;text-transform:uppercase;margin-top:9px}
.line{color:var(--muted);font-style:italic;max-width:540px;margin:13px auto 0}
.pane-wrap{position:relative;margin:26px auto 0;width:100%;max-width:664px;border:1px solid var(--line);border-radius:5px;background:var(--glass);
  box-shadow:inset 0 0 60px rgba(0,0,0,.6),0 18px 50px rgba(0,0,0,.45);overflow:hidden}
.mullion{position:absolute;background:hsla(28,18%,30%,.5);pointer-events:none}
.mullion.v{top:0;bottom:0;width:2px;left:50%}
.mullion.h{left:0;right:0;height:2px;top:50%}
canvas{display:block;width:100%;height:auto;image-rendering:auto}
.readout{display:flex;justify-content:center;gap:22px;flex-wrap:wrap;margin:14px 0 0;color:var(--muted);font-size:13px}
.readout b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.verdict{display:inline-block;padding:2px 12px;border-radius:999px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--line)}
.verdict.alive{color:var(--bg);background:var(--gold);border-color:var(--gold)}
.verdict.thin{color:var(--muted)}
.controls{display:grid;grid-template-columns:1fr 1fr;gap:10px 26px;max-width:560px;margin:22px auto 0}
.ctl{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12.5px}
.ctl label{min-width:88px;text-align:right}
.ctl input[type=range]{accent-color:var(--lantern);flex:1}
.ctl .val{min-width:34px;color:var(--ink);font-variant-numeric:tabular-nums}
.buttons{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin:22px 0 0}
button{font:inherit;font-size:15px;color:var(--bg);background:var(--gold);border:0;border-radius:999px;padding:10px 24px;cursor:pointer;letter-spacing:.02em;transition:filter .15s,transform .1s}
button:hover{filter:brightness(1.08)}button:active{transform:translateY(1px)}
button.ghost{background:transparent;color:var(--lantern);border:1px solid var(--line)}
.kept{text-align:center;color:var(--muted);font-size:12px;margin:16px auto 0;min-height:18px;font-variant-numeric:tabular-nums}
.kept code{color:var(--lantern);background:hsla(42,40%,50%,.08);padding:1px 6px;border-radius:4px;cursor:pointer}
.note{color:var(--muted);font-size:13px;max-width:600px;margin:30px auto 0;text-align:center;line-height:1.7}
.note a{color:var(--lantern)}
footer{text-align:center;color:var(--muted);font-size:11.5px;margin-top:36px;border-top:1px solid var(--line);padding-top:16px;opacity:.8}
</style></head>
<body><div class="wrap">
<header>
  <h1>The Frost-Grammar</h1>
  <div class="sub">a new frost every night</div>
  <div class="line">Cold breathes a crystal up a dark windowpane — drifting vapor that freezes where it touches, branching as real frost branches. No two panes are the same. Tune the cold, and see if you can make it live.</div>
</header>

<div class="pane-wrap" id="pane">
  <canvas id="cv" width="660" height="450"></canvas>
  <div class="mullion v"></div><div class="mullion h"></div>
</div>

<div class="readout">
  <div>coverage <b id="rCov">—</b></div>
  <div>branching (dim) <b id="rDim">—</b></div>
  <div>reach (span) <b id="rSpan">—</b></div>
  <div><span class="verdict thin" id="rVerdict">—</span></div>
</div>

<div class="controls">
  <div class="ctl"><label>cold</label><input type="range" id="sTemp" min="0.08" max="0.55" step="0.01" value="0.25"><span class="val" id="vTemp"></span></div>
  <div class="ctl"><label>frost</label><input type="range" id="sCov" min="0.06" max="0.26" step="0.01" value="0.16"><span class="val" id="vCov"></span></div>
  <div class="ctl"><label>wind</label><input type="range" id="sWind" min="-1" max="1" step="0.1" value="0"><span class="val" id="vWind"></span></div>
  <div class="ctl"><label>seeds</label><input type="range" id="sNuc" min="1" max="14" step="1" value="7"><span class="val" id="vNuc"></span></div>
</div>

<div class="buttons">
  <button id="grow">breathe a new pane</button>
  <button class="ghost" id="keep">keep this pane</button>
</div>
<div class="kept" id="kept"></div>

<div class="note">Whether a pane is <em>alive</em> is measured, not admired: a lively frost is branched (box-counting dimension in a real range) and reaches across the glass (its largest crystal spans the pane). A bare pane or a clump of thin spikes fails, visibly and numerically. The same engine is checked headless in <a href="frost-verify.mjs">frost-verify.mjs</a>.</div>

<footer>a Wright-HQ making · diffusion-limited aggregation · self-contained, offline, unpublished</footer>
</div>

<script>
// ── the shared engine (inlined verbatim from frost-core.mjs) ─────────────────
${coreSrc}

// ── the pane: grow, then reveal in the order it froze ────────────────────────
(() => {
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const GW = DEFAULTS.width, GH = DEFAULTS.height;
  const cell = Math.floor(cv.width / GW);           // px per grid cell
  const ox = Math.floor((cv.width - GW * cell) / 2), oy = cv.height - GH * cell;
  let paneSeed = 1, reveal = null, raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const params = () => ({
    width: GW, height: GH,
    temperature: +$('sTemp').value, coverage: +$('sCov').value,
    wind: +$('sWind').value, nucleation: +$('sNuc').value | 0,
  });
  const showVals = () => {
    $('vTemp').textContent =ADJ_COLD(+$('sTemp').value);
    $('vCov').textContent = (+$('sCov').value).toFixed(2);
    $('vWind').textContent = (+$('sWind').value).toFixed(1);
    $('vNuc').textContent = $('sNuc').value;
  };
  // lower stickiness reads as "colder" frost visually; label it that way
  const ADJ_COLD = (t) => t <= 0.16 ? 'deep' : t <= 0.3 ? 'keen' : t <= 0.42 ? 'mild' : 'thaw';

  const clearGlass = () => { ctx.fillStyle = getCSS('--glass'); ctx.fillRect(0, 0, cv.width, cv.height); };
  const _cs = getComputedStyle(document.documentElement);
  function getCSS(v) { return _cs.getPropertyValue(v).trim(); }

  function paintCell(x, y, warm) {
    const px = ox + x * cell, py = oy + y * cell;
    // ice warms toward the seeds (older = warmer/brighter)
    const g = 60 + warm * 34;            // lightness-ish
    ctx.fillStyle = 'hsl(' + (42 - warm * 6) + ' ' + (78 + warm * 12) + '% ' + g + '%)';
    ctx.fillRect(px, py, cell, cell);
  }

  function bloom(x, y) {
    const px = ox + x * cell + cell / 2, py = oy + y * cell + cell / 2;
    const r = cell * 2.4;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, 'hsla(46,90%,72%,.20)'); grad.addColorStop(1, 'hsla(46,90%,72%,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  }

  function grow(newSeed) {
    cancelAnimationFrame(raf);
    if (newSeed) paneSeed = ((paneSeed * 1103515245 + 12345) & 0x7fffffff) ^ (paneSeed << 3);
    const p = params(); p.seed = paneSeed >>> 0;
    const res = simulate(p);
    // order cells by freeze order (age): the reveal grows as the frost grew
    const cells = [];
    for (let i = 0; i < res.grid.length; i++) if (res.grid[i]) cells.push(i);
    cells.sort((a, b) => res.age[a] - res.age[b]);
    const maxAge = res.age[cells[cells.length - 1]] || 1;

    clearGlass();
    $('kept').textContent = '';
    const finish = () => {
      const a = assess(res);
      $('rCov').textContent = (a.coverage * 100).toFixed(1) + '%';
      $('rDim').textContent = a.dimension.toFixed(2);
      $('rSpan').textContent = (a.span * 100).toFixed(0) + '%';
      const v = $('rVerdict');
      v.className = 'verdict ' + (a.alive ? 'alive' : 'thin');
      v.textContent = a.alive ? 'alive' : (a.coverage < ALIVE.covMin ? 'bare' : a.dimension < ALIVE.dimMin ? 'thin' : a.span < ALIVE.spanMin ? 'shallow' : 'dense');
    };

    if (reduce) {
      for (const i of cells) paintCell(i % GW, (i / GW) | 0, res.age[i] / maxAge);
      finish(); return;
    }
    let k = 0; const per = Math.max(18, Math.ceil(cells.length / 240));
    reveal = () => {
      const end = Math.min(cells.length, k + per);
      for (; k < end; k++) { const i = cells[k]; const x = i % GW, y = (i / GW) | 0; paintCell(x, y, res.age[i] / maxAge); if ((k & 7) === 0) bloom(x, y); }
      if (k < cells.length) raf = requestAnimationFrame(reveal); else finish();
    };
    raf = requestAnimationFrame(reveal);
  }

  $('grow').addEventListener('click', () => grow(true));
  $('keep').addEventListener('click', () => {
    const p = params();
    const s = 'seed ' + (paneSeed >>> 0) + ' · cold ' + p.temperature + ' · frost ' + p.coverage + ' · wind ' + p.wind + ' · seeds ' + p.nucleation;
    $('kept').innerHTML = 'this pane: <code id="cp" title="click to copy">' + s + '</code>';
    const c = $('cp'); if (c) c.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(s); c.textContent = s + '  ✓'; };
  });
  for (const id of ['sTemp', 'sCov', 'sWind', 'sNuc']) $(id).addEventListener('input', showVals);

  showVals(); clearGlass();
  // first pane on load (a still one under reduced-motion)
  grow(false);
})();
</script>
</body></html>`;
}
