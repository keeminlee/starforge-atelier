// /sitemap.xml: built at build time, with no package (lanes don't add dependencies).
//
// It lists:
//   - every Astro page in src/pages (the import.meta.glob below), as its
//     trailing-slash URL;
//   - the two static encyclopedias in public/atlas/ and
//     public/atlas-of-algorithms/: each folder holding an index.html, plus each
//     top-level .html page (about, colophon, glossary...).
//
// It leaves out, and logs each one it leaves out (console.warn at build):
//   - any page that opts out with `noindex`. For an Astro page, that's read
//     from the props of its <BaseLayout ...> opening tag, never from comments or
//     prose; for a static page, it's a robots meta tag outside HTML comments;
//   - everything under /atelier/postmark/ except the pointer card
//     /atelier/postmark/ itself, because the box 301s the rest to postmark.town;
//   - the raw exhibit artifacts (public/atelier/<slug>/*.html, Voussoir's
//     game/*.html), since each exhibit's page is its canonical entry. The walk
//     below never enters public/atelier/ at all; the final filter re-checks.
//
// Why props and not the built HTML: this endpoint renders in the same prerender
// pass as the pages, so their built HTML isn't there to read.
//
// No <lastmod>: no honest per-page date is available at build, so none is
// invented.
import type { APIRoute } from 'astro';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const prerender = true;

// The static encyclopedias under public/ (the only part of public/ walked).
const STATIC_ROOTS = ['atlas', 'atlas-of-algorithms'];

const POSTMARK_POINTER = '/atelier/postmark/';

// A robots meta tag carrying noindex (searched only after comments are stripped).
const META_NOINDEX = /<meta\b[^>]*\bname\s*=\s*["']?robots["']?[^>]*\bnoindex\b/i;

const warn = (msg: string) => console.warn(`[sitemap] ${msg}`);

// --- Reading a page's noindex --------------------------------------------------

const stripFrontmatter = (src: string) =>
  src.replace(/^﻿?\s*---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/, '');
const stripHtmlComments = (src: string) => src.replace(/<!--[\s\S]*?-->/g, '');
// Template comments: <!-- ... --> and {/* ... */}.
const stripTemplateComments = (src: string) =>
  stripHtmlComments(src).replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

type AttrValue = true | { quoted: string } | { expr: string };
type Attr = { name: string; value: AttrValue };

// The attributes of the first <tag ...> opening tag, read token by token so a
// quoted value or a {...} expression (which may hold `>`, `=` or the word
// "noindex") is never taken for an attribute. null when there is no such tag.
function openingTagAttrs(src: string, tag: string): Attr[] | null {
  const open = new RegExp(`<${tag}(?=[\\s/>])`).exec(src);
  if (!open) return null;
  let i = open.index + open[0].length;
  const n = src.length;
  const attrs: Attr[] = [];
  const skipWs = () => {
    while (i < n && /\s/.test(src[i])) i++;
  };
  const readBraced = (): string => {
    const start = i;
    let depth = 0;
    let quote: string | null = null;
    for (; i < n; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        i++;
        return src.slice(start + 1, i - 1);
      }
    }
    throw new Error(`unterminated {...} in <${tag}>`);
  };
  const name = /[^\s=>/{]+/y;
  const bare = /[^\s>]+/y;
  while (i < n) {
    skipWs();
    if (src[i] === '>' || src.startsWith('/>', i)) return attrs;
    if (src[i] === '{') {
      attrs.push({ name: '{spread}', value: { expr: readBraced() } });
      continue;
    }
    name.lastIndex = i;
    const nm = name.exec(src);
    if (!nm) throw new Error(`can't read an attribute of <${tag}> at ${i}`);
    i += nm[0].length;
    skipWs();
    if (src[i] !== '=') {
      attrs.push({ name: nm[0], value: true });
      continue;
    }
    i++;
    skipWs();
    const c = src[i];
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new Error(`unterminated ${c} in <${tag}>`);
      attrs.push({ name: nm[0], value: { quoted: src.slice(i + 1, end) } });
      i = end + 1;
    } else if (c === '{') {
      attrs.push({ name: nm[0], value: { expr: readBraced() } });
    } else {
      bare.lastIndex = i;
      const v = bare.exec(src);
      attrs.push({ name: nm[0], value: { quoted: v ? v[0] : '' } });
      i += v ? v[0].length : 0;
    }
  }
  throw new Error(`unterminated <${tag}> opening tag`);
}

export type NoindexVerdict = { noindex: boolean; reason: string };

