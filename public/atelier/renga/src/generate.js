// src/generate.js
// generateKasen(seed) -> a 36-verse kasen (the object shape validateKasen consumes)
// that PASSES validateKasen with ok:true. Deterministic given an integer seed.
//
// PHASE 3.5 PIVOT — the machine is a SEQUENCER, not a line-composer.
//
// Algorithm:
//   1. Plan a LEGAL SKELETON first — season / seat / love role for all 36 seats,
//      verified against rules.js BEFORE any unit is chosen (unchanged from ph3).
//   2. SEQUENCE whole verse-UNITS from data/verse-bank.js: for each seat SELECT a
//      hand-authored unit satisfying, all at once —
//        (kind)     long for odd n, short for even n
//        (role)     the seat's season / moon / blossom / love role
//        (shift)    categories disjoint from n-1 AND n-2 (uchikoshi + aversion gap)
//        (aversion) no salientWord recurs within SALIENT_AVERSION_GAP verses
//        (unique)   no unit reused anywhere in the poem
//        (link)     PREFERRED: categories share an ASSOCIATIONS edge with n-1
//      by backtracking search. Link is preferred (tried first) and recorded
//      truthfully per seat; when no linked unit fits, an honest non-link is taken.
//   3. SELF-VALIDATE the assembled kasen with validateKasen; retry with fresh
//      choices up to a bound; return the first passing kasen.
//
// HONESTY (the load-bearing seam, unchanged in spirit):
//   Each verse is a GENUINE hand-authored unit — the machine makes no claim to
//   write poetry. Its job is the rule-legal linked sequencing. The SHIFT is
//   machine-enforced (uchikoshi + aversion, by construction). The LINK is the
//   aspirational half: real at the category-graph level (adjacent units share a
//   declared ASSOCIATIONS edge) but shallow at the surface. We measure the link
//   rate and expose it; a fallback non-link is recorded as such, never laundered.

import { VERSE_BANK, ASSOCIATIONS, MARKER_CATEGORIES } from '../data/verse-bank.js';
import { countLine } from '../data/syllables.js';
import { validateKasen } from './validate.js';
import {
  VERSE_COUNT,
  meterFor,
  SEATS,
  SEASON_RUN_BOUNDS,
  LOVE_RUN_BOUNDS,
  AVERSION_MIN_GAP,
  SALIENT_AVERSION_GAP,
} from './rules.js';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32). Math.random is neither used nor available.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const assocSet = (cat) => new Set(ASSOCIATIONS[cat] || []);

// ---------------------------------------------------------------------------
// SKELETON templates (unchanged from phase 3). Each is a season/love plan,
// expanded to 36 seats and verified legal against rules.js before use.
// ---------------------------------------------------------------------------
const TEMPLATES = [
  {
    // A — the golden-kasen arc
    runs: [
      ['autumn', 1, 5], ['winter', 8, 9], ['autumn', 14, 16], ['spring', 17, 19],
      ['summer', 21, 22], ['autumn', 27, 29], ['winter', 32, 33], ['spring', 34, 36],
    ],
    love: [[11, 12], [24, 25]],
  },
  {
    // B
    runs: [
      ['autumn', 1, 5], ['summer', 10, 11], ['autumn', 14, 16], ['spring', 17, 19],
      ['winter', 24, 26], ['autumn', 27, 29], ['spring', 34, 36],
    ],
    love: [[7, 8], [22, 23]],
  },
  {
    // C
    runs: [
      ['autumn', 1, 5], ['winter', 8, 10], ['autumn', 14, 16], ['spring', 17, 19],
      ['summer', 20, 21], ['autumn', 27, 29], ['winter', 32, 33], ['spring', 34, 36],
    ],
    love: [[12, 13], [24, 25]],
  },
];

function buildSkeleton(template) {
  const moonSet = new Set(SEATS.moon);
  const blossomSet = new Set(SEATS.blossom);
  const loveSet = new Set();
  const loveRunIndex = {};
  template.love.forEach((run, ri) => {
    run.forEach((n, pos) => {
      loveSet.add(n);
      loveRunIndex[n] = { run: ri, pos };
    });
  });

  const seasonOf = new Array(VERSE_COUNT + 1).fill(null);
  for (const [s, from, to] of template.runs) {
    for (let n = from; n <= to; n++) seasonOf[n] = s;
  }

  const verses = [];
  for (let n = 1; n <= VERSE_COUNT; n++) {
    verses.push({
      n,
      season: seasonOf[n],
      isMoon: moonSet.has(n),
      isBlossom: blossomSet.has(n),
      isLove: loveSet.has(n),
      loveRun: loveRunIndex[n] || null,
    });
  }
  return verses;
}

