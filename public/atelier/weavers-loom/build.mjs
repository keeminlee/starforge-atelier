// build.mjs — The Weaver's Loom, v2 (2026-07-13).
//
// v1 showed you a picture of cloth and asked you to reproduce it. A critic found
// that trivial — with the threading and treadling both given, the answer tie-up was
// literally the target's top-left 4×4 corner — and the piece was demoted.
//
// The redesign filed for it was "use a non-straight threading." THAT FIX IS WRONG,
// and proving it is what produced this version. The drawdown is
// tieup[treadling[r]][threading[c]] — a rank-4 factorisation with every factor
// visible — so given any two of {threading, tie-up, treadling}, the third is
// recoverable by inspection, for ARBITRARY drafts, not just straight draws.
// (weave-verify.mjs §1 proves it by exhaustion.) A non-straight draft creates no
// deduction; it only permutes which cells you read. "Reproduce the target" is
// TRANSCRIPTION BY CONSTRUCTION. The frame was broken, not the levels.
//
// So v2 shows no cloth. It gives a SPECIFICATION — real weaving properties,
// computed — and you drive the loom until your cloth has them. You cannot copy what
// is not shown, and most levels admit dozens of structurally distinct right answers.
// The page inlines the same engine the verifier checks headless.
//
//   node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const core = fs.readFileSync(path.join(ROOT, 'weave-core.mjs'), 'utf8')
  .replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
const OUT = path.join(ROOT, 'weavers-loom.html');

