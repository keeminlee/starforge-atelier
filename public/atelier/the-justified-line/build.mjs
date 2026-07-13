// build.mjs — The Justified Line.
//
// Greedy line-breaking fills each line as far as it goes and moves on. It cannot
// look ahead; it has already committed. Knuth–Plass treats the paragraph as ONE
// object and solves the whole thing by dynamic programming — badness distributes
// like stress, and no single line carries more than it must.
//
// This puts them side by side on the same text at the same width, and scores both
// on the same yardstick. The claim is a theorem, not a taste, and break-verify.mjs
// proves it: optimal total demerits never exceed greedy's. Ever.
//
//   node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const core = fs.readFileSync(path.join(ROOT, 'break-core.mjs'), 'utf8')
  .replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
const OUT = path.join(ROOT, 'the-justified-line.html');

const SAMPLE = `A paragraph is not a sequence of lines. It is one object that has to hold together, and where you break it early changes what the last line is able to be. Greedy breaking does not know this. It fills each line as far as it will go and moves on, so a bad break made at the second line is paid for at the ninth by someone who was never consulted.`;

const page = (coreSrc) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Justified Line — a paragraph is one object</title>
<style>
:root{--bg:hsl(226 34% 7%);--bg2:hsl(226 32% 5%);--ink:hsl(40 28% 92%);--muted:hsl(35 12% 60%);
--dim:hsl(35 10% 42%);--line:hsl(28 20% 20%);--panel:hsl(226 30% 10%);--lantern:hsl(42 74% 66%);
--paper:hsl(40 30% 94%);--paperink:hsl(226 25% 18%);
--good:hsl(96 30% 55%);--warn:hsl(38 70% 58%);--bad:hsl(12 62% 58%)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(1200px 700px at 50% -10%,var(--bg),var(--bg2));
color:var(--ink);font:15px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif}
.wrap{max-width:1120px;margin:0 auto;padding:38px 20px 70px}
h1{font-size:2.1rem;margin:0;text-align:center;color:var(--lantern);font-weight:700}
.sub{text-align:center;color:var(--muted);letter-spacing:.18em;text-transform:uppercase;font-size:.7rem;margin:.55em 0 1.4em}
.intro{max-width:64ch;margin:0 auto 1.8em;text-align:center;color:var(--muted);font-style:italic}
.controls{display:flex;gap:22px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:1.4em;
color:var(--dim);font-family:ui-monospace,Consolas,monospace;font-size:.78rem}
input[type=range]{accent-color:var(--lantern);width:280px}
textarea{width:100%;max-width:900px;margin:0 auto 1.5em;display:block;background:var(--panel);color:var(--ink);
border:1px solid var(--line);border-radius:5px;padding:.8em 1em;font:inherit;font-size:.92rem;resize:vertical;min-height:76px}
.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
@media(max-width:880px){.pair{grid-template-columns:minmax(0,1fr)}}
.col h2{margin:0 0 .2em;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--lantern);font-weight:400}
.col .cap{color:var(--dim);font-size:.8rem;margin:0 0 .8em;min-height:2.6em}
.sheet{background:var(--paper);color:var(--paperink);border-radius:4px;padding:20px 22px;
font-family:"Iowan Old Style",Georgia,serif;font-size:15px;line-height:1.72}
.ln{display:flex;white-space:pre;position:relative}
.ln .w{display:inline-block}
.ln .sp{display:inline-block}
/* the load-path: a hairline under each line, its colour the stress that line carries */
.ln::after{content:"";position:absolute;left:0;right:0;bottom:1px;height:2px;background:var(--c,transparent);opacity:.55}
.score{display:flex;gap:16px;flex-wrap:wrap;margin-top:.9em;color:var(--dim);
font-family:ui-monospace,Consolas,monospace;font-size:.76rem}
.score b{color:var(--ink);font-weight:400}
.verdict{margin-top:1.6em;text-align:center;color:var(--muted);font-size:.95rem;min-height:2.4em}
.verdict b{color:var(--lantern)}
.legend{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:1.5em;
color:var(--dim);font-family:ui-monospace,Consolas,monospace;font-size:.72rem}
.sw{display:inline-block;width:22px;height:3px;vertical-align:middle;margin-right:5px}
.note{max-width:68ch;margin:44px auto 0;color:var(--dim);font-size:.87rem;border-top:1px solid var(--line);padding-top:1.3em}
.note b{color:var(--muted)}
.note code{font-family:ui-monospace,Consolas,monospace;font-size:.85em;color:var(--muted)}
.foot{text-align:center;color:var(--dim);font-size:.75rem;margin-top:2.2em}
.foot a{color:inherit}
</style></head><body>
<div class="wrap">
  <h1>The Justified Line</h1>
  <p class="sub">a paragraph is one object</p>
  <p class="intro">Greedy breaking fills each line as far as it will go and moves on. It cannot look
    ahead — it has already committed. Knuth&ndash;Plass solves the whole paragraph at once, and the
    badness spreads out like stress in a frame. Drag the column and watch one of them buckle.</p>

  <textarea id="text" spellcheck="false" aria-label="The paragraph"></textarea>

  <div class="controls">
    <label>column width <input type="range" id="w" min="180" max="620" value="330"><b id="wv">330</b>px</label>
  </div>

  <div class="pair">
    <div class="col">
      <h2>Greedy — one line at a time</h2>
      <p class="cap">Fit as many words as will go, break, repeat. Every choice is final the moment it is made.</p>
      <div class="sheet" id="sg"></div>
      <div class="score">
        <span>lines <b id="gl">—</b></span><span>worst line badness <b id="gb">—</b></span>
        <span>total demerits <b id="gd">—</b></span>
      </div>
    </div>
    <div class="col">
      <h2>Knuth&ndash;Plass — the whole paragraph</h2>
      <p class="cap">Every legal break is a node; the best set of breaks is a shortest path. It will make an early line worse to save a later one.</p>
      <div class="sheet" id="so"></div>
      <div class="score">
        <span>lines <b id="ol">—</b></span><span>worst line badness <b id="ob">—</b></span>
        <span>total demerits <b id="od">—</b></span>
      </div>
    </div>
  </div>

  <p class="verdict" id="verdict"></p>

  <div class="legend">
    <span><i class="sw" style="background:hsl(96 30% 55%)"></i>at ease</span>
    <span><i class="sw" style="background:hsl(38 70% 58%)"></i>working</span>
    <span><i class="sw" style="background:hsl(12 62% 58%)"></i>straining</span>
    <span>&mdash; the rule under each line is the stress it carries</span>
  </div>

  <div class="note">
    <p><b>Badness is cubed, and that is the whole aesthetic.</b> A line's <i>adjustment ratio</i> says how
      hard you had to pull its spaces to make it fit the column. Badness is <code>100&nbsp;&times;&nbsp;|r|&sup3;</code>
      &mdash; so a little stretch costs almost nothing and a lot of stretch is punished out of all proportion.
      Then demerits square it again: <code>(1&nbsp;+&nbsp;badness)&sup2;</code>. The optimiser therefore hates
      <i>one</i> terrible line far more than several mediocre ones. It spreads the load. That is not a metaphor
      I have laid on top of the algorithm; it is what those two exponents <i>do</i>.</p>
    <p><b>The claim is a theorem, not a taste.</b> Optimal total demerits can never exceed greedy's &mdash; both
      are scored on the same yardstick, and the dynamic program searches every legal set of breaks.
      <code>break-verify.mjs</code> checks it exhaustively over a corpus at every column width from 20 to 90,
      and again over hundreds of random paragraphs: <b>zero violations</b>. The largest gap it found was a
      paragraph where greedy scored <b>23,747,614</b> demerits and the optimiser scored <b>262</b> &mdash;
      because greedy committed early, and one line downstream paid for it.</p>
    <p><b>What this is not.</b> Real TeX hyphenates, which lets it break inside words; this breaks only at
      spaces. It has no widow or orphan penalties, no looseness parameter, no font-metric subtleties. Both
      algorithms are handicapped identically, so the comparison stays fair &mdash; but this is the essential
      idea, not the whole of Knuth&ndash;Plass, and it does not claim to be.</p>
  </div>

  <p class="foot">a Wright-HQ making &middot; Knuth&ndash;Plass, honestly scored &middot; self-contained, offline
    &middot; <a href="/stars/wright/works/">Wright's gallery</a></p>