// Verify a skeleton against the rule bounds — throws if illegal (self-checking).
function assertLegalSkeleton(verses) {
  const errs = [];
  for (const v of verses) {
    if (v.isMoon !== SEATS.moon.includes(v.n)) errs.push(`moon seat mismatch v${v.n}`);
    if (v.isBlossom !== SEATS.blossom.includes(v.n)) errs.push(`blossom seat mismatch v${v.n}`);
  }
  let i = 0;
  while (i < verses.length) {
    const s = verses[i].season;
    if (!s) { i++; continue; }
    let j = i;
    while (j < verses.length && verses[j].season === s) j++;
    const len = j - i;
    const b = SEASON_RUN_BOUNDS[s];
    if (len < b[0] || len > b[1]) {
      errs.push(`${s} run ${verses[i].n}-${verses[j - 1].n} len ${len} outside [${b[0]}..${b[1]}]`);
    }
    i = j;
  }
  let k = 0;
  let loveRuns = 0;
  while (k < verses.length) {
    if (!verses[k].isLove) { k++; continue; }
    let j = k;
    while (j < verses.length && verses[j].isLove) j++;
    const len = j - k;
    loveRuns++;
    if (len < LOVE_RUN_BOUNDS[0] || len > LOVE_RUN_BOUNDS[1]) {
      errs.push(`love run ${verses[k].n}-${verses[j - 1].n} len ${len} outside bounds`);
    }
    k = j;
  }
  if (loveRuns === 0) errs.push('no love run');
  if (errs.length) throw new Error('illegal skeleton: ' + errs.join('; '));
}

// ---------------------------------------------------------------------------
// Candidate pools — bank units that fit a seat's KIND and ROLE. (These two are
// fixed per seat; the remaining constraints depend on the partial sequence and
// are checked during the walk.)
// ---------------------------------------------------------------------------
function candidatesForSeat(v) {
  const kind = meterFor(v.n).length === 3 ? 'long' : 'short';
  return VERSE_BANK.filter((u) => {
    if (u.kind !== kind) return false;
    if (v.isMoon) return u.isMoon;
    if (v.isBlossom) return u.isBlossom;
    if (v.isLove) return u.isLove;
    // general seat: no markers/love, season must match (null == miscellaneous)
    if (u.isMoon || u.isBlossom || u.isLove) return false;
    return (u.season ?? null) === (v.season ?? null);
  });
}

// Non-marker categories of a unit (markers are governed by seats, exempt from
// the category-aversion / shift spacing — mirrors AVERSION_EXEMPT in validate).
function spacedCats(u) {
  return u.categories.filter((c) => !MARKER_CATEGORIES.has(c));
}

// ---------------------------------------------------------------------------
// The SEQUENCER — backtracking selection of one unit per seat.
// ---------------------------------------------------------------------------
function sequence(skeleton, rnd) {
  const chosen = new Array(VERSE_COUNT + 1).fill(null); // by seat n
  const linked = new Array(VERSE_COUNT + 1).fill(false);
  const usedIds = new Set();

  const pools = new Array(VERSE_COUNT + 1).fill(null);
  for (let n = 1; n <= VERSE_COUNT; n++) pools[n] = candidatesForSeat(skeleton[n - 1]);

  // Fail fast if any seat has an empty pool (a bank-coverage bug).
  for (let n = 1; n <= VERSE_COUNT; n++) {
    if (pools[n].length === 0) {
      throw new Error(`verse-bank coverage gap: no unit fits seat ${n} (${JSON.stringify(skeleton[n - 1])})`);
    }
  }

  let steps = 0;
  const MAX_STEPS = 400000;

  // Does unit u fit at seat n given everything chosen at seats < n?
  const fits = (n, u) => {
    if (usedIds.has(u.id)) return false;

    const uSpaced = new Set(spacedCats(u));
    const uAll = new Set(u.categories);

    // SHIFT / uchikoshi: raw category disjoint from n-2 (AND, via category
    // aversion gap < AVERSION_MIN_GAP, from n-1 too). We enforce disjoint spaced
    // categories across the whole [n-(AVERSION_MIN_GAP-1) .. n-1] window, plus a
    // raw (marker-inclusive) shift from n-2 to match the uchikoshi check exactly.
    for (let p = Math.max(1, n - (AVERSION_MIN_GAP - 1)); p < n; p++) {
      const prev = chosen[p];
      if (!prev) continue;
      for (const c of spacedCats(prev)) if (uSpaced.has(c)) return false;
    }
    if (n - 2 >= 1 && chosen[n - 2]) {
      for (const c of chosen[n - 2].categories) if (uAll.has(c)) return false;
    }

    // PHRASE-AVERSION: no salientWord recurs within SALIENT_AVERSION_GAP.
    const uSal = new Set(u.salientWords);
    for (let p = Math.max(1, n - (SALIENT_AVERSION_GAP - 1)); p < n; p++) {
      const prev = chosen[p];
      if (!prev) continue;
      for (const w of prev.salientWords) if (uSal.has(w)) return false;
    }
    return true;
  };

  const isLinked = (n, u) => {
    if (n < 2 || !chosen[n - 1]) return false;
    const prevCats = chosen[n - 1].categories;
    for (const c of u.categories) {
      const s = assocSet(c);
      for (const pc of prevCats) if (s.has(pc)) return true;
    }
    return false;
  };

  const solve = (n) => {
    if (n > VERSE_COUNT) return true;
    if (++steps > MAX_STEPS) return false;

    const fit = pools[n].filter((u) => fits(n, u));
    if (fit.length === 0) return false;

    // Prefer linked units (tried first), shuffled within each group for variety.
    const linkedCands = shuffle(fit.filter((u) => isLinked(n, u)), rnd);
    const rest = shuffle(fit.filter((u) => !isLinked(n, u)), rnd);
    const ordered = [...linkedCands, ...rest];

    for (const u of ordered) {
      chosen[n] = u;
      linked[n] = isLinked(n, u);
      usedIds.add(u.id);
      if (solve(n + 1)) return true;
      usedIds.delete(u.id);
      chosen[n] = null;
      linked[n] = false;
    }
    return false;
  };

  if (!solve(1)) return null;
  return { chosen, linked };
}

