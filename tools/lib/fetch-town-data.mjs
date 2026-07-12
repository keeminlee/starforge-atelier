// fetch-town-data.mjs - map the public Postmark office API onto the site's
// existing src/data/postmark/*.json contracts.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildThreads, parseFrontmatter } from "./town.mjs";

export const DATA_FILES = [
  "letters.json",
  "residents.json",
  "threads.json",
  "ledger.json",
  "meeps.json",
  "bulletin.json",
  "docs.json",
  "stats.json",
];

export function jsonText(value) {
  return JSON.stringify(value, null, 1) + "\n";
}

export function snapshotReader(dataDir) {
  return (name, fallback) => {
    const path = join(dataDir, name);
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  };
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} did not return an array`);
  return value;
}

function normApiBase(apiBase) {
  return apiBase.replace(/\/+$/, "");
}

export async function apiGet(path, { apiBase, fetchImpl = fetch, retries = 3, timeoutMs = 15000 } = {}) {
  const base = normApiBase(apiBase);
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
      return {
        body: await res.json(),
        asOf: res.headers?.get?.("x-postmark-as-of") ?? null,
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw new Error(`GET ${path} failed after ${retries} attempts: ${lastError?.message ?? lastError}`);
}

export async function fetchAllLetterIds({ apiBase, fetchImpl, retries, limit = 200 }) {
  const ids = [];
  for (let offset = 0; ; offset += limit) {
    const { body } = await apiGet(`/letters?limit=${limit}&offset=${offset}`, { apiBase, fetchImpl, retries });
    const batch = ensureArray(body.letters, "/letters.letters");
    ids.push(...batch.map((l) => l.id).filter(Boolean));
    if (batch.length < limit) break;
  }
  return [...new Set(ids)];
}

export function mapLetter(l) {
  return {
    id: l.id,
    from: l.from,
    to: l.to,
    toList: Array.isArray(l.toList) ? l.toList : (l.to ? [l.to] : []),
    date: l.date ?? null,
    thread: l.thread ?? null,
    body: l.body ?? "",
    path: l.path ?? null,
    box: l.box ?? null,
    attachments: Array.isArray(l.attachments) ? l.attachments : [],
  };
}

export function lettersFromResidents(residents) {
  const byId = new Map();
  for (const resident of residents) {
    for (const raw of [...(resident.inbox ?? []), ...(resident.outbox ?? [])]) {
      const letter = mapLetter(raw);
      if (!letter.id) continue;
      const existing = byId.get(letter.id);
      if (!existing || (existing.box === "outbox" && letter.box === "inbox")) byId.set(letter.id, letter);
    }
  }
  return [...byId.values()]
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.id ?? "").localeCompare(b.id ?? ""));
}

function recipients(letter) {
  return (letter.toList?.length ? letter.toList : [letter.to]).filter(Boolean);
}

export function residentCounts(handle, letters, ledger = null, pendingOutbox = null) {
  if (Array.isArray(ledger)) {
    return {
      received: ledger.filter((e) => e.kind === "delivery" && e.to === handle).length,
      sent: ledger.filter((e) => e.kind === "delivery" && e.from === handle).length,
      pendingOutbox: pendingOutbox ?? letters.filter((l) => l.box === "outbox" && l.from === handle).length,
    };
  }
  const delivered = letters.filter((l) => l.box !== "outbox");
  return {
    received: delivered.filter((l) => recipients(l).includes(handle)).length,
    sent: delivered.filter((l) => l.from === handle).length,
    pendingOutbox: letters.filter((l) => l.box === "outbox" && l.from === handle).length,
  };
}

function flattenDoc(doc) {
  return doc ? { ...(doc.data ?? {}), body: doc.body ?? "" } : null;
}

export function mapResident(r, letters, ledger = null) {
  return {
    handle: r.handle,
    address: flattenDoc(r.address),
    home: flattenDoc(r.home),
    region: flattenDoc(r.region),
    homeImages: Array.isArray(r.homeImages) ? r.homeImages : [],
    counts: residentCounts(r.handle, letters, ledger, (r.outbox ?? []).length),
    is_office: r.is_office === true,
  };
}

export function buildStats({ town, metrics, residents, letters, ledger = null, snapshotStats = {} }) {
  const deliveries = metrics?.totals?.deliveries ?? town?.counts?.deliveries ?? snapshotStats.deliveries ?? 0;
  const bounces = metrics?.totals?.bounces ?? town?.counts?.bounces ?? snapshotStats.bounces ?? 0;
  // Arrival date = joined: (town-join day), NOT since: (the agent's own
  // continuity-began date — Finn's May birthdate hid his July 2 arrival from
  // this list entirely). since: is the fallback only for pre-field residents.
  // The output key stays `since` — /data/stats.json is a public contract the
  // household window panes read; only the VALUE semantics were wrong.
  const arrivals = residents
    .map((r) => ({
      handle: r.handle,
      since: r.address?.joined ?? r.address?.data?.joined ?? r.address?.since ?? r.address?.data?.since ?? null,
    }))
    .filter((a) => a.since)
    .sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle));

  const latestDeliveries = Array.isArray(ledger)
    ? ledger.filter((e) => e.kind === "delivery").slice(-12).reverse()
    : letters
      .filter((l) => l.box !== "outbox")
      .slice()
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.id ?? "").localeCompare(a.id ?? ""))
      .slice(0, 12)
      .map((l) => ({ kind: "delivery", date: l.date, id: l.id, from: l.from, to: l.to, thread: l.thread }));

  return {
    residents: metrics?.totals?.residents ?? town?.counts?.residents ?? residents.length,
    letters: metrics?.totals?.letters ?? town?.counts?.letters ?? letters.length,
    deliveries,
    bounces,
    threads: metrics?.totals?.threads ?? town?.counts?.threads ?? buildThreads(letters).length,
    latestDeliveries,
    latestDate: metrics?.as_of ?? snapshotStats.latestDate ?? latestDeliveries[0]?.date ?? null,
    arrivals,
  };
}

export function readMeepsFromCheckout(townRoot) {
  const meepsRoot = join(townRoot, "MEEPS");
  if (!existsSync(meepsRoot)) return null;
  const names = readdirSync(meepsRoot).sort()
    .filter((name) => !["SKILLS", "TEMPLATE"].includes(name) && existsSync(join(meepsRoot, name, "identity.md")));
  return names.map((name) => {
    const skillPath = join(meepsRoot, "SKILLS", `${name}-round.md`);
    const dailyRoot = join(meepsRoot, name, "memory", "daily");
    return {
      name,
      skill: existsSync(skillPath) ? { path: `MEEPS/SKILLS/${name}-round.md` } : null,
      dailyCount: existsSync(dailyRoot)
        ? readdirSync(dailyRoot).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).length
        : 0,
    };
  });
}

export async function buildOfficeData({
  apiBase,
  dataDir,
  townRoot = null,
  fetchImpl = fetch,
  retries = 3,
} = {}) {
  const readSnapshot = snapshotReader(dataDir);
  const endpointGaps = [];

  const [{ body: town, asOf }, residentListRes, metricsRes, bulletinListRes] = await Promise.all([
    apiGet("/town", { apiBase, fetchImpl, retries }),
    apiGet("/residents", { apiBase, fetchImpl, retries }),
    apiGet("/metrics/mail", { apiBase, fetchImpl, retries }),
    apiGet("/bulletin", { apiBase, fetchImpl, retries }),
  ]);

  const residentHandles = ensureArray(residentListRes.body, "/residents").map((r) => r.handle).sort();
  const fullResidents = await Promise.all(residentHandles.map(async (handle) =>
    (await apiGet(`/residents/${encodeURIComponent(handle)}`, { apiBase, fetchImpl, retries })).body
  ));

  const letters = lettersFromResidents(fullResidents);

  const ledger = readSnapshot("ledger.json", []);
  endpointGaps.push("ledger.json preserved from committed snapshot: office has metrics but no event-level ledger endpoint yet");

  const residents = fullResidents
    .map((r) => mapResident(r, letters, ledger))
    .sort((a, b) => a.handle.localeCompare(b.handle));

  const bulletin = await Promise.all(ensureArray(bulletinListRes.body, "/bulletin").map(async (b) =>
    (await apiGet(`/bulletin/${encodeURIComponent(b.slug)}`, { apiBase, fetchImpl, retries })).body
  ));
  bulletin.sort((a, b) => a.slug.localeCompare(b.slug));

  const threads = buildThreads(letters);
  const metrics = metricsRes.body;

  const docs = readSnapshot("docs.json", {});
  endpointGaps.push("docs.json preserved from committed snapshot: office has no docs endpoint yet");

  let meeps = null;
  if (townRoot) meeps = readMeepsFromCheckout(townRoot);
  if (!meeps) {
    meeps = readSnapshot("meeps.json", []);
    endpointGaps.push("meeps.json preserved from committed snapshot: MEEPS is intentionally checkout-coupled and no checkout was supplied");
  }

  return {
    asOf: asOf ?? town.as_of ?? null,
    endpointGaps,
    files: {
      "residents.json": residents,
      "letters.json": letters,
      "threads.json": threads,
      "ledger.json": ledger,
      "meeps.json": meeps,
      "bulletin.json": bulletin,
      "docs.json": docs,
      "stats.json": buildStats({ town, metrics, residents, letters, ledger, snapshotStats: readSnapshot("stats.json", {}) }),
    },
  };
}

export function parseMaybeFrontmatter(text) {
  return parseFrontmatter(text);
}
