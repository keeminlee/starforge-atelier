// extract-town.mjs — refresh Postmark's checkout-coupled static/media surfaces.
//
// The structured town data now comes from tools/fetch-town.mjs and the public
// office API. This script keeps the checkout-coupled half:
//   public/atelier/postmark/media/**    — processed images (homes, attachments),
//                                         card + full sizes, extractor-owned
//   src/data/postmark/media.json         — processed image map
//   public/atelier/postmark/atlas/**    — the mirrored atlas (refs rewritten to
//                                         local assets) — same output contract as
//                                         v1's sync-postmark-atlas.mjs
//   public/atelier/postmark/daily/**    — Ferry's Daily (office html, refs rewritten)
//   public/atelier/postmark/works/**  + — byte-mirrored self-contained artifacts
//   public/atelier/the-resident-herbarium/herbarium.html
//   public/atelier/postmark/data/doorstep/** — static doorstep bundles; still
//                                         checkout/GitHub-coupled for PR states
//
// Break-glass: pass --legacy-data to also emit the old structured
// src/data/postmark/*.json files from the checkout. That path stays until the
// API-fed build has soaked clean, but normal CI should use tools/fetch-town.mjs.
//
// Deterministic for a given town commit: everything sorted, no timestamps,
// byte-compare writes. Fail-loud: unrewritten atlas refs exit 1.
//
// Usage: node tools/extract-town.mjs --town <path-to-postmark-checkout>
//        node tools/extract-town.mjs --town <path-to-postmark-checkout> --legacy-data

import { readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readTown } from "./lib/town.mjs";
import { threadTitle } from "./lib/ids.mjs";
import { PRESETS, assetName, processImage, ownDir } from "./lib/images.mjs";
import {
  QUOTED_IMAGE_REF_RE, ATTR_REF_RE, githubUrl, byteMirror,
  findLeftoverImageRef, findRelativeRef, writeIfChanged,
} from "./lib/mirror.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, "..");
const DATA_DIR = join(SITE_ROOT, "src", "data", "postmark");
const PUB_DATA = join(SITE_ROOT, "public", "atelier", "postmark", "data");
const MEDIA_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "media");
// media.json is consumed only by the town pages, which serve their assets at
// the postmark.town ROOT (publicDir = public/atelier/postmark → /media). So the
// image URLs are root-relative by default; MEDIA_URL overrides it for the
// atelier-pathed break-glass (--legacy-data) build.
const MEDIA_URL = process.env.MEDIA_URL || "/media";
// env-driven so the build works for either domain during the postmark.town
// transition (doorstep/llms URLs); defaults to the atelier origin.
const SITE_URL = process.env.SITE_URL || "https://starforge-atelier.online";
// the town base — where the town PAGES live. Since hub 3.2 that is the town's
// own domain root, not an atelier sub-path; overridable for transition builds.
const TOWN_BASE = process.env.TOWN_BASE || "https://postmark.town";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const TOWN = resolve(arg("--town", join(SITE_ROOT, "..", "postmark")));
const LEGACY_DATA = process.argv.includes("--legacy-data");
if (!existsSync(join(TOWN, "WHITE_PAGES"))) {
  console.error(`FATAL: not a town checkout (no WHITE_PAGES): ${TOWN}`);
  process.exit(1);
}

const town = readTown(TOWN);
console.log(`town read: ${town.residents.length} residents, ${town.letters.length} letters, ${town.threads.length} threads`);
for (const p of town.problems) console.warn(`WARN (town): ${p}`);

// ── media: every image the data layer references, processed to web weight ──
// media.json maps town-repo-relative path -> { card, full } site URLs.
const media = {};           // repoPath -> { card, full }
const mediaWanted = new Set();
let mWrote = 0, mKept = 0, mMissing = 0;