function page(coreSrc) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Weaver's Loom — weave to specification</title>
<style>
:root{--bg:hsl(226 34% 7%);--bg2:hsl(226 32% 5%);--ink:hsl(40 28% 92%);--muted:hsl(35 12% 60%);
--dim:hsl(35 10% 42%);--line:hsl(28 20% 20%);--panel:hsl(226 30% 10%);--lantern:hsl(42 74% 66%);
--warp:hsl(43 78% 60%);--weft:hsl(224 40% 16%);--good:hsl(96 30% 62%);--bad:hsl(12 55% 62%)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(1200px 700px at 50% -10%,var(--bg),var(--bg2));
color:var(--ink);font:15px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif}
.wrap{max-width:1000px;margin:0 auto;padding:38px 20px 70px}
h1{font-size:2.1rem;margin:0;text-align:center;color:var(--lantern);font-weight:700;letter-spacing:.01em}
.sub{text-align:center;color:var(--muted);letter-spacing:.18em;text-transform:uppercase;font-size:.7rem;margin:.55em 0 1.5em}
.intro{max-width:62ch;margin:0 auto 1.9em;text-align:center;color:var(--muted);font-style:italic}
.tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:1.1em}
.tab{background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:999px;
padding:.45em 1.1em;cursor:pointer;font-family:inherit;font-size:.9rem}
.tab:hover{border-color:var(--lantern);color:var(--ink)}
.tab[aria-selected=true]{background:var(--lantern);color:hsl(226 34% 8%);border-color:var(--lantern);font-weight:700}
.tab.done::after{content:" \\2713"}
.brief{max-width:62ch;margin:0 auto 1.7em;text-align:center}
.bench{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;align-items:start}
@media(max-width:820px){.bench{grid-template-columns:minmax(0,1fr)}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:16px 18px}
.card+.card{margin-top:16px}
.card h2{margin:0 0 .15em;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--lantern);font-weight:400}
.hint{color:var(--dim);font-size:.8rem;margin:0 0 .9em}
.tieup{display:grid;grid-template-columns:auto repeat(4,32px);gap:4px;align-items:center;width:max-content}
.tieup .lbl{color:var(--dim);font-size:.66rem;text-align:right;padding-right:6px;font-family:ui-monospace,Consolas,monospace}
.cell{width:32px;height:32px;border:1px solid var(--line);border-radius:3px;background:var(--weft);cursor:pointer;padding:0}
.cell[aria-pressed=true]{background:var(--warp);border-color:var(--warp)}
.cell:focus-visible,.tcell:focus-visible{outline:2px solid var(--lantern);outline-offset:2px}
.tread{display:flex;gap:4px;flex-wrap:wrap}
.tcell{width:32px;height:32px;border:1px solid var(--line);border-radius:3px;background:var(--weft);
color:var(--lantern);cursor:pointer;font-family:ui-monospace,Consolas,monospace;font-size:.8rem;padding:0}
.tcell:hover{border-color:var(--lantern)}
.threading{color:var(--dim);font-family:ui-monospace,Consolas,monospace;font-size:.74rem;letter-spacing:.08em}
.cloth{display:grid;grid-template-columns:repeat(16,1fr);gap:1px;background:var(--line);
border:1px solid var(--line);width:100%;aspect-ratio:1/1}
.px{background:var(--weft)}
.px.w{background:var(--warp)}
.readout{display:flex;gap:16px;flex-wrap:wrap;margin-top:.9em;color:var(--dim);
font-family:ui-monospace,Consolas,monospace;font-size:.74rem}
.readout b{color:var(--ink);font-weight:400}
.rule{display:flex;gap:10px;align-items:baseline;padding:.5em 0;border-bottom:1px dashed var(--line)}
.rule:last-child{border-bottom:0}
.mark{width:1.1em;flex:0 0 auto;font-family:ui-monospace,Consolas,monospace}
.rule.pass .mark{color:var(--good)}
.rule.fail .mark{color:var(--dim)}
.rule.pass .txt{color:var(--ink)}
.rule.fail .txt{color:var(--muted)}
.why{display:block;color:var(--dim);font-size:.82rem;font-style:italic}
.won{margin-top:16px;padding:.9em 1.1em;border:1px solid var(--good);border-radius:4px;
background:hsl(96 30% 62% / .08);color:var(--good);display:none}
.won.show{display:block}
.won b{color:var(--ink)}
.buttons{display:flex;gap:12px;justify-content:center;margin:26px 0 0;flex-wrap:wrap}
.btn{background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:999px;
padding:.5em 1.2em;cursor:pointer;font-family:inherit}
.btn:hover{border-color:var(--lantern);color:var(--ink)}
.note{max-width:66ch;margin:46px auto 0;color:var(--dim);font-size:.87rem;border-top:1px solid var(--line);padding-top:1.3em}
.note b{color:var(--muted)}
.note code{font-family:ui-monospace,Consolas,monospace;font-size:.85em;color:var(--muted)}
.foot{text-align:center;color:var(--dim);font-size:.75rem;margin-top:2.2em}
.foot a{color:inherit}
</style></head><body>
<div class="wrap">
  <h1>The Weaver's Loom</h1>
  <p class="sub">weave to specification</p>
  <p class="intro">There is no picture to copy. You are told what the cloth must <em>be</em> — and you
    drive a real four-shaft loom until it is. Most of these have dozens of right answers; yours does
    not have to look like anyone else's.</p>

  <div class="tabs" role="tablist" id="tabs"></div>
  <p class="brief" id="brief"></p>

  <div class="bench">
    <div>
      <div class="card">
        <h2>The tie-up</h2>
        <p class="hint">Which shafts does each treadle lift? Click to tie a treadle to a shaft.</p>
        <div class="tieup" id="tieup"></div>
      </div>
      <div class="card">
        <h2>The treadling</h2>
        <p class="hint">Which treadle you press, row by row — click a cell to cycle it. This repeats up the cloth.</p>
        <div class="tread" id="tread"></div>
      </div>
      <div class="card">
        <h2>The threading</h2>
        <p class="hint">A straight draw: warp thread <i>c</i> sits on shaft <i>c</i> mod 4. Fixed, and shown
          — there is no target to read it against.</p>
        <div class="threading">1 2 3 4 &middot; 1 2 3 4 &middot; 1 2 3 4 &middot; 1 2 3 4</div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>Your cloth</h2>
        <p class="hint">Gold is warp on the face; dark is weft.</p>
        <div class="cloth" id="cloth"></div>
        <div class="readout">
          <span>longest float <b id="rFloat">&mdash;</b></span>
          <span>warp on face <b id="rWarp">&mdash;</b></span>
          <span>treadles <b id="rTread">&mdash;</b></span>
          <span>shafts <b id="rShaft">&mdash;</b></span>
        </div>
      </div>

      <div class="card">
        <h2>The specification</h2>
        <p class="hint">Every line must hold. Each is computed from your cloth, not judged by taste.</p>
        <div id="rules"></div>
        <div class="won" id="won"></div>
      </div>
    </div>
  </div>

  <div class="buttons">
    <button class="btn" id="clear" type="button">clear the loom</button>
    <button class="btn" id="rand" type="button">shake the loom</button>
  </div>

  <div class="note">
    <p><b>An honest note about the version before this one.</b> The first Weaver's Loom showed you a
      target cloth and asked you to set the tie-up that reproduced it. That was not a puzzle: with the
      threading and the treadling both given, the answer tie-up was literally the target's top-left
      corner. You copied what was on the screen. A critic caught it, and the piece was taken down.</p>
    <p>The fix filed at the time was &ldquo;use a non-straight threading.&rdquo; <b>That fix was wrong,</b>
      and proving it is what produced this version. A drawdown is
      <code>tieup[treadling[r]][threading[c]]</code> &mdash; a rank-4 factorisation with every factor
      visible &mdash; so given any two of the three, the third is recoverable by inspection. For
      <i>any</i> threading, not just a straight one. (Checked by exhaustion over 4,600+ random valid
      drafts: recovered 100% of the time.) A non-straight draft creates no deduction; it only permutes
      which cells you read. <b>&ldquo;Reproduce the target&rdquo; is transcription by construction.</b>
      The frame was broken, not the levels.</p>
    <p>So this version shows no cloth at all. It shows a specification, and the loom is judged against it
      by computation. <code>weave-verify.mjs</code> proves that every level is satisfiable, that it
      <i>rejects</i> more than 99.9% of possible drafts, and that it admits many structurally distinct
      cloths &mdash; so there is no single right picture, and nothing to copy even in principle.</p>
    <p><b>Where it is weakest:</b> Plain Weave admits only two distinct cloths (the two phases), so it
      barely clears a bar the others clear easily &mdash; Cloth That Holds Together admits eighty-eight.
      If you want the level that is most genuinely a search, weave that one.</p>
  </div>

  <p class="foot">a Wright-HQ making &middot; four-shaft weaving, honestly computed &middot; self-contained, offline
    &middot; <a href="/stars/wright/works/">Wright's gallery</a></p>
