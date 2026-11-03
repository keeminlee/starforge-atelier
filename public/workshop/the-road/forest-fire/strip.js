/* The Road's line under each exhibit's canvas. The atlas writes its readout (the clock,
   the frame rate, then the sim's counts) as one long line, far wider than these small
   frames. This keeps that line hidden and mirrors it here, wrapped between fields, with
   as many fields as the frame's room holds: always the clock, the tree cover and the
   burning count, then the others in the order below until one doesn't fit, the frame
   rate last. It only mirrors: the sim and atlas.js stay as they were, and a sim that stops
   stops writing, so this line stops too (the page then says why, in the same element).

   The room is set by the page (the frame's height less the canvas). Which fields fit is
   decided against each number grown by a digit (to three at least), so the set holds
   while the numbers grow; it's decided again when the room changes or the line no
   longer fits. */
(function () {
  var stage = document.getElementById('stage');
  var readout = stage && stage.querySelector('.readout');
  if (!readout) return;
  var strip = document.createElement('p');
  strip.className = 'road-strip';
  stage.append(strip);

  // a field is kept when its text starts with one of these; the first three always show
  var CORE = ['t=', 'cover ', 'burning '];
  var EXTRA = ['last fire ', 'max ', 'fires ', 'p/f ', 'sizes', '/ fps$/'];
  var matches = function (field, key) {
    return key.charAt(0) === '/' ? new RegExp(key.slice(1, -1)).test(field) : field.indexOf(key) === 0;
  };
  var NB = String.fromCharCode(160);
  var SEP = NB + '·' + ' ';                                  // the dot stays with the field before it
  var fieldsOf = function (text) { return text.split('·').map(function (s) { return s.trim(); }).filter(Boolean); };
  var join = function (fields) { return fields.map(function (s) { return s.split(' ').join(NB); }).join(SEP); };
  var grown = function (fields) {
    return fields.map(function (s) { return s.replace(/\d+/g, function (d) { return new Array(Math.max(d.length + 1, 3) + 1).join('9'); }); });
  };
  var fits = function (text) {
    strip.textContent = text;
    return strip.scrollHeight <= strip.clientHeight + 1 && strip.scrollWidth <= strip.clientWidth + 1;
  };

  var keys = null, room = '';
  var pick = function (fields, ks) {
    return fields.filter(function (f) { return ks.some(function (k) { return matches(f, k); }); });
  };
  var choose = function (fields) {
    var ks = CORE.slice();
    for (var i = 0; i < EXTRA.length; i++) {
      var trial = ks.concat(EXTRA[i]);
      if (!fits(join(grown(pick(fields, trial))))) break;   // the rest are dropped in order
      ks = trial;
    }
    return ks;
  };
  var render = function () {
    var fields = fieldsOf(readout.textContent);
    if (!fields.length) return;
    // A line this can't read (one field, or none of the three it always shows) is shown
    // as the atlas wrote it, wrapped anywhere, rather than as nothing.
    var raw = fields.length < 2 || !pick(fields, CORE).length;
    strip.classList.toggle('is-raw', raw);
    if (raw) { keys = null; strip.textContent = readout.textContent; return; }
    var now = strip.clientWidth + 'x' + strip.clientHeight;
    if (!keys || now !== room) { keys = choose(fields); room = now; }
    if (!fits(join(pick(fields, keys)))) { keys = choose(fields); fits(join(pick(fields, keys))); }
  };
  new MutationObserver(render).observe(readout, { childList: true, characterData: true, subtree: true });
  render();
})();
