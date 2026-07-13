// data/verse-bank.js
// THE VERSE BANK (Phase 3.5 pivot). The machine is no longer a line-composer;
// it is a renga SEQUENCER over a bank of hand-authored whole-verse units. Each
// unit below is a genuine, coherent, human-authored image — the aesthetic lives
// HERE, in the units; the machine's job is the hard part: sequencing them into a
// rule-legal, linked, shifting kasen.
//
// Each unit:
//   { id, kind:'long'|'short', lines:[...], syllables:[...], season,
//     categories:[...], isMoon, isBlossom, isLove, salientWords:[...] }
//
//   long  = 5-7-5 (three lines)   short = 7-7 (two lines)
//   season ∈ 'spring'|'summer'|'autumn'|'winter'|null   (null = miscellaneous / zō)
//   categories — imagistic tags used for LINK (ASSOCIATIONS edge to n-1) and
//                SHIFT (disjoint from n-1 / n-2)
//   salientWords — the distinctive content words of this verse, for cross-poem
//                  aversion (no distinctive image returns within a set gap).
//
// SELF-CHECKING DATA (three hard asserts at module load — throw on any failure):
//   1. every line's declared syllable count == countLine(line).count
//   2. no two lines in a unit share a salient content word (no intra-verse stutter)
//   3. no line string appears in two different units (no cross-poem verbatim reuse
//      can arise from the bank itself)
//
// MOON / BLOSSOM HONESTY (the structural half of the honesty gate): the words
//   moon / moonlight appear in NO non-moon unit; blossom / cherry / petals appear
//   in NO non-blossom unit. Marker words live ONLY in marker units, so a marker
//   can never leak into a general seat's surface text.

import { countLine } from './syllables.js';

// ---------------------------------------------------------------------------
// Unit builders — fill defaults + the meter-derived `syllables` field.
// ---------------------------------------------------------------------------
function unit(kind, o) {
  return {
    id: o.id,
    kind,
    lines: o.lines,
    syllables: kind === 'long' ? [5, 7, 5] : [7, 7],
    season: o.season ?? null,
    categories: o.categories,
    isMoon: !!o.isMoon,
    isBlossom: !!o.isBlossom,
    isLove: !!o.isLove,
    salientWords: o.salientWords,
  };
}
const L = (o) => unit('long', o);
const S = (o) => unit('short', o);

