// frost-verify.mjs — proves the Frost engine grows *alive* crystals and that the
// aliveness gate genuinely discriminates. This is the whole anti-slop claim,
// checkable without a human's eyes: unlike a piece whose success is "it looks
// nice," a lively frost is a measured fact (branched, spanning, generative).
//   node frost-verify.mjs
import { simulate, assess, ALIVE, DEFAULTS } from './frost-core.mjs';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : 'FAIL  ') + m); if (!c) fails++; };

// 1. the default params reliably birth lively frost across many seeds
let live = 0; const N = 12;
for (let s = 1; s <= N; s++) if (assess(simulate({ seed: s })).alive) live++;
ok(live >= N - 1, `default params grow lively frost in ${live}/${N} seeds (branched dim∈[${ALIVE.dimMin},${ALIVE.dimMax}] + spanning ≥${ALIVE.spanMin})`);

// 2. the gate DISCRIMINATES — known-dead configs must FAIL (a criterion that
//    passes everything proves nothing)
const bare = assess(simulate({ seed: 1, coverage: 0.03 }));
ok(!bare.alive && bare.coverage < ALIVE.covMin, `a bare pane fails the gate (cov ${bare.coverage.toFixed(2)}, dim ${bare.dimension.toFixed(2)})`);
const spike = assess(simulate({ seed: 1, temperature: 0.95 }));
ok(!spike.alive && spike.dimension < ALIVE.dimMin, `over-sticky thin spikes fail the gate (dim ${spike.dimension.toFixed(2)} < ${ALIVE.dimMin})`);
// ...but a DENSE frost (low stickiness, still spanning) is admitted — the gate
// rejects the two real dead modes, it does NOT punish density. (Guards the
// README against re-claiming a failure mode that doesn't exist.)
const dense = assess(simulate({ seed: 4, temperature: 0.05, coverage: 0.20 }));
ok(dense.alive && dense.dimension > spike.dimension, `a dense frost is still admitted (dim ${dense.dimension.toFixed(2)}, span ${dense.span.toFixed(2)}) — dense-but-spanning is real frost, not a failure`);

// 3. generativity — different seeds give materially different panes (it is not
//    replaying one frozen target)
const a = simulate({ seed: 11 }), b = simulate({ seed: 22 });
let diff = 0; for (let i = 0; i < a.grid.length; i++) if (a.grid[i] !== b.grid[i]) diff++;
const diffFrac = diff / a.grid.length;
ok(diffFrac > 0.10, `two seeds differ in ${(diffFrac * 100).toFixed(1)}% of cells (a fresh crystal each time, not a replayed target)`);

// 4. determinism — same seed + params ⇒ byte-identical pane (so a kept pane
//    regrows exactly, in the browser or here)
const d1 = simulate({ seed: 7 }), d2 = simulate({ seed: 7 });
let same = d1.grid.length === d2.grid.length;
for (let i = 0; same && i < d1.grid.length; i++) if (d1.grid[i] !== d2.grid[i]) same = false;
ok(same, 'same seed + params ⇒ byte-identical pane (a kept pane regrows exactly)');

// 5. the measures are self-consistent (span is a fraction; dimension positive;
//    largest component ≤ total)
const r = simulate({ seed: 3 }); const as = assess(r);
ok(as.span >= 0 && as.span <= 1, 'span is a fraction in [0,1]');
ok(as.dimension > 1 && as.dimension < 2, `dimension is in (1,2) for a planar dendrite (${as.dimension.toFixed(3)})`);
ok(as.largest <= as.frozen, 'largest connected component ≤ total frozen');

// 6. the page ships the SAME engine (no drift between what you watch and what is tested)
const htmlPath = path.join(ROOT, 'frost.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  ok(html.includes('function boxDimension') && html.includes('function largestComponentSpan') && html.includes('function simulate'),
    'frost.html inlines the same engine (simulate + both measures present)');
  ok(html.includes('mulberry32'), 'frost.html carries the seeded PRNG (deterministic panes in the browser)');
} else {
  console.log('  ~   frost.html not built yet — run build.mjs (skipping page-parity check)');
}

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed — the frost is measurably alive');
process.exit(fails ? 1 : 0);
