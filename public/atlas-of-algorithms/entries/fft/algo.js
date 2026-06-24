/* =====================================================================
 * fft / algo.js  —  The Atlas of Algorithms (Numerical Methods)
 * ---------------------------------------------------------------------
 * The Fast Fourier Transform (Cooley–Tukey, 1965). Compute the Discrete
 * Fourier Transform in O(n log n) instead of O(n²) by recursively reusing
 * the even- and odd-indexed sub-transforms. Shown iteratively: bit-reverse
 * the input, then log₂n butterfly stages combine ever-larger blocks with
 * twiddle factors — turning a time-domain signal into its spectrum.
 * Dependency-free complex arithmetic (separate re/im). One source of truth.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Fast Fourier Transform',
    slug: 'fft',
    family: 'numerical',
    oneLiner: 'Turn a signal into its frequencies in O(n log n) — the divide-and-conquer that reshaped signal processing.',
    invariant: 'The FFT computes exactly the DFT (it inverts losslessly: ifft(fft(x)) = x), just far faster.',
    cost: { time: 'O(n log n)', space: 'O(n)' },
    controls: [
      { key: 'N', type: 'select', label: 'Size (power of 2)', value: '16',
        options: [{ value: '8', label: '8' }, { value: '16', label: '16' }, { value: '32', label: '32' }] },
      { key: 'shuffle', type: 'button', label: 'New signal',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var N = parseInt(params.N || '16', 10); if (![8, 16, 32].includes(N)) N = 16;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    // signal = sum of a couple pure cosines (so the spectrum has clean peaks)
    var f1 = 1 + Math.floor(rng() * (N / 2 - 1)), f2 = 1 + Math.floor(rng() * (N / 2 - 1));
    if (f2 === f1) f2 = (f2 % (N / 2 - 1)) + 1;
    var a2 = 0.6 + rng() * 0.3;
    var x = []; for (var n = 0; n < N; n++) x.push(Math.cos(2 * Math.PI * f1 * n / N) + a2 * Math.cos(2 * Math.PI * f2 * n / N));

    var re = x.slice(), im = new Array(N).fill(0), mults = 0;
    function mags() { var m = []; for (var i = 0; i < N; i++) m.push(Math.hypot(re[i], im[i])); return m; }
    function snap(phase, hl, annotation) {
      return {
        N: N, mag: mags(), re: re.slice(), im: im.slice(), x: x.slice(), f1: f1, f2: f2,
        phase: phase, highlight: hl || {}, mults: mults, status: phase,
        readout: [
          { label: 'size n', value: N },
          { label: 'phase', value: phase === 'input' ? 'time domain' : phase === 'bitrev' ? 'bit-reversal' : phase === 'done' ? 'frequency domain' : 'stage ' + (hl.stage || '') + '/' + Math.log2(N) },
          { label: 'complex mults', value: mults }
        ],
        annotation: annotation
      };
    }

    yield snap('input', {}, 'Input: a real signal of ' + N + ' samples (here cos at frequencies ' + f1 + ' and ' + f2 + '). The FFT will reveal exactly those frequencies as peaks.');

    // bit-reversal permutation
    for (var i = 1, j = 0; i < N; i++) {
      var bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { var tr = re[i]; re[i] = re[j]; re[j] = tr; var ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    yield snap('bitrev', {}, 'Reorder samples by bit-reversed index — this lines up each recursive even/odd split so the butterflies can run in place.');

    // butterfly stages
    var stage = 0;
    for (var len = 2; len <= N; len <<= 1) {
      stage++;
      var ang = -2 * Math.PI / len, wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
      for (var s = 0; s < N; s += len) {
        var wRe = 1, wIm = 0;
        for (var k = 0; k < len / 2; k++) {
          var aRe = re[s + k], aIm = im[s + k];
          var bRe = re[s + k + len / 2] * wRe - im[s + k + len / 2] * wIm;
          var bIm = re[s + k + len / 2] * wIm + im[s + k + len / 2] * wRe;
          mults++;
          re[s + k] = aRe + bRe; im[s + k] = aIm + bIm;
          re[s + k + len / 2] = aRe - bRe; im[s + k + len / 2] = aIm - bIm;
          var nwRe = wRe * wlenRe - wIm * wlenIm; wIm = wRe * wlenIm + wIm * wlenRe; wRe = nwRe;
        }
      }
      yield snap('stage', { stage: stage, len: len }, 'Stage ' + stage + ' of ' + Math.log2(N) + ': combine blocks of ' + len + '. Each "butterfly" pairs an element with the one ' + (len / 2) + ' ahead, scaled by a twiddle factor e^(−2πi·k/' + len + ').');
    }

    // magnitude spectrum (final)
    var fin = snap('done', {}, 'Done in ' + mults + ' complex multiplications (a brute-force DFT would need ' + (N * N) + '). The spectrum peaks at bins ' + f1 + ' and ' + f2 + ' (and their mirrors ' + (N - f1) + ', ' + (N - f2) + ') — exactly the signal\'s frequencies. ifft would rebuild the signal exactly.');
    fin.report = { N: N, x: x.slice(), re: re.slice(), im: im.slice(), f1: f1, f2: f2, mults: mults };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var N = snap.N, peaks = {};
    if (snap.phase === 'done') { peaks[snap.f1] = peaks[N - snap.f1] = peaks[snap.f2] = peaks[N - snap.f2] = true; }
    var values;
    if (snap.phase === 'input') {            // shift the signed waveform to non-negative (bars draw upward)
      var mn = Math.min.apply(null, snap.x);
      values = snap.x.map(function (v) { return v - mn + 0.04; });
    } else { values = snap.mag; }
    root.Algo.bars(ctx, {
      values: values, w: w, h: h, theme: theme,
      colorFor: function (idx) {
        if (snap.phase === 'done') return peaks[idx] ? theme.invariant : (theme.panel_2 || theme.ink);
        if (snap.phase === 'input') return theme.cost;
        return theme.accent;
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
