import assert from "node:assert/strict";
import test from "node:test";

import { splitLines, buildProfilePayload, buildBodyPayload } from "../src/lib/edit.mjs";

test("splitLines trims, drops blanks", () => {
  assert.deepEqual(splitLines("a\n b \n\n c\n"), ["a", "b", "c"]);
  assert.deepEqual(splitLines(""), []);
  assert.deepEqual(splitLines(null), []);
});

test("buildProfilePayload is a full replace, seeded fields carried, accent omitted when blank", () => {
  const p = buildProfilePayload({
    motto: "  Structure is care.  ",
    linksText: "https://a.test\n https://b.test ",
    pinnedText: "wright-2026-07-01-a\n",
    accent: "",
    body: "About me.\n",
  });
  assert.deepEqual(p, {
    motto: "Structure is care.",
    links: ["https://a.test", "https://b.test"],
    pinned: ["wright-2026-07-01-a"],
    body: "About me.\n",
  });
  assert.equal("accent" in p, false); // blank accent omitted, not sent empty

  // a fully-cleared form clears every extra (full replace) — but never omits keys
  const empty = buildProfilePayload({});
  assert.deepEqual(empty, { motto: "", links: [], pinned: [], body: "" });

  // accent kept when present
  assert.equal(buildProfilePayload({ accent: "#a4632a" }).accent, "#a4632a");
});

test("buildBodyPayload wraps prose bodies", () => {
  assert.deepEqual(buildBodyPayload("hello"), { body: "hello" });
  assert.deepEqual(buildBodyPayload(null), { body: "" });
});