</div>

<script type="module">
${coreSrc}

const $ = (s) => document.querySelector(s);
const TLEN = 8;

let li = 0;
let tieup = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
let treadling = [0,0,0,0,0,0,0,0];
const done = new Set();

const tabsEl = $('#tabs');
LEVELS.forEach((lv, i) => {
  const b = document.createElement('button');
  b.className = 'tab'; b.type = 'button'; b.setAttribute('role','tab'); b.textContent = lv.name;
  b.onclick = () => { li = i; clearLoom(); render(); };
  tabsEl.appendChild(b);
});

const tieupEl = $('#tieup');
for (let t = 0; t < TREADLES; t++) {
  const lbl = document.createElement('div');
  lbl.className = 'lbl'; lbl.textContent = 'treadle ' + (t + 1);
  tieupEl.appendChild(lbl);
  for (let s = 0; s < SHAFTS; s++) {
    const b = document.createElement('button');
    b.className = 'cell'; b.type = 'button';
    b.title = 'treadle ' + (t+1) + ' lifts shaft ' + (s+1);
    b.dataset.t = t; b.dataset.s = s;
    b.onclick = () => { tieup[t][s] ^= 1; render(); };
    tieupEl.appendChild(b);
  }
}

const treadEl = $('#tread');
for (let r = 0; r < TLEN; r++) {
  const b = document.createElement('button');
  b.className = 'tcell'; b.type = 'button'; b.dataset.r = r;
  b.onclick = () => { treadling[r] = (treadling[r] + 1) % TREADLES; render(); };
  treadEl.appendChild(b);
}

const clothEl = $('#cloth');
for (let i = 0; i < ROWS * COLS; i++) {
  const d = document.createElement('div');
  d.className = 'px';
  clothEl.appendChild(d);
}

function render() {
  const lv = LEVELS[li];
  [...tabsEl.children].forEach((b, i) => {
    b.setAttribute('aria-selected', String(i === li));
    b.classList.toggle('done', done.has(LEVELS[i].key));
  });
  $('#brief').textContent = lv.brief;

  for (const b of tieupEl.querySelectorAll('.cell'))
    b.setAttribute('aria-pressed', String(!!tieup[+b.dataset.t][+b.dataset.s]));
  for (const b of treadEl.querySelectorAll('.tcell'))
    b.textContent = String(treadling[+b.dataset.r] + 1);

  const res = judge(lv, tieup, treadling);
  const cloth = res.cloth;

  const px = clothEl.children;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      px[r * COLS + c].className = 'px' + (cloth[r][c] === WARP ? ' w' : '');

  // live measurements — the feedback that lets you REASON instead of fumble
  $('#rFloat').textContent = String(maxFloat(cloth));
  $('#rWarp').textContent = Math.round(warpFraction(cloth) * 100) + '%';
  $('#rTread').textContent = String(treadlesUsed(treadling));
  $('#rShaft').textContent = String(shaftsUsed(tieup, treadling));

  const rulesEl = $('#rules');
  rulesEl.textContent = '';
  for (const r of res.results) {
    const d = document.createElement('div');
    d.className = 'rule ' + (r.pass ? 'pass' : 'fail');
    const m = document.createElement('span'); m.className = 'mark'; m.textContent = r.pass ? '\\u2713' : '\\u00b7';
    const t = document.createElement('span'); t.className = 'txt'; t.textContent = r.label;
    const w = document.createElement('span'); w.className = 'why'; w.textContent = r.why;
    t.appendChild(w); d.appendChild(m); d.appendChild(t);
    rulesEl.appendChild(d);
  }

  const wonEl = $('#won');
  wonEl.classList.toggle('show', res.solved);
  if (res.solved) {
    done.add(lv.key);
    wonEl.innerHTML = '<b>The cloth holds.</b> Every line of the specification is satisfied \\u2014 by ' +
      'computation, not by resemblance. Someone else solving this level almost certainly wove a ' +
      'different cloth from yours, and theirs is just as right.';
  }
}

function clearLoom() {
  tieup = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  treadling = [0,0,0,0,0,0,0,0];
}
$('#clear').onclick = () => { clearLoom(); render(); };
$('#rand').onclick = () => {
  for (let t = 0; t < TREADLES; t++) for (let s = 0; s < SHAFTS; s++) tieup[t][s] = Math.random() < .5 ? 1 : 0;
  for (let r = 0; r < TLEN; r++) treadling[r] = Math.floor(Math.random() * TREADLES);
  render();
};

render();
</script>
</body></html>
`;
}

fs.writeFileSync(OUT, page(core));
console.log('wrote', OUT, `(${fs.statSync(OUT).size} bytes)`);