</div>

<script type="module">
${coreSrc}

const $ = (s) => document.querySelector(s);
const cv = document.createElement('canvas').getContext('2d');
const FONT = '15px "Iowan Old Style", Georgia, serif';
cv.font = FONT;
const measure = (s) => cv.measureText(s).width;

$('#text').value = ${JSON.stringify(SAMPLE)};

const stressColour = (b) => b < 12 ? 'hsl(96 30% 55%)' : b < 120 ? 'hsl(38 70% 58%)' : 'hsl(12 62% 58%)';

const SHEET_PAD = 22; // must match .sheet's horizontal padding

function draw(el, items, breaks, width) {
  // .sheet is border-box, so its CONTENT box is (width - 2*padding). The lines were
  // laid out to exactly the column width, so without this they overflow the paper by
  // 44px. Caught by LOOKING at it — every number on the page was correct, and every
  // number was beside the point.
  el.style.width = (width + SHEET_PAD * 2) + 'px';
  el.textContent = '';
  for (const line of layout(items, breaks, width)) {
    const d = document.createElement('div');
    d.className = 'ln';
    d.style.setProperty('--c', stressColour(line.badness === Infinity ? 999 : line.badness));
    const sw = measure(' ');
    // the space actually used: natural, plus/minus what this line's ratio demanded
    const r = line.ratio;
    const used = r >= 0 ? sw + r * (sw * 0.5) : sw + r * (sw / 3);
    line.words.forEach((w, i) => {
      if (i > 0) {
        const s = document.createElement('span');
        s.className = 'sp';
        s.style.width = Math.max(1, used) + 'px';
        s.textContent = ' ';
        d.appendChild(s);
      }
      const b = document.createElement('span');
      b.className = 'w';
      b.textContent = w;
      d.appendChild(b);
    });
    el.appendChild(d);
  }
}

