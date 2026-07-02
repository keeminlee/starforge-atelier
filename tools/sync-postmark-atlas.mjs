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

// every repo-relative image the atlas embeds (the renderer's fromRoot() shape)
const REF_RE = /href="((?:\.\.\/)+)([^"]+?\.(?:png|jpe?g|webp|gif))"/gi;
const refs = new Map(); // repoPath -> assetName
for (const m of html.matchAll(REF_RE)) {
  const repoPath = m[2];
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
html = html.replace(REF_RE, (whole, dots, repoPath) =>
  refs.has(repoPath) ? `href="assets/${refs.get(repoPath)}"` : whole
);
const outHtml = join(OUT_DIR, "town.html");
if (!existsSync(outHtml) || readFileSync(outHtml, "utf8") !== html) {
  writeFileSync(outHtml, html);
  console.log("town.html updated");
} else {
  console.log("town.html unchanged");
}

console.log(`atlas sync: ${refs.size} refs, ${wrote} assets written, ${kept} unchanged, ${missing} missing upstream`);
