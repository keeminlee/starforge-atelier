#!/usr/bin/env node
// weave-verify.mjs — prove the loom, and prove the PUZZLE. v2 (2026-07-13).
//
// v1's verifier asserted its own flaw (§4b): with a straight draw and an
// advancing treadling, the answer tie-up was literally the target's top-left 4×4
// corner, so "solving" was transcription, not deduction. The filed bronze said
// that assertion must FLIP when the triviality was genuinely gone.
//
// This is the flip — but NOT by the route the bronze proposed. See §1: the
// bronze's own suggested fix does not work, and §1 proves it.
//
//   node weave-verify.mjs

import {
  SHAFTS, TREADLES, ROWS, COLS, WARP, drawdown, weave,
  maxFloat, warpFraction, hasTwillDiagonal,
  LEVELS, judge, clothKey,
} from './weave-core.mjs';

let fails = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) fails++; };
const head = (s) => console.log(`\n${s}`);

// ─────────────────────────────────────────────────────────────────────────────
head('1. WHY v1 COULD NOT HAVE WORKED — and why the filed fix was wrong');
// The drawdown is a rank-4 factorisation with every factor visible. Given any two
// of {threading, tie-up, treadling}, the third is recoverable BY INSPECTION — for
// ARBITRARY drafts, not merely straight draws. So the bronze's filed fix ("use a
// non-straight threading") does NOT create deduction; it only permutes which
// cells you read. Proved by exhaustion.
{
  let s = 12345;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const draft = (n) => Array.from({ length: n }, () => Math.floor(rnd() * SHAFTS));
  let trials = 0, recovered = 0;
  for (let i = 0; i < 6000; i++) {
    const threading = draft(COLS), treadling = draft(ROWS);
    const tieup = Array.from({ length: TREADLES }, () => Array.from({ length: SHAFTS }, () => (rnd() < 0.5 ? 1 : 0)));
    if (new Set(threading).size < SHAFTS || new Set(treadling).size < TREADLES) continue;
    trials++;
    const cloth = drawdown(threading, tieup, treadling);
    const guess = Array.from({ length: TREADLES }, () => new Array(SHAFTS).fill(null));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) guess[treadling[r]][threading[c]] = cloth[r][c];
    if (JSON.stringify(guess) === JSON.stringify(tieup)) recovered++;
  }
  // A vacuous pass is not a pass. (Learned twice in one night; guarded here.)
  ok(trials >= 1000, `enough random drafts to conclude anything at all (${trials})`);
  ok(trials > 0 && recovered === trials,
    `tie-up recovered by inspection in ${recovered}/${trials} ARBITRARY drafts → "reproduce the target" is transcription BY CONSTRUCTION, for ANY threading`);
}

// ─────────────────────────────────────────────────────────────────────────────
head('2. THE FLIP — nothing can be transcribed, because nothing is shown');
// The v1 triviality is not patched; the frame that made it inevitable is gone.
// There is no target cloth in the level data, so there is no cell to read an
// answer off. The §4b corner-read is now unstateable.
for (const lv of LEVELS) {
  const exposed = Object.keys(lv).some((k) => /target|cloth|answer|tieup|treadling|solution/i.test(k));
  ok(!exposed, `"${lv.name}": exposes no target cloth and no answer — nothing to copy`);
}

// ─────────────────────────────────────────────────────────────────────────────
head('3. The drawdown engine is still correct (it was never the problem)');
{
  const plain = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 0, 1]];
  const cloth = weave(plain, [0, 1]);
  ok(cloth.length === ROWS && cloth[0].length === COLS, `drawdown is ${ROWS}×${COLS}`);
  ok(cloth[0][0] === WARP && cloth[0][1] === 0, 'row 0 alternates warp/weft');
  ok(cloth[1][0] === 0 && cloth[1][1] === WARP, 'row 1 is its opposite — over one, under one');
  ok(maxFloat(cloth) === 1, 'plain weave floats exactly 1 everywhere');
  ok(Math.abs(warpFraction(cloth) - 0.5) < 1e-9, 'plain weave is exactly balanced');
  const twill = [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 1], [1, 0, 0, 1]];
  ok(hasTwillDiagonal(twill, [0, 1, 2, 3]), '2/2 twill walked 0→3 has a continuous diagonal');
  ok(maxFloat(weave(twill, [0, 1, 2, 3])) === 2, 'a 2/2 twill floats exactly 2');
  ok(!hasTwillDiagonal(plain, [0, 1]), 'plain weave has no diagonal');
}

