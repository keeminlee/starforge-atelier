# CRITIC-NOTES — adversarial quality + honesty audit of The Renga Machine

Independent read of seeds 1, 2, 3 (all 36 verses each), against `DESIGN.md`,
`src/generate.js`, `src/validate.js`, `data/lexicon.js`, `src/rules.js`.

**One-line verdict: HARDEN-FIRST.** The machine core is genuinely solid and the
honesty labeling on the *link/shift* seam is accurate — but the honesty gate is
pointed at a lesser risk. The dominant, reader-visible defect is **repetition**
(intra-verse paraphrase-triples and cross-verse verbatim reuse), and it is
entirely unaudited. A second, blocker-class defect: the validator's `moon-seat`
"PASS" is sometimes *false about the surface text*. As "reads like renga," this
is not shippable yet; as "a rule-satisfying constraint engine," it ships today.

---

## Reading the claims against the poems

The machine-verifiable core is real and I confirmed it: 3/3 seeds pass all eight
checks, 90/90 lines dictionary-exact, uchikoshi enforced. The `// HONESTY:`
comments in `generate.js` and `lexicon.js` are **truthful** about what they cover.
The problems below are all in territory the honesty gate never looks at.

---

## 1. Repetition — BLOCKER (the dominant defect; entirely unchecked)

Renga's *sarikirai* forbids returning to the same material; the validator only
spaces *categories* by gap ≥3 and exempts markers/love. It never looks at
phrases or words. The result is pervasive repetition at two scales.

### 1a. Intra-verse paraphrase-triples (the worst offender)

Root cause: `composeVerse` builds each of a verse's 3 lines by calling `pickLine`
with the **same single category** (`imgCat`) for every non-marker line
(`generate.js:308`, `cats = [imgCat]`). So a 5-7-5 verse is three
independently-drawn fragments from *one* category's pool — which for small pools
means three restatements of the same noun. `avoidTexts` blocks identical strings
but not near-identical ones, so paraphrases sail through.

Worst cases (immediately damning to any reader):

- **Seed 1, v31** (dew): "clear dew weighs each stem / clear dew weighs the
  bending stem / clear dew on the stem" — "clear dew" ×3, "stem" ×3, "clear dew
  weighs" ×2. This is not a verse, it's one fragment stuttered three times.
- **Seed 2, v21** (dew): identical failure mode — "clear dew on the stem / clear
  dew weighs the bending stem / clear dew weighs each stem."
- **Seed 1, v25** (smoke): "thin smoke climbs and fades / thin smoke climbs from
  hidden fire / the thin smoke and slow" — "thin smoke" ×3, "thin smoke climbs" ×2.
- **Seed 1, v21** (gate): "the gate hangs open / the gate hangs from one hinge
  now / the old gate and dark" — "gate" ×3, "the gate hangs" ×2.
- **Seed 1, v33** (insect): "the butterfly drifts / a butterfly wakes and drifts /
  a butterfly wakes" — "butterfly" ×3, "wakes" ×2, "drifts" ×2.
- **Seed 1, v9** (dwelling): "a small hut with doors / a small hut with shuttered
  doors / …" — L1 is a substring of L2.
- **Seed 1, v11** (hearth): "coals glow in the hearth / … / the coals in the
  hearth" — L1 and L3 are near-identical.
- **Seed 2, v7** (moss) "moss" ×3; **v10** (water) "the river runs black and…" ×2;
  **v15** (cloud) "white clouds…west" ×2; **v16** (mountain) "far peaks hold
  the…light" ×2.
- **Seed 3, v15** (marsh): "the low marsh at dusk / the low marsh lies dry and
  still / the low marsh lies still" — "the low marsh" ×3.

Roughly a third of all verses have a visible intra-verse word/phrase echo. The
subset of verses that read *well* are exactly those whose category has three
genuinely distinct facets: **seed 1 v27** (road: road / traveler / sandals),
**seed 2 v23** (ice: pond / glass-over-fish / world-holds-breath), **seed 1 v1**
(hokku). Those prove the form can work — but they're the minority, and they work
by luck of pool composition, not by design.

### 1b. Cross-verse verbatim reuse (sarikirai proper)

Whole lines recur across a single poem, spaced far enough to pass the gap-3
category check but far too close for renga's actual aversion discipline (some
images once per kasen; most spaced 5–7+ verses *and never verbatim*):

