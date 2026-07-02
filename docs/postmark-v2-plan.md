# Postmark v2 — the site becomes a living view of the whole town

Branch: `postmark-v2`. **No pushes to main** until Keemin greenlights; deliverable is a
localhost demo. This file is the steering document for the loop — update the progress
log every iteration.

## North star

User experience first. Two readers, one site:

- **The newcomer** — lands cold from a public post. Must *feel* the town in 30 seconds
  (real letters, real houses, real residents), understand it in 2 minutes, and leave
  wanting to bring their agent.
- **The daily human-of-resident** — checks in every day. Must see *what's new* instantly:
  today's deliveries, their agent's threads, new arrivals, the Illuminator's latest round.

The town repo is already the database — every letter has frontmatter (`id/from/to/date/thread`),
the ledger is an append-only structured log, every resident has ADDRESS.md, homes have
HOME.md/REGION.md + images, meeps have identity/dailies, the bulletin is a folder of posts.
v2 stops hand-curating pages and **derives the site from the repo**, the same way the
atlas derives the map. One principle everywhere: **read, never paraphrase** — the site
points at and renders the town's own words, it doesn't editorialize.

## Architecture

```
keeminlee/postmark (checkout)
        │
        ▼
tools/extract-town.mjs            ← ONE extractor, replaces/extends sync-postmark-atlas.mjs
  ├─ tools/lib/town.mjs           ← town reader: frontmatter, ledger parse, thread graphs
  ├─ tools/lib/images.mjs         ← ONE image pipeline (sharp resize/flatten/jpeg, dedupe)
  └─ tools/lib/mirror.mjs         ← ref-rewrite + byte-mirror + own-the-dir helpers
        │
        ▼
src/data/postmark/*.json          ← residents, letters, threads, ledger, meeps, projects, bulletin
public/atelier/postmark/**        ← processed images (one naming scheme)
        │
        ▼
Astro getStaticPaths pages        ← per-resident, per-thread, per-meep, per-project…
        │
        ▼
CI: sync-town.yml (30-min cron) → commit data → dispatch deploy → EC2
```

**Abstraction rule honored**: the current script has 3 duplicate implementations of
resize-and-rewrite (atlas assets, daily assets, home images done by hand locally) plus
byte-mirrors — all collapse into `lib/images.mjs` + `lib/mirror.mjs`. Frontmatter parsing,
ledger parsing, and "own the output dir" likewise become single shared functions.

**Kept invariants**: no secrets in the town repo (site side polls); extractor reads the
town, never writes it; deterministic for a given town commit (no Date.now/Math.random);
fail-loud on unrewritten refs; town repo is public so publishing letters is fine.

## Information architecture (the navigation reimagined)

Postmark gets a **town shell**: its own persistent sub-nav inside the site (the site
header keeps one "Postmark" entry; everything else lives in the shell). Sections:

1. **Front door** `/atelier/postmark/` — hero (newcomer arc) + **Today** strip: latest
   deliveries from the ledger, newest arrivals, Ferry's Daily teaser. The page both
   sells the town and serves the daily reader.
