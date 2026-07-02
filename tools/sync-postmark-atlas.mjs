// sync-postmark-atlas.mjs — mirror the town's living atlas into this site.
//
// The canonical atlas (keeminlee/postmark → PROJECTS/build-the-town/atlas/
// town.html) references resident images by repo-relative paths. A hosted copy
// can't reach those, so this script:
//   1. reads the canonical town.html,
//   2. finds every ../../../-style image ref,
//   3. resizes each referenced image to a small web copy (sharp, ≤420w jpeg —
//      the atlas renders them at 60–76px, so this is generous),
//   4. rewrites the refs to assets/<name>.jpg,
//   5. writes the result into public/atelier/postmark/atlas/, owning that
//      directory completely (stray assets from earlier syncs are removed).
//
// Deterministic for a given town commit + pinned sharp version: the CI job
// only commits when bytes actually change, so an unchanged atlas is a no-op.
//
// Usage: node tools/sync-postmark-atlas.mjs --town <path-to-postmark-checkout>

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, "..");
const OUT_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "atlas");
const ASSET_DIR = join(OUT_DIR, "assets");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const TOWN = resolve(arg("--town", join(SITE_ROOT, "..", "postmark")));
const CANONICAL = join(TOWN, "PROJECTS", "build-the-town", "atlas", "town.html");

if (!existsSync(CANONICAL)) {
  console.error(`FATAL: canonical atlas not found at ${CANONICAL}`);
  process.exit(1);
}

let html = readFileSync(CANONICAL, "utf8");

