// images.mjs — the ONE image pipeline for town assets.
//
// Unifies the three resize-and-rewrite implementations that grew during v1
// (atlas assets @420w, daily assets @1600w, home images done by hand): every
// caller now goes through processImage() with a width preset, and every
// output directory is reconciled with ownDir() so stray assets from earlier
// syncs never linger.
//
// Idempotent: byte-compares before writing, so an unchanged source is a
// no-op and CI only commits real changes. Deterministic for a given source
// + pinned sharp version.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

// the town's night background — transparent PNGs flatten onto this
export const NIGHT_BG = { r: 10, g: 13, b: 22 };

export const PRESETS = {
  thumb: { width: 420, quality: 84 },   // atlas map cells, card thumbnails
  card: { width: 900, quality: 84 },    // resident/works cards
  full: { width: 1600, quality: 84 },   // lightbox / daily / hero-scale
};

// canonical asset name from a town-repo-relative path:
//   WHITE_PAGES/wright/HOME/the-trueing-house.png -> wright-the-trueing-house.jpg
export function assetName(repoPath, { suffix = "" } = {}) {
  return (
    repoPath
      .replace(/^WHITE_PAGES\//i, "")
      .replace(/^PROJECTS\//i, "")
      .replace(/^TOWN_BULLETIN\//i, "")
      .replace(/^MEEPS\//i, "")
      .replace(/\/HOME\//i, "/")
      .replace(/\.[a-z]+$/i, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() + suffix + ".jpg"
  );
}

// resize + flatten + jpeg, byte-compare write. Returns "wrote" | "kept".
export async function processImage(src, dest, { width, quality = 84, background = NIGHT_BG } = {}) {
  const buf = await sharp(src)
    .resize({ width, withoutEnlargement: true })
    .flatten({ background })
    .jpeg({ quality })
    .toBuffer();
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && Buffer.compare(readFileSync(dest), buf) === 0) return "kept";
  writeFileSync(dest, buf);
  return "wrote";
}

// remove anything in dir that the current extraction didn't claim.
// Returns the removed names (callers log them — no silent truncation).
export function ownDir(dir, wantedNames) {
  if (!existsSync(dir)) return [];
  const removed = [];
  for (const f of readdirSync(dir)) {
    if (!wantedNames.has(f)) {
      unlinkSync(join(dir, f));
      removed.push(f);
    }
  }
  return removed;
}