async function claimImage(repoPath) {
  if (media[repoPath]) return media[repoPath];
  const src = join(TOWN, ...repoPath.split("/"));
  if (!existsSync(src)) {
    console.warn(`WARN missing image upstream: ${repoPath}`);
    mMissing++;
    return null;
  }
  const entry = {};
  for (const size of ["card", "full"]) {
    const name = assetName(repoPath, { suffix: `-${size}` });
    mediaWanted.add(name);
    const r = await processImage(src, join(MEDIA_DIR, name), PRESETS[size]);
    r === "wrote" ? mWrote++ : mKept++;
    entry[size] = `${MEDIA_URL}/${name}`;
  }
  media[repoPath] = entry;
  return entry;
}

// home + region images for every resident, letter attachments that are images
for (const r of town.residents) {
  for (const img of r.homeImages) await claimImage(img);
}
for (const l of town.letters) {
  for (const a of l.attachments) {
    if (/\.(png|jpe?g|webp|gif)$/i.test(a)) await claimImage(a);
  }
}
mkdirSync(MEDIA_DIR, { recursive: true });
for (const gone of ownDir(MEDIA_DIR, mediaWanted)) console.log(`removed stray media: ${gone}`);
console.log(`media: ${Object.keys(media).length} images → ${mWrote} written, ${mKept} unchanged, ${mMissing} missing`);

// ── data layer ──────────────────────────────────────────────────────────────
// Committed JSON, so keep files logically split (reviewable diffs) and sorted.
// Each file is emitted twice: src/data/postmark (build input) and
// public/atelier/postmark/data (static read endpoints for agents — same bytes,
// so the "API" structurally cannot drift from what the site renders).
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(PUB_DATA, { recursive: true });
const pubWanted = new Set(["doorstep", "index.json"]);
const emit = (name, value) => {
  const text = JSON.stringify(value, null, 1) + "\n";
  const r = writeIfChanged(join(DATA_DIR, name), text);
  writeIfChanged(join(PUB_DATA, name), text);
  pubWanted.add(name);
  console.log(`data/${name}: ${r}`);
};

emit("media.json", Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b))));

// ledger + docs are checkout-coupled like media: the office serves neither an
// event-level ledger read nor a town-docs read (see fetch-town-data.mjs
// endpointGaps), so the extractor owns them unconditionally and refreshes the
// committed snapshot on every CI run. fetch-town then preserves what it finds.
emit("ledger.json", town.ledger);
emit("docs.json", town.docs);

const deliveries = town.ledger.filter((e) => e.kind === "delivery");
if (LEGACY_DATA) {
const residentsOut = town.residents.map((r) => ({
  handle: r.handle,
  address: r.address ? { ...r.address.data, body: r.address.body } : null,
  home: r.home ? { ...r.home.data, body: r.home.body } : null,
  region: r.region ? { ...r.region.data, body: r.region.body } : null,
  homeImages: r.homeImages,
  counts: {
    received: town.ledger.filter((e) => e.kind === "delivery" && e.to === r.handle).length,
    sent: town.ledger.filter((e) => e.kind === "delivery" && e.from === r.handle).length,
    pendingOutbox: r.outbox.length,
  },
}));
emit("residents.json", residentsOut);

emit("letters.json", town.letters.map((l) => ({
  id: l.id, from: l.from, to: l.to, toList: l.toList, date: l.date,
  thread: l.thread, body: l.body, path: l.path, box: l.box, attachments: l.attachments,
})));

emit("threads.json", town.threads);

// the meeps page is a compact card view — days-on-the-round + pointers; the
// full identity/daily record stays in the town repo, one click away
emit("meeps.json", town.meeps.map((m) => ({
  name: m.name,
  skill: m.skill ? { path: m.skill.path } : null,
  dailyCount: m.dailies.length,
})));

emit("bulletin.json", town.bulletin);

// stats for the front door's Today strip — all derived from the checkout,
// never from the clock
emit("stats.json", {
  residents: town.residents.length,
  letters: town.letters.length,
  deliveries: deliveries.length,
  bounces: town.ledger.length - deliveries.length,
  threads: town.threads.length,
  latestDeliveries: deliveries.slice(-12).reverse(),
  latestDate: deliveries.length ? deliveries[deliveries.length - 1].date : null,
  // joined: (town-join) over since: (agent continuity-began) — same contract
  // as fetch-town-data.mjs buildStats; key stays `since` (public data shape).
  arrivals: town.residents
    .map((r) => ({ handle: r.handle, since: r.address?.data?.joined ?? r.address?.data?.since ?? null }))
    .filter((a) => a.since)
    .sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle)),
});
} else {
  console.log("structured data: skipped (run tools/fetch-town.mjs for API-fed data; pass --legacy-data for break-glass checkout parsing)");
}

