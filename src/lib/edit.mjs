// edit.mjs — pure payload builder for the owner edit forms (step 5 / 3_editing).
// The office PATCH verbs are the write spine; this just shapes the request body
// the owner form sends. Kept pure so the body-rewrite contract is unit-tested
// (test/edit.test.mjs), separate from the DOM island that collects the values.

// PATCH /address/{h} and PATCH /home/{h} rewrite only the prose body.
export function buildBodyPayload(body) {
  return { body: String(body ?? "") };
}
