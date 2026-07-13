// renga.mjs — CLI entrypoint.
//   node renga.mjs [seed]
// Generates a kasen (deterministic given the integer seed), runs validateKasen,
// and prints (a) the poem verse-by-verse with season/seat/role markers, (b) the
// full machine-check report, and (c) a syllable-confidence summary.

import { generateKasen } from './src/generate.js';
import { validateKasen } from './src/validate.js';
import { movementFor } from './src/rules.js';

const seed = Number.parseInt(process.argv[2] ?? '1', 10);
if (!Number.isFinite(seed)) {
  console.error('usage: node renga.mjs [seed]   (seed must be an integer)');
  process.exit(2);
}

const result = generateKasen(seed);
const { kasen, report } = result;

function roleOf(v) {
  if (v.n === 1) return 'hokku';
  if (v.n === 2) return 'waki';
  if (v.isMoon) return 'moon-seat';
  if (v.isBlossom) return 'blossom-seat';
  if (v.isLove) return 'love';
  return 'verse';
}

const BAR = '═'.repeat(64);
const bar = '─'.repeat(64);

console.log(BAR);
console.log(`  THE RENGA MACHINE — a kasen (36 verses)   seed=${seed}`);
console.log(`  template=${result.template}   attempts=${result.attempts}   generated=${result.ok ? 'PASS' : 'FAIL'}`);
console.log(BAR);
console.log();

// (a) the poem -------------------------------------------------------------
let movementMark = '';
for (const v of kasen) {
  const mv = movementFor(v.n);
  if (mv !== movementMark) {
    movementMark = mv;
    const label = mv === 'jo' ? 'jo — formal opening' : mv === 'ha' ? 'ha — development' : 'kyū — swift close';
    console.log(`  · · ·  ${label}  · · ·`);
    console.log();
  }
  const seat = roleOf(v);
  const season = v.season ? v.season : 'misc';
  const link = v.n === 1 ? '' : v.linked ? ' ⇄link' : ' →shift';
  const flags = [
    season,
    seat,
    `img:${v.salient}`,
    v.confidence.every((c) => c === 'exact') ? 'exact' : 'heuristic',
  ].join('  ');
  console.log(`  ${String(v.n).padStart(2, ' ')}. [ ${flags} ]${link}`);
  for (const line of v.lines) console.log(`        ${line}`);
  console.log();
}

// (b) machine-check report -------------------------------------------------
console.log(bar);
console.log('  MACHINE-CHECK REPORT (src/validate.js — the instrument)');
console.log(bar);
// Re-run independently so the printed verdict is not merely the generator's word.
const independent = validateKasen(kasen);
console.log(`  overall: ${independent.ok ? 'ok (zero hard violations)' : 'FAIL'}`);
console.log();
for (const c of independent.checks) {
  console.log(`  [${c.ok ? '✔' : '✗'}] ${c.rule}`);
  console.log(`        ${c.detail}`);
}
if (independent.violations.length) {
  console.log();
  console.log('  VIOLATIONS:');
  for (const v of independent.violations) console.log(`    - ${v.rule}: ${v.detail || JSON.stringify(v)}`);
}
if (independent.warnings.length) {
  console.log();
  console.log(`  WARNINGS (heuristic-confidence, not failures): ${independent.warnings.length}`);
  for (const w of independent.warnings.slice(0, 10)) console.log(`    - ${w}`);
  if (independent.warnings.length > 10) console.log(`    … (${independent.warnings.length - 10} more)`);
}

// (c) syllable-confidence summary -----------------------------------------
const s = result.stats;
console.log();
console.log(bar);
console.log('  SYLLABLE-CONFIDENCE SUMMARY');
console.log(bar);
console.log(`  lines exact (dictionary-verified): ${s.exactLines}/${s.totalLines}`);
console.log(`  lines heuristic (contain OOV word): ${s.heuristicLines}/${s.totalLines}`);
console.log();
console.log('  LINK vs SHIFT (the honesty seam):');
console.log(`  shift (n↛n-2): ENFORCED by the validator — uchikoshi check above is a hard pass.`);
console.log(`  link  (n→n-1): ${s.linked}/${s.linkable} verses share an ASSOCIATIONS edge with`);
console.log(`         their predecessor (${(s.linkRate * 100).toFixed(0)}%). This is real category-graph`);
console.log(`         linking, but shallow at the surface — topic-adjacency, not a crafted turn.`);
console.log(BAR);

process.exit(independent.ok ? 0 : 1);
