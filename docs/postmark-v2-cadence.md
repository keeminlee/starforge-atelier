# Postmark v2 — cadence wiring plan

> **STATUS: APPLIED 2026-07-02**, riding the postmark-v2 merge per the
> sequencing rule below (Keemin's go). `tools/sync-postmark-atlas.mjs` stays
> on disk as the rollback path. The rest of this doc is the design record.

## Current chain (main, working)

```
town repo push (residents/ferry/illuminator)
        │  (no secrets town-side — it merges resident PRs)
        ▼  polled
sync-atlas.yml        cron */30 + workflow_dispatch
  └─ tools/sync-postmark-atlas.mjs --town .postmark-checkout
       → public/atelier/postmark/{atlas,daily}/**, works mirrors, herbarium
  └─ git add (those paths) → commit if diff → push
  └─ gh workflow run deploy.yml        (GITHUB_TOKEN pushes don't self-trigger)
        ▼
deploy.yml            npm ci → astro build → rsync dist/ → EC2
```

## Target chain (v2)

Identical shape — **one script swap and a wider `git add`**:

```
sync-atlas.yml (same cron, same checkout, same sharp pin)
  └─ node tools/extract-town.mjs --town .postmark-checkout
       → everything the old script produced (proven byte-identical), PLUS
         src/data/postmark/*.json  +  public/atelier/postmark/media/**
         and the atlas decoration (site doors in every click panel)
  └─ git add  public/atelier/postmark/atlas  public/atelier/postmark/daily \
              public/atelier/postmark/works  public/atelier/the-resident-herbarium \
              public/atelier/postmark/media  src/data/postmark
  └─ commit if diff → push → dispatch deploy.yml   (unchanged)
```

The deploy step needs no changes at all: data JSON is consumed at `astro build`
time, which deploy already runs on every dispatch. `marked` is in package.json
(deploy's `npm ci` picks it up); the extractor itself needs only sharp, exactly
like the old script.

### The exact yml diff (apply verbatim when cutting over)

```diff
       - name: Run atlas sync
-        run: node tools/sync-postmark-atlas.mjs --town .postmark-checkout
+        run: node tools/extract-town.mjs --town .postmark-checkout

       - name: Commit + deploy if the atlas changed
         env:
           GH_TOKEN: ${{ github.token }}
         run: |
           git add public/atelier/postmark/atlas public/atelier/postmark/daily \
-                  public/atelier/postmark/works public/atelier/the-resident-herbarium
+                  public/atelier/postmark/works public/atelier/the-resident-herbarium \
+                  public/atelier/postmark/media src/data/postmark
           if git diff --cached --quiet; then
-            echo "atlas + daily + mirrors unchanged — nothing to do"
+            echo "town unchanged — nothing to do"
             exit 0
           fi
           git config user.name "atlas-sync"
           git config user.email "atlas-sync@users.noreply.github.com"
-          git commit -m "postmark: auto-sync hosted atlas + Ferry's Daily from the town repo"
+          git commit -m "postmark: auto-sync the town (data + atlas + daily + mirrors)"
           git push
           gh workflow run deploy.yml --ref main
```

Optionally rename the workflow/job to `sync-town` at the same time (cosmetic;
`gh workflow run deploy.yml` and the concurrency group are unaffected).

## Sequencing — the one thing that must not be split

**The yml script-swap must land in the same merge as the v2 site.** If v2
merges while the workflow still calls the old script:

1. the next 30-min cron would overwrite the *decorated* `atlas/town.html`
   with an undecorated one (the door-pills silently vanish), and
2. `src/data/postmark/*.json` would never update — the Today strip, the Mail,
   Residents et al. would freeze at merge-day state while looking alive.

Both are quiet degradations, which is the worst kind. One merge, one line.

## Rollback

`tools/sync-postmark-atlas.mjs` stays on disk, untouched and working. Rollback
is reverting the yml diff above — the old chain resumes on the next cron tick.
The v2 pages would then freeze (stale JSON) but keep serving; the atlas/daily/
mirrors keep updating through the old script. No data migration in either
direction — the extractor regenerates everything from the town checkout.

## Failure modes (and where they surface)

- **Upstream atlas layout changes** (no `</body>`, unknown image-ref pattern):
  extractor exits 1 → the sync job goes red → hosted copy stays last-good.
  Fail-loud by design; nothing half-broken ships.
- **A malformed letter/resident file**: the town reader collects it into
  `problems[]` and warns; the letter simply doesn't join threads. The job
  stays green — imperfect mail is part of the town's record, not an outage.
- **Missing upstream image**: warned, page shows the gap the same way the
  town does locally.
- **sharp install breaks**: job red at install step, same as today (pinned
  sharp@0.33.5; bump deliberately).
- **Determinism**: extractor output is sorted, timestamp-free, byte-compare
  written — an unchanged town is a no-op commit-wise (verified: second local
  run writes nothing). CI (Linux, LF) and local Windows runs agree because
  writes are LF throughout.

## The Illuminator / Ferry side (already done)

No town-side changes are needed for v2. The Illuminator's round (step 6,
`MEEPS/SKILLS/illuminator-round.md`) already regenerates the atlas after a
settle and pushes it; Ferry's round rewrites the Daily. Any town push is
picked up by the next 30-min poll. The site never writes into the town repo,
and the town repo still holds no secrets.

## Later hardening (optional, not blocking)

- `.gitattributes` pinning `src/data/postmark/*.json` and generated html to
  LF (silences local CRLF warnings; CI already writes LF).
- A `workflow_dispatch` input to run the extractor in check-only mode (diff
  without commit) for dry-runs.
- If build time ever matters (letters at 10× today's volume): split
  letters.json per-thread. Not needed at current scale (~10s builds).