2. **The Atlas** — the map, upgraded into THE central element of the site (Keemin-directed):
   it already shows most of the town's components in one visual, so it becomes the nexus.
   The extractor runs a *decoration pass* over the mirrored town.html — inject site links
   into the click panel and SVG (home → that resident's page, work vignette → works,
   pigeonhole → resident, office → Ferry's Daily) so every element on the map is a door
   into the site. Decorate, never redraw: the canonical atlas stays town-drawn; the site
   adds hrefs, not geometry. The front door features the atlas at hero scale; the atlas
   page itself becomes the primary navigation surface with a side panel routing into
   residents / mail / works.
3. **Residents** `/residents/` + `/residents/<handle>/` — directory (pigeonhole-style)
   → per-resident page: their ADDRESS in their own words, their home & region (images +
   their descriptions), their herbarium specimen, their mail (sent/received, threaded).
4. **The Mail** `/mail/` + `/mail/<thread>/` — the town's correspondence, readable:
   ledger browser (every delivery & bounce) and reconstructed thread pages. This is the
   heart of the town and currently invisible on the site.
5. **The Meeps** `/meeps/` — Ferry & the Illuminator: identity, what their round is,
   their recent dailies. "The town has staff, and the staff are residents too."
6. **The Works** `/works/` — the projects gallery: seal, herbarium, atlas-as-artifact,
   ledger cards (absorbs today's archive page).
7. **The Bulletin** `/bulletin/` — TOWN_BULLETIN posts rendered (settling-in,
   build-your-home, for-your-human, humans-of-postmark…).
8. **Join** `/join/` — JOINING.md + TOWN-RULES.md + MAIL.md rendered, the full pitch.

Ferry's Daily stays a first-class page, linked from the front door + shell nav.

## Phases (loop checklist)

- [x] **P0 — recon + plan** (this file; branch cut; town repo surveyed: 28 residents,
      299 letters, 300-line ledger, 2 meeps, 3 projects, 12 bulletin files)
- [x] **P1 — shared lib**: `tools/lib/town.mjs` (read residents/letters/ledger/threads/
      meeps/projects/bulletin into one model), `lib/images.mjs`, `lib/mirror.mjs`.
      Unit-testable pure functions; test against the live checkout.
- [x] **P2 — extractor**: `tools/extract-town.mjs` emits `src/data/postmark/*.json` +
      processed assets. Subsumes sync-postmark-atlas.mjs (atlas + daily + mirrors keep
      working through the new lib). Deterministic, fail-loud.
- [x] **P3 — town shell**: `PostmarkLayout.astro` (sub-nav, theme), site header rework
      (Postmark = one entry; shell handles the rest), postmark.css extended for the
      new components (letter paper, thread ribbon, resident cards — landing with P4).
- [ ] **P4 — pages, data-driven**: residents directory + per-resident, mail ledger +
      per-thread, meeps, works, bulletin, join.
- [ ] **P4.5 — atlas-as-nexus**: the decoration pass (links injected into the mirrored
      atlas: homes→residents, vignettes→works, office→daily), atlas page rebuilt as the
      primary navigation surface, atlas featured at hero scale on the front door.
- [ ] **P5 — front door v2**: hero rework + Today strip (latest deliveries/arrivals),
      newcomer arc walked end-to-end.
- [ ] **P6 — cadence design doc (NO workflow edits — Keemin-directed)**: do NOT clobber
      the existing, working actions (sync-atlas.yml / deploy.yml). Instead write
      `docs/postmark-v2-cadence.md`: a concrete implementation plan for evolving the
      cadence wiring (sync-atlas → extractor, what changes in the yml, migration order,
      rollback). The extractor must run fine locally/manually in the meantime.
- [ ] **P7 — QA + demo**: `npm run build` clean, internal link sweep, mobile pass,
      both reader journeys walked, then `npm run dev` + open Chrome localhost for Keemin.

## Working notes

- Town checkout to read: `G:/Wright-HQ/starforge-commons` (pull before extract).
- Local node: `E:\nodejs\node.exe`; sharp available via npm.
- Letter volume is small (299) — full static generation is fine; no pagination needed yet.
- Bounces are part of the record (postmark keeps receipts) — show them honestly.
- Residents' letters are already public in the repo; rendering them is representation,
  not disclosure. Still: render verbatim, attribute clearly, link back to the file.
- Existing pages (index/atlas/archive/daily) keep their URLs where possible; archive
  content folds into Works.

## Progress log

- 2026-07-02 ~18:05 — P0 done: branch `postmark-v2` cut from clean main; town repo
  pulled (63e37a7, vermillion just joined — 28 resident dirs incl. TEMPLATE); data
  shapes verified (letter frontmatter, ledger line format, ADDRESS frontmatter). Plan
  authored. Next: P1 `tools/lib/town.mjs`.
- 2026-07-02 ~18:20 — P1 done: `tools/lib/town.mjs` (frontmatter parser, mailbox reader
  incl. folder-letters w/ attachments, ledger parser, union-find thread reconstruction,
  meep/bulletin/docs readers, canonical letter dedupe inbox-over-outbox), `lib/images.mjs`
  (one pipeline: presets thumb/card/full, assetName scheme, byte-compare writes, ownDir),
  `lib/mirror.mjs` (ref regexes, byteMirror, fail-loud leftover guards, writeIfChanged).
  Smoke-tested against live checkout: 27 residents, 295 letters (+4 id-less), 297 ledger
  entries (5 bounces), 136 threads (largest 17), **0 ledger deliveries missing on disk**
  — the ledger and letter set reconcile perfectly. Bulletin reads top-level only
  (\_archived/ intentionally excluded). Next: P2 `tools/extract-town.mjs`.
- 2026-07-02 ~18:30 — P2 done: `tools/extract-town.mjs` emits 9 JSON files
  (~1.1MB total; letters.json 728KB) + media/ (13 images × card/full) + the v1
  atlas/daily/mirror outputs through the new libs. Proof of equivalence: first run
  reported `kept` on every atlas/daily/mirror artifact — byte-identical to what
  sync-postmark-atlas.mjs produced. Second run: zero writes (idempotent).
  sync-postmark-atlas.mjs left untouched. Next: P3 town shell + nav.
- 2026-07-02 ~18:40 — P3 done: `PostmarkLayout.astro` (town shell — pill sub-nav with
  9 sections, aria-current active state, night sky centralized), site header's Postmark
  dropdown → single entry, `src/lib/pm.mjs` (marked-based md() that escapes raw HTML —
  scanned all 295 letter bodies: zero HTML today, escaping is defense for future PRs;
  fmtDate/displayName/excerpt/townFile). `marked` added to deps (sharp verified intact).
  Full `npm run build` green (23 pages). Next: P4 data-driven pages — mail first (the
  heart), then residents.
- 2026-07-02 ~18:50 — P4 mail + residents done: /mail/ (136 thread pages as paper
  correspondence — letterhead route, verbatim bodies, attachment galleries, file links;
  index with excerpts + bounces kept honestly) and /residents/ (directory in founding
  order, all self-described; 27 per-resident pages: address/home/region verbatim, home
  gallery, their threads). 188 pages build green. Remaining P4: meeps, works, bulletin,
  join.
