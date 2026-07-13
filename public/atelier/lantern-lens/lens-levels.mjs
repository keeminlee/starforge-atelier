// lens-levels.mjs — the hand-authored puzzles. Shared by the page and the
// verifier, so the levels you play are the levels proven solvable.
//
// Each level fixes the lantern and the wick; gives the player one or two
// MOVABLE pieces (a mirror or a glass slab) with a starting placement that does
// NOT yet light the wick; and optionally fixed walls the beam must respect. The
// verifier searches each movable piece's placement space and proves at least one
// arrangement lights the wick (solvable by construction) — and that the starting
// arrangement is dark (so there is a puzzle to solve).

export const BOUNDS = { w: 640, h: 420 };

export const LEVELS = [
  {
    name: 'The Turn',
    hint: 'A mirror bends light by bouncing it. Slide and tilt the mirror so the lantern’s beam turns up to the wick.',
    lantern: { x: 60, y: 250, angle: 0 },       // pointing right
    wick: { x: 330, y: 70, r: 13 },
    walls: [],
    pieces: [{ type: 'mirror', movable: true, len: 78, cx: 250, cy: 250, angle: 0.2 }],
    search: { kind: 'mirror', cx: [180, 420, 20], cy: [120, 300, 20], angle: [0, Math.PI, Math.PI / 36] },
  },
  {
    name: 'The Shift',
    hint: 'Glass doesn’t turn the beam — it slides it sideways as it passes through. Angle the slab so the beam slips down onto the wick.',
    lantern: { x: 60, y: 205, angle: 0 },
    wick: { x: 590, y: 232, r: 13 },            // just below the beam line — a refraction shift lands it
    walls: [],
    pieces: [{ type: 'glass', movable: true, w: 66, h: 150, cx: 320, cy: 205, angle: 0 }],
    search: { kind: 'glass', cx: [240, 400, 20], cy: [160, 250, 20], angle: [-1.2, 1.2, Math.PI / 40] },
  },
  {
    name: 'The Reach',
    hint: 'A pillar hangs in the way. Catch the beam before it and bend it down past the pillar’s foot to the far wick — the aim is fussy.',
    lantern: { x: 60, y: 120, angle: 0 },
    wick: { x: 540, y: 330, r: 13 },
    walls: [{ a: { x: 390, y: 0 }, b: { x: 390, y: 190 } }],  // a pillar hanging from the top
    pieces: [{ type: 'mirror', movable: true, len: 80, cx: 230, cy: 120, angle: 0.08 }],
    search: { kind: 'mirror', cx: [130, 340, 15], cy: [105, 135, 15], angle: [0, Math.PI, Math.PI / 48] },
  },
];

// Turn a level's piece list into scene pieces (mirror len+angle → segment).
export function levelScene(level, pieceOverrides) {
  const pieces = [];
  const src = pieceOverrides || level.pieces;
  for (const p of src) {
    if (p.type === 'mirror') {
      const hl = (p.len || 78) / 2, dx = Math.cos(p.angle) * hl, dy = Math.sin(p.angle) * hl;
      pieces.push({ type: 'mirror', a: { x: p.cx - dx, y: p.cy - dy }, b: { x: p.cx + dx, y: p.cy + dy }, _src: p });
    } else if (p.type === 'glass') {
      pieces.push({ type: 'glass', cx: p.cx, cy: p.cy, w: p.w, h: p.h, angle: p.angle, _src: p });
    }
  }
  // walls are just mirrors that swallow (opaque) — model as thin non-reflective
  // segments the tracer stops on. We give them material 'wall' handled as escape.
  for (const w of level.walls || []) pieces.push({ type: 'mirror', a: w.a, b: w.b, wall: true });
  return { lantern: level.lantern, wick: level.wick, bounds: BOUNDS, pieces };
}
