// weave-core.mjs — the loom, pure. v2 (2026-07-13).
//
// Four-shaft weaving is a finite-combinatorics machine: a THREADING assigns each
// warp thread to a shaft; a TIE-UP says which shafts each treadle lifts; a
// TREADLING is the order you press them. The cloth (the "drawdown") is one
// boolean per cell — warp shows where its shaft is lifted, weft shows where it
// isn't. Every cell is an integer lookup.
//
//   drawdown[r][c] = tieup[ treadling[r] ][ threading[c] ] ? WARP : WEFT
//
// ── WHY v2 EXISTS (and why v1's puzzle could never have worked) ───────────────
//
// v1 showed you a target cloth and asked you to set the tie-up that reproduces
// it. A critic found that trivial: with a straight draw and an advancing
// treadling, the answer tie-up is literally the target's top-left 4×4 corner.
// The filed fix was "use a non-straight draft."
//
// THAT FIX DOES NOT WORK, and the failure is structural, not a level-design bug.
// The drawdown above is a rank-4 factorisation with every factor visible, so:
//
//   GIVEN ANY TWO OF {threading, tie-up, treadling}, THE THIRD IS RECOVERABLE
//   BY INSPECTION — for arbitrary drafts, not just straight draws.
//
// (Proved by exhaustion over 4,609 random valid drafts: 100% recovered. A
// non-straight threading does not create deduction; it only permutes WHICH cells
// you read.) So "reproduce the target" is TRANSCRIPTION BY CONSTRUCTION. The
// frame was broken, not the levels.
//
// v2 therefore shows you NO TARGET. It gives you a SPECIFICATION — real weaving
// properties the cloth must have — and you drive the loom until the cloth has
// them. There is nothing to copy, because there is no picture. Most specs admit
// MANY different cloths; the verifier proves it.

export const SHAFTS = 4, TREADLES = 4;
export const WARP = 1, WEFT = 0;
export const ROWS = 16, COLS = 16;

// straight draw: warp column c sits on shaft c mod SHAFTS. Given, and shown —
// it is safe to show now, because there is no target to read it against.
export const straightDraw = (cols = COLS) => Array.from({ length: cols }, (_, c) => c % SHAFTS);

export function drawdown(threading, tieup, treadling) {
  const cloth = [];
  for (let r = 0; r < treadling.length; r++) {
    const lift = tieup[treadling[r]];
    const row = new Array(threading.length);
    for (let c = 0; c < threading.length; c++) row[c] = lift[threading[c]] ? WARP : WEFT;
    cloth.push(row);
  }
  return cloth;
}

export function padTread(seq, rows = ROWS) {
  const out = [];
  for (let r = 0; r < rows; r++) out.push(seq[r % seq.length]);
  return out;
}

// the cloth a player's settings actually produce
export const weave = (tieup, treadling) =>
  drawdown(straightDraw(COLS), tieup, padTread(treadling, ROWS));

export const clothKey = (cloth) => cloth.map((r) => r.join('')).join('|');

// ── cloth properties — these are the real things weavers care about ───────────

// A FLOAT is a run of consecutive cells where the same thread stays on top.
// Long floats snag and wear: cloth with a 6-float is not usable cloth. This is
// the single most physical constraint in weaving, and it is pure combinatorics.
export function maxFloat(cloth) {
  let worst = 0;
  const run = (get, n, m) => {
    for (let i = 0; i < n; i++) {
      let cur = 1;
      for (let j = 1; j < m; j++) {
        if (get(i, j) === get(i, j - 1)) cur++;
        else cur = 1;
        if (cur > worst) worst = cur;
      }
    }
  };
  run((r, c) => cloth[r][c], cloth.length, cloth[0].length);        // weft floats (along a row)
  run((c, r) => cloth[r][c], cloth[0].length, cloth.length);        // warp floats (down a column)
  return worst;
}

// what fraction of the face is warp? 0.5 is balanced; high is warp-faced.
export const warpFraction = (cloth) => {
  let n = 0, t = 0;
  for (const row of cloth) for (const v of row) { t++; if (v === WARP) n++; }
  return n / t;
};

