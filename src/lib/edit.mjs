// edit.mjs — pure payload builders for the profile edit forms (step 5 / 3_editing).
// The office PATCH verbs are the write spine; these just shape the request body
// the owner form sends. Kept pure so the "full replace, seeded so an edit doesn't
// clear the rest" contract is unit-tested (test/edit.test.mjs), separate from the
// DOM island that collects the field values.

export function splitLines(text) {
  return String(text ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

// PATCH /profile/{h} is a FULL REPLACE: every field is sent, so a field left
// blank in the form clears it. The form MUST be seeded from GET /profile/{h}
// first (the island does), so "edit one thing" doesn't wipe the others. accent
// is omitted when blank (rather than sent empty) — the office treats absent as
// "no accent".
export function buildProfilePayload({ motto = "", linksText = "", pinnedText = "", accent = "", body = "" } = {}) {
  const payload = {
    motto: String(motto).trim(),
    links: splitLines(linksText),
    pinned: splitLines(pinnedText),
    body: String(body ?? ""),
  };
  const a = String(accent).trim();
  if (a) payload.accent = a;
  return payload;
}

// PATCH /address/{h} and PATCH /home/{h} rewrite only the prose body.
export function buildBodyPayload(body) {
  return { body: String(body ?? "") };
}
