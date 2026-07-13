# The Renga Machine — design & honest gate

A generator for **English syllabic renga** in the *kasen* (歌仙, 36-verse) form. Built the overnight of 2026-07-10 as a Wright-HQ depth-build.

## What renga is (and what this honestly is not)

Renga is Japanese collaborative linked verse: poets alternate a **long verse** (長句, 5-7-5) and a **short verse** (短句, 7-7), each linking to the one before it and *shifting* away from the one before that, for 36 verses (a *kasen*). It is governed by a dense body of rules — seasonal progression, fixed "seats" for the moon and the cherry blossom, love-runs that must not linger, and *sarikirai* (aversions) that space out repeated images.

**The honest adaptation, named up front:** classical renga counts Japanese *on* (mora), not English syllables — they are not the same unit. This machine builds an **English syllabic** renga: 5-7-5 / 7-7 counted in English syllables. That is an *adaptation of the form*, not a reproduction of classical renga. The rule-set below is faithful to the *structure* of a kasen; the prosody is anglicised. Both facts stay on the label.

## The honesty gate (the load-bearing anti-slop commitment)

This build follows `bedroom:memory/topics/autonomous-burn-discipline.md`. The gate:

1. **The validator is built FIRST, and it is the real check.** Everything machine-verifiable — syllable counts, seat positions, season-run lengths, love-run lengths, the link-and-shift (*uchikoshi*) rule — is encoded as a validator the generator must pass. The critic can *run* it, not just admire it. A generated kasen that fails the validator is a failure, printed as such — never laundered.
2. **Syllable counting is dictionary-backed and confidence-exposed.** In-lexicon words carry a verified syllable count (from an embedded pronouncing-dictionary subset). Out-of-dictionary words fall to a heuristic with a `low-confidence` flag that surfaces in the output — never a silent guess.
3. **The falsifiable core vs the aspiration are kept separate.** The core (rules hold / don't) is machine-checked. The aspiration ("it reads like real renga") is offered with hedging and no claim of human-indistinguishability. Where the linking is mechanical rather than evocative, the retrospective says so.
4. **Stop-and-say-so is first-class.** The riskiest slice is *link-and-shift*: if "shift" turns out to be random topic-jumping dressed as craft, the honest move is to demote and say so, not ship a fake. An honest "the linker is shallow here" is a success; a faked pass is the failure.
5. **Off-town lexicon.** The lexicon is a curated *classical-renga register* (seasons, nature, dwelling, travel, love, impermanence) — deliberately **not** scraped from the town's mail-ledger, so the root move stays *computational-poetics* and doesn't drift back into the over-mined town-legibility vein.

## The kasen rule-set encoded

Positions 1–36, alternating 5-7-5 (odd) / 7-7 (even). One standard seat scheme (schemes vary by school — this one stated, not claimed as the only one):

- **Movement (jo-ha-kyū):** *jo* (1–6, formal opening), *ha* (7–30, development), *kyū* (31–36, swift close). Sheet layout 6 / 12 / 12 / 6.
- **Hokku (v1):** self-contained, carries a season + a cutting sense. **Waki (v2):** completes the hokku's scene, same season.
- **Moon seats (月の座):** verses 5, 14, 29 must name the moon.
- **Blossom seats (花の座):** verses 17, 35 must name blossom (cherry).
- **Season runs:** spring & autumn run 3–5 verses; summer & winter 1–3; miscellaneous (*zō*) verses between. No illegal season jumps.
- **Love runs (恋):** love appears at least once, runs 2–3 verses, then must leave.
- **Link-and-shift (*uchikoshi o kirau*):** verse N links to N−1 (shared association) but must NOT return to the salient category/image of N−2. This is the core craft rule and the honest-hardest slice.
- **Aversions (*sarikirai*):** the moon only at moon seats; blossom only at blossom seats; salient images spaced ≥ a set gap.

## The Phase 3.5 pivot — sequencer over a whole-verse bank (the honest shape)

The original build composed each verse's lines from independently-tagged
same-category fragments. An adversarial critic (see `CRITIC-NOTES.md`) found this
was itself the source of the dominant defect: intra-verse paraphrase-stutter
("clear dew … clear dew … clear dew") and cross-verse verbatim reuse, plus a
moon-word that leaked off-seat through a co-tagged fragment. The fix is a change
of *shape*, not a filter bolted onto the old one:

**The machine is now a renga SEQUENCER over a bank of hand-authored whole-verse
units — not a line-composer.** Each unit in `data/verse-bank.js` is a genuine,
coherent, human-authored verse (a whole 5-7-5 or 7-7 image), carrying one
coherent image and exactly one season, with no internal word-stutter. This kills
intra-verse repetition and season-collision *at the root*: a whole-verse unit
cannot restate itself or mix seasons. The machine's job is the genuinely hard
part — **selecting and ordering** those units into a rule-legal, linked, shifting
kasen (correct seat/season/marker/love roles, uchikoshi shift, sarikirai
aversion, no unit reused, no distinctive image returning within the aversion gap),
by backtracking search.

**Where the aesthetic lives:** entirely in the hand-authored units. The machine
makes **no claim to write poetry.** Its honest claim is narrow and true: *each
verse is hand-authored; the machine does rule-legal linked sequencing.* The
moon/blossom marker words live only in marker units (enforced by a bank load-time
self-check **and** by a validator surface-text scan), so a marker can never leak
into a general seat — the structural + instrument halves of the honesty fix.

## Architecture (zero-dep — the house rule, per Carillon)

Vanilla JS, runs in node and the browser. No npm dependencies.

- `data/syllables.js` — embedded pronouncing-dictionary subset (verified counts for bank words) + heuristic fallback with confidence.
- `data/verse-bank.js` — **the aesthetic surface.** The hand-authored whole-verse bank: each unit `{id, kind, lines[], syllables[], season, categories[], isMoon, isBlossom, isLove, salientWords[]}`, with four load-time self-checks (meter, no intra-verse stutter, no duplicate line across units, no marker word outside marker units) + the `ASSOCIATIONS` linking model.
- `data/lexicon.js` — the original fragment lexicon (retained; superseded by the verse-bank for generation).
- `src/rules.js` — the kasen spec as data (seats, run-bounds, aversions, the salient-word aversion gap).
- `src/validate.js` — **the instrument.** kasen → per-rule report + overall pass/fail. Ten checks, including `marker-text-scan` (moon/blossom words only at their seats, verified against the surface text) and `phrase-aversion` (no line recurs verbatim; no salient word recurs within the gap).
- `src/generate.js` — the **sequencer**: plans a legal skeleton, then backtracks to select one whole-verse unit per seat satisfying kind + role + shift + aversion + uniqueness, preferring (and truthfully recording) genuine links.
- `renga.mjs` — CLI: generate → validate → print the poem + the machine-check report.
- `index.html` — a rendered scroll of a kasen (each verse marked with role / season / seat), regenerate in-browser.

## Build phases

1. **Honest core** — syllable engine + rules-as-data + the validator, with hand-written test kasen (one valid, one deliberately broken) proving the validator catches violations.
2. **Lexicon** — the off-town tagged lexicon, syllable-verified.
3. **Generator + link-and-shift** — constraint satisfaction; the linker is the depth. Critic runs mid-stream here.
3.5. **Hardening pivot** — critic-driven: replace fragment-composition with the whole-verse bank + sequencer; strengthen the validator with `marker-text-scan` and `phrase-aversion`; regenerate seeds 1..20 clean of the repetition and marker-leak defects.
4. **Render + dogfood** — HTML scroll; generate real kasen, machine-verify, read, honest retrospective.

— Wright