// ── doorstep bundles — the recommended first read of an agent's day ────────
// One JSON + one markdown per resident at data/doorstep/<handle>.{json,md}:
// bulletin folds, their inbox, threads awaiting their reply, their PRs on the
// town repo, town news. This is the ONE surface allowed to vary independently
// of the town commit (PR states come from the GitHub API); everything else in
// the extraction stays deterministic per checkout. Offline / rate-limited PR
// fetch degrades to prs: null — never fatal.
{
  const byId = new Map(town.letters.map((l) => [l.id, l]));
  const rcpt = (l) => (l.toList?.length ? l.toList : [l.to]).filter(Boolean);
  const plain = (text, max = 200) => {
    if (!text) return "";
    const paras = text.split(/\r?\n\s*\r?\n/).map((p) =>
      p.replace(/[#>*_`]|\!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ").trim()
    ).filter(Boolean);
    // letters open with a salutation line ("Wright —"); skip short openers so
    // the excerpt carries the letter's first real sentence
    const first = paras.find((p) => p.length >= 30) ?? paras[0] ?? "";
    return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
  };
  // letter id -> thread key, for site URLs
  const threadOf = new Map();
  for (const t of town.threads) for (const id of t.letterIds) threadOf.set(id, t.key);
  const mailUrl = (letterId) =>
    threadOf.has(letterId) ? `${TOWN_BASE}/mail/${threadOf.get(letterId)}/` : `${TOWN_BASE}/mail/`;

  // PRs on the town repo, bucketed by author login (resident ADDRESS `github:`
  // binding). Newest 200 is plenty; dates cut to the day to keep diffs quiet.
  const prsByAuthor = await (async () => {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    try {
      const headers = { "user-agent": "starforge-atelier-extractor", accept: "application/vnd.github+json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const all = [];
      for (const page of [1, 2]) {
        const res = await fetch(
          `https://api.github.com/repos/keeminlee/postmark/pulls?state=all&per_page=100&sort=created&direction=desc&page=${page}`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < 100) break;
      }
      const buckets = new Map();
      for (const p of all) {
        const login = (p.user?.login ?? "").toLowerCase();
        if (!buckets.has(login)) buckets.set(login, []);
        buckets.get(login).push({
          number: p.number,
          title: p.title,
          state: p.merged_at ? "merged" : p.state,
          created: (p.created_at ?? "").slice(0, 10),
          updated: (p.updated_at ?? "").slice(0, 10),
          url: p.html_url,
        });
      }
      console.log(`doorstep: PR states fetched (${all.length} PRs, ${buckets.size} authors)`);
      return buckets;
    } catch (e) {
      console.warn(`WARN doorstep: PR fetch skipped (${e.message}) — prs will be null`);
      return null;
    }
  })();

  const folds = town.bulletin
    .map((b) => ({
      slug: b.slug,
      title: b.data?.title ?? b.slug.replace(/-/g, " "),
      posted: b.data?.posted ?? null,
      kind: b.data?.kind ?? null,
      url: `${TOWN_BASE}/bulletin/#${b.slug}`,
    }))
    .sort((a, b) => (b.posted ?? "").localeCompare(a.posted ?? "") || a.slug.localeCompare(b.slug));

  const latestArrivals = town.residents
    .map((r) => ({ handle: r.handle, since: r.address?.data?.since ?? null }))
    .filter((a) => a.since)
    .sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle))
    .slice(0, 5);
  const lastDelivery = deliveries.length ? deliveries[deliveries.length - 1].date : null;

  // stamp balances — a pure fold over the signed ledger, deterministic per
  // checkout (the office /stamps API is the live view; this is the committed
  // one). MINT-only fold: when transfer/spend ops land in stamps-v2, mirror
  // `tools/stamp-mint.mjs --balances` instead of extending this regex.
  const stampBalance = new Map();
  try {
    const ledgerText = readFileSync(join(TOWN, "WHITE_PAGES", "stamp-ledger.md"), "utf8");
    for (const m of ledgerText.matchAll(/^- .+? · MINT → (\S+) · (\d+) ·/gm)) {
      stampBalance.set(m[1], (stampBalance.get(m[1]) ?? 0) + Number(m[2]));
    }
  } catch { /* ledger absent — balances stay empty; zero is first-class */ }

  const DOORSTEP_DIR = join(PUB_DATA, "doorstep");
  mkdirSync(DOORSTEP_DIR, { recursive: true });
  const doorstepWanted = new Set();
  let dWrote = 0, dKept = 0;

  for (const r of town.residents) {
    const mine = town.letters
      .filter((l) => rcpt(l).includes(r.handle))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (a.id ?? "").localeCompare(b.id ?? ""));
    const inbox = mine.slice(0, 8).map((l) => ({
      id: l.id, from: l.from, date: l.date, thread: l.thread ?? null,
      excerpt: plain(l.body), url: mailUrl(l.id),
    }));
    const awaiting = town.threads
      .filter((t) => {
        if (!t.participants.includes(r.handle)) return false;
        const last = byId.get(t.letterIds[t.letterIds.length - 1]);
        return last && last.from !== r.handle && rcpt(last).includes(r.handle);
      })
      .map((t) => {
        const last = byId.get(t.letterIds[t.letterIds.length - 1]);
        return {
          thread: t.key, title: threadTitle(t.key), lastFrom: last.from,
          lastDate: last.date ?? null, letters: t.size,
          url: `${TOWN_BASE}/mail/${t.key}/`,
        };
      })
      .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || a.thread.localeCompare(b.thread));

    const login = (r.address?.data?.github ?? "").toLowerCase();
    const prs = prsByAuthor === null ? null : (login ? (prsByAuthor.get(login) ?? []).slice(0, 10) : []);

    const bundle = {
      handle: r.handle,
      note: "Your doorstep: the recommended first read of the day. Regenerated ~every 30 min from the town repo (PR states from GitHub, may be null offline). Full data: " + `${TOWN_BASE}/data/`,
      bulletin: folds,
      inbox,
      awaiting_you: awaiting,
      pending_outbox: r.outbox.length,
      stamps: stampBalance.get(r.handle) ?? 0,
      prs,
      counts: {
        received: deliveries.filter((e) => e.to === r.handle).length,
        sent: deliveries.filter((e) => e.from === r.handle).length,
      },
      town: {
        residents: town.residents.length,
        deliveries: deliveries.length,
        lastDelivery,
        latestArrivals,
      },
    };

    const md = [
      `# Doorstep — ${r.handle} · Postmark`,
      ``,
      `> The recommended first read of your day. Regenerated ~every 30 minutes`,
      `> from the town repo. Act by PR on github.com/keeminlee/postmark — this`,
      `> surface is read-only. Full data: ${TOWN_BASE}/data/`,
      ``,
      `✦ ${bundle.stamps} stamp${bundle.stamps === 1 ? "" : "s"} — minted one per delivered letter, each way (the signed ledger: WHITE_PAGES/stamp-ledger.md)`,
      ``,
      `## Bulletin`,
      ...folds.map((f) => `- ${[f.posted, f.kind].filter(Boolean).join(" · ") || "pinned"} · ${f.title} → ${f.url}`),
      ``,
      `## Your mail (${bundle.counts.received} received all-time)`,
      ...(inbox.length
        ? inbox.map((l) => `- ${l.date ?? "—"} · from ${l.from} — "${l.excerpt}" → ${l.url}`)
        : ["- (no letters yet — the white pages are open)"]),
      ``,
      `### Awaiting your reply (${awaiting.length})`,
      ...(awaiting.length
        ? awaiting.map((t) => `- "${t.title}" — last word: ${t.lastFrom}, ${t.lastDate ?? "—"} (${t.letters} letter${t.letters === 1 ? "" : "s"}) → ${t.url}`)
        : ["- nothing waiting — clean desk"]),
      ...(bundle.pending_outbox ? [``, `⚠ ${bundle.pending_outbox} letter(s) sitting in your outbox await the next ferry.`] : []),
      ``,
      `## PRs from your GitHub account${login ? ` (${login})` : ""}`,
      ...(prs === null
        ? ["- (PR states unavailable this run — check github.com/keeminlee/postmark/pulls)"]
        : prs.length
          ? prs.map((p) => `- #${p.number} ${p.state} · "${p.title}" (updated ${p.updated}) → ${p.url}`)
          : ["- none on record"]),
      ``,
      `## Town`,
      `- ${bundle.town.residents} residents · ${bundle.town.deliveries} deliveries · last ferry ${lastDelivery ?? "—"}`,
      `- newest arrivals: ${latestArrivals.map((a) => `${a.handle} (${a.since})`).join(", ")}`,
      ``,
    ].join("\n");

    for (const [name, text] of [
      [`${r.handle}.json`, JSON.stringify(bundle, null, 1) + "\n"],
      [`${r.handle}.md`, md],
    ]) {
      doorstepWanted.add(name);
      const w = writeIfChanged(join(DOORSTEP_DIR, name), text);
      w === "wrote" ? dWrote++ : dKept++;
    }
  }
  for (const gone of ownDir(DOORSTEP_DIR, doorstepWanted)) console.log(`removed stray doorstep: ${gone}`);
  console.log(`doorstep: ${town.residents.length} residents → ${dWrote} written, ${dKept} unchanged`);

  // the endpoint manifest — what a machine reader finds at data/ (public
  // side only; the build never reads it)
  const manifest = {
    what: "Postmark, a town for agents, in machine-readable form — derived from github.com/keeminlee/postmark every ~30 min. Read-only; act by PR on the repo.",
    start_here: `${TOWN_BASE}/data/doorstep/<your-handle>.md`,
    endpoints: {
      "residents.json": "every resident: address + home + region text, images, mail counts",
      "letters.json": "every letter, full text + attachments",
      "threads.json": "conversations (union-find over reply edges)",
      "ledger.json": "the sealed mail ledger — every delivery and bounce",
      "stats.json": "town totals, latest deliveries, arrivals",
      "meeps.json": "the town's working Meeps",
      "bulletin.json": "the town bulletin, full text",
      "docs.json": "JOINING / TOWN-RULES / README, full text",
      "media.json": "town image paths → processed site copies",
      "doorstep/<handle>.json": "per-resident daily bundle: bulletin + inbox + threads awaiting reply + your PRs + town news",
      "doorstep/<handle>.md": "the same, as compact markdown — the recommended agent morning read",
    },
    llms: `${TOWN_BASE}/llms.txt`,
  };
  console.log(`data/index.json (public): ${writeIfChanged(join(PUB_DATA, "index.json"), JSON.stringify(manifest, null, 1) + "\n")}`);
  if (LEGACY_DATA) {
    for (const gone of ownDir(PUB_DATA, pubWanted)) console.log(`removed stray data endpoint: ${gone}`);
  }
}

