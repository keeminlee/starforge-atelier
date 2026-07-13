#!/usr/bin/env node
// break-verify.mjs — prove the paragraph holds.
//
// The claim this piece makes is that looking at the WHOLE paragraph beats looking
// at one line at a time. That is not a matter of taste, and it should not be left
// as one. It is a theorem about a shortest-path problem, and it is checkable:
//
//   OPTIMAL TOTAL DEMERITS ≤ GREEDY TOTAL DEMERITS.  Always. No exceptions.
//
// If a single random paragraph at a single random width breaks that inequality,
// the dynamic program is wrong and this piece is lying.
//
//   node break-verify.mjs

import {
  typeset, breakGreedy, breakOptimal, totalDemerits, adjustRatio, badness,
  layout, INFEASIBLE, breakpoints,
} from './break-core.mjs';

let fails = 0;
const ok = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) fails++; };
const head = (s) => console.log(`\n${s}`);

// a monospace-ish measure, so the check is deterministic and has no font in it
const measure = (s) => s.length;

const CORPUS = [
  'In a village of La Mancha the name of which I have no desire to call to mind there lived not long since one of those gentlemen that keep a lance in the lance-rack an old buckler a lean hack and a greyhound for coursing.',
  'It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife.',
  'The quick brown fox jumps over the lazy dog while the dog considers whether any of this is really necessary at all.',
  'Call me Ishmael. Some years ago never mind how long precisely having little or no money in my purse and nothing particular to interest me on shore I thought I would sail about a little and see the watery part of the world.',
  'A paragraph is not a sequence of lines it is one object that has to hold together and where you break it early changes what the last line is able to be.',
];

// ─────────────────────────────────────────────────────────────────────────────
head('1. The model is the model (box / glue / adjustment ratio)');
{
  const items = typeset('aaa bb cccc', measure);
  ok(items.length === 5, 'three words become 3 boxes + 2 glues');
  ok(items[0].w === 3 && items[2].w === 2 && items[4].w === 4, 'boxes carry their word widths');
  // natural width = 3 + 1 + 2 + 1 + 4 = 11
  ok(Math.abs(adjustRatio(items, 0, items.length, 11)) < 1e-9, 'r = 0 when the line is exactly the column width');
  ok(adjustRatio(items, 0, items.length, 13) > 0, 'r > 0 when the line must STRETCH to fill');
  ok(adjustRatio(items, 0, items.length, 9) < 0, 'r < 0 when the line must SQUEEZE to fit');
  ok(badness(0, false) === 0, 'a perfect line has zero badness');
  ok(badness(1, false) === 100 && badness(2, false) === 800,
    'badness is cubed: twice the stretch is EIGHT times as ugly (100 → 800)');
  ok(badness(2, true) === 0, 'the last line is free — it is allowed to run short');
}

// ─────────────────────────────────────────────────────────────────────────────
head('2. THE CLAIM: optimal never loses to greedy. Exhaustive over the corpus.');
// Every paragraph, every column width from 20 to 90. If the DP is right this
// inequality cannot be broken even once.
{
  let compared = 0, strictlyBetter = 0, ties = 0, worse = 0;
  let biggestWin = { gain: 0 };
  for (const text of CORPUS) {
    const items = typeset(text, measure);
    for (let width = 20; width <= 90; width++) {
      const g = totalDemerits(items, breakGreedy(items, width), width);
      const o = breakOptimal(items, width);
      if (!o.feasible || g === INFEASIBLE) continue;   // no feasible layout at this width; skip honestly
      compared++;
      if (o.demerits > g) { worse++; console.log(`      width ${width}: optimal ${o.demerits} > greedy ${g}`); }
      else if (o.demerits < g) {
        strictlyBetter++;
        const gain = g / Math.max(o.demerits, 1);
        if (gain > biggestWin.gain) biggestWin = { gain, width, g, o: o.demerits, text: text.slice(0, 34) };
      } else ties++;
    }
  }
  ok(compared >= 200, `enough feasible (paragraph, width) pairs to conclude anything: ${compared}`);
  ok(worse === 0, `OPTIMAL NEVER LOSES: 0 of ${compared} cases where greedy beat the dynamic program`);
  ok(strictlyBetter > 0, `and it genuinely wins: strictly better in ${strictlyBetter} cases (${ties} ties — the widths where greedy happens to be optimal)`);
  console.log(`      biggest win: width ${biggestWin.width}, greedy ${Math.round(biggestWin.g).toLocaleString()} vs optimal ${Math.round(biggestWin.o).toLocaleString()} demerits — ${biggestWin.gain.toFixed(1)}x`);
}

// ─────────────────────────────────────────────────────────────────────────────
head('3. Same claim, on RANDOM paragraphs — no cherry-picked corpus');
{
  let s = 987654321;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const word = () => 'x'.repeat(2 + Math.floor(rnd() * 9));
  let compared = 0, worse = 0;
  for (let t = 0; t < 400; t++) {
    const n = 20 + Math.floor(rnd() * 60);
    const text = Array.from({ length: n }, word).join(' ');
    const items = typeset(text, measure);
    const width = 25 + Math.floor(rnd() * 60);
    const g = totalDemerits(items, breakGreedy(items, width), width);
    const o = breakOptimal(items, width);
    if (!o.feasible || g === INFEASIBLE) continue;
    compared++;
    if (o.demerits > g) worse++;
  }
  ok(compared >= 100, `enough random paragraphs to conclude anything: ${compared}`);
  ok(worse === 0, `optimal never loses on random text either: 0 / ${compared} violations`);
}

// ─────────────────────────────────────────────────────────────────────────────
head('4. Every line the optimiser emits actually FITS (no cheating on the column)');
{
  let checked = 0, overfull = 0;
  for (const text of CORPUS) {
    const items = typeset(text, measure);
    for (let width = 30; width <= 80; width += 7) {
      const o = breakOptimal(items, width);
      if (!o.feasible) continue;
      for (const line of layout(items, o.breaks, width)) {
        checked++;
        // a line may be squeezed only within its glue's shrink, stretched only within tolerance
        if (line.badness === INFEASIBLE) overfull++;
      }
    }
  }
  ok(checked > 0 && overfull === 0, `all ${checked} emitted lines are feasible — none is overfull or stretched past tolerance`);
}

// ─────────────────────────────────────────────────────────────────────────────
head('5. The honest limit of this implementation');
// Say what it is NOT, in the test suite, so the claim can't quietly inflate.
{
  ok(true, 'NO HYPHENATION — real TeX breaks words; this breaks only at spaces, so both algorithms are handicapped equally and the comparison stays fair');
  ok(true, 'no widow/orphan penalties, no looseness, no font metrics — the DP and the badness exponent are the essential idea, and that is all this claims to be');
}

console.log(fails
  ? `\n${fails} check(s) FAILED — the paragraph does not hold.`
  : `\nall checks passed — the dynamic program is correct, and its central claim is a
theorem and not a taste: looking at the whole paragraph at once is never worse
than filling one line at a time, and is often far better.`);
process.exit(fails ? 1 : 0);
