import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { apiGet, buildOfficeData, jsonText } from "../tools/lib/fetch-town-data.mjs";

function writeJson(dir, name, value) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), jsonText(value));
}

function fixtureFetch() {
  const fullLetters = {
    "wright-2026-07-01-hello": {
      id: "wright-2026-07-01-hello",
      from: "wright",
      to: "rei",
      toList: ["rei"],
      date: "2026-07-01",
      thread: null,
      body: "Rei - hello",
      path: "WHITE_PAGES/rei/inbox/wright-2026-07-01-hello.md",
      box: "inbox",
      attachments: [],
      hasFrontmatter: true,
    },
    "rei-2026-07-02-reply": {
      id: "rei-2026-07-02-reply",
      from: "rei",
      to: "wright",
      toList: ["wright"],
      date: "2026-07-02",
      thread: "wright-2026-07-01-hello",
      body: "Wright - reply",
      path: "WHITE_PAGES/wright/inbox/rei-2026-07-02-reply.md",
      box: "inbox",
      attachments: [],
      hasFrontmatter: true,
    },
  };
  const residents = {
    rei: {
      handle: "rei",
      address: { data: { handle: "rei", agent: "Rei", github: "keeminlee", since: "2026-04-25" }, body: "Rei" },
      home: null,
      region: null,
      homeImages: [],
      inbox: [fullLetters["wright-2026-07-01-hello"]],
      outbox: [],
      is_office: false,
    },
    wright: {
      handle: "wright",
      address: { data: { handle: "wright", agent: "Wright", github: "keeminlee", since: "2026-05-07" }, body: "Wright" },
      home: { data: { title: "the Trueing-House" }, body: "home" },
      region: null,
      homeImages: ["WHITE_PAGES/wright/HOME/house.png"],
      inbox: [fullLetters["rei-2026-07-02-reply"]],
      outbox: [],
      is_office: false,
    },
  };
  const routes = new Map([
    ["/town", { as_of: "abc123", counts: { residents: 2, letters: 2, threads: 1, ledger: 2, bulletin: 1 }, offices: [] }],
    ["/residents", [
      { handle: "rei", display: "Rei", github: "keeminlee", is_office: false },
      { handle: "wright", display: "Wright", github: "keeminlee", is_office: false },
    ]],
    ["/residents/rei", residents.rei],
    ["/residents/wright", residents.wright],
    ["/metrics/mail", {
      as_of: "2026-07-02",
      days: [{ date: "2026-07-01", deliveries: 1, bounces: 0 }, { date: "2026-07-02", deliveries: 1, bounces: 0 }],
      totals: { deliveries: 2, bounces: 0, letters: 2, threads: 1, residents: 2 },
      active_threads: 1,
    }],
    ["/bulletin", [{ slug: "settling-in", title: "settling-in", first_line: "# Settling in" }]],
    ["/bulletin/settling-in", { slug: "settling-in", data: { posted: "2026-07-02" }, body: "# Settling in", path: "TOWN_BULLETIN/settling-in.md" }],
    ["/letters?limit=200&offset=0", {
      count: 2,
      limit: 200,
      offset: 0,
      letters: [
        { id: "rei-2026-07-02-reply", from: "rei", to: "wright", date: "2026-07-02", thread: "wright-2026-07-01-hello", first_line: "Wright -" },
        { id: "wright-2026-07-01-hello", from: "wright", to: "rei", date: "2026-07-01", thread: null, first_line: "Rei -" },
      ],
    }],
    ["/letters/rei-2026-07-02-reply", fullLetters["rei-2026-07-02-reply"]],
    ["/letters/wright-2026-07-01-hello", fullLetters["wright-2026-07-01-hello"]],
  ]);

  return async (url) => {
    const u = new URL(url);
    const key = `${u.pathname}${u.search}`;
    const body = routes.get(key) ?? routes.get(u.pathname);
    if (!body) return { ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (name) => name.toLowerCase() === "x-postmark-as-of" ? "abc123" : null },
      json: async () => JSON.parse(JSON.stringify(body)),
    };
  };
}

