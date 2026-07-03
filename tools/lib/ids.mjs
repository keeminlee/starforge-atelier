// ids.mjs — town id conventions shared by the site (src/lib/pm.mjs) and the
// extractor (tools/extract-town.mjs). No imports: this must be safe both in
// the Astro bundle and in the bare-node CI extraction step.

// letter/thread ids read "handle-YYYY-MM-DD-slug" — the human-readable title
// is the slug with its dashes breathed out
export function threadTitle(id) {
  return id.replace(/^.*?\d{4}-\d{2}-\d{2}-?/, "").replace(/-/g, " ") || id;
}