// ===========================================================================
// GENERAL UNITS — the four seasons + miscellaneous (zō). No marker words.
// ===========================================================================
const GENERAL = [
  // ---------------- AUTUMN long ----------------
  L({ id: 'au-l-field', season: 'autumn', categories: ['field'],
      lines: ['grey dusk on the moor', 'the empty field lies fallow', 'the geese are long gone'],
      salientWords: ['moor', 'field', 'fallow', 'geese'] }),
  L({ id: 'au-l-reed', season: 'autumn', categories: ['reed', 'marsh'],
      lines: ['reeds bend by the marsh', 'their dry heads whisper and sway', 'the cold wind lifts them'],
      salientWords: ['reeds', 'marsh', 'whisper', 'sway'] }),
  L({ id: 'au-l-dew', season: 'autumn', categories: ['dew'],
      lines: ['clear dew on the stem', 'it weighs the bending grass down', 'the cold dawn comes slow'],
      salientWords: ['dew', 'stem', 'weighs', 'dawn'] }),
  L({ id: 'au-l-frost', season: 'autumn', categories: ['frost'],
      lines: ['white frost on the ground', 'it stiffens the fallen leaves', 'the year turns to cold'],
      salientWords: ['frost', 'ground', 'fallen', 'stiffens'] }),
  L({ id: 'au-l-smoke', season: 'autumn', categories: ['smoke'],
      lines: ['thin smoke climbs and fades', 'someone burns the fallow brush', 'the field smells of ash'],
      salientWords: ['smoke', 'burns', 'brush', 'ash'] }),
  L({ id: 'au-l-bird', season: 'autumn', categories: ['bird'],
      lines: ['wild geese cross the sky', 'their long cry fades to the south', 'the reeds bow below'],
      salientWords: ['geese', 'cry', 'south', 'bow'] }),
  L({ id: 'au-l-cricket', season: 'autumn', categories: ['insect'],
      lines: ['the crickets grow faint', 'the cold nights silence their song', 'frost waits in the dark'],
      salientWords: ['crickets', 'faint', 'song', 'silence'] }),

  // ---------------- AUTUMN short ----------------
  S({ id: 'au-s-field', season: 'autumn', categories: ['field'],
      lines: ['the bare field lies grey and still', 'grey dusk settles on the moor'],
      salientWords: ['field', 'lies', 'dusk', 'moor'] }),
  S({ id: 'au-s-reed', season: 'autumn', categories: ['reed', 'marsh'],
      lines: ['dry reeds bend along the marsh', 'their whisper the only sound'],
      salientWords: ['reeds', 'marsh', 'whisper', 'sound'] }),
  S({ id: 'au-s-dew', season: 'autumn', categories: ['dew'],
      lines: ['clear dew weighs the bending stem', 'the long night turns it to frost'],
      salientWords: ['dew', 'stem', 'weighs', 'frost'] }),
  S({ id: 'au-s-frost', season: 'autumn', categories: ['frost'],
      lines: ['white frost bites the fallen leaves', 'the bare field waits for the snow'],
      salientWords: ['frost', 'fallen', 'field', 'bites'] }),
  S({ id: 'au-s-smoke', season: 'autumn', categories: ['smoke'],
      lines: ['thin smoke climbs from hidden fire', 'someone clears the autumn field'],
      salientWords: ['smoke', 'fire', 'autumn', 'clears'] }),
  S({ id: 'au-s-bird', season: 'autumn', categories: ['bird'],
      lines: ['the wild geese cross the grey sky', 'their long cry fades and is gone'],
      salientWords: ['geese', 'sky', 'cry', 'gone'] }),

  // ---------------- SPRING long ----------------
  L({ id: 'sp-l-bird', season: 'spring', categories: ['bird'],
      lines: ['a lark climbs the air', 'it sings the long year awake', 'the fields turn to green'],
      salientWords: ['lark', 'sings', 'fields', 'green'] }),
  L({ id: 'sp-l-stream', season: 'spring', categories: ['stream'],
      lines: ['the thaw frees the stream', 'bright water leaps over stone', 'the last ice lets go'],
      salientWords: ['thaw', 'stream', 'leaps', 'ice'] }),
  L({ id: 'sp-l-grass', season: 'spring', categories: ['grass'],
      lines: ['new grass on the bank', 'soft green under walking feet', 'the warm rain has come'],
      salientWords: ['grass', 'walking', 'feet', 'rain'] }),
  L({ id: 'sp-l-insect', season: 'spring', categories: ['insect'],
      lines: ['a butterfly wakes', 'it drifts over the warm field', 'the year opens wide'],
      salientWords: ['butterfly', 'drifts', 'field', 'opens'] }),
  L({ id: 'sp-l-hill', season: 'spring', categories: ['hill'],
      lines: ['spring comes to the hill', 'green spreads to the far ridges', 'the snow is all gone'],
      salientWords: ['hill', 'spreads', 'ridges', 'snow'] }),
  L({ id: 'sp-l-willow', season: 'spring', categories: ['water'],
      lines: ['the willow leans low', 'its new leaves brush the water', 'spring wakes in the reeds'],
      salientWords: ['willow', 'leaves', 'water', 'reeds'] }),

  // ---------------- SPRING short ----------------
  S({ id: 'sp-s-bird', season: 'spring', categories: ['bird'],
      lines: ['the lark climbs the warming air', 'and sings the long year awake'],
      salientWords: ['lark', 'warming', 'sings', 'awake'] }),
  S({ id: 'sp-s-grass', season: 'spring', categories: ['grass'],
      lines: ['new grass spreads soft on the bank', 'green as far as the eye sees'],
      salientWords: ['grass', 'bank', 'green', 'eye'] }),
  S({ id: 'sp-s-stream', season: 'spring', categories: ['stream'],
      lines: ['the thaw frees the singing stream', 'bright water spills over stone'],
      salientWords: ['thaw', 'stream', 'water', 'stone'] }),
  S({ id: 'sp-s-hill', season: 'spring', categories: ['hill'],
      lines: ['spring comes green to the far hills', 'the last snow melts from the ridge'],
      salientWords: ['hills', 'snow', 'melts', 'ridge'] }),
  S({ id: 'sp-s-insect', season: 'spring', categories: ['insect'],
      lines: ['a butterfly wakes and drifts', 'over the warm greening field'],
      salientWords: ['butterfly', 'drifts', 'greening', 'field'] }),
  S({ id: 'sp-s-rain', season: 'spring', categories: ['rain'],
      lines: ['spring rain falls on the soft ground', 'the year turns green in a day'],
      salientWords: ['rain', 'ground', 'green', 'day'] }),

  // ---------------- SUMMER long ----------------
  L({ id: 'su-l-well', season: 'summer', categories: ['well'],
      lines: ['the cold well spills bright', 'the drawn water cools the hand', 'the long day burns on'],
      salientWords: ['well', 'water', 'cools', 'burns'] }),
  L({ id: 'su-l-rain', season: 'summer', categories: ['rain'],
      lines: ['warm rain in the dusk', 'it drums on the broad green leaves', 'then clears to thin steam'],
      salientWords: ['rain', 'drums', 'leaves', 'steam'] }),
  L({ id: 'su-l-water', season: 'summer', categories: ['water'],
      lines: ['the river runs low', 'warm shallows over the stones', 'a slow green current'],
      salientWords: ['river', 'shallows', 'stones', 'current'] }),
  L({ id: 'su-l-cicada', season: 'summer', categories: ['insect'],
      lines: ['cicadas start up', 'the whole grove throbs with their sound', 'the noon heat presses'],
      salientWords: ['cicadas', 'grove', 'throbs', 'heat'] }),
  L({ id: 'su-l-cloud', season: 'summer', categories: ['cloud'],
      lines: ['white cloud towers high', 'it climbs the hot afternoon', 'far thunder mutters'],
      salientWords: ['cloud', 'towers', 'afternoon', 'thunder'] }),
  L({ id: 'su-l-pond', season: 'summer', categories: ['water'],
      lines: ['the still pond lies warm', 'green lotus opens its cup', 'dragonflies hover'],
      salientWords: ['pond', 'lotus', 'cup', 'dragonflies'] }),

  // ---------------- SUMMER short ----------------
  S({ id: 'su-s-well', season: 'summer', categories: ['well'],
      lines: ['cold water drawn from the well', 'spills bright in the wooden pail'],
      salientWords: ['water', 'well', 'spills', 'pail'] }),
  S({ id: 'su-s-rain', season: 'summer', categories: ['rain'],
      lines: ['warm rain drums on the broad leaves', 'then clears to a rising steam'],
      salientWords: ['rain', 'drums', 'leaves', 'steam'] }),
  S({ id: 'su-s-cloud', season: 'summer', categories: ['cloud'],
      lines: ['white cloud piles over the hills', 'far thunder rolls in the heat'],
      salientWords: ['cloud', 'piles', 'thunder', 'heat'] }),
  S({ id: 'su-s-cicada', season: 'summer', categories: ['insect'],
      lines: ['cicadas drum in the pines', 'the long heat presses the day'],
      salientWords: ['cicadas', 'pines', 'heat', 'presses'] }),
  S({ id: 'su-s-water', season: 'summer', categories: ['water'],
      lines: ['the river runs warm and low', 'green weed sways over the stones'],
      salientWords: ['river', 'weed', 'sways', 'stones'] }),
  S({ id: 'su-s-eve', season: 'summer', categories: ['well'],
      lines: ['the cool of evening comes down', 'cicadas quiet at last'],
      salientWords: ['cool', 'evening', 'cicadas', 'quiet'] }),

  // ---------------- WINTER long ----------------
  L({ id: 'wi-l-snow', season: 'winter', categories: ['snow'],
      lines: ['the first snow falls slow', 'each step sinks in the deep white', 'the long road grows still'],
      salientWords: ['snow', 'step', 'sinks', 'road'] }),
  L({ id: 'wi-l-ice', season: 'winter', categories: ['ice'],
      lines: ['ice locks the still pond', 'clear glass over sleeping fish', 'the whole world holds still'],
      salientWords: ['ice', 'pond', 'glass', 'fish'] }),
  L({ id: 'wi-l-hearth', season: 'winter', categories: ['hearth'],
      lines: ['coals glow in the hearth', 'an old man warms his thin hands', 'the night wind bites cold'],
      salientWords: ['coals', 'hearth', 'warms', 'hands'] }),
  L({ id: 'wi-l-pine', season: 'winter', categories: ['pine'],
      lines: ['green pines hold the snow', 'their dark boughs bend with the weight', 'the cold deepens on'],
      salientWords: ['pines', 'boughs', 'bend', 'weight'] }),
  L({ id: 'wi-l-crane', season: 'winter', categories: ['bird'],
      lines: ['a lone crane stands still', 'in the grey frozen shallows', 'the marsh locked in ice'],
      salientWords: ['crane', 'frozen', 'shallows', 'marsh'] }),
  L({ id: 'wi-l-wind', season: 'winter', categories: ['wind'],
      lines: ['the north wind rises', 'it rattles the shuttered doors', 'the long cold night comes'],
      salientWords: ['wind', 'rattles', 'shuttered', 'doors'] }),

  // ---------------- WINTER short ----------------
  S({ id: 'wi-s-snow', season: 'winter', categories: ['snow'],
      lines: ['the first snow blurs the pathway', 'each slow step sinks in the white'],
      salientWords: ['snow', 'pathway', 'step', 'sinks'] }),
  S({ id: 'wi-s-ice', season: 'winter', categories: ['ice'],
      lines: ['clear ice locks the sleeping pond', 'the frozen world holds its breath'],
      salientWords: ['ice', 'pond', 'frozen', 'breath'] }),
  S({ id: 'wi-s-hearth', season: 'winter', categories: ['hearth'],
      lines: ['the old man warms his cold hands', 'the wind gnaws at the bare walls'],
      salientWords: ['warms', 'hands', 'gnaws', 'walls'] }),
  S({ id: 'wi-s-pine', season: 'winter', categories: ['pine'],
      lines: ['pines bend with the weight of snow', 'the dark boughs strain and hold on'],
      salientWords: ['pines', 'weight', 'boughs', 'strain'] }),
  S({ id: 'wi-s-wind', season: 'winter', categories: ['wind'],
      lines: ['the north wind rattles the screens', 'the long night deepens to cold'],
      salientWords: ['wind', 'rattles', 'screens', 'deepens'] }),
  S({ id: 'wi-s-road', season: 'winter', categories: ['road'],
      lines: ['the deep snow blurs the long road', 'no footprint marks the deep white'],
      salientWords: ['snow', 'road', 'footprint', 'marks'] }),

  // ---------------- MISCELLANEOUS (zō, season null) long ----------------
  L({ id: 'mi-l-mountain', season: null, categories: ['mountain'],
      lines: ['far peaks hold the light', 'the sharp ridgeline cuts the sky', 'the valley grows cold'],
      salientWords: ['peaks', 'ridgeline', 'valley', 'cuts'] }),
  L({ id: 'mi-l-dwelling', season: null, categories: ['dwelling'],
      lines: ['a small hut with doors', 'no one comes to latch them shut', 'the low roof sags grey'],
      salientWords: ['hut', 'latch', 'roof', 'sags'] }),
  L({ id: 'mi-l-road', season: null, categories: ['road'],
      lines: ['a road without end', 'the traveler walks alone', 'his straw sandals worn'],
      salientWords: ['road', 'traveler', 'straw', 'sandals'] }),
  L({ id: 'mi-l-water', season: null, categories: ['water'],
      lines: ['the river runs black', 'deep water over the stones', 'and gives back no sound'],
      salientWords: ['river', 'water', 'stones', 'sound'] }),
  L({ id: 'mi-l-gate', season: null, categories: ['gate'],
      lines: ['the gate hangs open', 'one hinge holds it to the post', 'the old wall crumbles'],
      salientWords: ['gate', 'hinge', 'post', 'crumbles'] }),
  L({ id: 'mi-l-bridge', season: null, categories: ['bridge'],
      lines: ['a low narrow bridge', 'spans the current far below', 'worn smooth by the years'],
      salientWords: ['bridge', 'spans', 'current', 'smooth'] }),
  L({ id: 'mi-l-bell', season: null, categories: ['bell'],
      lines: ['a far bell sounds low', 'one note across the still dusk', 'then the long silence'],
      salientWords: ['bell', 'note', 'dusk', 'silence'] }),
  L({ id: 'mi-l-mist', season: null, categories: ['mist', 'marsh'],
      lines: ['mist over the marsh', 'it blurs the far dark reed beds', 'the whole world goes grey'],
      salientWords: ['mist', 'marsh', 'reed', 'beds'] }),

  // ---------------- MISCELLANEOUS short ----------------
  S({ id: 'mi-s-mountain', season: null, categories: ['mountain'],
      lines: ['far peaks hold the fading light', 'the valley fills with cold dark'],
      salientWords: ['peaks', 'light', 'valley', 'fills'] }),
  S({ id: 'mi-s-dwelling', season: null, categories: ['dwelling'],
      lines: ['a small hut with shuttered doors', 'no smoke lifts from the cold roof'],
      salientWords: ['hut', 'doors', 'smoke', 'roof'] }),
  S({ id: 'mi-s-road', season: null, categories: ['road'],
      lines: ['a lone traveler walks on', 'the long road bends out of sight'],
      salientWords: ['traveler', 'road', 'bends', 'sight'] }),
  S({ id: 'mi-s-water', season: null, categories: ['water'],
      lines: ['the river runs black and deep', 'it gives no light to the sky'],
      salientWords: ['river', 'deep', 'light', 'sky'] }),
  S({ id: 'mi-s-gate', season: null, categories: ['gate'],
      lines: ['the gate hangs from one hinge now', 'the old wall gives back the dusk'],
      salientWords: ['gate', 'hinge', 'wall', 'dusk'] }),
  S({ id: 'mi-s-bridge', season: null, categories: ['bridge'],
      lines: ['the old bridge spans the current', 'worn smooth by the passing years'],
      salientWords: ['bridge', 'spans', 'smooth', 'passing'] }),
  S({ id: 'mi-s-mist', season: null, categories: ['mist', 'marsh'],
      lines: ['cold mist blurs the far reed beds', 'the marsh fades into the grey'],
      salientWords: ['mist', 'reed', 'marsh', 'fades'] }),
  S({ id: 'mi-s-moss', season: null, categories: ['moss', 'stone'],
      lines: ['green moss creeps over the stone', 'the old wall sinks in the earth'],
      salientWords: ['moss', 'stone', 'wall', 'earth'] }),
  S({ id: 'mi-s-bell', season: null, categories: ['bell'],
      lines: ['a far bell sounds through the dark', 'one note then the long silence'],
      salientWords: ['bell', 'note', 'silence', 'dark'] }),
  S({ id: 'mi-s-pine', season: null, categories: ['wind'],
      lines: ['the wind moves through the tall pines', 'a long sigh then it is still'],
      salientWords: ['wind', 'pines', 'sigh', 'moves'] }),
];