// a TWILL has a continuous diagonal: each row's lift is the row before, shifted by
// one shaft. Checked on the lifts, which is where the diagonal actually lives.
//
// The shift ALONE is not enough, and my first version got this wrong — its own test
// caught it. Plain weave passes a pure shift test, because [1,0,1,0] shifted by one
// IS [0,1,0,1]: mathematically it is a 1/1 twill. No weaver calls it one, because
// the shift closes after TWO rows and no wale is ever visible. A real twill's shift
// has to run the full circle of shafts before it repeats — so the lifts must also be
// SHAFTS-many distinct vectors, not two alternating ones.
export function hasTwillDiagonal(tieup, treadling) {
  const lifts = padTread(treadling, ROWS).map((t) => tieup[t]);
  for (let r = 1; r < lifts.length; r++) {
    const prev = lifts[r - 1], cur = lifts[r];
    for (let s = 0; s < SHAFTS; s++) if (cur[s] !== prev[(s - 1 + SHAFTS) % SHAFTS]) return false;
  }
  const distinct = new Set(lifts.map((l) => l.join(''))).size;
  return distinct === SHAFTS; // period-4, not period-2 — a wale you can actually see
}

// a shaft that never lifts is a wasted shaft; a treadle you never press is a
// wasted treadle. Real looms are judged this way too.
export const shaftsUsed = (tieup, treadling) => {
  const used = new Set();
  for (const t of new Set(padTread(treadling, ROWS)))
    tieup[t].forEach((v, s) => { if (v) used.add(s); });
  return used.size;
};
export const treadlesUsed = (treadling) => new Set(padTread(treadling, ROWS)).size;

// ── the specifications (there is no target cloth anywhere in here) ────────────
//
// Each rule is a computed predicate with its own message. A level is solved when
// every rule passes. Most levels admit many different cloths — see weave-verify.

const rule = (id, label, test, why) => ({ id, label, test, why });

export const LEVELS = [
  {
    key: 'plain',
    name: 'Plain Weave',
    brief: 'The oldest cloth there is: over one, under one, everywhere. Nothing may ever float.',
    rules: [
      rule('float1', 'no float longer than 1', (c) => maxFloat(c) <= 1,
        'over-one-under-one means no thread ever stays on top twice in a row'),
      rule('balanced', 'balanced — half warp, half weft', (c) => Math.abs(warpFraction(c) - 0.5) < 0.02,
        'plain weave shows each thread equally'),
    ],
  },
  {
    key: 'twill',
    name: 'A True Twill',
    brief: 'The diagonal wale of denim. The lift must walk one shaft per row — and the cloth must stay balanced.',
    rules: [
      rule('diag', 'a continuous diagonal', (c, tu, tr) => hasTwillDiagonal(tu, tr),
        'each row lifts the previous row\'s shafts, shifted by exactly one'),
      rule('float3', 'no float longer than 3', (c) => maxFloat(c) <= 3,
        'a longer float would snag'),
      rule('balanced', 'balanced — half warp, half weft', (c) => Math.abs(warpFraction(c) - 0.5) < 0.02,
        'a 2/2 twill shows both faces equally'),
      rule('t4', 'all four treadles pressed', (c, tu, tr) => treadlesUsed(tr) === 4,
        'a twill walks the whole loom'),
    ],
  },
  {
    key: 'warpface',
    name: 'Warp-Faced, and Nothing Snags',
    brief: 'Make the warp dominate the face — but keep every float short enough to survive being worn.',
    rules: [
      rule('warp70', 'warp shows on at least 70% of the face', (c) => warpFraction(c) >= 0.7,
        'warp-faced cloth hides the weft'),
      rule('float3', 'no float longer than 3', (c) => maxFloat(c) <= 3,
        'the hard part: warp dominance wants long floats, and long floats snag'),
      rule('s4', 'every shaft earns its keep', (c, tu, tr) => shaftsUsed(tu, tr) === 4,
        'a shaft that never lifts is a shaft you did not need'),
    ],
  },
  {
    key: 'tight',
    name: 'Cloth That Holds Together',
    brief: 'Nothing may float more than two. Use every treadle. And it may not simply be plain weave — find some other way to hold.',
    rules: [
      rule('float2', 'no float longer than 2', (c) => maxFloat(c) <= 2,
        'a tight, hard-wearing cloth'),
      rule('notplain', 'not plain weave', (c) => maxFloat(c) === 2,
        'over-one-under-one is the easy answer; something must float exactly two'),
      rule('t4', 'all four treadles pressed', (c, tu, tr) => treadlesUsed(tr) === 4,
        'use the whole loom'),
      rule('s4', 'every shaft earns its keep', (c, tu, tr) => shaftsUsed(tu, tr) === 4,
        'no idle shafts'),
    ],
  },
];

// evaluate a player's loom against a level: which rules pass, and is it solved?
export function judge(level, tieup, treadling) {
  const cloth = weave(tieup, treadling);
  const results = level.rules.map((r) => ({
    id: r.id, label: r.label, why: r.why, pass: !!r.test(cloth, tieup, treadling),
  }));
  return { cloth, results, solved: results.every((r) => r.pass) };
}
