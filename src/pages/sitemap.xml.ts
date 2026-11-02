// /sitemap.xml: built at build time, with no package (lanes don't add dependencies).
//
// It lists:
//   - every Astro page in src/pages (the import.meta.glob below), as its
//     trailing-slash URL;
//   - the two static encyclopedias in public/atlas/ and
//     public/atlas-of-algorithms/: each folder holding an index.html, plus each
//     top-level .html page (about, colophon, glossary...).
//
// It leaves out:
//   - any page that opts out with `noindex` (BaseLayout's prop, or a robots
//     meta tag in a static page);
//   - everything under /atelier/postmark/ except the pointer card
//     /atelier/postmark/ itself, because the box 301s the rest to postmark.town;
//   - the raw exhibit artifacts (public/atelier/<slug>/*.html, Voussoir's
//     game/*.html), since each exhibit's page is its canonical entry. The walk
//     below never enters public/atelier/ at all; the final filter re-checks.
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

// `noindex` passed to a layout (`noindex`, `noindex={true}`), not `noindex={false}`.
const ASTRO_NOINDEX = /\bnoindex\b(?!\s*=\s*\{\s*false\s*\})/;
// A robots meta tag carrying noindex, in a static page.
const HTML_NOINDEX = /<meta\b[^>]*\bname\s*=\s*["']?robots["']?[^>]*\bnoindex\b/i;

// Page sources, read raw so a page's `noindex` can be seen without rendering it.
const astroPages = import.meta.glob<string>('./**/*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function astroRoute(file: string): string | null {
  // './atelier/index.astro' -> '/atelier/'; './stars/wright/works.astro' -> '/stars/wright/works/'
  const rel = file.replace(/^\.\//, '').replace(/\.astro$/, '');
  const parts = rel.split('/');
  // Astro doesn't route files or folders that start with an underscore.
  if (parts.some((p) => p.startsWith('_'))) return null;
  if (parts.some((p) => p.includes('['))) {
    console.warn(`[sitemap] skipping dynamic route ${file}: list its paths here by hand`);
    return null;
  }
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts.length ? `/${parts.join('/')}/` : '/';
}

function astroUrls(): string[] {
  const out: string[] = [];
  for (const [file, source] of Object.entries(astroPages)) {
    const route = astroRoute(file);
    if (route && !ASTRO_NOINDEX.test(source)) out.push(route);
  }
  return out;
}

function indexable(file: string): boolean {
  return !HTML_NOINDEX.test(readFileSync(file, 'utf8'));
}

function staticUrls(): string[] {
  const publicDir = resolve(process.cwd(), 'public');
  if (!existsSync(publicDir)) {
    throw new Error(`[sitemap] no public/ at ${publicDir}: the build isn't running from the site root`);
  }
  const out: string[] = [];
  for (const root of STATIC_ROOTS) {
    const rootDir = join(publicDir, root);
    if (!existsSync(rootDir)) {
      console.warn(`[sitemap] public/${root}/ is missing; its pages are not listed`);
      continue;
    }
    // The root's own top-level pages: index.html is the folder URL, the rest keep .html.
    for (const name of readdirSync(rootDir)) {
      const file = join(rootDir, name);
      if (!name.endsWith('.html') || !statSync(file).isFile() || !indexable(file)) continue;
      out.push(name === 'index.html' ? `/${root}/` : `/${root}/${name}`);
    }
    // Every folder below the root that holds an index.html (the entries).
    const walk = (dir: string, urlPath: string) => {
      for (const name of readdirSync(dir)) {
        const sub = join(dir, name);
        if (!statSync(sub).isDirectory()) continue;
        const subUrl = `${urlPath}${name}/`;
        const index = join(sub, 'index.html');
        if (existsSync(index) && indexable(index)) out.push(subUrl);
        walk(sub, subUrl);
      }
    };
    walk(rootDir, `/${root}/`);
  }
  return out;
}

function listed(path: string): boolean {
  if (path.startsWith(POSTMARK_POINTER)) return path === POSTMARK_POINTER;
  // Raw artifacts under an exhibit (/atelier/<slug>/...html) are never listed.
  if (path.startsWith('/atelier/') && path.endsWith('.html')) return false;
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
