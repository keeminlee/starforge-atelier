// data/lexicon.js
// The off-town tagged fragment bank, in the classical-renga register:
// seasons, nature, dwelling, travel, love, impermanence, moon, blossom.
// Deliberately NOT mail/town/ledger imagery — the root move stays
// computational-poetics and does not drift into the town-legibility vein.
//
// Two exports:
//   FRAGMENTS   — {text, syllables, season, categories:[], kind:'image'|'link-phrase'}
//   ASSOCIATIONS — category -> [associated categories]; the LINKING model.
//
// SELF-CHECKING DATA: for every fragment, the declared `syllables` MUST equal
// countLine(text).count. We assert this at module load and throw if any entry is
// mis-counted. The whole meter guarantee of the generator rests on this: a line
// built by concatenating fragments has syllables == sum of the fragments' declared
// counts (countLine sums per-word), so if the declared counts are exact, the line
// is exact. Prefer words in the syllable dictionary (OVERRIDES) for exact confidence.

import { countLine } from './syllables.js';

// -------------------------------------------------------------------------
// GLUE (link-phrase): category-neutral TRAILING modifiers used to pad an image
// fragment to an exact syllable target. season:null, categories:[].
// Covers lengths 1..5 so any remainder after an image fragment is reachable.
//
// DESIGN NOTE: every glue entry is a conjoined adjective/adverb tail — it reads
// acceptably *after* a clause or noun ("the river runs black and cold"). We
// deliberately exclude leading prepositions/articles ("in the", "over") as glue:
// left dangling at a line's end those read as broken grammar, and article glue
// collides with the article-initial image fragments. Composition always places
// the image first and the glue as a trailing modifier.
// -------------------------------------------------------------------------
const GLUE = [
  // length 1 — single trailing modifiers
  { text: 'still', syllables: 1 },
  { text: 'cold', syllables: 1 },
  { text: 'grey', syllables: 1 },
  { text: 'pale', syllables: 1 },
  { text: 'clear', syllables: 1 },
  { text: 'slow', syllables: 1 },
  { text: 'deep', syllables: 1 },
  { text: 'far', syllables: 1 },
  { text: 'dark', syllables: 1 },
  { text: 'soft', syllables: 1 },
  { text: 'low', syllables: 1 },
  // length 2 — conjoined modifiers
  { text: 'and cold', syllables: 2 },
  { text: 'and slow', syllables: 2 },
  { text: 'and grey', syllables: 2 },
  { text: 'and still', syllables: 2 },
  { text: 'and deep', syllables: 2 },
  { text: 'and pale', syllables: 2 },
  { text: 'and dark', syllables: 2 },
  { text: 'and soft', syllables: 2 },
  { text: 'far off', syllables: 2 },
  // length 3
  { text: 'and far off', syllables: 3 },
  { text: 'far and cold', syllables: 3 },
  { text: 'and still cold', syllables: 3 },
  { text: 'and cold now', syllables: 3 },
  { text: 'and grey now', syllables: 3 },
  { text: 'and pale now', syllables: 3 },
  // length 4
  { text: 'and far and cold', syllables: 4 },
  { text: 'and cold and grey', syllables: 4 },
  { text: 'and pale and cold', syllables: 4 },
  { text: 'and soft and grey', syllables: 4 },
  // length 5
  { text: 'and far off and cold', syllables: 5 },
  { text: 'and cold and far off', syllables: 5 },
  { text: 'and pale and far off', syllables: 5 },
].map((g) => ({ ...g, season: null, categories: [], kind: 'link-phrase' }));