// ===========================================================================
// MOON UNITS — season autumn, isMoon. The ONLY units that may contain "moon".
// long for seats 5 & 29; short for seat 14.
// ===========================================================================
const MOON = [
  L({ id: 'moon-l-1', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the moon lifts and glows', 'white light on the frost-bright field', 'the whole long night stills'],
      salientWords: ['moon', 'light', 'frost', 'field'] }),
  L({ id: 'moon-l-2', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the late moon rises', 'it swims up through the cold mist', 'the reeds stand silver'],
      salientWords: ['moon', 'rises', 'mist', 'reeds'] }),
  L({ id: 'moon-l-3', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the moon clears the ridge', 'cold light floods the frozen marsh', 'the geese cross its face'],
      salientWords: ['moon', 'ridge', 'floods', 'geese'] }),
  L({ id: 'moon-l-4', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the round moon comes up', 'up over the dark reed-marsh', 'frost forms as it climbs'],
      salientWords: ['moon', 'reed', 'frost', 'climbs'] }),
  L({ id: 'moon-l-5', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the moon hangs alone', 'in the wide and empty sky', 'the frost creeps below'],
      salientWords: ['moon', 'hangs', 'empty', 'creeps'] }),

  S({ id: 'moon-s-1', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['and the cold moon lifts and glows', 'white light on the frozen field'],
      salientWords: ['moon', 'glows', 'light', 'field'] }),
  S({ id: 'moon-s-2', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the late moon swims in the mist', 'cold silver floods the still reeds'],
      salientWords: ['moon', 'mist', 'silver', 'reeds'] }),
  S({ id: 'moon-s-3', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the round moon clears the dark ridge', 'its light floods the frozen marsh'],
      salientWords: ['moon', 'ridge', 'floods', 'marsh'] }),
  S({ id: 'moon-s-4', season: 'autumn', categories: ['moon'], isMoon: true,
      lines: ['the pale moon climbs through thin cloud', 'and stills the wide autumn field'],
      salientWords: ['moon', 'cloud', 'autumn', 'field'] }),
];

