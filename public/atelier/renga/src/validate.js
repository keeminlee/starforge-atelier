// src/validate.js
// THE INSTRUMENT. Every machine-checkable kasen rule, each reported independently.
//
// validateKasen(kasen) -> { ok, checks:[{rule, ok, detail}], violations:[{rule, ...}], warnings:[...] }
//
// A kasen is an array of 36 verse objects:
//   { n, lines:[...strings], season:'spring'|'summer'|'autumn'|'winter'|null,
//     categories:[...strings], isMoon:bool, isBlossom:bool, isLove:bool }
//
// HONESTY (the load-bearing commitment, per DESIGN.md):
//   The link-and-shift rule has two halves. Verse n LINKING to n-1 (a shared,
//   evocative association) is aspirational craft and is NOT hard-checked here —
//   a machine can't tell an evocative link from a random one. What IS cleanly
//   checkable is the SHIFT: verse n must not return to the salient category of
//   n-2 (uchikoshi o kirau). That shift-away is check (f) below and it is a hard
//   fail. So: the shift is enforced; the forward-link stays aspirational, and
//   this comment says so rather than faking a pass on the un-checkable half.
//
//   Meter check (a) treats a WRONG count as a hard fail, but a line that is
//   merely heuristic-confidence (out-of-dictionary word) as a soft WARNING —
//   never a silent guess, never a fake pass.

import { countLine } from '../data/syllables.js';
import {
  VERSE_COUNT,
  meterFor,
  SEATS,
  SEASON_RUN_BOUNDS,
  SEASONS,
  LOVE_RUN_BOUNDS,
  AVERSION_MIN_GAP,
  AVERSION_EXEMPT,
  UCHIKOSHI_LOOKBACK,
  SALIENT_AVERSION_GAP,
} from './rules.js';

