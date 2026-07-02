// pm.mjs — build-time helpers for the Postmark pages.

import { marked } from "marked";

// Render resident-authored markdown. Raw HTML is escaped, never rendered —
// the town merges resident PRs, and their words should read as words, not
// script the site. `>` stays untouched so blockquotes work; `&`/`<` escape.
export function md(text) {
  if (!text) return "";
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return marked.parse(safe, { async: false });
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

// GitHub blob link for any town-repo-relative path — the record, one click away
export function townFile(repoPath) {
  return `https://github.com/keeminlee/postmark/blob/main/${repoPath}`;
}
