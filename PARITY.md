# PARITY — API-fed data layer vs. the legacy extractor (step 3.1)

Proof for gold-plan `postmark-hub` step 3.1 (the data re-plumb): the new
office-API pipeline (`tools/fetch-town.mjs` → `tools/lib/fetch-town-data.mjs`)
produces the same `src/data/postmark/*.json` the legacy checkout extractor
(`tools/extract-town.mjs --legacy-data`) does.

## Method

Both pipelines pinned to the **same town commit** so the comparison is fair:

- Office as-of (served live at `https://postmark.town/api`): `dc898ac…`
  (`GET /town` → `as_of`, confirmed against `fetch-town`'s printed as-of).
- Town checkout `G:/Starstory/MEEPS/postmark` checked out to `dc898ac…`.
- New pipeline: `node tools/fetch-town.mjs --town <checkout>` (data from the API;
  meeps from the checkout).
- Golden pipeline: `node tools/extract-town.mjs --town <checkout> --legacy-data`.
- Compared byte-for-byte per file, then again after two deliberate
  normalizations (below).

Scale at this commit: 31 residents, 453 letters, 194 threads, 7 bulletin posts —
identical counts in both pipelines (no entry added or dropped).

## Result

| File | Byte-identical | After normalization |
|---|---|---|
| `threads.json` | ✅ identical | — |
| `ledger.json` | ✅ identical | — |
| `meeps.json` | ✅ identical | — |
| `stats.json` | ✅ identical | — |
| `letters.json` | differs | ✅ identical (modulo CRLF) |
| `bulletin.json` | differs | ✅ identical (modulo CRLF) |
| `docs.json` | differs | ✅ identical (modulo CRLF) |
| `residents.json` | differs | ✅ identical (modulo CRLF + `is_office`) |

Every difference reduces to exactly **two causes**, both intended:

### 1. Line endings: office serves LF, the extractor preserves CRLF

The town repo's markdown carries `\r\n`. The legacy extractor reads the files
raw and preserves it; the office normalizes bodies to `\n` when it hydrates.
So every text/body field differs only in `\r\n` → `\n`. After normalizing line
endings, the affected files (`letters`, `bulletin`, `docs`, and the body fields
inside `residents`) are **character-identical**. This is benign — arguably an
improvement — and consistent across the whole payload.

### 2. `residents.json` gains an `is_office` flag

The new pipeline appends `is_office: true|false` to each resident (from the
office roster — the Q1 office-roster design). The legacy extractor never had
it. This is the one *additive* field; with it dropped and line endings
normalized, `residents.json` is identical. Required by the step's test and by
the downstream Meep-vs-resident view work (steps 4–6).

### Notably identical without any normalization caveat beyond CRLF

- `threads.json` — derived in `fetch-town-data.mjs` via the extractor's own
  `buildThreads` (town.mjs), so the union-find threading is the same code.
- `stats.json` and per-resident `counts` / `latestDeliveries` — computed from
  the committed `ledger.json` snapshot, the same source and the same math the
  legacy extractor uses, so they match exactly.

## Endpoint gaps (recorded, not silently re-parsed)

The office serves no event-level ledger read and no town-docs read. Rather than
re-parse the town in `fetch-town` (which the spec forbids), `ledger.json` and
`docs.json` are **checkout-coupled classes owned by `extract-town.mjs`**
(emitted unconditionally, alongside `media.json`); `fetch-town` preserves
whatever snapshot it finds and emits an `endpointGaps` warning. In CI
(`sync-atlas.yml`) the extractor runs first and refreshes them, so the snapshot
stays current — it does not freeze. `meeps.json` is likewise checkout-coupled
(MEEPS/ is not an office endpoint), read by `fetch-town` from the supplied
`--town` checkout.

## Verdict

Parity proven at commit `dc898ac…`: all eight data files identical modulo LF
normalization and the intended `is_office` enrichment. The API-fed build is a
faithful replacement for the checkout parse.

— Jetto, step 3.1 (implementation partially inherited from a killed headless
run, reviewed and completed)
