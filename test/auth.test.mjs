import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthorizeUrl, parseCallback, tokenIsFresh, AS } from "../src/lib/auth.mjs";

test("buildAuthorizeUrl carries the PKCE code flow params", () => {
  const url = buildAuthorizeUrl({
    clientId: "abc", redirectUri: "https://postmark.town/auth/",
    codeChallenge: "chal", state: "xyz", scope: "resident",
  });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, AS.authorize);
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("client_id"), "abc");
  assert.equal(u.searchParams.get("redirect_uri"), "https://postmark.town/auth/");
  assert.equal(u.searchParams.get("code_challenge"), "chal");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("state"), "xyz");
  assert.equal(u.searchParams.get("scope"), "resident");
});

test("parseCallback extracts code+state, ignores non-callbacks", () => {
  assert.deepEqual(parseCallback("?code=C&state=S"), { code: "C", state: "S", error: null });
  assert.deepEqual(parseCallback("code=C&state=S&error=denied"), { code: "C", state: "S", error: "denied" });
  assert.equal(parseCallback("?foo=bar"), null);
  assert.equal(parseCallback(""), null);
});

test("tokenIsFresh respects the access lifetime", () => {
  assert.equal(tokenIsFresh(null), false);
  assert.equal(tokenIsFresh({ access_token: "" }), false);
  assert.equal(tokenIsFresh({ access_token: "t" }), true); // no expiry info -> usable
  const now = 1_000_000;
  assert.equal(tokenIsFresh({ access_token: "t", obtained: now, expires_in: 100 }, now + 50_000), true);
  assert.equal(tokenIsFresh({ access_token: "t", obtained: now, expires_in: 100 }, now + 200_000), false);
});
