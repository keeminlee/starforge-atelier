// sync-renditions.mjs — pull approved resident-page renditions from a town
// checkout into the site. The town repo is the source of truth and the
// approval gate (a rendition exists on main = it was reviewed and merged);
// this only copies. Contract: PROJECTS/resident-page-renditions/README.md
// in the town repo (RESIDENT_DATA v1 — additive-only, forever).
//
//   node tools/sync-renditions.mjs --town <path-to-postmark-checkout>
//
// Writes: public/renditions/<author>.html  (the sandboxed iframe sources)
//         src/data/postmark/renditions.json (the picker index)

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function arg(name, fallback) { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : fallback; }
const TOWN = resolve(arg("--town", "G:/postmark/repo"));

const srcDir = join(TOWN, "PROJECTS", "resident-page-renditions");
// the town build's publicDir is public/atelier/postmark (astro.config.town.mjs)
// -> these serve at postmark.town/renditions/<author>.html
const outHtml = join(ROOT, "public", "atelier", "postmark", "renditions");
const outIndex = join(ROOT, "src", "data", "postmark", "renditions.json");

const index = [];
const skipped = [];
if (existsSync(srcDir)) {
  for (const e of readdirSync(srcDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const author = e.name;
    if (author === author.toUpperCase()) continue; // STARTER etc. — infrastructure, not submissions
    const html = join(srcDir, author, "rendition.html");
    const meta = join(srcDir, author, "rendition.md");
    // Say so out loud. A submission folder that merged but is missing its
    // rendition.html is a resident whose approved work will never appear, and
    // a silent `continue` here reports success while dropping them — the same
    // failure class as the pipeline this script sits in (keeminlee/postmark#603).
    // Warn rather than throw: one malformed folder must not block the others.
    if (!existsSync(html)) {
      console.warn(`renditions: WARN ${author}/ has no rendition.html — skipped, so it will NOT appear on the site`);
      skipped.push(author);
      continue;
    }
    let title = author, line = "";
    if (existsSync(meta)) {
      const raw = readFileSync(meta, "utf8").replace(/\r\n/g, "\n");
      title = /^title:\s*(.+)$/m.exec(raw)?.[1]?.trim() ?? author;
      line = raw.split(/^---$/m)[2]?.trim().split("\n")[0] ?? "";
    }
    mkdirSync(outHtml, { recursive: true });
    copyFileSync(html, join(outHtml, `${author}.html`));
    const hash = createHash("sha1").update(readFileSync(html)).digest("hex").slice(0, 10);
    index.push({ author, title, line, hash });
  }
}
index.sort((a, b) => a.author.localeCompare(b.author));
mkdirSync(dirname(outIndex), { recursive: true });
writeFileSync(outIndex, JSON.stringify(index, null, 2) + "\n");
console.log(`renditions: synced ${index.length} — ${index.map((r) => r.author).join(", ") || "(none)"}` + (skipped.length ? `  ·  SKIPPED ${skipped.length}: ${skipped.join(", ")}` : ""));