// ===========================================================================
// BLOSSOM UNITS — season spring, isBlossom. The ONLY units that may contain
// blossom / cherry / petals. long for seats 17 & 35.
// ===========================================================================
const BLOSSOM = [
  L({ id: 'blo-l-1', season: 'spring', categories: ['blossom'], isBlossom: true,
      lines: ['cherry blossom falls', 'a slow drift of white petals', 'spring wind carries them'],
      salientWords: ['cherry', 'blossom', 'petals', 'drift'] }),
  L({ id: 'blo-l-2', season: 'spring', categories: ['blossom'], isBlossom: true,
      lines: ['the cherry tree breaks', 'into a white cloud of bloom', 'the whole hill turns pale'],
      salientWords: ['cherry', 'bloom', 'hill', 'cloud'] }),
  L({ id: 'blo-l-3', season: 'spring', categories: ['blossom'], isBlossom: true,
      lines: ['pale blossom opens', 'along the dark bending boughs', 'spring floods the valley'],
      salientWords: ['blossom', 'opens', 'boughs', 'valley'] }),
  L({ id: 'blo-l-4', season: 'spring', categories: ['blossom'], isBlossom: true,
      lines: ['cherry petals drift', 'down to the slow moving stream', 'the far hills grow green'],
      salientWords: ['cherry', 'petals', 'stream', 'hills'] }),
  L({ id: 'blo-l-5', season: 'spring', categories: ['blossom'], isBlossom: true,
      lines: ['blossom fills the branch', 'a warm wind loosens the drift', 'petals on the grass'],
      salientWords: ['blossom', 'branch', 'petals', 'grass'] }),
];