- **Seed 1**: "an old man warms his thin hands" at v11 **and** v24. "and the cold
  moon lifts and glows" at v14 **and** v29. "the empty field lies fallow" at v13
  **and** v26. "thin smoke climbs from hidden fire" at v12 **and** v25. "spring
  comes green to the far hills" at v14 **and** v34. "a butterfly wakes and drifts"
  at v33 **and** v36. Whole verses echo their mirror: v24≈v11, v25≈v12, v26≈v13.
- **Seed 3**: v7 and v13 are the **same verse verbatim** ("a loose shutter bangs /
  the night wind rattles the screens / the night wind rises"), 6 verses apart.

The template arc is partly mirrored, so the same categories recur at symmetric
positions; with thin per-category pools they pull the *same* fragments, producing
these echoes. The gap-3 category rule cannot see it.

**Assessment:** this is the flaw a reader notices first, and the honesty gate is
silent on it. It should be the headline risk, not link-and-shift.

---

## 2. Moon named off-seat — BLOCKER (the validator's PASS is false)

The `moon-seat` check reports `moon named at exactly 5, 14, 29`. That statement
is **false about the surface text** in 2 of 3 seeds:

- **Seed 1, v2** (waki, *not* a moon seat): line 1 is literally "the moon swims
  in the cold mist." The moon is named at verse 2.
- **Seed 2, v20** (non-seat): line 2 is "the moon swims in the cold mist" — moon
  named at v20, and *again* verbatim at its real seat v14.

Mechanism: the fragment "the moon swims in the cold mist" is co-tagged
`categories: ['moon','mist']` (`lexicon.js:316`). `imagesFor(['mist'])` returns
it, so it can be selected as a plain *mist* image. When it is, the verse's stored
`categories` are reduced to `[imgCat]` = `['mist']` (`generate.js:345`) — the
`moon` tag is **dropped before the validator sees it**. So `isMoon` is correctly
false, the category check passes, and the machine truthfully-but-misleadingly
prints "moon named at exactly 5, 14, 29" while the poem says otherwise.

This is precisely the failure the honesty gate exists to prevent: a check that is
true about the *flag* and false about the *thing*. It is the one finding here that
directly impugns the "the validator is the real check" claim. (Blossom is not
exposed to this — its fragments are all single-tag `['blossom']`, so they never
leak into other pools. Moon leaks solely through that one co-tagged entry.)

Fix is small (below) but the honesty stakes are high: until fixed, the printed
`moon-seat: ✔` should not be trusted as stated.

---

## 3. Intra-verse season / image collisions — MAJOR

The skeleton assigns a season to each seat, but `composeVerse` only *prefers*
season-matching fragments (`seasonScore`) and freely falls back. Worse, the
category walk picks a salient category without regard to whether that category's
fragments *can* match the planned season — and several categories are
season-locked (hill→spring, geese→autumn, rain→summer). The result is two or
three seasons colliding **inside one verse**:

- **Seed 1, v14** (moon-seat, autumn): "and the cold moon lifts and glows"
  (autumn) + "spring comes green to the far hills" (**spring**). Autumn moon over
  spring hills, same verse.
- **Seed 2, v29** and **Seed 3, v29** (moon-seat, autumn, img hill): both pair the
  autumn moon with "white against green hills" / "spring comes to the hill"
  (**spring**).
- **Seed 2, v17** (blossom-seat, spring, img bird): spring lark + spring blossom +
  "wild geese cross the sky" (**autumn** — geese are the canonical autumn kigo).
- **Seed 3, v9** (winter run, img bird): "a lark climbs the air" (spring) + "wild
  geese cross the sky" (autumn) inside a **winter**-labeled verse — three seasons.
- **Seed 1, v16** (autumn run): "warm rain drums on the broad leaves" — **summer**
  rain imagery under an autumn label.

The season-run validator checks only the `season` *label*, never the imagery, so
none of this is caught. For a form whose whole spine is seasonal progression,
this is a real coherence hole, not polish.

---

## 4. Linking quality — the 94.4% is honest but measures the wrong thing

I reproduced the number: 661/700 across seeds 1–20 = **94.4%**, accurately
computed and accurately hedged in code and DESIGN ("real at the category-graph
level… shallow at the surface — topic-adjacency, not a crafted turn"). No
overclaim in context. **But** two things hollow it out as evidence of craft:

- **Many "links" are near-tautologies, not turns.** marsh→reed (seed 1 v5→v6:
  "reeds bend by the marsh" → "reeds by the marsh far and cold"), mist→mountain,
  cloud→mountain, field→field-adjacent — these share an edge because they're
  *the same scene*, so the "link" is stagnation, the opposite of link-and-shift's
  intent. The edge exists; the *movement* doesn't.
- **The reader can't perceive linking through the repetition.** When a verse is
  three restatements of one noun (§1a), whether it links to its neighbor is moot —
  the surface is too noisy to read as linked verse at all.

So the metric is not dishonest; it is **load-bearing weight on a category-graph
proxy that does not track the reading experience**, while the defect that *does*
govern the reading experience (repetition) has no metric at all. The honest
retrospective should say: "94.4% of adjacent verses share an authored
association; this is not the same as 94.4% reading as linked verse, and the
dominant obstacle to the latter is intra-verse repetition, which we do not yet
measure."

---

## 5. Honesty-gate audit — summary

- `// HONESTY:` comments on the link/shift seam (`generate.js:17-25, 247-250`;
  `validate.js:10-21`; `lexicon.js:383-387`): **honest and accurate.** `linked[n]`
  genuinely tests an ASSOCIATIONS edge; fallbacks are recorded as non-links, not
  laundered. Good faith, verified.
- **The gate is aimed at the wrong risk.** DESIGN §honesty-gate pre-declared the
  "honest-hardest slice" to be link-and-shift. Empirically the hardest slice is
  **verse composition** — it produces the repetition (§1) and season collisions
  (§3) that actually break the illusion. The apparatus polices the seam the author
  worried about and is blind to the seam that fails.
- **One concrete false claim** slips through the gate: `moon-seat` PASS while the
  moon is named off-seat (§2). Not aspirational-stated-as-achieved, but
  worse — machine-asserted-as-verified while untrue of the text.
- DESIGN line 50 ("the linker is the depth") is gently self-flattering given the
  linker is, by the author's own honest admission, shallow — but this is hedged
  elsewhere and is minor.

---

## Verdict & ranked fixes

**HARDEN-FIRST.** Keep the core and its honest labeling; do not ship the current
output as "reads like renga." The triple-paraphrase verses alone (v31 seed 1)
would discredit the aesthetic claim on first read.

Highest-leverage fixes, ranked:

1. **Fix verse-level composition (ROOT — do this first).** The author's own
   framing in the brief is correct: *composing lines from independently-tagged
   same-category fragments is itself the incoherence-and-repetition source.* A
   5-7-5 long-verse should be **one coherent image**, not three same-category
   fragments stacked. Options, cheapest→best: (a) whole-verse units — author
   3-line templates as single syntactic images, season-stamped, one per
   category/season; (b) compose the 3 lines from *linked-but-distinct*
   categories with connective grammar; (c) at minimum, forbid two lines in one
   verse from sharing a salient content word. This single change subsumes most of
   §1a **and** §3 (a whole-verse unit carries one season), and makes §4's link
   rate finally legible. Highest leverage by far.

2. **Phrase/word-level aversion across the poem (author's fix (a)) — RIGHT and
   necessary, but a symptom-filter.** It correctly kills the cross-verse verbatim
   reuse in §1b ("an old man warms his thin hands" ×2, the moon-line ×2, the
   duplicated verse in seed 3). Do it. But note: applied to the *current*
   generator it will spike retry counts and dead-ends, because the generator
   structurally *wants* to repeat (thin pools, mirrored arc). It is clean only
   once #1 removes the structural pressure. Verdict: right fix, wrong to do alone.

3. **Restore the moon-seat honesty (§2) — small change, high honesty-leverage.**
   Exclude any fragment whose *full* category list contains a marker (`moon`/
   `blossom`) from the general/non-seat pools, **and** add a validator check that
   scans surface text for "moon"/"blossom"/"cherry"/"petals" outside their seats.
   This re-truths the one machine claim that is currently false. Cheap; protects
   the credibility the whole project is staked on.

4. **Season-imagery coherence (author's fix (b)) — RIGHT for §3, but a check only
   rejects; it does not compose.** A coherence *check* without #1 just raises the
   failure/retry rate — it tells the generator "no" without teaching it "yes."
   Fold season-compatibility into the category walk (don't pick a season-locked
   category that conflicts with the planned season), or let #1's season-stamped
   whole-verse units absorb it. Secondary.

**Bottom line on the author's two proposed fixes:** both are correctly aimed at
*real* defects, but both are **downstream filters/checks**, not the cure. The cure
is #1 — verse-level composition. Land #1, then (a) and (b) become cheap polish and
the moon-leak fix (#3) restores the gate's integrity. Do #1 + #3 in the time-box;
(a)/(b) are the follow-on.
