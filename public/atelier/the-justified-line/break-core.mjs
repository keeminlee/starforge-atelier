// break-core.mjs — Knuth–Plass line breaking, pure.
//
// A paragraph is not a sequence of lines. It is ONE object that has to hold
// together, and where you break it early changes what the last line can be. Greedy
// breaking doesn't know that: it fills each line as far as it can and moves on, so
// a bad break at line 2 is paid for at line 9 by someone who wasn't consulted.
//
// Knuth–Plass (TeX, 1981) treats the whole paragraph as a shortest-path problem.
// Every legal breakpoint is a node; the cost of a line is its BADNESS (how far its
// spaces are stretched or squeezed from natural width, cubed); dynamic programming
// finds the set of breaks minimising total demerits over the paragraph entire.
//
// It is a load-path for text. Badness distributes like stress, and the optimal
// solution is the one that lets no single line carry more than it must.
//
// The model (simplified from TeX — no hyphenation, no penalties beyond the
// forced final break; the essential idea intact):
//
//   BOX   an unbreakable thing with a width (a word)
//   GLUE  a stretchable/shrinkable space: natural width, stretch, shrink
//   A line from breakpoint i to breakpoint j must fit the column by adjusting
//   only its glue. The adjustment ratio r says how hard you had to pull:
//     r > 0  spaces stretched   (line was too short)
//     r < 0  spaces squeezed    (line was too long)
//     r = 0  perfect            (natural width exactly fills the column)
//   badness = 100 * |r|^3   — cubed, because a little stretch is fine and a lot
//   is ugly out of all proportion. This is the whole aesthetic, in one exponent.

export const BOX = 'box', GLUE = 'glue';

export const box = (w, text) => ({ type: BOX, w, text });
export const glue = (w, stretch, shrink) => ({ type: GLUE, w, stretch, shrink });

// turn a string into the box/glue stream. Space widths are the classic TeX-ish
// ratios: a space stretches by half its width and shrinks by a third.
export function typeset(text, measure) {
  const items = [];
  const words = text.split(/\s+/).filter(Boolean);
  words.forEach((word, i) => {
    if (i > 0) {
      const sw = measure(' ');
      items.push(glue(sw, sw * 0.5, sw / 3));
    }
    items.push(box(measure(word), word));
  });
  return items;
}

// legal breakpoints: at each glue (you may break at a space), plus the end.
export const breakpoints = (items) => {
  const bp = [0];
  items.forEach((it, i) => { if (it.type === GLUE) bp.push(i); });
  bp.push(items.length);
  return bp;
};

// measure the run of items that would form a line from breakpoint a to b.
// A break AT a glue consumes that glue (the space vanishes at the line end).
export function lineMetrics(items, a, b) {
  let w = 0, stretch = 0, shrink = 0;
  const from = items[a] && items[a].type === GLUE ? a + 1 : a;
  for (let i = from; i < b; i++) {
    const it = items[i];
    w += it.w;
    if (it.type === GLUE) { stretch += it.stretch; shrink += it.shrink; }
  }
  return { w, stretch, shrink };
}

// how hard did we have to pull to make this line fit the column?
export function adjustRatio(items, a, b, width) {
  const { w, stretch, shrink } = lineMetrics(items, a, b);
  if (w === width) return 0;
  if (w < width) return stretch > 0 ? (width - w) / stretch : Infinity;
  return shrink > 0 ? (width - w) / shrink : -Infinity; // negative: squeezed
}

export const INFEASIBLE = Infinity;
export const MAX_SHRINK = -1;   // you may not squeeze past the glue's shrink
export const TOLERANCE = 4;     // nor stretch past 4x — TeX's default pretolerance-ish

// badness = 100 |r|^3. Cubed: mild stretch costs almost nothing, hard stretch is
// punished out of proportion. The last line is free — it is allowed to be short.
export function badness(r, isLast) {
  if (isLast && r >= 0) return 0;                 // the final line may run short
  if (r === Infinity || r < MAX_SHRINK) return INFEASIBLE;
  if (r > TOLERANCE) return INFEASIBLE;
  return 100 * Math.abs(r) ** 3;
}

// ── GREEDY: fill each line as far as it will go, then move on. ────────────────
// It never looks ahead. It cannot: it has already committed.
export function breakGreedy(items, width) {
  const bp = breakpoints(items);
  const breaks = [0];
  let a = 0;
  while (a < items.length) {
    let best = null;
    for (const b of bp) {
      if (b <= a) continue;
      const { w } = lineMetrics(items, a, b);
      if (w <= width || best === null) best = b; else break;
    }
    if (best === null || best === a) break;
    breaks.push(best);
    a = best;
    if (best >= items.length) break;
  }
  if (breaks[breaks.length - 1] !== items.length) breaks.push(items.length);
  return breaks;
}

// ── KNUTH–PLASS: the whole paragraph at once, by dynamic programming. ─────────
// dist[j] = the least total demerits of any way to break the paragraph up to j.
export function breakOptimal(items, width) {
  const bp = breakpoints(items);
  const idx = new Map(bp.map((b, i) => [b, i]));
  const dist = new Array(bp.length).fill(INFEASIBLE);
  const prev = new Array(bp.length).fill(-1);
  dist[0] = 0;

  for (let j = 1; j < bp.length; j++) {
    const b = bp[j];
    const isLast = b === items.length;
    for (let i = 0; i < j; i++) {
      if (dist[i] === INFEASIBLE) continue;
      const a = bp[i];
      const r = adjustRatio(items, a, b, width);
      const bad = badness(r, isLast);
      if (bad === INFEASIBLE) continue;
      // TeX's demerits: (1 + badness)^2 — squaring again means the optimiser
      // hates ONE terrible line more than several mediocre ones. It spreads the load.
      const d = dist[i] + (1 + bad) ** 2;
      if (d < dist[j]) { dist[j] = d; prev[j] = i; }
    }
  }

  const end = bp.length - 1;
  if (dist[end] === INFEASIBLE) return { breaks: breakGreedy(items, width), demerits: INFEASIBLE, feasible: false };

  const breaks = [];
  for (let j = end; j !== -1; j = prev[j]) { breaks.unshift(bp[j]); if (j === 0) break; }
  return { breaks, demerits: dist[end], feasible: true };
}

// total demerits of an arbitrary set of breaks — the common yardstick both
// algorithms are scored on. This is what makes the comparison honest.
export function totalDemerits(items, breaks, width) {
  let total = 0;
  for (let k = 0; k + 1 < breaks.length; k++) {
    const a = breaks[k], b = breaks[k + 1];
    const isLast = b === items.length;
    const bad = badness(adjustRatio(items, a, b, width), isLast);
    if (bad === INFEASIBLE) return INFEASIBLE;
    total += (1 + bad) ** 2;
  }
  return total;
}

// the lines, with the stretch each one actually suffered — for rendering
export function layout(items, breaks, width) {
  const lines = [];
  for (let k = 0; k + 1 < breaks.length; k++) {
    const a = breaks[k], b = breaks[k + 1];
    const isLast = b === items.length;
    const r = adjustRatio(items, a, b, width);
    const from = items[a] && items[a].type === GLUE ? a + 1 : a;
    const words = [];
    for (let i = from; i < b; i++) if (items[i].type === BOX) words.push(items[i].text);
    lines.push({
      words,
      ratio: isLast && r >= 0 ? 0 : r,
      badness: badness(r, isLast),
      isLast,
      natural: lineMetrics(items, a, b).w,
    });
  }
  return lines;
}