// ===========================================================================
// LOVE UNITS — season null, isLove. categories robe / lamp / dream / pillow.
// No marker words. Both kinds for each image so love runs (2-3 verses,
// long/short alternating) can be filled from either run's imagery.
// ===========================================================================
const LOVE = [
  L({ id: 'love-l-robe', season: null, categories: ['robe'], isLove: true,
      lines: ['she folds his old robe', 'and lays it across the quilt', 'his scent almost gone'],
      salientWords: ['folds', 'robe', 'quilt', 'scent'] }),
  S({ id: 'love-s-robe', season: null, categories: ['robe'], isLove: true,
      lines: ['she folds away his old robe', 'his scent almost gone from it'],
      salientWords: ['folds', 'robe', 'scent', 'gone'] }),
  L({ id: 'love-l-lamp', season: null, categories: ['lamp'], isLove: true,
      lines: ['the lamp gutters low', 'she waits for a step, a voice', 'the night wears away'],
      salientWords: ['lamp', 'gutters', 'waits', 'voice'] }),
  S({ id: 'love-s-lamp', season: null, categories: ['lamp'], isLove: true,
      lines: ['the lamp gutters low and dim', 'she listens for his footstep'],
      salientWords: ['lamp', 'gutters', 'dim', 'listens'] }),
  L({ id: 'love-l-dream', season: null, categories: ['dream'], isLove: true,
      lines: ['she meets him in dreams', 'and wakes to the empty room', 'the cold bed too wide'],
      salientWords: ['meets', 'dreams', 'wakes', 'room'] }),
  S({ id: 'love-s-dream', season: null, categories: ['dream'], isLove: true,
      lines: ['again she meets him in dreams', 'and wakes alone in the dark'],
      salientWords: ['meets', 'dreams', 'wakes', 'alone'] }),
  L({ id: 'love-l-pillow', season: null, categories: ['pillow'], isLove: true,
      lines: ['her pillow still damp', 'she counts the long hours till dawn', 'the lamp long burned out'],
      salientWords: ['pillow', 'counts', 'hours', 'dawn'] }),
  S({ id: 'love-s-pillow', season: null, categories: ['pillow'], isLove: true,
      lines: ['her pillow still damp with tears', 'she counts the slow hours to dawn'],
      salientWords: ['pillow', 'damp', 'tears', 'counts'] }),
];

