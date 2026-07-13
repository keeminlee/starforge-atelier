// data/syllables.js
// The syllable engine. Confidence is exposed, never hidden.
//
// countSyllables(word) -> { count, confidence }
//   confidence === 'exact'     when the count comes from the embedded override table
//   confidence === 'heuristic' when it comes from the fallback vowel-group rule
//
// countLine(line) -> { count, words:[{word,count,confidence}], lowConfidence }
//
// HONESTY: classical renga counts Japanese *on* (mora), not English syllables.
// This is an English-syllabic adaptation. The heuristic is deliberately simple and
// WILL be imperfect on out-of-table words; that imperfection is surfaced via the
// 'heuristic' confidence flag rather than silently trusted. Any word the generator
// or a hand-authored kasen relies on for an exact meter should live in OVERRIDES.

// Embedded override table: verified counts. Seeded with ~150 common English words
// PLUS every word used in the two test kasen, so those kasen count as 'exact'.
export const OVERRIDES = {
  // --- common function / short words ---
  a: 1, an: 1, the: 1, and: 1, or: 1, but: 1, if: 1, so: 1, of: 1, to: 1,
  in: 1, on: 1, at: 1, by: 1, for: 1, from: 1, with: 1, as: 1, is: 1, was: 1,
  are: 1, be: 1, not: 1, no: 1, now: 1, out: 1, up: 1, off: 1, own: 1, one: 1,
  two: 1, all: 1, each: 1, then: 1, than: 1, till: 1, too: 1, into: 2, i: 1,
  you: 1, he: 1, she: 1, we: 1, they: 1, it: 1, its: 1, his: 1, her: 1, him: 1,
  them: 1, their: 1, this: 1, that: 1, my: 1, me: 1, us: 1, do: 1, does: 1,
  did: 1, have: 1, has: 1, had: 1, will: 1, can: 1, may: 1, would: 1, could: 1,
  should: 1, our: 1, new: 1, old: 1, few: 1, far: 1, low: 1, high: 1,

  // --- common content words (the ~150 seed) ---
  day: 1, night: 1, sun: 1, star: 1, sky: 1, moon: 1, cloud: 1, clouds: 1,
  rain: 1, snow: 1, wind: 1, water: 2, fire: 1, tree: 1, bird: 1, flower: 2,
  grass: 1, leaf: 1, leaves: 1, stone: 1, hill: 1, hills: 1, sea: 1, river: 2,
  field: 1, road: 1, house: 1, home: 1, love: 1, heart: 1, hand: 1, hands: 1,
  eye: 1, eyes: 1, hair: 1, face: 1, table: 2, apple: 2, little: 2, people: 2,
  open: 2, close: 1, closed: 1, every: 2, only: 2, very: 2, many: 2, much: 1,
  some: 1, any: 2, here: 1, there: 1, where: 1, when: 1, what: 1, who: 1,
  how: 1, why: 1, because: 2, before: 2, after: 2, around: 2, between: 2,
  beautiful: 3, quiet: 2, evening: 2, morning: 2, orange: 2, family: 3,
  animal: 3, another: 3, together: 3, remember: 3, different: 3, important: 3,
  syllable: 3, poetry: 3, autumn: 2, spring: 1, summer: 2, winter: 2,
  number: 2, mother: 2, father: 2, brother: 2, sister: 2, other: 2, color: 2,
  over: 2, under: 2, above: 2, below: 2, again: 2, silence: 2,
  silent: 2, silver: 2, garden: 2, window: 2, candle: 2,

  // --- Phase 3.5 verse-bank additions (all counts hand-verified) ---
  settles: 2, stiffens: 2, turns: 1, smells: 1, ash: 1, bow: 1, crickets: 2,
  cricket: 2, grow: 1, faint: 1, song: 1, nights: 1, along: 2, bites: 1,
  bare: 1, fields: 1, leaps: 1, lets: 1, spreads: 1, ridges: 2, ridge: 1,
  willow: 2, willows: 2, leans: 1, greening: 2, melts: 1, noon: 1, cools: 1,
  cool: 1, shallows: 2, stones: 1, cicadas: 3, cicada: 3, grove: 1, throbs: 1,
  presses: 2, towers: 2, afternoon: 3, thunder: 2, mutters: 2, lotus: 2,
  cup: 1, dragonflies: 3, dragonfly: 3, hover: 2, piles: 1, rolls: 1, drum: 1,
  weed: 1, sways: 1, sinks: 1, lone: 1, crane: 1, cranes: 1, stands: 1,
  frozen: 2, locked: 1, north: 1, strain: 1, gnaws: 1, walls: 1, track: 1,
  footprint: 2, footstep: 2, sags: 1, post: 1, crumbles: 2, beds: 1, fills: 1,
  floods: 1, forms: 1, round: 1, stills: 1, earth: 1, moves: 1, tall: 1,
  sigh: 1, passing: 2, bends: 1, sight: 1, listens: 2, tears: 1, burned: 1,
  loosens: 2, bloom: 1, crowds: 1, wears: 1, heat: 1, hot: 1,
  makes: 1, gives: 1, back: 1, puts: 1, away: 2, sees: 1, last: 1,
  come: 1, reed: 1, cuts: 1, carries: 2, down: 1, go: 1, goes: 1, marks: 1,
  opens: 2, rising: 2, stand: 1, start: 1, turn: 1,

  // --- words used in test/kasen-valid.js (all verified exact) ---
  grey: 1, dusk: 1, moor: 1, empty: 2, lies: 1, fallow: 2, long: 1, year: 1,
  darkens: 2, wild: 1, geese: 1, cross: 1, fading: 2, cry: 1, fades: 1,
  dark: 1, peaks: 1, hold: 1, light: 1, ridgeline: 2, sharp: 1, against: 2,
  valley: 2, grows: 1, cold: 1, small: 1, hut: 1, shuttered: 2, doors: 1,
  roof: 1, heavy: 2, thatch: 1, frost: 1, comes: 1, tonight: 2, lifts: 1,
  glows: 1, white: 1, ground: 1, runs: 1, black: 1, deep: 1, carrying: 3,
  fallen: 2, without: 2, end: 1, traveler: 3, walks: 1, alone: 2, straw: 1,
  sandals: 2, worn: 1, first: 1, blurs: 1, pathway: 2, step: 1, slow: 1,
  green: 1, pines: 1, bend: 1, weight: 1, boughs: 1, unbent: 2, gate: 1,
  hangs: 1, hinge: 1, latch: 1, shut: 1, folds: 1, robe: 1, lays: 1,
  across: 2, quilt: 1, scent: 1, almost: 2, gone: 1, lamp: 1, gutters: 2,
  dim: 1, waits: 1, voice: 1, rises: 2, rattles: 2, paper: 2, screens: 1,
  loose: 1, shutter: 2, bangs: 1, swims: 1, mist: 1, pale: 1, returns: 2,
  reeds: 1, marsh: 1, dry: 1, heads: 1, whisper: 2, sway: 1, still: 1,
  clear: 1, dew: 1, weighs: 1, bending: 2, stem: 1, falls: 1, breath: 1,
  blossom: 2, breaks: 1, branch: 1, butterfly: 3, wakes: 1, drifts: 1,
  sunlit: 2, meadow: 2, bank: 1, soft: 1, walking: 2, feet: 1, seen: 1,
  pile: 1, blue: 1, west: 1, shapes: 1, moving: 2, warm: 1, drums: 1,
  broad: 1, plantain: 2, clears: 1, steam: 1, drawn: 1, well: 1, spills: 1,
  bright: 1, wooden: 2, pail: 1, narrow: 2, bridge: 1, spans: 1, current: 2,
  smooth: 1, years: 1, meets: 1, dreams: 1, room: 1, pillow: 2, damp: 1,
  counts: 1, hours: 1, dawn: 1, bed: 1, wide: 1, thin: 1, smoke: 1,
  climbs: 1, hidden: 2, someone: 2, burns: 1, brush: 1, line: 1, calling: 2,
  sets: 1, bound: 1, south: 1, beneath: 2, moss: 1, creeps: 1, wall: 1,
  late: 1, bitten: 2, whole: 1, world: 1, bell: 1, sounds: 1, through: 1,
  note: 1, coals: 1, glow: 1, hearth: 1, man: 1, warms: 1, ahead: 2,
  deepens: 2, sound: 1, ice: 1, locks: 1, pond: 1, glass: 1, sleeping: 2,
  fish: 1, holds: 1, thaw: 1, frees: 1, singing: 2, stream: 1, rocks: 1,
  cherry: 2, petals: 2, air: 1, drift: 1, lark: 1, warming: 2, sings: 1,
  awake: 2,
};

