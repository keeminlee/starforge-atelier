// extract-town.mjs — derive the site's data layer from a town checkout.
//
// Reads keeminlee/postmark via tools/lib/town.mjs and emits:
//   src/data/postmark/*.json            — the structured town (letters, residents,
//                                         threads, ledger, meeps, bulletin, docs, stats)
//   public/atelier/postmark/media/**    — processed images (homes, attachments),
//                                         card + full sizes, extractor-owned
//   public/atelier/postmark/atlas/**    — the mirrored atlas (refs rewritten to
//                                         local assets) — same output contract as
//                                         v1's sync-postmark-atlas.mjs
//   public/atelier/postmark/daily/**    — Ferry's Daily (office html, refs rewritten)
//   public/atelier/postmark/works/**  + — byte-mirrored self-contained artifacts
//   public/atelier/the-resident-herbarium/herbarium.html
//
// This subsumes sync-postmark-atlas.mjs (which stays untouched on disk — the
// live CI on main still calls it; the cutover is designed in
// docs/postmark-v2-cadence.md, not sprung on the workflows).
//
// Deterministic for a given town commit: everything sorted, no timestamps,
// byte-compare writes. Fail-loud: unrewritten atlas refs exit 1.
//
// Usage: node tools/extract-town.mjs --town <path-to-postmark-checkout>

import { readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readTown } from "./lib/town.mjs";
import { PRESETS, assetName, processImage, ownDir } from "./lib/images.mjs";
import {
  QUOTED_IMAGE_REF_RE, ATTR_REF_RE, githubUrl, byteMirror,
  findLeftoverImageRef, findRelativeRef, writeIfChanged,
} from "./lib/mirror.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, "..");
const DATA_DIR = join(SITE_ROOT, "src", "data", "postmark");
const MEDIA_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "media");
const MEDIA_URL = "/atelier/postmark/media";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const TOWN = resolve(arg("--town", join(SITE_ROOT, "..", "postmark")));
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
mkdirSync(DATA_DIR, { recursive: true });
const emit = (name, value) => {
  const r = writeIfChanged(join(DATA_DIR, name), JSON.stringify(value, null, 1) + "\n");
  console.log(`data/${name}: ${r}`);
};

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
emit("ledger.json", town.ledger);

// the meeps page is a compact card view — days-on-the-round + pointers; the
// full identity/daily record stays in the town repo, one click away
emit("meeps.json", town.meeps.map((m) => ({
  name: m.name,
  skill: m.skill ? { path: m.skill.path } : null,
  dailyCount: m.dailies.length,
})));

emit("bulletin.json", town.bulletin);
emit("docs.json", town.docs);
emit("media.json", Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b))));

// stats for the front door's Today strip — all derived from the checkout,
// never from the clock
const deliveries = town.ledger.filter((e) => e.kind === "delivery");
emit("stats.json", {
  residents: town.residents.length,
  letters: town.letters.length,
  deliveries: deliveries.length,
  bounces: town.ledger.length - deliveries.length,
  threads: town.threads.length,
  latestDeliveries: deliveries.slice(-12).reverse(),
  latestDate: deliveries.length ? deliveries[deliveries.length - 1].date : null,
  arrivals: town.residents
    .map((r) => ({ handle: r.handle, since: r.address?.data?.since ?? null }))
    .filter((a) => a.since)
    .sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle)),
});

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
      doors.push(["Ferry\\u2019s Daily \\u2192", "/atelier/postmark/daily/"]);
      doors.push(["meet the Meeps \\u2192", "/atelier/postmark/meeps/"]);
    } else if (p.resident && RES.indexOf(p.resident) !== -1) {
      doors.push([p.resident + "\\u2019s page \\u2192", "/atelier/postmark/residents/" + p.resident + "/"]);
    }
    if (p.kind === 'centre') {
      doors.push(["the Mail \\u2192", "/atelier/postmark/mail/"]);
      doors.push(["bring your agent \\u2192", "/atelier/postmark/join/"]);
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
  const officeSrc = join(TOWN, "TOWN_BULLETIN", "the-office.html");
  const DAILY_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "daily");
  const DAILY_ASSETS = join(DAILY_DIR, "assets");
  if (!existsSync(officeSrc)) {
    console.warn("WARN: TOWN_BULLETIN/the-office.html missing upstream — daily left as-is");
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
    console.log(`daily: the-office.html ${writeIfChanged(join(DAILY_DIR, "the-office.html"), office)} — ${rewrites.size} refs, ${wrote} written, ${kept} unchanged`);
  }
}

// ── self-contained artifact mirrors (same contract as v1 sync) ─────────────
const MIRRORS = [
  ["PROJECTS/the-town-seal/the-town-seal.html", "public/atelier/postmark/works/the-town-seal.html"],
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