// -------------------------------------------------------------------------
// IMAGE fragments, grouped by primary category. Each entry may carry more
// than one category (co-tagged). season is one of the four or null.
// -------------------------------------------------------------------------
const IMAGES = [
  // ---- field ----
  { text: 'grey dusk on the moor', syllables: 5, season: 'autumn', categories: ['field'] },
  { text: 'the wide field lies still', syllables: 5, season: null, categories: ['field'] },
  { text: 'the empty field lies fallow', syllables: 7, season: 'autumn', categories: ['field'] },
  { text: 'the empty field', syllables: 4, season: 'autumn', categories: ['field'] },
  { text: 'the fallow field', syllables: 4, season: 'autumn', categories: ['field'] },
  { text: 'fallow ground', syllables: 3, season: 'autumn', categories: ['field'] },
  { text: 'the field', syllables: 2, season: null, categories: ['field'] },

  // ---- bird ----
  { text: 'wild geese cross the sky', syllables: 5, season: 'autumn', categories: ['bird'] },
  { text: 'a lark climbs the air', syllables: 5, season: 'spring', categories: ['bird'] },
  { text: 'the wild geese cross the grey sky', syllables: 7, season: 'autumn', categories: ['bird'] },
  { text: 'the lark sings the year awake', syllables: 7, season: 'spring', categories: ['bird'] },
  { text: 'geese line the sky', syllables: 4, season: 'autumn', categories: ['bird'] },
  { text: 'their long cry fades', syllables: 4, season: 'autumn', categories: ['bird'] },
  { text: 'wild geese', syllables: 2, season: 'autumn', categories: ['bird'] },
  { text: 'a lark climbs', syllables: 3, season: 'spring', categories: ['bird'] },

  // ---- mountain ----
  { text: 'far peaks hold the light', syllables: 5, season: null, categories: ['mountain'] },
  { text: 'the valley grows cold', syllables: 5, season: null, categories: ['mountain'] },
  { text: 'peaks against the sky', syllables: 5, season: null, categories: ['mountain'] },
  { text: 'far peaks hold the fading light', syllables: 7, season: null, categories: ['mountain'] },
  { text: 'far peaks', syllables: 2, season: null, categories: ['mountain'] },
  { text: 'the sharp ridgeline', syllables: 4, season: null, categories: ['mountain'] },
  { text: 'the valley', syllables: 3, season: null, categories: ['mountain'] },

  // ---- dwelling ----
  { text: 'a small hut with doors', syllables: 5, season: null, categories: ['dwelling'] },
  { text: 'a small hut with shuttered doors', syllables: 7, season: null, categories: ['dwelling'] },
  { text: 'the shuttered hut', syllables: 4, season: null, categories: ['dwelling'] },
  { text: 'the heavy thatch', syllables: 4, season: null, categories: ['dwelling'] },
  { text: 'the roof of thatch', syllables: 4, season: null, categories: ['dwelling'] },
  { text: 'a small hut', syllables: 3, season: null, categories: ['dwelling'] },
  { text: 'the low roof', syllables: 3, season: null, categories: ['dwelling'] },

  // ---- water / river ----
  { text: 'the river runs black', syllables: 5, season: null, categories: ['water'] },
  { text: 'the river runs deep', syllables: 5, season: null, categories: ['water'] },
  { text: 'water over stone', syllables: 5, season: null, categories: ['water', 'stone'] },
  { text: 'the river runs black and deep', syllables: 7, season: null, categories: ['water'] },
  { text: 'the deep river', syllables: 4, season: null, categories: ['water'] },
  { text: 'black water', syllables: 3, season: null, categories: ['water'] },
  { text: 'the river', syllables: 3, season: null, categories: ['water'] },

  // ---- road / travel ----
  { text: 'a road without end', syllables: 5, season: null, categories: ['road'] },
  { text: 'the road without end', syllables: 5, season: null, categories: ['road'] },
  { text: 'his straw sandals worn', syllables: 5, season: null, categories: ['road'] },
  { text: 'the traveler walks alone', syllables: 7, season: null, categories: ['road'] },
  { text: 'the traveler', syllables: 4, season: null, categories: ['road'] },
  { text: 'a long road', syllables: 3, season: null, categories: ['road'] },
  { text: 'the long road', syllables: 3, season: null, categories: ['road'] },

  // ---- pine ----
  { text: 'green pines bend with weight', syllables: 5, season: null, categories: ['pine'] },
  { text: 'the pines hold the snow', syllables: 5, season: 'winter', categories: ['pine'] },
  { text: 'pines bend with the weight of snow', syllables: 7, season: 'winter', categories: ['pine'] },
  { text: 'green pines bend', syllables: 3, season: null, categories: ['pine'] },
  { text: 'the dark boughs', syllables: 3, season: null, categories: ['pine'] },
  { text: 'green pines', syllables: 2, season: null, categories: ['pine'] },

  // ---- gate ----
  { text: 'the gate hangs open', syllables: 5, season: null, categories: ['gate'] },
  { text: 'no one comes to latch it shut', syllables: 7, season: null, categories: ['gate'] },
  { text: 'the gate hangs from one hinge now', syllables: 7, season: null, categories: ['gate'] },
  { text: 'the old gate', syllables: 3, season: null, categories: ['gate'] },
  { text: 'the gate', syllables: 2, season: null, categories: ['gate'] },
  { text: 'the latch', syllables: 2, season: null, categories: ['gate'] },

  // ---- wind ----
  { text: 'the night wind rises', syllables: 5, season: null, categories: ['wind'] },
  { text: 'a loose shutter bangs', syllables: 5, season: null, categories: ['wind'] },
  { text: 'the night wind rattles the screens', syllables: 7, season: null, categories: ['wind'] },
  { text: 'the night wind', syllables: 3, season: null, categories: ['wind'] },
  { text: 'the cold wind', syllables: 3, season: null, categories: ['wind'] },
  { text: 'the wind', syllables: 2, season: null, categories: ['wind'] },

  // ---- mist ----
  { text: 'its pale light returns', syllables: 5, season: null, categories: ['mist'] },
  { text: 'mist over the marsh', syllables: 5, season: null, categories: ['mist', 'marsh'] },
  { text: 'the pale mist returns', syllables: 5, season: null, categories: ['mist'] },
  { text: 'the pale mist blurs and returns', syllables: 7, season: null, categories: ['mist'] },
  { text: 'cold mist over the marsh', syllables: 6, season: null, categories: ['mist', 'marsh'] },
  { text: 'the cold mist', syllables: 3, season: null, categories: ['mist'] },
  { text: 'cold mist', syllables: 2, season: null, categories: ['mist'] },
  { text: 'pale mist', syllables: 2, season: null, categories: ['mist'] },

  // ---- reed ----
  { text: 'reeds bend by the marsh', syllables: 5, season: 'autumn', categories: ['reed', 'marsh'] },
  { text: 'the low marsh lies still', syllables: 5, season: 'autumn', categories: ['reed', 'marsh'] },
  { text: 'their dry heads whisper and sway', syllables: 7, season: 'autumn', categories: ['reed'] },
  { text: 'reeds by the marsh', syllables: 4, season: 'autumn', categories: ['reed', 'marsh'] },
  { text: 'reeds bend', syllables: 2, season: 'autumn', categories: ['reed'] },
  { text: 'dry reeds', syllables: 2, season: 'autumn', categories: ['reed'] },

  // ---- dew ----
  { text: 'clear dew on the stem', syllables: 5, season: 'autumn', categories: ['dew'] },
  { text: 'clear dew weighs each stem', syllables: 5, season: 'autumn', categories: ['dew'] },
  { text: 'clear dew weighs the bending stem', syllables: 7, season: 'autumn', categories: ['dew'] },
  { text: 'the cold dew', syllables: 3, season: 'autumn', categories: ['dew'] },
  { text: 'clear dew', syllables: 2, season: 'autumn', categories: ['dew'] },

  // ---- hill ----
  { text: 'spring comes to the hill', syllables: 5, season: 'spring', categories: ['hill'] },
  { text: 'white against green hills', syllables: 5, season: 'spring', categories: ['hill'] },
  { text: 'spring comes green to the far hills', syllables: 7, season: 'spring', categories: ['hill'] },
  { text: 'spring on the hill', syllables: 4, season: 'spring', categories: ['hill'] },
  { text: 'the green hill', syllables: 3, season: 'spring', categories: ['hill'] },
  { text: 'the far hills', syllables: 3, season: null, categories: ['hill'] },
  { text: 'green hills', syllables: 2, season: 'spring', categories: ['hill'] },

  // ---- insect ----
  { text: 'a butterfly wakes', syllables: 5, season: 'spring', categories: ['insect'] },
  { text: 'the butterfly drifts', syllables: 5, season: 'spring', categories: ['insect'] },
  { text: 'a butterfly wakes and drifts', syllables: 7, season: 'spring', categories: ['insect'] },
  { text: 'a butterfly', syllables: 4, season: 'spring', categories: ['insect'] },

  // ---- grass ----
  { text: 'new grass on the bank', syllables: 5, season: 'spring', categories: ['grass'] },
  { text: 'green as far as seen', syllables: 5, season: 'spring', categories: ['grass'] },
  { text: 'soft under the walking feet', syllables: 7, season: 'spring', categories: ['grass'] },
  { text: 'the soft grass', syllables: 3, season: 'spring', categories: ['grass'] },
  { text: 'new grass', syllables: 2, season: 'spring', categories: ['grass'] },

  // ---- cloud ----
  { text: 'white clouds in the west', syllables: 5, season: null, categories: ['cloud'] },
  { text: 'clouds over the peaks', syllables: 5, season: null, categories: ['cloud', 'mountain'] },
  { text: 'white clouds pile in the blue west', syllables: 7, season: null, categories: ['cloud'] },
  { text: 'slow shapes moving out to sea', syllables: 7, season: null, categories: ['cloud'] },
  { text: 'the blue west', syllables: 3, season: null, categories: ['cloud'] },
  { text: 'white clouds', syllables: 2, season: null, categories: ['cloud'] },

  // ---- rain ----
  { text: 'warm rain in the dusk', syllables: 5, season: 'summer', categories: ['rain'] },
  { text: 'then clears to warm steam', syllables: 5, season: 'summer', categories: ['rain'] },
  { text: 'warm rain drums on the broad leaves', syllables: 7, season: 'summer', categories: ['rain'] },
  { text: 'the warm rain', syllables: 3, season: 'summer', categories: ['rain'] },
  { text: 'warm rain', syllables: 2, season: 'summer', categories: ['rain'] },

  // ---- well ----
  { text: 'the cold well spills bright', syllables: 5, season: 'summer', categories: ['well'] },
  { text: 'cold water drawn from the well', syllables: 7, season: 'summer', categories: ['well'] },
  { text: 'spills bright in the wooden pail', syllables: 7, season: 'summer', categories: ['well'] },
  { text: 'the wooden pail', syllables: 4, season: 'summer', categories: ['well'] },
  { text: 'the cold well', syllables: 3, season: 'summer', categories: ['well'] },
  { text: 'the well', syllables: 2, season: 'summer', categories: ['well'] },

  // ---- bridge ----
  { text: 'a low narrow bridge', syllables: 5, season: null, categories: ['bridge'] },
  { text: 'worn smooth by the years', syllables: 5, season: null, categories: ['bridge'] },
  { text: 'spans the current far below', syllables: 7, season: null, categories: ['bridge'] },
  { text: 'a narrow bridge', syllables: 4, season: null, categories: ['bridge'] },
  { text: 'the old bridge', syllables: 3, season: null, categories: ['bridge'] },

  // ---- smoke ----
  { text: 'thin smoke climbs and fades', syllables: 5, season: null, categories: ['smoke'] },
  { text: 'thin smoke climbs from hidden fire', syllables: 7, season: null, categories: ['smoke'] },
  { text: 'someone burns the fallow brush', syllables: 7, season: 'autumn', categories: ['smoke'] },
  { text: 'thin smoke climbs', syllables: 3, season: null, categories: ['smoke'] },
  { text: 'the thin smoke', syllables: 3, season: null, categories: ['smoke'] },
  { text: 'thin smoke', syllables: 2, season: null, categories: ['smoke'] },

  // ---- stone ----
  { text: 'cold grey stone lies still', syllables: 5, season: null, categories: ['stone'] },
  { text: 'grey stone cold beneath the hand', syllables: 7, season: null, categories: ['stone'] },
  { text: 'cold grey stone', syllables: 3, season: null, categories: ['stone'] },
  { text: 'grey stone', syllables: 2, season: null, categories: ['stone'] },
  { text: 'the old wall', syllables: 3, season: null, categories: ['stone', 'moss'] },

  // ---- bell ----
  { text: 'a far bell sounds low', syllables: 5, season: null, categories: ['bell'] },
  { text: 'a far bell sounds through the dark', syllables: 7, season: null, categories: ['bell'] },
  { text: 'one note then the long silence', syllables: 7, season: null, categories: ['bell'] },
  { text: 'a far bell sounds', syllables: 4, season: null, categories: ['bell'] },
  { text: 'a far bell', syllables: 3, season: null, categories: ['bell'] },
  { text: 'the bell sounds', syllables: 3, season: null, categories: ['bell'] },

  // ---- hearth ----
  { text: 'coals glow in the hearth', syllables: 5, season: 'winter', categories: ['hearth'] },
  { text: 'the coals in the hearth', syllables: 5, season: 'winter', categories: ['hearth'] },
  { text: 'an old man warms his thin hands', syllables: 7, season: 'winter', categories: ['hearth'] },
  { text: 'the warm hearth', syllables: 3, season: 'winter', categories: ['hearth'] },
  { text: 'the hearth', syllables: 2, season: 'winter', categories: ['hearth'] },

  // ---- ice ----
  { text: 'ice locks the still pond', syllables: 5, season: 'winter', categories: ['ice'] },
  { text: 'the world holds its breath', syllables: 5, season: 'winter', categories: ['ice'] },
  { text: 'clear glass over sleeping fish', syllables: 7, season: 'winter', categories: ['ice'] },
  { text: 'the still pond', syllables: 3, season: 'winter', categories: ['ice'] },
  { text: 'clear ice', syllables: 2, season: 'winter', categories: ['ice'] },
  { text: 'the ice', syllables: 2, season: 'winter', categories: ['ice'] },

  // ---- stream ----
  { text: 'the thaw frees the stream', syllables: 5, season: 'spring', categories: ['stream'] },
  { text: 'the thaw frees the singing stream', syllables: 7, season: 'spring', categories: ['stream'] },
  { text: 'water bright over the rocks', syllables: 7, season: 'spring', categories: ['stream'] },
  { text: 'the singing stream', syllables: 4, season: 'spring', categories: ['stream'] },
  { text: 'the clear stream', syllables: 3, season: 'spring', categories: ['stream'] },

  // ---- frost ----
  { text: 'the frost comes tonight', syllables: 5, season: 'autumn', categories: ['frost'] },
  { text: 'white frost on the ground', syllables: 5, season: 'autumn', categories: ['frost'] },
  { text: 'on the white frost-bitten ground', syllables: 7, season: 'autumn', categories: ['frost'] },
  { text: 'the cold frost', syllables: 3, season: 'autumn', categories: ['frost'] },
  { text: 'the frost', syllables: 2, season: 'autumn', categories: ['frost'] },

  // ---- snow ----
  { text: 'the first snow falls slow', syllables: 5, season: 'winter', categories: ['snow'] },
  { text: 'the first snow blurs the pathway', syllables: 7, season: 'winter', categories: ['snow'] },
  { text: 'each step slow in the deep white', syllables: 7, season: 'winter', categories: ['snow'] },
  { text: 'snow falls all the still cold night', syllables: 7, season: 'winter', categories: ['snow'] },
  { text: 'the first snow', syllables: 3, season: 'winter', categories: ['snow'] },
  { text: 'the deep snow', syllables: 3, season: 'winter', categories: ['snow'] },
  { text: 'white snow', syllables: 2, season: 'winter', categories: ['snow'] },

  // ---- moss ----
  { text: 'moss on the old wall', syllables: 5, season: null, categories: ['moss'] },
  { text: 'moss creeps on the stone', syllables: 5, season: null, categories: ['moss', 'stone'] },
  { text: 'green moss creeps over the stone', syllables: 7, season: null, categories: ['moss', 'stone'] },
  { text: 'the green moss', syllables: 3, season: null, categories: ['moss'] },
  { text: 'green moss', syllables: 2, season: null, categories: ['moss'] },

  // ---- marsh (extra, links water/reed/mist) ----
  { text: 'the low marsh at dusk', syllables: 5, season: 'autumn', categories: ['marsh'] },
  { text: 'the low marsh lies dry and still', syllables: 7, season: 'autumn', categories: ['marsh'] },
  { text: 'the low marsh', syllables: 3, season: 'autumn', categories: ['marsh'] },
  { text: 'the still marsh', syllables: 3, season: 'autumn', categories: ['marsh'] },
  { text: 'the marsh', syllables: 2, season: 'autumn', categories: ['marsh'] },

  // ---- MOON (exempt marker; used at moon seats) ----
  { text: 'the moon lifts and glows', syllables: 5, season: 'autumn', categories: ['moon'] },
  { text: 'white on the cold ground', syllables: 5, season: 'autumn', categories: ['moon'] },
  { text: 'the late moon rises', syllables: 5, season: 'autumn', categories: ['moon'] },
  { text: 'the whole world silver', syllables: 5, season: 'autumn', categories: ['moon'] },
  { text: 'and the cold moon lifts and glows', syllables: 7, season: 'autumn', categories: ['moon'] },
  { text: 'its pale light blurs and returns', syllables: 7, season: 'autumn', categories: ['moon'] },
  { text: 'the moon swims in the cold mist', syllables: 7, season: 'autumn', categories: ['moon', 'mist'] },
  { text: 'the cold moon', syllables: 3, season: 'autumn', categories: ['moon'] },
  { text: 'the moon', syllables: 2, season: 'autumn', categories: ['moon'] },

  // ---- BLOSSOM (exempt marker; used at blossom seats) ----
  { text: 'cherry blossom falls', syllables: 5, season: 'spring', categories: ['blossom'] },
  { text: 'a slow drift of white', syllables: 5, season: 'spring', categories: ['blossom'] },
  { text: 'cherry petals drift', syllables: 5, season: 'spring', categories: ['blossom'] },
  { text: 'and blossom breaks on the branch', syllables: 7, season: 'spring', categories: ['blossom'] },
  { text: 'petals loose on the spring air', syllables: 7, season: 'spring', categories: ['blossom'] },
  { text: 'the blossom', syllables: 3, season: 'spring', categories: ['blossom'] },

  // ---- LOVE images (first run: robe, lamp) ----
  { text: 'she folds his old robe', syllables: 5, season: null, categories: ['robe'] },
  { text: 'and lays it across the quilt', syllables: 7, season: null, categories: ['robe'] },
  { text: 'his scent almost gone', syllables: 5, season: null, categories: ['robe'] },
  { text: 'she folds his robe', syllables: 4, season: null, categories: ['robe'] },
  { text: 'his old robe', syllables: 3, season: null, categories: ['robe'] },

  { text: 'the lamp gutters low', syllables: 5, season: null, categories: ['lamp'] },
  { text: 'the lamp gutters low and dim', syllables: 7, season: null, categories: ['lamp'] },
  { text: 'she waits for a voice', syllables: 5, season: null, categories: ['lamp'] },
  { text: 'she waits for a step a voice', syllables: 7, season: null, categories: ['lamp'] },
  { text: 'the lamp', syllables: 2, season: null, categories: ['lamp'] },

  // ---- LOVE images (second run: dream, pillow) ----
  { text: 'she meets him in dreams', syllables: 5, season: null, categories: ['dream'] },
  { text: 'again she meets him in dreams', syllables: 7, season: null, categories: ['dream'] },
  { text: 'and wakes to an empty room', syllables: 7, season: null, categories: ['dream'] },
  { text: 'she wakes alone', syllables: 4, season: null, categories: ['dream'] },

  { text: 'her pillow still damp', syllables: 5, season: null, categories: ['pillow'] },
  { text: 'the cold bed too wide', syllables: 5, season: null, categories: ['pillow'] },
  { text: 'she counts the long hours till dawn', syllables: 7, season: null, categories: ['pillow'] },
  { text: 'her pillow', syllables: 3, season: null, categories: ['pillow'] },
].map((f) => ({ ...f, kind: 'image' }));