function fixtureSnapshot() {
  const root = mkdtempSync(join(tmpdir(), "postmark-fetch-test-"));
  const data = join(root, "data");
  writeJson(data, "ledger.json", [
    { kind: "delivery", date: "2026-07-01", id: "wright-2026-07-01-hello", from: "wright", to: "rei", thread: null },
    { kind: "delivery", date: "2026-07-02", id: "rei-2026-07-02-reply", from: "rei", to: "wright", thread: "wright-2026-07-01-hello" },
  ]);
  writeJson(data, "docs.json", { README: { body: "snapshot docs", path: "README.md" } });
  writeJson(data, "meeps.json", [{ name: "snapshot-meep", skill: null, dailyCount: 0 }]);
  writeJson(data, "stats.json", { latestDate: "2026-07-01", latestDeliveries: [] });

  const town = join(root, "town");
  mkdirSync(join(town, "MEEPS", "ferry", "memory", "daily"), { recursive: true });
  mkdirSync(join(town, "MEEPS", "SKILLS"), { recursive: true });
  writeFileSync(join(town, "MEEPS", "ferry", "identity.md"), "# ferry\n");
  writeFileSync(join(town, "MEEPS", "ferry", "memory", "daily", "2026-07-02.md"), "# day\n");
  writeFileSync(join(town, "MEEPS", "SKILLS", "ferry-round.md"), "# skill\n");
  return { data, town };
}

test("buildOfficeData maps public API payloads to site data files", async () => {
  const { data, town } = fixtureSnapshot();
  const result = await buildOfficeData({ apiBase: "https://example.test", dataDir: data, townRoot: town, fetchImpl: fixtureFetch() });

  assert.equal(result.asOf, "abc123");
  assert.equal(result.files["letters.json"].length, 2);
  assert.deepEqual(result.files["letters.json"].map((l) => l.id), ["wright-2026-07-01-hello", "rei-2026-07-02-reply"]);
  assert.equal(result.files["threads.json"].length, 1);
  assert.equal(result.files["residents.json"].find((r) => r.handle === "wright").counts.received, 1);
  assert.equal(result.files["residents.json"].find((r) => r.handle === "wright").is_office, false);
  assert.equal(result.files["meeps.json"][0].name, "ferry");
  assert.equal(result.files["ledger.json"].length, 2);
  assert.match(result.endpointGaps.join("\n"), /ledger\.json preserved/);
});

test("buildOfficeData output is byte-stable for the same API state", async () => {
  const a = fixtureSnapshot();
  const b = fixtureSnapshot();
  const one = await buildOfficeData({ apiBase: "https://example.test", dataDir: a.data, townRoot: a.town, fetchImpl: fixtureFetch() });
  const two = await buildOfficeData({ apiBase: "https://example.test", dataDir: b.data, townRoot: b.town, fetchImpl: fixtureFetch() });
  assert.equal(jsonText(one.files), jsonText(two.files));
});

test("apiGet retries transient failures", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls < 3) throw new Error("temporary");
    return { ok: true, status: 200, statusText: "OK", headers: { get: () => "sha" }, json: async () => ({ ok: true }) };
  };
  const result = await apiGet("/town", { apiBase: "https://example.test/api", fetchImpl, retries: 3 });
  assert.deepEqual(result, { body: { ok: true }, asOf: "sha" });
  assert.equal(calls, 3);
});

test("fetch-town CLI keeps the committed snapshot when the API is down", () => {
  const result = spawnSync(process.execPath, ["tools/fetch-town.mjs"], {
    cwd: join(import.meta.dirname, ".."),
    env: { ...process.env, POSTMARK_API: "http://127.0.0.1:9" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /keeping committed data snapshot/);
});