// Does this .astro page opt out of indexing? Decided by BaseLayout's `noindex`
// prop as BaseLayout reads it (`{noindex && <meta ...>}`), or a robots meta tag
// in the template. Frontmatter and comments never count.
export function pageNoindex(source: string): NoindexVerdict {
  const template = stripTemplateComments(stripFrontmatter(source));
  const attrs = openingTagAttrs(template, 'BaseLayout');
  const prop = attrs?.find((a) => a.name === 'noindex');
  if (prop) {
    const v = prop.value;
    if (v === true) return { noindex: true, reason: 'BaseLayout noindex' };
    if ('quoted' in v) return { noindex: v.quoted !== '', reason: `BaseLayout noindex="${v.quoted}"` };
    const e = v.expr.trim();
    if (e === 'true' || e === 'false') return { noindex: e === 'true', reason: `BaseLayout noindex={${e}}` };
    // An expression can't be evaluated here; a noindex page in a sitemap is the
    // worse mistake, so it's left out, and the warning says so.
    return { noindex: true, reason: `BaseLayout noindex={${e}} can't be read at build, so it's left out to be safe` };
  }
  if (META_NOINDEX.test(template)) return { noindex: true, reason: 'a robots noindex meta tag in the template' };
  if (attrs?.some((a) => a.name === '{spread}')) {
    return { noindex: false, reason: "BaseLayout takes a {...spread}; a noindex inside it can't be seen" };
  }
  return { noindex: false, reason: '' };
}

// --- The two sources of URLs -----------------------------------------------------

export function astroRoute(file: string): string | null {
  // './atelier/index.astro' -> '/atelier/'; './stars/wright/works.astro' -> '/stars/wright/works/'
  const rel = file.replace(/^\.\//, '').replace(/\.astro$/, '');
  const parts = rel.split('/');
  // Astro doesn't route files or folders that start with an underscore.
  if (parts.some((p) => p.startsWith('_'))) return null;
  if (parts.some((p) => p.includes('['))) {
    warn(`left out ${file}: a dynamic route; list its paths here by hand`);
    return null;
  }
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts.length ? `/${parts.join('/')}/` : '/';
}

function astroUrls(): string[] {
  // Page sources, read raw so a page's `noindex` can be seen without rendering it.
  // (The glob sits inside the function so the helpers above can be imported in
  // plain node for testing.)
  const pages = import.meta.glob<string>('./**/*.astro', { query: '?raw', import: 'default', eager: true });
  const out: string[] = [];
  for (const [file, source] of Object.entries(pages)) {
    const route = astroRoute(file);
    if (!route) continue;
    const verdict = pageNoindex(source);
    if (verdict.noindex) warn(`left out ${route} (${file}): ${verdict.reason}`);
    else {
      if (verdict.reason) warn(`listed ${route} (${file}), but ${verdict.reason}`);
      out.push(route);
    }
  }
  return out;
}

function staticIndexable(file: string, url: string): boolean {
  if (!META_NOINDEX.test(stripHtmlComments(readFileSync(file, 'utf8')))) return true;
  warn(`left out ${url}: a robots noindex meta tag`);
  return false;
}

export function staticUrls(): string[] {
  const publicDir = resolve(process.cwd(), 'public');
  if (!existsSync(publicDir)) {
    throw new Error(`[sitemap] no public/ at ${publicDir}: the build isn't running from the site root`);
  }
  const out: string[] = [];
  for (const root of STATIC_ROOTS) {
    const rootDir = join(publicDir, root);
    if (!existsSync(rootDir)) {
      throw new Error(`[sitemap] public/${root}/ is missing: retire it from STATIC_ROOTS on purpose, or restore it`);
    }
    // The root's own top-level pages: index.html is the folder URL, the rest keep .html.
    for (const name of readdirSync(rootDir)) {
      const file = join(rootDir, name);
      if (!name.endsWith('.html') || !statSync(file).isFile()) continue;
      const url = name === 'index.html' ? `/${root}/` : `/${root}/${name}`;
      if (staticIndexable(file, url)) out.push(url);
    }
    // Every folder below the root that holds an index.html (the entries).
    const walk = (dir: string, urlPath: string) => {
      for (const name of readdirSync(dir)) {
        const sub = join(dir, name);
        if (!statSync(sub).isDirectory()) continue;
        const subUrl = `${urlPath}${name}/`;
        const index = join(sub, 'index.html');
        if (existsSync(index) && staticIndexable(index, subUrl)) out.push(subUrl);
        walk(sub, subUrl);
      }
    };
    walk(rootDir, `/${root}/`);
  }
  return out;
}

function listed(path: string): boolean {
  if (path.startsWith(POSTMARK_POINTER) && path !== POSTMARK_POINTER) {
    warn(`left out ${path}: under /atelier/postmark/, which the box 301s to postmark.town`);
    return false;
  }
  if (path.startsWith('/atelier/') && path.endsWith('.html')) {
    warn(`left out ${path}: a raw exhibit artifact; its exhibit page is the entry`);
    return false;
  }
  return true;
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('[sitemap] `site` is not set in astro.config.mjs');
  const paths = [...new Set([...astroUrls(), ...staticUrls()])].filter(listed).sort();
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${escapeXml(new URL(p, site).href)}</loc></url>\n`).join('') +
    '</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