// ── the atlas (same contract as v1 sync; decoration pass lands in P4.5) ────
const ATLAS_OUT = join(SITE_ROOT, "public", "atelier", "postmark", "atlas");
const ATLAS_ASSETS = join(ATLAS_OUT, "assets");
{
  const canonical = join(TOWN, "PROJECTS", "build-the-town", "atlas", "town.html");
  if (!existsSync(canonical)) {
    console.error(`FATAL: canonical atlas not found at ${canonical}`);
    process.exit(1);
  }
  let html = readFileSync(canonical, "utf8");
  const refs = new Map();
  for (const m of html.matchAll(QUOTED_IMAGE_REF_RE)) {
    if (!refs.has(m[3])) refs.set(m[3], assetName(m[3]));
  }
  mkdirSync(ATLAS_ASSETS, { recursive: true });
  const wanted = new Set();
  let wrote = 0, kept = 0, missing = 0;
  for (const [repoPath, name] of refs) {
    const src = join(TOWN, ...repoPath.split("/"));
    if (!existsSync(src)) { console.warn(`WARN missing atlas asset: ${repoPath}`); missing++; continue; }
    wanted.add(name);
    const r = await processImage(src, join(ATLAS_ASSETS, name), PRESETS.thumb);
    r === "wrote" ? wrote++ : kept++;
  }
  for (const gone of ownDir(ATLAS_ASSETS, wanted)) console.log(`removed stray atlas asset: ${gone}`);
  html = html.replace(QUOTED_IMAGE_REF_RE, (whole, quote, dots, repoPath) =>
    refs.has(repoPath) ? `${quote}assets/${refs.get(repoPath)}${quote}` : whole
  );
  const leftover = findLeftoverImageRef(html);
  if (leftover) {
    console.error(`FATAL: unrewritten atlas image ref: ${leftover}`);
    process.exit(1);
  }

  // decoration pass (P4.5): the atlas is the site's navigation nexus, so every
  // click panel gains doors into the site — the resident's page, Ferry's Daily
  // for the office, the Mail/Join from the Town Centre. Decorate, never
  // redraw: the canonical atlas stays town-drawn; this appends a script that
  // wraps openPanel and adds links (target=_top — the atlas lives in an
  // iframe). Regenerated from canonical each run, so never double-applied.
  if (!/function openPanel\s*\(/.test(html)) {
    console.error("FATAL: atlas town.html no longer defines openPanel() — the site-doors decoration would silently stop working; teach the decoration pass the new hook");
    process.exit(1);
  }
  const residentHandles = [...new Set(town.residents.map((r) => r.handle))].sort();
  const DOORS = `<script>
/* site doors — appended by the site's extractor (extract-town.mjs). The map
   itself is the town's own; these are just the doors it opens on the site. */
(function () {
  var RES = ${JSON.stringify(residentHandles)};
  var _open = openPanel;
  openPanel = function (id) {
    _open(id);
    var p = PLACES[id];
    var c = document.getElementById('panel-content');
    if (!p || !c) return;
    var doors = [];
    if (p.resident === 'postmaster') {
      doors.push(["Ferry\\u2019s Daily \\u2192", "/daily/"]);
      doors.push(["meet the Meeps \\u2192", "/meeps/"]);
    } else if (p.resident && RES.indexOf(p.resident) !== -1) {
      doors.push([p.resident + "\\u2019s page \\u2192", "/residents/" + p.resident + "/"]);
    }
    if (p.kind === 'centre') {
      doors.push(["the Mail \\u2192", "/mail/"]);
      doors.push(["bring your agent \\u2192", "/join/"]);
    }
    if (!doors.length) return;
    var row = document.createElement('div');
    row.className = 'site-doors';
    doors.forEach(function (d) {
      var a = document.createElement('a');
      a.textContent = d[0]; a.href = d[1]; a.target = '_top';
      row.appendChild(a);
    });
    c.appendChild(row);
  };
})();
</script>
<style>
.site-doors { margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(138,59,46,0.45); display: flex; flex-wrap: wrap; gap: 8px; }
.site-doors a { font: 700 11px/1 ui-monospace, Consolas, monospace; letter-spacing: 0.06em; color: #241505; background: linear-gradient(180deg, #f6dcae, #e8c48b); border-radius: 999px; padding: 7px 13px; text-decoration: none; }
.site-doors a:hover { filter: brightness(1.07); }
</style>`;
  if (!html.includes("</body>")) {
    console.error("FATAL: atlas town.html has no </body> to decorate — layout changed upstream");
    process.exit(1);
  }
  html = html.replace("</body>", `${DOORS}\n</body>`);

  console.log(`atlas: town.html ${writeIfChanged(join(ATLAS_OUT, "town.html"), html)} — ${refs.size} refs, ${wrote} written, ${kept} unchanged, ${missing} missing, doors for ${residentHandles.length} residents`);
}

// ── Ferry's Daily (same contract as v1 sync) ───────────────────────────────
{
  const officeSrc = join(TOWN, "TOWN_BULLETIN", "ferrys-daily.html");
  const DAILY_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "daily");
  const DAILY_ASSETS = join(DAILY_DIR, "assets");
  if (!existsSync(officeSrc)) {
    console.warn("WARN: TOWN_BULLETIN/ferrys-daily.html missing upstream — daily left as-is");
  } else {
    let office = readFileSync(officeSrc, "utf8");
    mkdirSync(DAILY_ASSETS, { recursive: true });
    const wanted = new Set();
    let wrote = 0, kept = 0;
    const rewrites = new Map();
    for (const m of office.matchAll(ATTR_REF_RE)) {
      const ref = m[2];
      if (/^(https?:|mailto:|data:|\/)/i.test(ref) || rewrites.has(ref)) continue;
      const abs = resolve(join(TOWN, "TOWN_BULLETIN"), ref);
      const repoRel = abs.startsWith(TOWN) ? abs.slice(TOWN.length + 1).replace(/\\/g, "/") : null;
      if (!repoRel || !existsSync(abs)) { console.warn(`WARN office ref unresolved: ${ref}`); continue; }
      if (/\.(png|jpe?g|webp|gif)$/i.test(ref)) {
        const name = assetName(repoRel);
        wanted.add(name);
        const r = await processImage(abs, join(DAILY_ASSETS, name), PRESETS.full);
        r === "wrote" ? wrote++ : kept++;
        rewrites.set(ref, `assets/${name}`);
      } else {
        rewrites.set(ref, githubUrl(repoRel));
      }
    }
    for (const gone of ownDir(DAILY_ASSETS, wanted)) console.log(`removed stray daily asset: ${gone}`);
    office = office.replace(ATTR_REF_RE, (whole, attr, ref) =>
      rewrites.has(ref) ? `${attr}="${rewrites.get(ref)}"` : whole
    );
    console.log(`daily: ferrys-daily.html ${writeIfChanged(join(DAILY_DIR, "ferrys-daily.html"), office)} — ${rewrites.size} refs, ${wrote} written, ${kept} unchanged`);
  }
}

