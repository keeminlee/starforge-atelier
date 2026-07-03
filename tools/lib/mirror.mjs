// mirror.mjs — ref-rewriting + byte-mirroring helpers for town artifacts.
//
// Self-contained town HTML (the seal, the herbarium) mirrors byte-for-byte;
// HTML that references repo-relative paths (the atlas, Ferry's Daily) gets
// its refs rewritten — images to local processed copies, documents to GitHub
// blob URLs so the record stays one click away. These helpers are the single
// implementation of both patterns.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export const TOWN_GITHUB = "https://github.com/keeminlee/postmark/blob/main";

// any quoted repo-relative image ref — matches both SVG href="..." attributes
// and JS data blobs ("image":"../../../...") in generated town HTML
export const QUOTED_IMAGE_REF_RE = /(["'])((?:\.\.\/)+)([^"']+?\.(?:png|jpe?g|webp|gif))\1/gi;

// any src/href attribute value (for document-style HTML like the office)
export const ATTR_REF_RE = /(src|href)="([^"#][^"]*?)"/gi;

export function githubUrl(repoRelPath) {
  return `${TOWN_GITHUB}/${repoRelPath}`;
}

// byte-compare copy. Returns "wrote" | "kept" | "missing".
export function byteMirror(src, dest) {
  if (!existsSync(src)) return "missing";
  const buf = readFileSync(src);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && Buffer.compare(readFileSync(dest), buf) === 0) return "kept";
  writeFileSync(dest, buf);
  return "wrote";
}

// does this HTML still carry a repo-relative image ref? (the fail-loud guard
// callers run AFTER rewriting — a leftover means a pattern the extractor
// doesn't know yet, and shipping it would mean broken images on the site)
export function findLeftoverImageRef(html) {
  const m = html.match(/(?:\.\.\/)+[^"'\s)]+\.(?:png|jpe?g|webp|gif)/i);
  return m ? m[0] : null;
}

// self-contained check for byte-mirrored HTML: warn if a regrow ever
// introduces relative refs this mirror doesn't rewrite
export function findRelativeRef(html) {
  const m = html.match(/(src|href)="(?:\.\.?\/)[^"]*"/i);
  return m ? m[0] : null;
}

// write text iff changed. Returns "wrote" | "kept".
export function writeIfChanged(path, text) {
  if (existsSync(path) && readFileSync(path, "utf8") === text) return "kept";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return "wrote";
}