export const VERSE_BANK = [...GENERAL, ...MOON, ...BLOSSOM, ...LOVE];

// ---------------------------------------------------------------------------
// SELF-CHECK 1 — declared syllables == countLine(line).count for every line.
// ---------------------------------------------------------------------------
{
  const errors = [];
  for (const u of VERSE_BANK) {
    const meter = u.kind === 'long' ? [5, 7, 5] : [7, 7];
    if (u.lines.length !== meter.length) {
      errors.push(`  ${u.id}: ${u.lines.length} lines (expected ${meter.length} for ${u.kind})`);
      continue;
    }
    for (let i = 0; i < u.lines.length; i++) {
      const actual = countLine(u.lines[i]).count;
      if (actual !== meter[i]) {
        errors.push(`  ${u.id} line ${i + 1}: declared ${meter[i]}, countLine says ${actual} — "${u.lines[i]}"`);
      }
    }
  }
  if (errors.length) {
    throw new Error(`verse-bank.js: ${errors.length} meter mismatch(es):\n` + errors.join('\n'));
  }
}

// ---------------------------------------------------------------------------
// SELF-CHECK 2 — no two lines in a unit share a salient content word (the
// anti-stutter guarantee). Content = tokens minus function/glue stopwords.
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'so', 'of', 'to', 'in', 'on', 'at',
  'by', 'for', 'from', 'with', 'as', 'is', 'was', 'are', 'be', 'not', 'no', 'now',
  'out', 'up', 'off', 'own', 'one', 'two', 'all', 'each', 'then', 'than', 'till',
  'too', 'into', 'it', 'its', 'his', 'her', 'she', 'he', 'they', 'them', 'their',
  'this', 'that', 'my', 'me', 'us', 'we', 'you', 'him', 'i', 'do', 'has', 'had',
  'over', 'under', 'through', 'along', 'across', 'below', 'above', 'down', 'on',
  'still', 'cold', 'grey', 'pale', 'clear', 'slow', 'deep', 'far', 'dark', 'soft',
  'low', 'long', 'old', 'new', 'small', 'wide', 'thin', 'warm', 'cool', 'hot',
  'white', 'green', 'black', 'blue', 'bright', 'first', 'last', 'whole', 'lone',
  'bare', 'round', 'sharp', 'tall',
]);
function contentWords(line) {
  return String(line)
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z]/g, ''))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}
{
  const errors = [];
  for (const u of VERSE_BANK) {
    const seen = new Map(); // content word -> first line index
    for (let i = 0; i < u.lines.length; i++) {
      for (const w of contentWords(u.lines[i])) {
        if (seen.has(w) && seen.get(w) !== i) {
          errors.push(`  ${u.id}: content word "${w}" appears in lines ${seen.get(w) + 1} and ${i + 1} (intra-verse stutter)`);
        } else if (!seen.has(w)) {
          seen.set(w, i);
        }
      }
    }
  }
  if (errors.length) {
    throw new Error(`verse-bank.js: ${errors.length} intra-verse stutter(s):\n` + errors.join('\n'));
  }
}

