// ===================== VOUSSOIR — THE CARILLON (procedural sound) =====================
// Zero-dependency Web Audio. Every sound is synthesised here — oscillators, gain
// envelopes, and a little shaped noise. No audio files, no libraries.
//
// The register is cathedral-knight / threshold-archivist: warm, low, dignified. The
// signature is THE BELL when the thrust comes home to ground — a fuller, purer bell
// when the line rests in the middle third (the honest verdict rewarded in sound).
//
// Contract:
//   unlock()            — call once on the first user gesture (browsers gate audio
//                         until then); safe to call repeatedly.
//   settle()            — soft low thunk: a stone set / the load released.
//   bell({pure})        — the stand. pure=true → the middle-third "comfy" bell.
//   collapse()          — weighty low rumble + tumbling scatter (never comical).
//   pierTip()           — the ring holds but the pier leans away: a low resigned groan.
//   tick()              — very quiet UI tock for a control nudge (throttled).
//   isMuted()/setMuted()/toggleMute() — persisted in localStorage.
//
// HEADLESS SAFETY: everything is guarded. If AudioContext is missing, blocked, or the
// context is suspended (no gesture / no device), every function is a silent no-op and
// NEVER throws. The playtest runs in headless chromium — it must stay green.

"use strict";

const MUTE_KEY = "voussoir_muted";

let ctx = null;          // the (lazily created) AudioContext
let master = null;       // master gain → destination
let unavailable = false; // set true if construction ever fails
let muted = loadMuted();
let lastTick = 0;

function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; }
}
function saveMuted() {
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {}
}

// Lazily construct the context. Returns the context or null — never throws.
function ensure() {
  if (unavailable) return null;
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { unavailable = true; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  } catch (e) {
    unavailable = true; ctx = null; master = null;
    return null;
  }
  return ctx;
}

// Resume on a user gesture. No-op / swallow if unavailable.
export function unlock() {
  const c = ensure();
  if (!c) return;
  try { if (c.state === "suspended") c.resume(); } catch (e) {}
}

// Is this frame allowed to make sound right now? (ready context + not muted)
function live() {
  const c = ensure();
  if (!c || muted) return null;
  // Only sound when actually running — suspended (no gesture, headless) stays silent.
  if (c.state !== "running") return null;
  return c;
}

// ---- shaped-noise buffers (built once, reused) ----------------------------------------
let whiteBuf = null, brownBuf = null;
function noiseBuffer(brown) {
  const c = ctx; if (!c) return null;
  const key = brown ? "brownBuf" : "whiteBuf";
  if (brown ? brownBuf : whiteBuf) return brown ? brownBuf : whiteBuf;
  try {
    const len = Math.floor(c.sampleRate * 1.4);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    if (brown) {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (brown) brownBuf = buf; else whiteBuf = buf;
    return buf;
  } catch (e) { return null; }
}

// ---- primitives -----------------------------------------------------------------------
// A single decaying partial (a struck sine). Safe against throwing.
function partial(freq, gain, t0, dur, type) {
  const c = ctx; if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (e) {}
}

// A shaped noise burst through a filter. type: 'lowpass' | 'bandpass' | 'highpass'.
function noiseBurst(t0, dur, peak, filtType, filtFreq, q, brown) {
  const c = ctx; if (!c) return;
  const buf = noiseBuffer(brown); if (!buf) return;
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = c.createBiquadFilter();
    f.type = filtType; f.frequency.value = filtFreq; if (q) f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  } catch (e) {}
}

// A pitched glide (a lean / a groan). freq0 → freq1 over dur.
function glide(f0, f1, t0, dur, peak, type) {
  const c = ctx; if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (e) {}
}