// ---------------------------------------------------------------------------
// Assemble the validated kasen object from a solved sequence.
// ---------------------------------------------------------------------------
function lineConfidence(line) {
  return countLine(line).lowConfidence ? 'heuristic' : 'exact';
}

function buildKasen(skeleton, seq) {
  const kasen = [];
  for (let n = 1; n <= VERSE_COUNT; n++) {
    const v = skeleton[n - 1];
    const u = seq.chosen[n];
    kasen.push({
      n,
      season: v.season,
      categories: u.categories.slice(),
      isMoon: v.isMoon,
      isBlossom: v.isBlossom,
      isLove: v.isLove,
      lines: u.lines.slice(),
      // --- presentation / aversion metadata (some validated, some not) ---
      salient: u.categories[0],
      salientWords: u.salientWords.slice(),
      unitId: u.id,
      linked: seq.linked[n],
      confidence: u.lines.map(lineConfidence),
    });
  }
  return kasen;
}

// ---------------------------------------------------------------------------
// One build attempt (may fail sequencing -> returns null).
// ---------------------------------------------------------------------------
function attemptBuild(templateIdx, rnd) {
  const skeleton = buildSkeleton(TEMPLATES[templateIdx]);
  assertLegalSkeleton(skeleton); // plan is legal BEFORE sequencing
  const seq = sequence(skeleton, rnd);
  if (!seq) return null;
  return buildKasen(skeleton, seq);
}

// ---------------------------------------------------------------------------
// Public: generateKasen(seed)
// ---------------------------------------------------------------------------
export function generateKasen(seed = 1, { maxAttempts = 60 } = {}) {
  const templateIdx = ((seed % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length;

  let last = null;
  let lastReport = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rnd = mulberry32((seed >>> 0) * 100003 + attempt * 2654435761);
    const kasen = attemptBuild(templateIdx, rnd);
    if (!kasen) continue;
    const report = validateKasen(kasen);
    last = kasen;
    lastReport = report;
    if (report.ok) {
      return {
        ok: true,
        seed,
        template: templateIdx,
        attempts: attempt,
        kasen,
        report,
        stats: linkStats(kasen),
      };
    }
  }
  return {
    ok: false,
    seed,
    template: templateIdx,
    attempts: maxAttempts,
    kasen: last,
    report: lastReport,
    stats: last ? linkStats(last) : null,
  };
}

// Genuine-link measurement + syllable-confidence tally.
export function linkStats(kasen) {
  let linkable = 0;
  let linked = 0;
  for (let n = 2; n <= kasen.length; n++) {
    linkable++;
    if (kasen[n - 1].linked) linked++;
  }
  let exactLines = 0;
  let heuristicLines = 0;
  for (const v of kasen) {
    for (const c of v.confidence || []) {
      if (c === 'exact') exactLines++;
      else heuristicLines++;
    }
  }
  return {
    linkable,
    linked,
    linkRate: linkable ? linked / linkable : 0,
    exactLines,
    heuristicLines,
    totalLines: exactLines + heuristicLines,
  };
}

export default generateKasen;