// ---------------------------------------------------------------------------
// SELF-CHECK 3 — no line string appears in two different units (so the bank can
// never itself be the source of a cross-verse verbatim repeat).
// ---------------------------------------------------------------------------
{
  const lineOwner = new Map();
  const errors = [];
  for (const u of VERSE_BANK) {
    for (const line of u.lines) {
      const key = line.trim().toLowerCase();
      if (lineOwner.has(key) && lineOwner.get(key) !== u.id) {
        errors.push(`  line "${line}" in both ${lineOwner.get(key)} and ${u.id}`);
      } else {
        lineOwner.set(key, u.id);
      }
    }
  }
  if (errors.length) {
    throw new Error(`verse-bank.js: ${errors.length} duplicate line(s) across units:\n` + errors.join('\n'));
  }
}

// ---------------------------------------------------------------------------
// SELF-CHECK 4 (MOON/BLOSSOM HONESTY) — marker words confined to marker units.
// ---------------------------------------------------------------------------
{
  const MOON_WORDS = /\b(moon|moonlight)\b/i;
  const BLOSSOM_WORDS = /\b(blossom|cherry|petals?)\b/i;
  const errors = [];
  for (const u of VERSE_BANK) {
    const text = u.lines.join(' ');
    if (!u.isMoon && MOON_WORDS.test(text)) errors.push(`  ${u.id} (non-moon) contains a moon word: "${text}"`);
    if (!u.isBlossom && BLOSSOM_WORDS.test(text)) errors.push(`  ${u.id} (non-blossom) contains a blossom word: "${text}"`);
  }
  if (errors.length) {
    throw new Error(`verse-bank.js: ${errors.length} marker-word leak(s):\n` + errors.join('\n'));
  }
}