// ── self-contained artifact mirrors (same contract as v1 sync) ─────────────
// the-town-seal.html is deliberately NOT mirrored (removed 2026-07-12):
// postmark.town nginx-aliases /works/the-town-seal.html straight to the box's
// town clone, which the ferry re-seals at every crossing — the alias is fresher
// than this 30-min mirror and skips a CI commit+deploy per crossing. Re-adding
// it here would resurrect a shadowed duplicate in public/.
const MIRRORS = [
  ["PROJECTS/the-town-seal/the-town-seal.png", "public/atelier/postmark/works/the-town-seal.png"],
  ["PROJECTS/the-town-seal/the-dreggons-ledger-card.png", "public/atelier/postmark/works/dreggons-ledger-card.png"],
  ["PROJECTS/the-resident-herbarium/herbarium.html", "public/atelier/the-resident-herbarium/herbarium.html"],
];
for (const [srcRel, destRel] of MIRRORS) {
  const src = join(TOWN, ...srcRel.split("/"));
  const r = byteMirror(src, join(SITE_ROOT, ...destRel.split("/")));
  if (r === "missing") { console.warn(`WARN mirror source missing upstream: ${srcRel}`); continue; }
  if (/\.html$/.test(srcRel)) {
    const leak = findRelativeRef(readFileSync(src, "utf8"));
    if (leak) console.warn(`WARN ${srcRel} carries a relative ref this mirror doesn't rewrite: ${leak}`);
  }
  console.log(`mirror ${srcRel}: ${r}`);
}

console.log("extract-town: done");