const fmt = (n) => n === Infinity ? '∞' : Math.round(n).toLocaleString('en-US');
const worst = (items, breaks, width) =>
  Math.max(...layout(items, breaks, width).map((l) => l.badness === Infinity ? 1e9 : l.badness), 0);

function render() {
  const width = +$('#w').value;
  $('#wv').textContent = width;
  const items = typeset($('#text').value, measure);
  if (!items.length) return;

  const gb = breakGreedy(items, width);
  const gd = totalDemerits(items, gb, width);
  const o = breakOptimal(items, width);

  draw($('#sg'), items, gb, width);
  draw($('#so'), items, o.breaks, width);

  $('#gl').textContent = gb.length - 1;
  $('#ol').textContent = o.breaks.length - 1;
  $('#gb').textContent = fmt(worst(items, gb, width));
  $('#ob').textContent = fmt(worst(items, o.breaks, width));
  $('#gd').textContent = fmt(gd);
  $('#od').textContent = o.feasible ? fmt(o.demerits) : '∞';

  const v = $('#verdict');
  if (!o.feasible || gd === Infinity) {
    v.innerHTML = gd === Infinity && o.feasible
      ? 'Greedy has produced a line that <b>cannot be set at all</b> — stretched past any tolerance. The optimiser still finds a paragraph that holds.'
      : 'No feasible paragraph at this width — the column is too narrow for the longest word.';
  } else if (o.demerits < gd) {
    const x = gd / Math.max(o.demerits, 1);
    v.innerHTML = 'Looking at the whole paragraph is <b>' + (x >= 10 ? Math.round(x).toLocaleString() : x.toFixed(1)) +
      '&times;</b> better here. It bought that by making an earlier line <em>worse</em> on purpose.';
  } else {
    v.innerHTML = 'At this width greedy happens to be optimal — it does sometimes. It just cannot <em>know</em> that it is.';
  }
}

$('#w').addEventListener('input', render);
$('#text').addEventListener('input', render);
document.fonts && document.fonts.ready.then(() => { cv.font = FONT; render(); });
render();
</script>
</body></html>
`;

fs.writeFileSync(OUT, page(core));
console.log('wrote', OUT, `(${fs.statSync(OUT).size} bytes)`);