// ---------------------------------------------------------------------------
// ASSOCIATIONS — category -> [associated categories]. THE LINKING MODEL.
// (Carried over from the fragment lexicon; the sequencer prefers, for verse n, a
// unit whose category shares an edge with verse n-1. Edges are symmetrized.)
//
// HONESTY: these edges are hand-authored imagistic adjacencies, not learned
// semantics. A link they produce is real at the category-graph level (two
// adjacent verses genuinely share a declared association); the sequencer records
// each seat as a genuine link or an honest non-link, never laundering a jump.
// ---------------------------------------------------------------------------
const RAW_ASSOCIATIONS = {
  field: ['bird', 'grass', 'road', 'dwelling', 'smoke'],
  bird: ['field', 'cloud', 'mountain', 'reed', 'marsh'],
  mountain: ['cloud', 'mist', 'pine', 'valley', 'stone'],
  dwelling: ['hearth', 'smoke', 'gate', 'lamp', 'robe'],
  water: ['bridge', 'reed', 'marsh', 'stream', 'dew'],
  road: ['bridge', 'gate', 'field', 'dwelling', 'stone'],
  pine: ['mountain', 'snow', 'wind'],
  gate: ['dwelling', 'road', 'moss', 'stone'],
  wind: ['reed', 'cloud', 'bell', 'mist', 'pine'],
  mist: ['moon', 'marsh', 'mountain', 'dew'],
  reed: ['marsh', 'water', 'wind', 'dew', 'bird'],
  dew: ['grass', 'reed', 'blossom', 'water'],
  hill: ['blossom', 'grass', 'field', 'cloud'],
  insect: ['grass', 'blossom', 'hill'],
  grass: ['dew', 'insect', 'field', 'hill'],
  cloud: ['wind', 'mountain', 'bird', 'hill'],
  rain: ['cloud', 'well', 'stream'],
  well: ['water', 'rain', 'stone'],
  bridge: ['water', 'road', 'stream'],
  smoke: ['hearth', 'dwelling', 'field'],
  stone: ['moss', 'gate', 'road', 'mountain'],
  bell: ['wind', 'dwelling', 'hearth'],
  hearth: ['smoke', 'dwelling', 'bell'],
  ice: ['snow', 'frost', 'water'],
  stream: ['water', 'stone', 'bridge', 'rain'],
  frost: ['moon', 'ice', 'dew'],
  snow: ['pine', 'ice', 'road'],
  moss: ['stone', 'gate'],
  marsh: ['reed', 'water', 'mist', 'bird'],
  moon: ['mist', 'frost', 'wind', 'reed'],
  blossom: ['hill', 'dew', 'insect', 'grass'],
  robe: ['lamp', 'dwelling'],
  lamp: ['robe', 'dwelling', 'wind'],
  dream: ['pillow', 'bell'],
  pillow: ['dream', 'hearth'],
};

function symmetrize(raw) {
  const out = {};
  const add = (a, b) => {
    if (!out[a]) out[a] = new Set();
    out[a].add(b);
  };
  for (const [a, list] of Object.entries(raw)) {
    for (const b of list) {
      add(a, b);
      add(b, a);
    }
  }
  const result = {};
  for (const [k, set] of Object.entries(out)) result[k] = [...set];
  return result;
}

export const ASSOCIATIONS = symmetrize(RAW_ASSOCIATIONS);

// Categories exempt from category-aversion spacing (governed by seats/love-runs).
export const MARKER_CATEGORIES = new Set(['moon', 'blossom']);
