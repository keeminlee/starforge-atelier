import assert from "node:assert/strict";
import test from "node:test";

import {
  officeHandles, letterParticipants, isOfficeInvolved, threadIsOffice,
  regionOfFn, regionList, shiftDate,
  metricsFromLedger, recentDays, deliveriesOn,
  queryToState, stateToQuery, filterLetters,
} from "../src/lib/mail.mjs";

const RESIDENTS = [
  { handle: "wright", region: { region: "the Trueing Terrace" }, is_office: false },
  { handle: "rei", region: { region: "the Lanternseed Gardens" }, is_office: false },
  { handle: "carta", region: { region: "The Long Run" }, is_office: false },
  { handle: "postmaster", is_office: true },
  { handle: "illuminator", is_office: true },
];

const LETTERS = [
  { id: "wright-2026-07-01-a", from: "wright", to: "rei", toList: ["rei"], date: "2026-07-01", thread: null, body: "the lighthouse holds" },
  { id: "rei-2026-07-02-b", from: "rei", to: "wright", toList: ["wright"], date: "2026-07-02", thread: "wright-2026-07-01-a", body: "answered" },
  { id: "carta-2026-07-03-c", from: "carta", to: "wright", toList: ["wright"], date: "2026-07-03", thread: null, body: "the long run" },
  { id: "postmaster-2026-07-04-d", from: "postmaster", to: "wright", toList: ["wright"], date: "2026-07-04", thread: null, body: "office notice" },
];

const THREADS = [
  { key: "wright-2026-07-01-a", participants: ["wright", "rei"], lastDate: "2026-07-02" },
  { key: "carta-2026-07-03-c", participants: ["carta", "wright"], lastDate: "2026-07-03" },
  { key: "postmaster-2026-07-04-d", participants: ["postmaster", "wright"], lastDate: "2026-07-04" },
];

test("office roster + involvement predicate", () => {
  const office = officeHandles(RESIDENTS);
  assert.deepEqual([...office].sort(), ["illuminator", "postmaster"]);
  assert.equal(isOfficeInvolved(letterParticipants(LETTERS[0]), office), false);
  assert.equal(isOfficeInvolved(letterParticipants(LETTERS[3]), office), true);
  assert.equal(threadIsOffice(THREADS[0], office), false);
  assert.equal(threadIsOffice(THREADS[2], office), true);
});

test("office exclusion is empty when no flags are set (pre-#224 behaviour)", () => {
  const noFlags = RESIDENTS.map((r) => ({ ...r, is_office: false }));
  const office = officeHandles(noFlags);
  assert.equal(office.size, 0);
  // with an empty office set, the default view excludes nothing
  const shown = filterLetters(LETTERS, { office: false }, { officeSet: office });
  assert.equal(shown.length, LETTERS.length);
});

test("region map + list", () => {
  const regionOf = regionOfFn(RESIDENTS);
  assert.equal(regionOf("carta"), "The Long Run");
  assert.equal(regionOf("postmaster"), null);
  assert.deepEqual(regionList(RESIDENTS), ["The Long Run", "the Lanternseed Gardens", "the Trueing Terrace"]);
});

test("shiftDate is UTC-stable across month boundaries", () => {
  assert.equal(shiftDate("2026-07-01", -1), "2026-06-30");
  assert.equal(shiftDate("2026-06-30", 1), "2026-07-01");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});

test("metricsFromLedger aggregates, gap-fills, counts active threads", () => {
  const ledger = [
    { kind: "delivery", date: "2026-07-01", id: "a" },
    { kind: "delivery", date: "2026-07-01", id: "a2" },
    { kind: "bounce", date: "2026-07-02", from: "x", defect: "envelope" },
    { kind: "delivery", date: "2026-07-04", id: "d" },
  ];
  const m = metricsFromLedger(ledger, THREADS, { activeWithinDays: 14 });
  assert.equal(m.as_of, "2026-07-04");
  assert.equal(m.totals.deliveries, 3);
  assert.equal(m.totals.bounces, 1);
  // 2026-07-01..07-04 gap-filled = 4 days, incl. the empty 07-03
  assert.equal(m.days.length, 4);
  assert.equal(m.days.find((d) => d.date === "2026-07-03").deliveries, 0);
  assert.equal(deliveriesOn(m.days, "2026-07-01"), 2);
  // all three threads' lastDate within 14d of 07-04
  assert.equal(m.active_threads, 3);
  assert.equal(recentDays(m.days, 2).length, 2);
});

test("filter state <-> URL round-trips (identity on canonical states)", () => {
  const states = [
    { office: false },
    { office: true },
    { resident: "wright", office: false },
    { region: "The Long Run", since: "2026-07-01", until: "2026-07-31", office: true },
    { thread: "wright-2026-07-01-a", q: "lighthouse", office: false },
  ];
  for (const s of states) {
    const round = queryToState(stateToQuery(s));
    // normalize: queryToState always sets office boolean
    const expected = { ...s, office: !!s.office };
    assert.deepEqual(round, expected, `round-trip failed for ${JSON.stringify(s)}`);
  }
  // a bare URL yields the default (office hidden)
  assert.deepEqual(queryToState(""), { office: false });
  assert.equal(stateToQuery({ office: false }), "");
});

test("filterLetters: each filter alone and combined", () => {
  const office = officeHandles(RESIDENTS);
  const regionOf = regionOfFn(RESIDENTS);
  const ctx = { officeSet: office, regionOf };

  // default excludes office traffic
  assert.deepEqual(filterLetters(LETTERS, { office: false }, ctx).map((l) => l.id),
    ["wright-2026-07-01-a", "rei-2026-07-02-b", "carta-2026-07-03-c"]);
  // toggle restores office traffic
  assert.equal(filterLetters(LETTERS, { office: true }, ctx).length, 4);
  // by resident
  assert.deepEqual(filterLetters(LETTERS, { office: true, resident: "carta" }, ctx).map((l) => l.id),
    ["carta-2026-07-03-c"]);
  // by region (carta is in The Long Run)
  assert.deepEqual(filterLetters(LETTERS, { office: true, region: "The Long Run" }, ctx).map((l) => l.id),
    ["carta-2026-07-03-c"]);
  // by thread
  assert.deepEqual(filterLetters(LETTERS, { office: true, thread: "wright-2026-07-01-a" }, ctx).map((l) => l.id),
    ["wright-2026-07-01-a", "rei-2026-07-02-b"]);
  // by date range
  assert.deepEqual(filterLetters(LETTERS, { office: true, since: "2026-07-02", until: "2026-07-03" }, ctx).map((l) => l.id),
    ["rei-2026-07-02-b", "carta-2026-07-03-c"]);
  // full-text
  assert.deepEqual(filterLetters(LETTERS, { office: true, q: "lighthouse" }, ctx).map((l) => l.id),
    ["wright-2026-07-01-a"]);
  // combined (resident + date) yields empty -> honest empty result
  assert.deepEqual(filterLetters(LETTERS, { office: true, resident: "carta", until: "2026-07-01" }, ctx), []);
});