// every repo-relative image the atlas embeds — both SVG href="..." attributes
// AND the click-panel's JS data blob ("image":"../../../..."), so match any
// quoted (../)+path.ext occurrence rather than a specific attribute
const REF_RE = /(["'])((?:\.\.\/)+)([^"']+?\.(?:png|jpe?g|webp|gif))\1/gi;
const refs = new Map(); // repoPath -> assetName
for (const m of html.matchAll(REF_RE)) {
  const repoPath = m[3];
  if (!refs.has(repoPath)) {
    const name = repoPath
      .replace(/^WHITE_PAGES\//i, "")
      .replace(/^PROJECTS\//i, "")
      .replace(/\/HOME\//i, "/")
      .replace(/\.[a-z]+$/i, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() + ".jpg";
    refs.set(repoPath, name);
  }
}

mkdirSync(ASSET_DIR, { recursive: true });
const wanted = new Set();
let wrote = 0, kept = 0, missing = 0;

for (const [repoPath, name] of refs) {
  const src = join(TOWN, ...repoPath.split("/"));
  if (!existsSync(src)) {
    // an honest gap upstream (the pipeline flags missing assets itself) —
    // leave the ref rewritten; the map degrades the same way it would locally
    console.warn(`WARN missing upstream asset: ${repoPath}`);
    missing++;
    continue;
  }
  wanted.add(name);
  const buf = await sharp(src)
    .resize({ width: 420, withoutEnlargement: true })
    .flatten({ background: { r: 10, g: 13, b: 22 } })
    .jpeg({ quality: 84 })
    .toBuffer();
  const dest = join(ASSET_DIR, name);
  if (existsSync(dest) && Buffer.compare(readFileSync(dest), buf) === 0) {
    kept++;
  } else {
    writeFileSync(dest, buf);
    wrote++;
  }
}

// own the assets dir: anything not referenced by the current atlas goes
for (const f of readdirSync(ASSET_DIR)) {
  if (!wanted.has(f)) {
    unlinkSync(join(ASSET_DIR, f));
    console.log(`removed stray asset: ${f}`);
  }
}

// rewrite refs and land the atlas
html = html.replace(REF_RE, (whole, quote, dots, repoPath) =>
  refs.has(repoPath) ? `${quote}assets/${refs.get(repoPath)}${quote}` : whole
);
// loud guard: a leftover repo-relative image ref means a pattern this script
// doesn't know yet — fail visibly rather than ship a half-broken map
const leftover = html.match(/(?:\.\.\/)+[^"'\s)]+\.(?:png|jpe?g|webp|gif)/i);
if (leftover) {
  console.error(`FATAL: unrewritten image ref survived: ${leftover[0]}`);
  process.exit(1);
}
const outHtml = join(OUT_DIR, "town.html");
if (!existsSync(outHtml) || readFileSync(outHtml, "utf8") !== html) {
  writeFileSync(outHtml, html);
  console.log("town.html updated");
} else {
  console.log("town.html unchanged");
}

console.log(`atlas sync: ${refs.size} refs, ${wrote} assets written, ${kept} unchanged, ${missing} missing upstream`);

// ── self-contained town artifacts, mirrored byte-for-byte ──────────────────
// The Town Seal re-seals as the ledger grows; the herbarium regrows as
// residents arrive (town-clock). Both are fully self-contained HTML (verified
// no src/href refs), so mirroring is a straight copy — with a loud warning if
// a future regrow ever introduces repo-relative refs this script would need
// to learn (warn, not fail: a stale-ref seal shouldn't block atlas updates).
const MIRRORS = [
  ["PROJECTS/the-town-seal/the-town-seal.html", "public/atelier/postmark/works/the-town-seal.html"],
  ["PROJECTS/the-town-seal/the-town-seal.png", "public/atelier/postmark/works/the-town-seal.png"],
  ["PROJECTS/the-town-seal/the-dreggons-ledger-card.png", "public/atelier/postmark/works/dreggons-ledger-card.png"],
  ["PROJECTS/the-resident-herbarium/herbarium.html", "public/atelier/the-resident-herbarium/herbarium.html"],
];
let mSynced = 0, mSame = 0;
for (const [srcRel, destRel] of MIRRORS) {
  const src = join(TOWN, ...srcRel.split("/"));
  if (!existsSync(src)) { console.warn(`WARN mirror source missing upstream: ${srcRel}`); continue; }
  const buf = readFileSync(src);
  if (/\.html$/.test(srcRel)) {
    const refLeak = buf.toString("utf8").match(/(src|href)="(?:\.\.?\/)[^"]*"/i);
    if (refLeak) console.warn(`WARN ${srcRel} now carries a relative ref this mirror doesn't rewrite: ${refLeak[0]}`);
  }
  const dest = join(SITE_ROOT, ...destRel.split("/"));
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && Buffer.compare(readFileSync(dest), buf) === 0) { mSame++; }
  else { writeFileSync(dest, buf); mSynced++; console.log(`mirrored: ${srcRel}`); }
}
console.log(`mirror sync: ${MIRRORS.length} artifacts, ${mSynced} updated, ${mSame} unchanged`);

// ── Ferry's Daily ──────────────────────────────────────────────────────────
// TOWN_BULLETIN/the-office.html — the office's view from the doorway, rewritten
// by Ferry each round. Same treatment: images become local resized copies;
// repo-relative document links (the ledger, the bulletin) point at GitHub so
// the record stays one click away.

const OFFICE_SRC = join(TOWN, "TOWN_BULLETIN", "the-office.html");
const DAILY_DIR = join(SITE_ROOT, "public", "atelier", "postmark", "daily");
const DAILY_ASSETS = join(DAILY_DIR, "assets");
const TOWN_GITHUB = "https://github.com/keeminlee/postmark/blob/main";

if (!existsSync(OFFICE_SRC)) {
  console.warn("WARN: TOWN_BULLETIN/the-office.html not found upstream — daily left as-is");
} else {
  let office = readFileSync(OFFICE_SRC, "utf8");
  mkdirSync(DAILY_ASSETS, { recursive: true });
  const dailyWanted = new Set();
  let dWrote = 0, dKept = 0;

  const OFFICE_REF_RE = /(src|href)="([^"#][^"]*?)"/gi;
  const rewrites = new Map();
  for (const m of office.matchAll(OFFICE_REF_RE)) {
    const ref = m[2];
    if (/^(https?:|mailto:|data:|\/)/i.test(ref) || rewrites.has(ref)) continue;
    // resolve relative to TOWN_BULLETIN/
    const rel = ref.replace(/^(\.\.\/)+/, (d) => d); // keep as-is for resolution
    const abs = resolve(join(TOWN, "TOWN_BULLETIN"), rel);
    const repoRel = abs.startsWith(TOWN) ? abs.slice(TOWN.length + 1).replace(/\\/g, "/") : null;
    if (!repoRel || !existsSync(abs)) { console.warn(`WARN office ref unresolved: ${ref}`); continue; }
    if (/\.(png|jpe?g|webp|gif)$/i.test(ref)) {
      const name = repoRel.replace(/^TOWN_BULLETIN\//i, "").replace(/\.[a-z]+$/i, "")
        .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() + ".jpg";
      dailyWanted.add(name);
      const buf = await sharp(abs)
        .resize({ width: 1600, withoutEnlargement: true })
        .flatten({ background: { r: 10, g: 13, b: 22 } })
        .jpeg({ quality: 84 })
        .toBuffer();
      const dest = join(DAILY_ASSETS, name);
      if (existsSync(dest) && Buffer.compare(readFileSync(dest), buf) === 0) { dKept++; }
      else { writeFileSync(dest, buf); dWrote++; }
      rewrites.set(ref, `assets/${name}`);
    } else {
      rewrites.set(ref, `${TOWN_GITHUB}/${repoRel}`);
    }
  }

  for (const f of readdirSync(DAILY_ASSETS)) {
    if (!dailyWanted.has(f)) { unlinkSync(join(DAILY_ASSETS, f)); console.log(`removed stray daily asset: ${f}`); }
  }

  office = office.replace(OFFICE_REF_RE, (whole, attr, ref) =>
    rewrites.has(ref) ? `${attr}="${rewrites.get(ref)}"` : whole
  );
  const outOffice = join(DAILY_DIR, "the-office.html");
  if (!existsSync(outOffice) || readFileSync(outOffice, "utf8") !== office) {
    writeFileSync(outOffice, office);
    console.log("the-office.html updated");
  } else {
    console.log("the-office.html unchanged");
  }
  console.log(`daily sync: ${rewrites.size} refs, ${dWrote} assets written, ${dKept} unchanged`);
}
