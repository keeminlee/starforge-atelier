// build-index.mjs — the bundler for the reader-facing render.
//
//   node build-index.mjs
//
// index.html must run on file:// with NO server and NO external anything, so
// ES-module imports across files (which the browser blocks under file:// CORS)
// are not an option. This builder concatenates the machine's modules — in
// dependency order — into a single inline <script>, stripping their import /
// export lines, and injects that bundle into index.template.html at the marker
//
//     /*__RENGA_BUNDLE__*/
//
// It then writes index.html AND self-checks by evaluating the written file's
// actual <script> body in a headless sandbox and generating one kasen, so a
// broken bundle fails the build instead of failing silently in someone's browser.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), 'utf8');

// Dependency order: each module may reference names defined by an earlier one.
//   syllables (no deps) -> rules (no deps) -> verse-bank (needs countLine)
//   -> validate (needs countLine + rules) -> generate (needs all of the above)
const MODULE_FILES = [
  'data/syllables.js',
  'src/rules.js',
  'data/verse-bank.js',
  'src/validate.js',
  'src/generate.js',
];

// Turn an ES module into plain in-scope script text:
//  - drop `import ... from '...';`   (single- or multi-line)
//  - drop bare `export { ... };`
//  - drop `export default X;`
//  - `export const|let|var|function|class|async ...` -> the bare declaration
function stripModule(src) {
  return src
    .replace(/^[ \t]*import\s+[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
    .replace(/^[ \t]*export\s*\{[\s\S]*?\};?[ \t]*$/gm, '')
    .replace(/^[ \t]*export\s+default\s+[^;]+;?[ \t]*$/gm, '')
    .replace(/^([ \t]*)export\s+(const|let|var|function|class|async)\b/gm, '$1$2');
}

function buildBundle() {
  const parts = [];
  for (const f of MODULE_FILES) {
    parts.push(`// ===== bundled from ${f} =====`);
    parts.push(stripModule(read(f)).trim());
    parts.push('');
  }
  return parts.join('\n');
}

function main() {
  const bundle = buildBundle();
  const template = read('index.template.html');
  if (!template.includes('/*__RENGA_BUNDLE__*/')) {
    throw new Error('index.template.html is missing the /*__RENGA_BUNDLE__*/ marker');
  }
  const html = template.replace('/*__RENGA_BUNDLE__*/', () => bundle);
  writeFileSync(join(HERE, 'index.html'), html, 'utf8');

  // --- headless sanity: run the WRITTEN file's actual <script> body ----------
  const written = read('index.html');
  const m = written.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('sanity: could not find a <script> block in index.html');
  const scriptBody = m[1];

  // A sandbox with no `document` -> the page's DOM bootstrap is skipped; the
  // IIFE still exposes its internals on globalThis.__RENGA__ for the check.
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptBody, sandbox, { filename: 'index.html:script' });

  const api = sandbox.__RENGA__;
  if (!api || typeof api.generateKasen !== 'function') {
    throw new Error('sanity: index.html script did not expose generateKasen');
  }
  const result = api.generateKasen(7);
  const check = api.validateKasen(result.kasen);
  const lines = result.kasen.reduce((n, v) => n + v.lines.length, 0);
  if (!result.ok || !check.ok) {
    throw new Error('sanity: generated kasen did NOT pass validation — build is not shippable');
  }

  console.log('build-index: wrote index.html');
  console.log(`  bundle: ${bundle.length} chars from ${MODULE_FILES.length} modules`);
  console.log('  headless sanity: evaluated the written <script> body, no throw');
  console.log(`  generated seed=7 kasen: ${result.kasen.length} verses, ${lines} lines`);
  console.log(`  independent validateKasen: ok=${check.ok}, violations=${check.violations.length}, warnings=${check.warnings.length}`);
  console.log(`  link rate: ${result.stats.linked}/${result.stats.linkable}  exact lines: ${result.stats.exactLines}/${result.stats.totalLines}`);
}

main();
