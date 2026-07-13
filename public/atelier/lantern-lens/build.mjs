// build.mjs — Lantern-Lens.
//
// A light puzzle: one gold ray leaves the lantern; you drag and rotate a few
// glass slabs and mirrors so the ray bends its way onto an unlit wick. It
// lights, or it doesn't — the beam obeys real 2D optics (reflection, Snell
// refraction, total internal reflection), so a solved level is a geometric
// fact, not a judgment. Inlines the shared engine (lens-core.mjs) and the
// levels (lens-levels.mjs) into a single self-contained page; both are also
// checked headless in lens-verify.mjs. Zero dependencies (Canvas 2D).
//   node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const strip = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')
  .replace(/^import[^\n]*\n/gm, '')      // drop ES imports (everything is in one scope)
  .replace(/^export\s+/gm, '');
const core = strip('lens-core.mjs');
const levels = strip('lens-levels.mjs');

const OUT = path.join(ROOT, 'lantern-lens.html');
fs.writeFileSync(OUT, page(core, levels));
console.log('wrote', OUT, `(${fs.statSync(OUT).size} bytes)`);

function page(coreSrc, levelsSrc) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lantern-Lens — bend the light to the wick</title>
<style>
:root{--bg:hsl(224 34% 7%);--bg2:hsl(224 32% 5%);--ink:hsl(40 28% 92%);--muted:hsl(35 12% 60%);--line:hsl(28 20% 20%);--lantern:hsl(42 74% 66%);--gold:hsl(44 92% 74%)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;color:var(--ink);font:15px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  background:radial-gradient(60% 40% at 50% 0%,hsla(42,80%,60%,.09),transparent 70%),linear-gradient(to bottom,var(--bg),var(--bg2))}
.wrap{max-width:720px;margin:0 auto;padding:0 18px 60px}
header{text-align:center;padding:42px 10px 4px}
h1{margin:0;font-size:31px;color:var(--gold);font-weight:600}
.sub{color:var(--lantern);font-size:12px;letter-spacing:.22em;text-transform:uppercase;margin-top:8px}
.tabs{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:20px 0 0}
.tab{font:inherit;font-size:13px;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:999px;padding:5px 14px;cursor:pointer}
.tab.on{color:var(--bg);background:var(--gold);border-color:var(--gold)}
.tab.done{border-color:var(--lantern);color:var(--lantern)}
.stage{position:relative;margin:16px auto 0;width:100%;max-width:640px;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#0b0f18;box-shadow:0 18px 50px rgba(0,0,0,.45)}
canvas{display:block;width:100%;height:auto;touch-action:none;cursor:grab}
canvas.grabbing{cursor:grabbing}
.hint{color:var(--muted);font-style:italic;text-align:center;max-width:560px;margin:14px auto 0;min-height:42px}
.bar{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;margin:14px 0 0;color:var(--muted);font-size:13px}
button.act{font:inherit;font-size:14px;color:var(--lantern);background:transparent;border:1px solid var(--line);border-radius:999px;padding:8px 18px;cursor:pointer}
button.act:hover{border-color:var(--lantern)}
.status{font-variant:small-caps;letter-spacing:.06em}
.status.lit{color:var(--gold)}
.note{color:var(--muted);font-size:12.5px;max-width:560px;margin:26px auto 0;text-align:center;line-height:1.7}
.note a{color:var(--lantern)}
footer{text-align:center;color:var(--muted);font-size:11.5px;margin-top:34px;border-top:1px solid var(--line);padding-top:14px;opacity:.8}
</style></head>
<body><div class="wrap">
<header>
  <h1>Lantern-Lens</h1>
  <div class="sub">bend the light to the wick</div>
</header>

<div class="tabs" id="tabs"></div>
<div class="stage"><canvas id="cv" width="640" height="420"></canvas></div>
<div class="hint" id="hint"></div>
<div class="bar">
  <span class="status" id="status">dark</span>
  <button class="act" id="reset">reset</button>
  <span style="opacity:.7">drag a piece · scroll or <b>[ ]</b> to turn it</span>
</div>

<div class="note">The beam obeys real optics — it reflects off mirrors and refracts through glass by Snell’s law, with total internal reflection past the critical angle. A level is solved when the traced beam actually touches the wick; the same engine is checked headless in <a href="lens-verify.mjs">lens-verify.mjs</a>.</div>

<footer>a Wright-HQ making · real 2D ray-optics · self-contained, offline, unpublished</footer>
</div>

<script>
${coreSrc}
${levelsSrc}

(() => {
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const W = BOUNDS.w, H = BOUNDS.h;
  let li = 0, work = null, sel = 0, solved = new Array(LEVELS.length).fill(false), dragging = false;

  function loadLevel(i) {
    li = i; sel = 0;
    const L = LEVELS[i];
    work = JSON.parse(JSON.stringify(L.pieces));
    sel = work.findIndex((p) => p.movable); if (sel < 0) sel = 0;
    $('hint').textContent = L.hint;
    renderTabs(); render();
  }
  function renderTabs() {
    $('tabs').innerHTML = '';
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      b.className = 'tab' + (i === li ? ' on' : '') + (solved[i] ? ' done' : '');
      b.textContent = (i + 1) + '. ' + L.name + (solved[i] ? ' ✓' : '');
      b.onclick = () => loadLevel(i);
      $('tabs').appendChild(b);
    });
  }

  const scene = () => levelScene(LEVELS[li], work);
  const cssColor = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function render() {
    const L = LEVELS[li], sc = scene();
    const res = trace(sc);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0f18'; ctx.fillRect(0, 0, W, H);

    // walls (opaque pillars)
    for (const wl of L.walls || []) {
      ctx.strokeStyle = 'hsl(28 16% 26%)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(wl.a.x, wl.a.y); ctx.lineTo(wl.b.x, wl.b.y); ctx.stroke();
    }
    // glass pieces
    for (let i = 0; i < work.length; i++) {
      const p = work[i]; if (p.type !== 'glass') continue;
      ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.angle);
      ctx.fillStyle = 'hsla(40,40%,86%,.14)'; ctx.strokeStyle = i === sel ? cssColor('--gold') : 'hsla(40,50%,80%,.5)';
      ctx.lineWidth = i === sel ? 2 : 1.2;
      ctx.beginPath(); ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // mirror pieces
    for (let i = 0; i < work.length; i++) {
      const p = work[i]; if (p.type !== 'mirror') continue;
      const hl = (p.len || 78) / 2, dx = Math.cos(p.angle) * hl, dy = Math.sin(p.angle) * hl;
      ctx.strokeStyle = i === sel ? cssColor('--gold') : 'hsl(42 40% 62%)'; ctx.lineWidth = i === sel ? 4 : 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.cx - dx, p.cy - dy); ctx.lineTo(p.cx + dx, p.cy + dy); ctx.stroke();
      // a faint backing so a mirror reads as a mirror
      ctx.strokeStyle = 'hsla(220,20%,60%,.35)'; ctx.lineWidth = 1;
      const nx = -Math.sin(p.angle) * 3, ny = Math.cos(p.angle) * 3;
      ctx.beginPath(); ctx.moveTo(p.cx - dx + nx, p.cy - dy + ny); ctx.lineTo(p.cx + dx + nx, p.cy + dy + ny); ctx.stroke();
    }

    // the beam (glow: 3 passes)
    const lit = res.lit;
    for (const [w2, a] of [[7, .10], [3.4, .22], [1.6, lit ? 1 : .82]]) {
      ctx.strokeStyle = lit ? 'hsla(46,95%,72%,' + a + ')' : 'hsla(42,80%,66%,' + a + ')';
      ctx.lineWidth = w2; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(res.path[0].x, res.path[0].y);
      for (let k = 1; k < res.path.length; k++) ctx.lineTo(res.path[k].x, res.path[k].y);
      ctx.stroke();
    }

    // lantern
    ctx.fillStyle = cssColor('--gold'); ctx.beginPath(); ctx.arc(L.lantern.x, L.lantern.y, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = 'hsla(44,80%,66%,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(L.lantern.x, L.lantern.y, 11, 0, 7); ctx.stroke();

    // wick
    const wk = L.wick;
    if (lit) {
      const g = ctx.createRadialGradient(wk.x, wk.y, 0, wk.x, wk.y, 34);
      g.addColorStop(0, 'hsla(46,95%,72%,.55)'); g.addColorStop(1, 'hsla(46,95%,72%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wk.x, wk.y, 34, 0, 7); ctx.fill();
      ctx.fillStyle = cssColor('--gold'); ctx.beginPath(); ctx.arc(wk.x, wk.y, wk.r * 0.7, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = 'hsl(220 14% 46%)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wk.x, wk.y, wk.r, 0, 7); ctx.stroke();
    }

    // status + solved bookkeeping
    const st = $('status');
    st.textContent = lit ? 'lit' : 'dark'; st.className = 'status' + (lit ? ' lit' : '');
    if (lit && !solved[li]) { solved[li] = true; renderTabs(); }
  }

  // ── interaction: drag a piece, turn it ─────────────────────────────────────
  const toScene = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  function pickPiece(pt) {
    let bi = -1, bd = 34;
    for (let i = 0; i < work.length; i++) {
      const p = work[i]; if (!p.movable) continue;
      const d = Math.hypot(p.cx - pt.x, p.cy - pt.y);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }
  cv.addEventListener('pointerdown', (e) => {
    const pt = toScene(e); const i = pickPiece(pt);
    if (i >= 0) { sel = i; dragging = true; cv.setPointerCapture(e.pointerId); cv.classList.add('grabbing'); render(); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!dragging) return; const pt = toScene(e); const p = work[sel];
    p.cx = Math.max(20, Math.min(W - 20, pt.x)); p.cy = Math.max(20, Math.min(H - 20, pt.y)); render();
  });
  const endDrag = (e) => { if (dragging) { dragging = false; cv.classList.remove('grabbing'); try { cv.releasePointerCapture(e.pointerId); } catch (x) {} } };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if (work[sel]) { work[sel].angle += (e.deltaY > 0 ? 1 : -1) * 0.045; render(); } }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (!work || !work[sel]) return;
    if (e.key === '[') { work[sel].angle -= 0.045; render(); }
    else if (e.key === ']') { work[sel].angle += 0.045; render(); }
  });
  $('reset').onclick = () => loadLevel(li);

  loadLevel(0);
})();
</script>
</body></html>`;
}
