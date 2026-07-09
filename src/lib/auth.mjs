// auth.mjs — the site's OAuth 2.0 public-client (PKCE) helpers for signing in
// to the office AS. Same dance the MCP connectors do: RFC 7591 dynamic
// registration, authorization-code + PKCE S256, opaque tokens held browser-side
// against the same-origin /api. The crypto + fetch live in the login island;
// this module is the pure, testable surface (URL build + callback parse +
// storage keys), shared and unit-tested.

export const OFFICE = "https://postmark.town/api";

// browser-side storage keys (localStorage token, sessionStorage transient PKCE)
export const KEYS = {
  token: "pm.oauth.token",       // { access_token, refresh_token, obtained, expires_in }
  client: "pm.oauth.client_id",  // cached RFC 7591 registration
  verifier: "pm.oauth.verifier", // sessionStorage, one sign-in attempt
  state: "pm.oauth.state",       // sessionStorage, CSRF check
  returnTo: "pm.oauth.return_to",
};

export const AS = {
  authorize: `${OFFICE}/oauth/authorize`,
  token: `${OFFICE}/oauth/token`,
  register: `${OFFICE}/oauth/register`,
  // whoami: the office maps GitHub-id -> household -> handles internally on every
  // request but exposes no identity read yet (see YELLOW). The island probes this
  // and degrades to a generic signed-in state until it lands.
  me: `${OFFICE}/me`,
};

// Build the /oauth/authorize redirect URL for the PKCE code flow.
export function buildAuthorizeUrl({ authorizeEndpoint = AS.authorize, clientId, redirectUri, codeChallenge, state, scope }) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  if (scope) p.set("scope", scope);
  return `${authorizeEndpoint}?${p.toString()}`;
}

// Pull { code, state } from a callback URL's query string; null if not a callback.
export function parseCallback(search) {
  const p = new URLSearchParams((search || "").replace(/^\?/, ""));
  const code = p.get("code");
  const state = p.get("state");
  if (!code || !state) return null;
  return { code, state, error: p.get("error") || null };
}

// A stored token is usable if present and not past its access lifetime.
export function tokenIsFresh(tok, nowMs = Date.now()) {
  if (!tok || !tok.access_token) return false;
  if (!tok.obtained || !tok.expires_in) return true; // no expiry info -> assume usable, server is the judge
  return nowMs < tok.obtained + tok.expires_in * 1000;
}