export const FRAGMENTS = [...GLUE, ...IMAGES];

// -------------------------------------------------------------------------
// SELF-CHECK: declared syllables must equal countLine(text).count.
// Throw loudly at module load if any fragment is mis-counted.
// -------------------------------------------------------------------------
{
  const errors = [];
  for (const f of FRAGMENTS) {
    const actual = countLine(f.text).count;
    if (actual !== f.syllables) {
      errors.push(`  "${f.text}" — declared ${f.syllables}, countLine says ${actual}`);
    }
  }
  if (errors.length) {
    throw new Error(
      `lexicon.js: ${errors.length} fragment(s) mis-counted (declared != countLine):\n` +
        errors.join('\n'),
    );
  }
}

// -------------------------------------------------------------------------
// ASSOCIATIONS: category -> [associated categories]. THE LINKING MODEL.
// An edge means the two images naturally associate in the classical register
// (moon<->mist<->frost; hut<->hearth<->smoke; reed<->marsh<->water). The
// generator prefers, for verse n, a category that shares an edge with verse
// n-1 (the forward LINK). Edges are intended as symmetric; the loader below
// symmetrizes them so a one-way declaration links both directions.
//
// HONESTY: these edges are hand-authored imagistic adjacencies, not learned
// semantics. The link they produce is real at the category-graph level (two
// adjacent verses genuinely share a declared association), but shallow at the
// surface: the pivot is topic-adjacency, not a crafted turn of sense. See the
// HONESTY note in generate.js where link vs shift is scored.
// -------------------------------------------------------------------------
const RAW_ASSOCIATIONS = {
  field: ['bird', 'grass', 'road', 'dwelling', 'smoke'],
  bird: ['field', 'cloud', 'mountain', 'reed', 'marsh'],
  mountain: ['cloud', 'mist', 'pine', 'valley', 'stone'],
  dwelling: ['hearth', 'smoke', 'gate', 'lamp', 'robe'],
  water: ['bridge', 'reed', 'marsh', 'stream', 'dew'],
  road: ['bridge', 'gate', 'field', 'dwelling', 'stone'],
  pine: ['mountain', 'snow', 'wind'],
  gate: ['dwelling', 'road', 'moss', 'stone'],
  wind: ['reed', 'cloud', 'bell', 'mist'],
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
  ice: ['pond', 'snow', 'frost'],
  stream: ['water', 'stone', 'bridge', 'rain'],
  frost: ['moon', 'ice', 'dew'],
  snow: ['pine', 'ice', 'road'],
  moss: ['stone', 'gate'],
  marsh: ['reed', 'water', 'mist', 'bird'],
  // exempt markers still carry edges so verses adjacent to a moon/blossom/love
  // seat can be scored for a link:
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