// ---- THE BELL -------------------------------------------------------------------------
// Inharmonic partials (hum / prime / tierce / quint / nominal ...) with per-partial
// decay — a struck bronze bell. A faint clapper transient seats the strike.
//   warm  (default): the pensive minor-third tierce present; medium ring.
//   pure  (comfy)  : the tierce softened, octave & fifth sung out, longer + fuller.
export function bell(opts) {
  const c = live(); if (!c) return;
  const pure = !!(opts && opts.pure);
  const t = c.currentTime + 0.01;
  const f0 = pure ? 233.08 : 261.63;            // Bb3 (fuller, lower) vs C4
  const base = pure ? 3.2 : 2.2;                // ring length (s)
  const amp = pure ? 0.26 : 0.22;
  // [ratio, gain, decayScale]
  const warmParts = [
    [0.5, 0.20, 1.00], [1.0, 0.34, 1.00], [1.2, 0.24, 0.62],
    [1.5, 0.14, 0.55], [2.0, 0.17, 0.46], [2.67, 0.07, 0.30], [4.0, 0.045, 0.20],
  ];
  const pureParts = [
    [0.5, 0.22, 1.15], [1.0, 0.36, 1.25], [1.25, 0.10, 0.70],
    [1.5, 0.18, 1.00], [2.0, 0.22, 0.92], [3.0, 0.09, 0.55], [4.0, 0.05, 0.34],
  ];
  const parts = pure ? pureParts : warmParts;
  for (const [ratio, g, dscale] of parts) {
    partial(f0 * ratio, amp * g, t, base * dscale, "sine");
  }
  // clapper: a soft, brief seat on the strike
  noiseBurst(t, 0.05, 0.05, "bandpass", f0 * 3.2, 1.4, false);
}

// ---- STONE SETTLING -------------------------------------------------------------------
// A soft low thunk — a stone set into course, or the load released onto the ring.
export function settle() {
  const c = live(); if (!c) return;
  const t = c.currentTime + 0.005;
  const f = 96 + Math.random() * 40;
  glide(f * 1.6, f * 0.8, t, 0.20, 0.20, "sine");    // the body of the thunk
  noiseBurst(t, 0.10, 0.07, "lowpass", 320, 0.7, false); // a little grit of stone
}

// ---- THE COLLAPSE ---------------------------------------------------------------------
// A low rumble + a sub thump + tumbling scatter as the ring hinges and falls. Weighty,
// resonant — the sound of masonry giving way, never a cartoon crash.
export function collapse() {
  const c = live(); if (!c) return;
  const t = c.currentTime + 0.01;
  // the sub thump of the drop
  glide(70, 32, t, 0.55, 0.32, "sine");
  // the low rumble (brown noise under a lowpass, swelling then long tail)
  noiseBurst(t, 1.6, 0.30, "lowpass", 150, 0.9, true);
  noiseBurst(t + 0.05, 1.2, 0.16, "lowpass", 90, 0.8, true);
  // the scatter — stones tumbling, low-mid and irregular (not tinkly)
  const n = 9;
  for (let i = 0; i < n; i++) {
    const dt = 0.06 + Math.random() * 0.95;
    const freq = 240 + Math.random() * 900;
    const peak = 0.05 + Math.random() * 0.07;
    noiseBurst(t + dt, 0.08 + Math.random() * 0.10, peak, "bandpass", freq, 1.1, false);
  }
}

// ---- THE PIER LEANS -------------------------------------------------------------------
// The ring held; the pier did not. A low resigned groan of the buttress tipping, then
// one heavy settle — no scatter. The weight leaves quietly.
export function pierTip() {
  const c = live(); if (!c) return;
  const t = c.currentTime + 0.01;
  glide(118, 66, t, 0.6, 0.20, "sine");          // the slow lean
  noiseBurst(t + 0.02, 0.7, 0.14, "lowpass", 180, 0.8, true);
  glide(60, 40, t + 0.34, 0.5, 0.24, "sine");    // the heavy settle at the toe
  noiseBurst(t + 0.34, 0.28, 0.12, "lowpass", 220, 0.7, false);
}

// ---- UI TICK --------------------------------------------------------------------------
// A very quiet wooden tock for a control nudge. Throttled so a slider drag doesn't
// machine-gun. Restraint: this should be barely felt.
export function tick() {
  const c = live(); if (!c) return;
  const now = c.currentTime;
  if (now - lastTick < 0.05) return;
  lastTick = now;
  partial(196, 0.030, now + 0.001, 0.045, "triangle");
}

// ---- MUTE (persisted) -----------------------------------------------------------------
export function isMuted() { return muted; }
export function setMuted(v) { muted = !!v; saveMuted(); }
export function toggleMute() { muted = !muted; saveMuted(); return muted; }
