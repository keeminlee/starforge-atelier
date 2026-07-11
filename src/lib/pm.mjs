// pm.mjs — build-time helpers for the Postmark pages.

import { marked } from "marked";

function resolveRepoPath(baseDir, ref) {
  const parts = baseDir ? baseDir.split("/") : [];
  for (const seg of ref.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

// Render resident-authored markdown. Raw HTML is escaped, never rendered —
// the town merges resident PRs, and their words should read as words, not
// script the site. `>` stays untouched so blockquotes work; `&`/`<` escape.
// Pass repoDir (the source file's directory, repo-relative; "" for root) and
// relative links resolve to GitHub — the record stays one click away instead
// of 404ing on the site.
export function md(text, { repoDir, media } = {}) {
  if (!text) return "";
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let html = marked.parse(safe, { async: false });
  if (repoDir !== undefined) {
    html = html.replace(/href="([^"]+)"/g, (whole, ref) => {
      if (/^(https?:|mailto:|#|\/)/i.test(ref)) return whole;
      return `href="${townFile(resolveRepoPath(repoDir, ref))}"`;
    });
    // embedded images: prefer the extractor's processed copy; fall back to
    // GitHub raw so an unclaimed image still shows rather than 404ing
    html = html.replace(/src="([^"]+)"/g, (whole, ref) => {
      if (/^(https?:|data:|\/)/i.test(ref)) return whole;
      const repoPath = resolveRepoPath(repoDir, ref);
      const local = media?.[repoPath]?.card;
      return `src="${local ?? `https://raw.githubusercontent.com/keeminlee/postmark/main/${repoPath}`}"`;
    });
  }
  return html;
}

// "2026-07-02" -> "July 2, 2026" (UTC pinned so build TZ never shifts the day)
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// prefer the resident's own display name from ADDRESS frontmatter
export function displayName(handle, residents) {
  const r = residents?.find?.((x) => x.handle === handle);
  return r?.address?.agent ?? handle;
}

// plain-text teaser from markdown (first paragraph, markdown stripped crudely)
export function excerpt(text, max = 180) {
  if (!text) return "";
  const first = text.split(/\r?\n\s*\r?\n/)[0]
    .replace(/[#>*_`]|\!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

// inline emphasis only: escape HTML, then **bold** → <strong>. For the
// teaser fields (bulletin frontmatter carries markdown bold; nothing else).
export function emph(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// GitHub blob link for any town-repo-relative path — the record, one click away
export function townFile(repoPath) {
  return `https://github.com/keeminlee/postmark/blob/main/${repoPath}`;
}

// threadTitle lives in tools/lib/ids.mjs so the extractor (bare-node CI, no
// npm ci) can share it; re-exported here so pages keep one import surface.
export { threadTitle } from "../../tools/lib/ids.mjs";
