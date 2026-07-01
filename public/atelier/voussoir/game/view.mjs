// ===================== VOUSSOIR VIEW TRANSFORM =====================
// The world->screen mapping, DPR handling and canvas fitting, factored out of the
// v0 (voussoir.html) inline code VERBATIM in behaviour. Isotropic scale derived from
// width (same as v0: view.scale = canvas.width / (bounds.x1 - bounds.x0)); the canvas
// height follows a fixed aspect ratio and simply shows a little extra vertical world.
//
// Reusable by the sandbox AND the future campaign — no game logic, no arch data here.
// A `view` is a plain object; call fitCanvas() before drawing a frame, then WX/WY.

"use strict";

// bounds: {x0,x1,y0,y1} world window. opts.aspect = canvasHeight/canvasWidth (v0: 640/960).
// opts.dpr overrides devicePixelRatio (handy for headless/testing).
export function makeView(bounds, opts = {}) {
  const dpr = opts.dpr != null
    ? opts.dpr
    : Math.min(2, (typeof globalThis !== "undefined" && globalThis.devicePixelRatio) || 1);
  return {
    bounds: { ...bounds },
    aspect: opts.aspect != null ? opts.aspect : 640 / 960,
    DPR: dpr,
    scale: 1,
    w: 0, // current canvas pixel width  (set by fitCanvas)
    h: 0, // current canvas pixel height (set by fitCanvas)
  };
}

// Size the canvas backing store from its CSS width and the DPR, and recompute scale.
// Mirrors v0's fitCanvas(): width drives an isotropic scale; height = cssW * aspect.
export function fitCanvas(canvas, view) {
  const cssW = canvas.clientWidth || 960;
  const cssH = cssW * view.aspect;
  canvas.width = Math.round(cssW * view.DPR);
  canvas.height = Math.round(cssH * view.DPR);
  view.w = canvas.width;
  view.h = canvas.height;
  view.scale = view.w / (view.bounds.x1 - view.bounds.x0);
  return view;
}

// world -> screen (pixel) coordinates
export function WX(view, x) { return (x - view.bounds.x0) * view.scale; }
export function WY(view, y) { return view.h - (y - view.bounds.y0) * view.scale; }

// screen (canvas-pixel) -> world. Pass pixels already scaled into the backing store
// (i.e. clientX*(canvas.width/rect.width)). Inverse of WX/WY.
export function worldX(view, px) { return view.bounds.x0 + px / view.scale; }
export function worldY(view, py) { return view.bounds.y0 + (view.h - py) / view.scale; }

// Convenience: map a raw pointer event to world coords, handling the CSS<->backing scale.
export function eventToWorld(canvas, view, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (canvas.width / rect.width);
  const py = (clientY - rect.top) * (canvas.height / rect.height);
  return [worldX(view, px), worldY(view, py)];
}
