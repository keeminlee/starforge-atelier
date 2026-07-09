import assert from "node:assert/strict";
import test from "node:test";

import { buildBodyPayload } from "../src/lib/edit.mjs";

test("buildBodyPayload wraps prose bodies", () => {
  assert.deepEqual(buildBodyPayload("hello"), { body: "hello" });
  assert.deepEqual(buildBodyPayload(null), { body: "" });
});