function intersect(a, b) {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

// Build maximal runs of consecutive verses whose predicate/key matches.
// keyFn returns a truthy grouping key, or null to break the run.
function buildRuns(kasen, keyFn) {
  const runs = [];
  let cur = null;
  for (let i = 0; i < kasen.length; i++) {
    const key = keyFn(kasen[i], i);
    if (key === null || key === undefined || key === false) {
      cur = null;
      continue;
    }
    if (cur && cur.key === key) {
      cur.verses.push(kasen[i].n);
      cur.end = kasen[i].n;
    } else {
      cur = { key, start: kasen[i].n, end: kasen[i].n, verses: [kasen[i].n] };
      runs.push(cur);
    }
  }
  return runs;
}

export function validateKasen(kasen) {
  const checks = [];
  const violations = [];
  const warnings = [];

  const addCheck = (rule, ok, detail) => checks.push({ rule, ok, detail });
  const addViolation = (rule, obj) => violations.push({ rule, ...obj });

  const verses = Array.isArray(kasen) ? kasen : [];

  // --- verse-count -----------------------------------------------------------
  {
    const ok = verses.length === VERSE_COUNT;
    addCheck('verse-count', ok, `${verses.length} verses (expected ${VERSE_COUNT})`);
    if (!ok) addViolation('verse-count', { detail: `got ${verses.length}, expected ${VERSE_COUNT}` });
  }

  // --- (a) meter: line count + per-line syllable counts ----------------------
  {
    const problems = [];
    for (const v of verses) {
      const target = meterFor(v.n);
      const lines = Array.isArray(v.lines) ? v.lines : [];
      if (lines.length !== target.length) {
        problems.push(`v${v.n}: ${lines.length} lines (expected ${target.length})`);
        addViolation('meter', { n: v.n, detail: `line count ${lines.length} != ${target.length}` });
        continue;
      }
      for (let i = 0; i < lines.length; i++) {
        const res = countLine(lines[i]);
        if (res.count !== target[i]) {
          problems.push(`v${v.n} line ${i + 1}: ${res.count} syllables (expected ${target[i]}) — "${lines[i]}"`);
          addViolation('meter', {
            n: v.n,
            line: i + 1,
            detail: `${res.count} syllables, expected ${target[i]}: "${lines[i]}"`,
          });
        }
        if (res.lowConfidence) {
          const lowWords = res.words.filter((w) => w.confidence === 'heuristic').map((w) => w.word);
          warnings.push(`v${v.n} line ${i + 1}: heuristic-only words [${lowWords.join(', ')}] — count not dictionary-verified`);
        }
      }
    }
    addCheck('meter', problems.length === 0,
      problems.length ? problems.join(' | ') : 'all lines match 5-7-5 / 7-7 with exact counts');
  }

  // --- (b) moon seats --------------------------------------------------------
  {
    const seatSet = new Set(SEATS.moon);
    const problems = [];
    for (const v of verses) {
      const shouldBe = seatSet.has(v.n);
      if (!!v.isMoon !== shouldBe) {
        const msg = shouldBe
          ? `v${v.n}: moon seat but isMoon is false`
          : `v${v.n}: isMoon true at non-seat`;
        problems.push(msg);
        addViolation('moon-seat', { n: v.n, detail: msg });
      }
    }
    addCheck('moon-seat', problems.length === 0,
      problems.length ? problems.join(' | ') : `moon named at exactly ${SEATS.moon.join(', ')}`);
  }

  // --- (c) blossom seats -----------------------------------------------------
  {
    const seatSet = new Set(SEATS.blossom);
    const problems = [];
    for (const v of verses) {
      const shouldBe = seatSet.has(v.n);
      if (!!v.isBlossom !== shouldBe) {
        const msg = shouldBe
          ? `v${v.n}: blossom seat but isBlossom is false`
          : `v${v.n}: isBlossom true at non-seat`;
        problems.push(msg);
        addViolation('blossom-seat', { n: v.n, detail: msg });
      }
    }
    addCheck('blossom-seat', problems.length === 0,
      problems.length ? problems.join(' | ') : `blossom named at exactly ${SEATS.blossom.join(', ')}`);
  }

  // --- (d) season runs -------------------------------------------------------
  {
    const runs = buildRuns(verses, (v) => (SEASONS.includes(v.season) ? v.season : null));
    const problems = [];
    const reported = [];
    for (const run of runs) {
      const bounds = SEASON_RUN_BOUNDS[run.key];
      const len = run.verses.length;
      const ok = len >= bounds[0] && len <= bounds[1];
      reported.push(`${run.key} ${run.start}-${run.end} (len ${len})${ok ? '' : ' !!'}`);
      if (!ok) {
        const msg = `${run.key} run ${run.start}-${run.end} length ${len} outside [${bounds[0]}..${bounds[1]}]`;
        problems.push(msg);
        addViolation('season-run', { detail: msg });
      }
    }
    addCheck('season-run', problems.length === 0,
      `runs: ${reported.join('; ')}${problems.length ? ' | VIOLATIONS: ' + problems.join(' | ') : ''}`);
  }

  // --- (e) love runs ---------------------------------------------------------
  {
    const runs = buildRuns(verses, (v) => (v.isLove ? 'love' : null));
    const problems = [];
    if (runs.length === 0) {
      problems.push('no love run present (need at least one)');
      addViolation('love-run', { detail: 'no love run present' });
    }
    const reported = [];
    for (const run of runs) {
      const len = run.verses.length;
      const ok = len >= LOVE_RUN_BOUNDS[0] && len <= LOVE_RUN_BOUNDS[1];
      reported.push(`${run.start}-${run.end} (len ${len})${ok ? '' : ' !!'}`);
      if (!ok) {
        const msg = `love run ${run.start}-${run.end} length ${len} outside [${LOVE_RUN_BOUNDS[0]}..${LOVE_RUN_BOUNDS[1]}]`;
        problems.push(msg);
        addViolation('love-run', { detail: msg });
      }
    }
    addCheck('love-run', problems.length === 0,
      `love runs: ${reported.length ? reported.join('; ') : 'none'}${problems.length ? ' | VIOLATIONS: ' + problems.join(' | ') : ''}`);
  }

  // --- (f) link-and-shift / uchikoshi (THE core hard check) ------------------
  {
    const problems = [];
    for (let i = 0; i < verses.length; i++) {
      const n = verses[i].n;
      const j = i - UCHIKOSHI_LOOKBACK;
      if (j < 0) continue;
      const shared = intersect(verses[i].categories || [], verses[j].categories || []);
      if (shared.length > 0) {
        const msg = `v${n} shares [${shared.join(', ')}] with v${verses[j].n} (n-2)`;
        problems.push(msg);
        addViolation('uchikoshi', { n, detail: msg, shared });
      }
    }
    addCheck('uchikoshi', problems.length === 0,
      problems.length ? problems.join(' | ') : 'every verse shifts away from its n-2 categories');
  }

  // --- (g) aversion spacing --------------------------------------------------
  {
    const positions = new Map(); // category -> [verse numbers in order]
    for (const v of verses) {
      for (const cat of v.categories || []) {
        if (AVERSION_EXEMPT.has(cat)) continue;
        if (!positions.has(cat)) positions.set(cat, []);
        positions.get(cat).push(v.n);
      }
    }
    const problems = [];
    for (const [cat, ns] of positions) {
      for (let k = 1; k < ns.length; k++) {
        const gap = ns[k] - ns[k - 1];
        if (gap < AVERSION_MIN_GAP) {
          const msg = `category "${cat}" recurs at v${ns[k - 1]} and v${ns[k]} (gap ${gap} < ${AVERSION_MIN_GAP})`;
          problems.push(msg);
          addViolation('aversion', { detail: msg, category: cat });
        }
      }
    }
    addCheck('aversion', problems.length === 0,
      problems.length ? problems.join(' | ') : `no salient category recurs within ${AVERSION_MIN_GAP} verses`);
  }

  // --- (h) marker-text-scan (re-truths the moon/blossom seats at the TEXT level)
  //   The moon-seat / blossom-seat checks above test the isMoon/isBlossom FLAGS.
  //   This check tests the SURFACE TEXT: the words moon/moonlight may appear only
  //   at verses 5, 14, 29; blossom/cherry/petals only at 17, 35. A marker word on
  //   the page anywhere else is a hard violation — catching a leak regardless of
  //   how the verse is tagged. (Critic §2: a PASS that is false about the text is
  //   the one failure the honesty gate must not allow.)
  {
    const MOON_RE = /\b(moon|moonlight)\b/i;
    const BLOSSOM_RE = /\b(blossom|cherry|petals?)\b/i;
    const moonSeats = new Set(SEATS.moon);
    const blossomSeats = new Set(SEATS.blossom);
    const problems = [];
    for (const v of verses) {
      const text = (Array.isArray(v.lines) ? v.lines : []).join(' ');
      const moonHit = MOON_RE.exec(text);
      if (moonHit && !moonSeats.has(v.n)) {
        const msg = `v${v.n}: moon word "${moonHit[0]}" off-seat (allowed only at ${SEATS.moon.join(', ')}) — "${text}"`;
        problems.push(msg);
        addViolation('marker-text-scan', { n: v.n, detail: msg, word: moonHit[0] });
      }
      if (moonSeats.has(v.n) && !moonHit) {
        const msg = `v${v.n}: moon seat but no moon word in the text — "${text}"`;
        problems.push(msg);
        addViolation('marker-text-scan', { n: v.n, detail: msg });
      }
      const blossomHit = BLOSSOM_RE.exec(text);
      if (blossomHit && !blossomSeats.has(v.n)) {
        const msg = `v${v.n}: blossom word "${blossomHit[0]}" off-seat (allowed only at ${SEATS.blossom.join(', ')}) — "${text}"`;
        problems.push(msg);
        addViolation('marker-text-scan', { n: v.n, detail: msg, word: blossomHit[0] });
      }
      if (blossomSeats.has(v.n) && !blossomHit) {
        const msg = `v${v.n}: blossom seat but no blossom word in the text — "${text}"`;
        problems.push(msg);
        addViolation('marker-text-scan', { n: v.n, detail: msg });
      }
    }
    addCheck('marker-text-scan', problems.length === 0,
      problems.length ? problems.join(' | ')
        : `moon words only at ${SEATS.moon.join(', ')}; blossom words only at ${SEATS.blossom.join(', ')} (surface-text verified)`);
  }

  // --- (i) phrase-aversion (sarikirai at the surface, critic §1b) -------------
  //   Two sub-rules:
  //     * no full LINE recurs verbatim anywhere in the poem;
  //     * no salientWord recurs within SALIENT_AVERSION_GAP verses.
  //   Each violation names the offending phrase/word and the two verse numbers.
  {
    const problems = [];

    // verbatim whole-line reuse
    const lineFirstSeen = new Map(); // normalized line -> verse n
    for (const v of verses) {
      for (const line of Array.isArray(v.lines) ? v.lines : []) {
        const key = String(line).trim().toLowerCase();
        if (lineFirstSeen.has(key)) {
          const first = lineFirstSeen.get(key);
          const msg = `line "${line}" recurs verbatim at v${first} and v${v.n}`;
          problems.push(msg);
          addViolation('phrase-aversion', { detail: msg, phrase: line, verses: [first, v.n] });
        } else {
          lineFirstSeen.set(key, v.n);
        }
      }
    }

    // salient-word recurrence within the gap
    const wordLast = new Map(); // salientWord -> most recent verse n
    for (const v of verses) {
      for (const w of Array.isArray(v.salientWords) ? v.salientWords : []) {
        const key = String(w).toLowerCase();
        if (wordLast.has(key)) {
          const prev = wordLast.get(key);
          const gap = v.n - prev;
          if (gap < SALIENT_AVERSION_GAP) {
            const msg = `salient word "${w}" recurs at v${prev} and v${v.n} (gap ${gap} < ${SALIENT_AVERSION_GAP})`;
            problems.push(msg);
            addViolation('phrase-aversion', { detail: msg, word: w, verses: [prev, v.n] });
          }
        }
        wordLast.set(key, v.n);
      }
    }

    addCheck('phrase-aversion', problems.length === 0,
      problems.length ? problems.join(' | ')
        : `no line recurs verbatim; no salient word recurs within ${SALIENT_AVERSION_GAP} verses`);
  }

  const ok = violations.length === 0;
  return { ok, checks, violations, warnings };
}
