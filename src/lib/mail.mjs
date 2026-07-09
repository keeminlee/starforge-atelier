// mail.mjs — pure helpers for The Mail page + the all-mail explorer.
//
// Shared by build-time rendering (Astro pages) and the client islands. No deps,
// no DOM, no network — every function here is testable in isolation
// (test/mail.test.mjs). The office API and the static build agree because both
// derive from the same shapes.

// ── office classification (is_office roster from step 2) ─────────────────────
// residents.json carries is_office per resident. A letter/thread is
// "office-involved" if any participant is a town office. Until town PR #224
// merges, every flag is false, so nothing is excluded yet — the logic is live
// and fixture-tested, and lights up the moment the roster flags land.
export function officeHandles(residents) {
  return new Set((residents ?? []).filter((r) => r.is_office === true).map((r) => r.handle));
}

// a letter's participants: sender + every recipient (toList wins over to)
export function letterParticipants(l) {
  return [l.from, ...(l.toList?.length ? l.toList : [l.to])].filter(Boolean);
}

export function isOfficeInvolved(participants, officeSet) {
  return (participants ?? []).some((h) => officeSet.has(h));
}

export function threadIsOffice(thread, officeSet) {
  return isOfficeInvolved(thread?.participants, officeSet);
}

// ── region map (from residents.json REGION.md frontmatter: `region:`) ────────
export function regionOfFn(residents) {
  const m = new Map();
  for (const r of residents ?? []) {
    const name = r.region?.region ?? null;
    if (name) m.set(r.handle, name);
  }
  return (handle) => m.get(handle) ?? null;
}

export function regionList(residents) {
  return [...new Set((residents ?? []).map((r) => r.region?.region).filter(Boolean))].sort();
}

// ── date helpers (UTC-pinned, YYYY-MM-DD string math) ────────────────────────
export function shiftDate(iso, deltaDays) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + deltaDays * 86400000).toISOString().slice(0, 10);
}

// ── metrics aggregation (build-time twin of /api/metrics/mail) ───────────────
// Deterministic: "today" is the newest ledger date, never the wall clock, so
// the static render and the live island report the same numbers for the same
// ledger. Days are gap-filled between the first and last ledger date.
export function metricsFromLedger(ledger, threads = [], { activeWithinDays = 14 } = {}) {
  const byDay = new Map();
  let deliveries = 0;
  let bounces = 0;
  for (const e of ledger ?? []) {
    if (e.kind === "delivery") deliveries++;
    else if (e.kind === "bounce") bounces++;
    if (!e.date) continue;
    const d = byDay.get(e.date) ?? { date: e.date, deliveries: 0, bounces: 0 };
    if (e.kind === "delivery") d.deliveries++;
    else if (e.kind === "bounce") d.bounces++;
    byDay.set(e.date, d);
  }
  const dates = [...byDay.keys()].sort();
  const asOf = dates.length ? dates[dates.length - 1] : null;
  const days = [];
  if (dates.length) {
    let cur = dates[0];
    const end = dates[dates.length - 1];
    for (let guard = 0; cur <= end && guard < 100000; guard++, cur = shiftDate(cur, 1)) {
      days.push(byDay.get(cur) ?? { date: cur, deliveries: 0, bounces: 0 });
    }
  }
  // "last letter within N days of as-of" — matches the office /metrics contract
  const cut = asOf ? shiftDate(asOf, -activeWithinDays) : null;
  const activeThreads = cut ? (threads ?? []).filter((t) => (t.lastDate ?? "") >= cut).length : 0;
  return {
    as_of: asOf,
    days,
    totals: { deliveries, bounces },
    active_threads: activeThreads,
  };
}

// most recent `n` days of the series (for the sparkline)
export function recentDays(days, n = 30) {
  return (days ?? []).slice(-n);
}

// deliveries recorded on the as-of day (the "today so far" figure)
export function deliveriesOn(days, date) {
  const d = (days ?? []).find((x) => x.date === date);
  return d ? d.deliveries : 0;
}

// ── explorer filter state <-> URL (round-trip stable) ────────────────────────
// The URL is the source of truth for a filtered view, so any view is shareable.
// String fields carry their value; `office` is a boolean ("1" = show office
// traffic). queryToState(stateToQuery(s)) === s for any canonical state.
const STRING_FIELDS = ["resident", "region", "since", "until", "thread", "q"];

export function queryToState(search) {
  const p = new URLSearchParams((search || "").replace(/^\?/, ""));
  const state = {};
  for (const f of STRING_FIELDS) {
    const v = p.get(f);
    if (v) state[f] = v;
  }
  state.office = p.get("office") === "1";
  return state;
}

export function stateToQuery(state) {
  const p = new URLSearchParams();
  for (const f of STRING_FIELDS) {
    if (state?.[f]) p.set(f, state[f]);
  }
  if (state?.office) p.set("office", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── the explorer filter (client-side over the full committed corpus) ─────────
// Full-text search is a substring match over the embedded corpus (id/from/to/
// body) — complete for the build-time mail and degradation-safe offline; the
// office /api/search verb is the live-freshness hook for mail newer than the
// last build.
export function filterLetters(letters, state, { officeSet = new Set(), regionOf = () => null } = {}) {
  const q = (state?.q || "").toLowerCase().trim();
  return (letters ?? []).filter((l) => {
    const parts = letterParticipants(l);
    if (!state?.office && isOfficeInvolved(parts, officeSet)) return false;
    if (state?.resident && !parts.includes(state.resident)) return false;
    if (state?.region && !parts.some((h) => regionOf(h) === state.region)) return false;
    if (state?.thread && l.thread !== state.thread && l.id !== state.thread) return false;
    if (state?.since && (l.date ?? "") < state.since) return false;
    if (state?.until && (l.date ?? "") > state.until) return false;
    if (q) {
      const hay = `${l.id} ${l.from} ${l.to} ${l.body ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
