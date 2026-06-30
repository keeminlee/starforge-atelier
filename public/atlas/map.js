/* The Constellation — an interactive force-directed map of the whole Atlas.
 * Each published entry is a node (colored by family); each manifest `related`
 * link is an edge. Data comes from window.ATLAS_ENTRIES (generated entries.js).
 * Hover a star to light its connections; click to open it. No dependencies. */
(function () {
  'use strict';
  const entries = window.ATLAS_ENTRIES || [];
  const canvas = document.getElementById('map');
  if (!canvas || !entries.length) return;
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  const info = document.getElementById('info');

  const FAMILY_COLORS = {
    'Cellular Automata': '#7fd1c1',
    'Collective Motion': '#e0a35e',
    'Pattern Formation': '#c98bd0',
    'Criticality':       '#e0675e',
    'Synchronization':   '#86c06a',
    'Networks':          '#6fa6d6',
    'Social Dynamics':   '#d6c46f',
  };
  const colorOf = (cat) => FAMILY_COLORS[cat] || '#9aa0ad';

  // ---- build graph ----
  const index = {};
  entries.forEach((e, i) => { index[e.slug] = i; });
  const nodes = entries.map((e, i) => ({
    i, slug: e.slug, title: e.title, cat: e.category, blurb: e.blurb,
    color: colorOf(e.category), x: 0, y: 0, vx: 0, vy: 0, deg: 0,
  }));
  const seen = new Set(); const edges = [];
  entries.forEach((e, i) => (e.related || []).forEach((r) => {
    const j = index[r]; if (j == null) return;
    const a = Math.min(i, j), b = Math.max(i, j), key = a + '-' + b;
    if (seen.has(key)) return; seen.add(key);
    edges.push([a, b]); nodes[a].deg++; nodes[b].deg++;
  }));

  // ---- canvas sizing (high-DPI) ----
  let W, H, dpr;
  function resize() {
    const cssW = host.clientWidth || 760;
    const cssH = Math.max(420, Math.round(cssW * 0.66));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cssW; H = cssH;
    canvas.style.width = cssW + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  new ResizeObserver(resize).observe(host);

  // seed positions on a circle (deterministic, settles cleanly)
  nodes.forEach((n, k) => {
    const a = (k / nodes.length) * Math.PI * 2;
    n.x = W / 2 + Math.cos(a) * W * 0.3;
    n.y = H / 2 + Math.sin(a) * H * 0.28;
  });

  const radius = (n) => 5 + Math.min(n.deg, 6) * 1.7;

  function step() {
    for (let a = 0; a < nodes.length; a++) {
      const na = nodes[a];
      for (let b = a + 1; b < nodes.length; b++) {
        const nb = nodes[b];
        let dx = na.x - nb.x, dy = na.y - nb.y;
        let d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2);
        const f = 2400 / d2, ux = dx / d, uy = dy / d;
        na.vx += ux * f; na.vy += uy * f; nb.vx -= ux * f; nb.vy -= uy * f;
      }
    }
    const L = 92;
    for (const [a, b] of edges) {
      const na = nodes[a], nb = nodes[b];
      let dx = nb.x - na.x, dy = nb.y - na.y, d = Math.hypot(dx, dy) || 0.01;
      const f = (d - L) * 0.02, ux = dx / d, uy = dy / d;
      na.vx += ux * f; na.vy += uy * f; nb.vx -= ux * f; nb.vy -= uy * f;
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.006; n.vy += (H / 2 - n.y) * 0.006;
      n.vx *= 0.85; n.vy *= 0.85; n.x += n.vx; n.y += n.vy;
      const m = 18; n.x = Math.max(m, Math.min(W - m, n.x)); n.y = Math.max(m, Math.min(H - m, n.y));
    }
  }

  let hovered = -1;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06070a'; ctx.fillRect(0, 0, W, H);
    const neigh = new Set();
    if (hovered >= 0) {
      neigh.add(hovered);
      for (const [a, b] of edges) { if (a === hovered) neigh.add(b); if (b === hovered) neigh.add(a); }
    }
    for (const [a, b] of edges) {
      const on = hovered < 0 || a === hovered || b === hovered;
      ctx.strokeStyle = on ? 'rgba(127,209,193,0.45)' : 'rgba(120,130,150,0.12)';
      ctx.lineWidth = on ? 1.4 : 0.8;
      ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.font = '10.5px ui-monospace, monospace';
    for (const n of nodes) {
      const active = hovered < 0 || neigh.has(n.i);
      const r = radius(n);
      ctx.globalAlpha = active ? 1 : 0.22;
      ctx.fillStyle = n.color;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
      if (n.i === hovered) { ctx.lineWidth = 2; ctx.strokeStyle = '#e7e2d6'; ctx.stroke(); }
      ctx.globalAlpha = active ? (hovered < 0 ? 0.62 : 1) : 0.12;
      ctx.fillStyle = '#e7e2d6';
      ctx.fillText(n.title, n.x, n.y - r - 5);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run: animate, or settle statically under reduced-motion ----
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { for (let k = 0; k < 500; k++) step(); draw(); }
  else {
    let frames = 0;
    (function loop() {
      // settle for a few seconds, then idle (still redraw on hover)
      if (frames++ < 600) step();
      draw();
      requestAnimationFrame(loop);
    })();
  }

  // ---- interaction ----
  const toLocal = (ev) => {
    const r = canvas.getBoundingClientRect();
    return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H];
  };
  const nodeAt = (mx, my) => {
    let best = -1, bestD = 1e9;
    for (const n of nodes) {
      const d = Math.hypot(n.x - mx, n.y - my);
      if (d <= radius(n) + 6 && d < bestD) { bestD = d; best = n.i; }
    }
    return best;
  };
  canvas.addEventListener('pointermove', (ev) => {
    const [mx, my] = toLocal(ev);
    hovered = nodeAt(mx, my);
    canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
    if (info) {
      if (hovered >= 0) { const n = nodes[hovered]; info.innerHTML = '<strong>' + n.title + '</strong> &middot; ' + n.cat + '<br>' + n.blurb; info.style.opacity = '1'; }
      else { info.style.opacity = '0'; }
    }
    if (reduce) draw();
  });
  canvas.addEventListener('pointerleave', () => { hovered = -1; if (info) info.style.opacity = '0'; if (reduce) draw(); });
  canvas.addEventListener('pointerup', (ev) => {
    const [mx, my] = toLocal(ev);
    const h = nodeAt(mx, my);
    if (h >= 0) location.href = 'entries/' + nodes[h].slug + '/index.html';
  });

  // ---- legend ----
  const legend = document.getElementById('legend');
  if (legend) {
    const fams = [];
    entries.forEach((e) => { if (!fams.includes(e.category)) fams.push(e.category); });
    legend.innerHTML = fams.map((f) =>
      '<span class="leg"><i style="background:' + colorOf(f) + '"></i>' + f + '</span>').join('');
  }
})();
