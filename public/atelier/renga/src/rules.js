// src/rules.js
// The kasen (36-verse) spec as pure data. One standard seat scheme is encoded here;
// schemes vary by school (this one is stated, not claimed as the only one).
//
// HONESTY: this is the *structure* of a kasen. The prosody is anglicised
// (English syllables, not Japanese on). See DESIGN.md.

export const VERSE_COUNT = 36;

// Verse-length pattern: odd verses (1,3,5,...) are 5-7-5 across three lines;
// even verses (2,4,6,...) are 7-7 across two lines.
export function meterFor(n) {
  return n % 2 === 1 ? [5, 7, 5] : [7, 7];
}

// Fixed seats. isMoon / isBlossom must be true at exactly these positions.
export const SEATS = {
  moon: [5, 14, 29],
  blossom: [17, 35],
};

// Movement (jo-ha-kyū). Sheet layout 6 / (7..30) / 6.
export const MOVEMENT = {
  jo: [1, 6],
  ha: [7, 30],
  kyu: [31, 36],
};

export function movementFor(n) {
  if (n >= MOVEMENT.jo[0] && n <= MOVEMENT.jo[1]) return 'jo';
  if (n >= MOVEMENT.ha[0] && n <= MOVEMENT.ha[1]) return 'ha';
  return 'kyu';
}

// Season-run bounds [min, max] (inclusive). Spring & autumn are the "long"
// seasons (3..5); summer & winter are brief (1..3). A min of 3 for spring/autumn
// is what forbids single-verse spring/autumn islands.
export const SEASON_RUN_BOUNDS = {
  spring: [3, 5],
  autumn: [3, 5],
  summer: [1, 3],
  winter: [1, 3],
};

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

// Love appears at least once; each love run is 2..3 verses, then must leave.
export const LOVE_RUN_BOUNDS = [2, 3];

// Aversion (sarikirai): a salient image category must not recur within this gap.
// Consecutive appearances of a salient category must differ by >= AVERSION_MIN_GAP.
export const AVERSION_MIN_GAP = 3;

// Categories exempt from the aversion spacing rule:
//  - moon / blossom are governed by their fixed seats instead.
//  - love is governed by love-run rules (adjacency within a run is required).
export const AVERSION_EXEMPT = new Set(['moon', 'blossom', 'love']);

// Link-and-shift (uchikoshi): for every n >= 3, verse n's categories must NOT
// overlap verse (n-2)'s categories. This is the hard, machine-checkable half of
// the linking rule. See validate.js and the HONESTY note there.
export const UCHIKOSHI_LOOKBACK = 2;

// Phrase-level aversion (Phase 3.5, sarikirai at the surface): a distinctive
// content word (a unit's salientWord) must not recur within this verse gap.
// Consecutive appearances of the same salient word must differ by >= this gap.
// (Verbatim whole-line recurrence is forbidden outright — gap = infinity.)
export const SALIENT_AVERSION_GAP = 7;