// Common diphthong / vowel pairs treated as a single vowel nucleus.
// (The vowel-group regex already collapses adjacent vowels; this list documents
//  the intent and is used to keep the heuristic honest about what it does.)
const VOWELS = 'aeiouy';

// The standard English syllable heuristic:
//  - lowercase, strip non-letters
//  - count vowel-groups (adjacent vowels = one group -> handles diphthongs)
//  - subtract a silent trailing 'e' (unless the word ends in consonant+'le',
//    which keeps its own syllable, e.g. "table", "little")
//  - never return less than 1 for a non-empty word
function heuristicCount(raw) {
  const w = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;

  const groups = w.match(/[aeiouy]+/g) || [];
  let count = groups.length;

  const endsConsonantLE = /[^aeiouy]le$/.test(w);
  const endsSilentE = /[^aeiouy]e$/.test(w);

  // silent trailing 'e' (but consonant+'le' keeps its syllable)
  if (endsSilentE && !endsConsonantLE) {
    count -= 1;
  }

  if (count < 1) count = 1;
  return count;
}

/**
 * countSyllables(word) -> { count, confidence }
 * 'exact' if from the override table, otherwise 'heuristic'.
 */
export function countSyllables(word) {
  const key = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (key.length === 0) return { count: 0, confidence: 'exact' };
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, key)) {
    return { count: OVERRIDES[key], confidence: 'exact' };
  }
  return { count: heuristicCount(key), confidence: 'heuristic' };
}

/**
 * countLine(line) -> { count, words:[{word,count,confidence}], lowConfidence }
 * Splits on whitespace and hyphens; strips other punctuation from each token.
 * lowConfidence is true if ANY token fell back to the heuristic.
 */
export function countLine(line) {
  const tokens = String(line)
    .split(/[\s-]+/)
    .map((t) => t.replace(/[^A-Za-z]/g, ''))
    .filter((t) => t.length > 0);

  const words = tokens.map((t) => {
    const r = countSyllables(t);
    return { word: t, count: r.count, confidence: r.confidence };
  });

  const count = words.reduce((sum, w) => sum + w.count, 0);
  const lowConfidence = words.some((w) => w.confidence === 'heuristic');

  return { count, words, lowConfidence };
}