// ─────────────────────────────────────────────────────────────────────────────
head('4. EVERY LEVEL: satisfiable · admits MANY distinct cloths · and REJECTS');
// Exhaustive over all 65,536 tie-ups × all 256 period-4 treadlings. Players may
// use longer treadlings, so this is a LOWER BOUND on the solution set — honestly
// so.
const allTieups = [];
for (let bits = 0; bits < 65536; bits++) {
  const tu = [];
  for (let t = 0; t < TREADLES; t++) {
    const row = [];
    for (let s = 0; s < SHAFTS; s++) row.push((bits >> (t * SHAFTS + s)) & 1);
    tu.push(row);
  }
  allTieups.push(tu);
}
const allTreadlings = [];
for (let n = 0; n < 256; n++) allTreadlings.push([n & 3, (n >> 2) & 3, (n >> 4) & 3, (n >> 6) & 3]);

// The cloth depends only on the SEQUENCE OF LIFTS the treadling pulls out of the
// tie-up — at most 16^4 distinct sequences, not 16.7M. Everything a rule can ask
// about the cloth is therefore memoisable on that sequence. (First pass recomputed
// a 16×16 drawdown 16.7M times per level and ran for over five minutes; this is
// the same search, just not doing 256× redundant work.)
const report = [];
for (const lv of LEVELS) {
  const cloths = new Set();
  const memo = new Map();
  let solutions = 0, tested = 0, witness = null;
  for (const tu of allTieups) {
    for (const tr of allTreadlings) {
      tested++;
      // treadlesUsed is the only thing a rule asks that the lift-sequence can't answer
      const key = tr.map((t) => tu[t].join('')).join('|') + '#' + new Set(tr).size;
      let hit = memo.get(key);
      if (hit === undefined) {
        const j = judge(lv, tu, tr);
        hit = j.solved ? clothKey(j.cloth) : null;
        memo.set(key, hit);
      }
      if (hit !== null) {
        solutions++;
        cloths.add(hit);
        if (!witness) witness = { tieup: tu, treadling: tr };
      }
    }
  }
  const rate = solutions / tested;
  report.push({ lv, solutions, distinct: cloths.size, tested, rate, witness });

  ok(solutions > 0, `"${lv.name}": SATISFIABLE — ${solutions.toLocaleString()} solutions exist`);
  // THE ANTI-TRANSCRIPTION CLAIM. One admissible cloth would mean a picture of it
  // is an answer key. Many distinct cloths ⇒ there is no picture to copy.
  ok(cloths.size >= 2,
    `"${lv.name}": admits ${cloths.size.toLocaleString()} STRUCTURALLY DISTINCT cloths — no single right picture exists`);
  // THE VACUITY GUARD. A spec everything passes is not a puzzle either.
  ok(rate < 0.5,
    `"${lv.name}": genuinely REJECTS — only ${(rate * 100).toFixed(3)}% of drafts satisfy it (${(tested - solutions).toLocaleString()} rejected)`);
}

// ─────────────────────────────────────────────────────────────────────────────
head('5. Each level is a DIFFERENT problem (v1 shipped two levels with one answer)');
{
  const sets = report.map((r) => r.lv.rules.map((x) => x.id).sort().join(','));
  ok(new Set(sets).size === LEVELS.length, `all ${LEVELS.length} levels have distinct rule-sets`);
}

head('— the solution space —');
for (const r of report) {
  console.log(`  ${r.lv.name.padEnd(28)} ${String(r.solutions).padStart(7)} solutions · ${String(r.distinct).padStart(5)} distinct cloths · ${(r.rate * 100).toFixed(3)}% of drafts pass`);
}

console.log(fails
  ? `\n${fails} check(s) FAILED — the redesign does not hold.`
  : `\nall checks passed — the engine is correct AND the puzzle is real:
nothing is shown, every level admits many distinct cloths, every spec rejects.
v1's transcription flaw is gone because the frame that guaranteed it is gone.`);
process.exit(fails ? 1 : 0);
