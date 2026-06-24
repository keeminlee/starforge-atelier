/* =====================================================================
 * numlib.js — tiny dependency-free linear algebra for the advanced wing.
 * ---------------------------------------------------------------------
 * (ADR-0006.) The shipped site can't import npm, but spectral graph theory
 * and Johnson–Lindenstrauss need eigenvectors and Gaussian projections. So
 * we roll a small, AUDITED, pure-JS `Numlib` — and test it (test-numlib.mjs)
 * like part of the engine, because the entries trust its output.
 *
 * Global `Numlib` (loaded via <script>, like the engine). Also exported for
 * the Node harness.
 *
 * Eigen-strategy: power iteration with DEFLATION by orthogonal projection.
 * For a symmetric operator M (given as a matVec closure x ↦ Mx), repeatedly
 * power-iterate while orthogonalizing the iterate against the eigenvectors
 * already found — yielding the top-k eigenpairs. To get the SMALLEST
 * eigenvectors of a Laplacian L, an entry passes M = cI − L (c ≥ λmax(L)),
 * whose largest eigenvectors are L's smallest. The constant vector (L's
 * λ=0) is supplied as a known `against` vector so we land directly on the
 * Fiedler vector and the next one.
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---- vector ops (plain Arrays of numbers) ----
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function scale(a, c) { var o = new Array(a.length); for (var i = 0; i < a.length; i++) o[i] = a[i] * c; return o; }
  function axpy(y, a, x) { var o = new Array(y.length); for (var i = 0; i < y.length; i++) o[i] = y[i] + a * x[i]; return o; } // y + a·x
  function normalize(a) { var nrm = norm(a); return nrm < 1e-300 ? a.slice() : scale(a, 1 / nrm); }

  // Remove components along each (orthonormal) basis vector — Gram–Schmidt.
  function orthogonalize(v, basis) {
    var out = v.slice();
    for (var b = 0; b < basis.length; b++) {
      var d = dot(out, basis[b]);
      out = axpy(out, -d, basis[b]);
    }
    return out;
  }

  function randomUnitVector(n, rng) {
    var v = new Array(n);
    for (var i = 0; i < n; i++) v[i] = rng() - 0.5;
    return normalize(v);
  }

  // Box–Muller standard normal from a uniform rng.
  function gaussian(rng) {
    var u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  function gaussianVector(n, rng) { var v = new Array(n); for (var i = 0; i < n; i++) v[i] = gaussian(rng); return v; }

  // Dense symmetric matrix (Array of rows) times a vector.
  function matVecDense(M, x) {
    var n = M.length, o = new Array(n);
    for (var i = 0; i < n; i++) { var s = 0, row = M[i]; for (var j = 0; j < n; j++) s += row[j] * x[j]; o[i] = s; }
    return o;
  }

  /* Power iteration for the dominant eigenpair of a symmetric operator,
   * within the subspace orthogonal to `opts.against` (orthonormal vectors).
   *   matVec: x ↦ Mx ;  n: dimension
   * Returns { value (Rayleigh quotient), vector (unit), iters, converged }. */
  function powerIteration(matVec, n, opts) {
    opts = opts || {};
    var against = opts.against || [];
    var maxIter = opts.maxIter || 1000;
    var tol = opts.tol != null ? opts.tol : 1e-10;
    var rng = opts.rng || Math.random;

    var v = normalize(orthogonalize(randomUnitVector(n, rng), against));
    var converged = false, iters = 0;
    for (; iters < maxIter; iters++) {
      var w = orthogonalize(matVec(v), against);
      var nrm = norm(w);
      if (nrm < 1e-14) break;            // collapsed into the deflated subspace
      var vNew = scale(w, 1 / nrm);
      var align = Math.abs(dot(vNew, v));
      v = vNew;
      if (align > 1 - tol) { converged = true; iters++; break; }
    }
    var lambda = dot(v, matVec(v));      // Rayleigh quotient
    return { value: lambda, vector: v, iters: iters, converged: converged };
  }

  /* Top-k eigenpairs (largest eigenvalues) of a symmetric operator, via
   * deflation. `opts.against` supplies any KNOWN eigenvectors to skip
   * (e.g. a Laplacian's constant vector). Returns [{value, vector}], in
   * descending eigenvalue order. */
  function topEigenpairs(matVec, n, k, opts) {
    opts = opts || {};
    var basis = (opts.against || []).map(normalize);
    var out = [];
    for (var i = 0; i < k; i++) {
      var res = powerIteration(matVec, n, { against: basis, maxIter: opts.maxIter, tol: opts.tol, rng: opts.rng });
      out.push({ value: res.value, vector: res.vector, converged: res.converged, iters: res.iters });
      basis = basis.concat([res.vector]);
    }
    return out;
  }

  // Residual ‖Mv − λv‖ — how well (λ,v) satisfies the eigen-equation.
  function eigResidual(matVec, value, vector) {
    var Mv = matVec(vector);
    var r = axpy(Mv, -value, vector);
    return norm(r);
  }

  var Numlib = {
    dot: dot, norm: norm, scale: scale, axpy: axpy, normalize: normalize,
    orthogonalize: orthogonalize, randomUnitVector: randomUnitVector,
    gaussian: gaussian, gaussianVector: gaussianVector,
    matVecDense: matVecDense,
    powerIteration: powerIteration, topEigenpairs: topEigenpairs, eigResidual: eigResidual,
    version: '1.0.0'
  };

  global.Numlib = Numlib;
  if (typeof module !== 'undefined' && module.exports) module.exports = Numlib;
})(typeof globalThis !== 'undefined' ? globalThis : this);
