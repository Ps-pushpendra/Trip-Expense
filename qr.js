// Minimal QR code encoder (byte mode, error correction level M, versions 1-10: up to 213 characters).
// Used to show UPI payment QR codes. No external libraries.
(function (root) {
  'use strict';

  // ---- Reed-Solomon over GF(256), polynomial 0x11D ----
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function gmul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }

  function generator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
      g = next;
    }
    return g;
  }
  function remainder(data, n) {
    var g = generator(n), res = new Array(n).fill(0);
    data.forEach(function (b) {
      var factor = b ^ res.shift();
      res.push(0);
      for (var i = 0; i < n; i++) res[i] ^= gmul(g[i + 1], factor);
    });
    return res;
  }

  // Level M: [error-correction codewords per block, [[blocks, data codewords per block], ...]]
  var BLOCKS = {
    1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
    6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]],
    10: [26, [[4, 43], [1, 44]]]
  };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

  function dataCodewords(v) { return BLOCKS[v][1].reduce(function (s, g) { return s + g[0] * g[1]; }, 0); }
  function capacity(v) { return Math.floor((dataCodewords(v) * 8 - 4 - (v < 10 ? 8 : 16)) / 8); }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(str));
    var s = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function buildCodewords(bytes, v) {
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4);                               // byte mode
    push(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    var total = dataCodewords(v) * 8;
    push(0, Math.min(4, total - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }
    for (var pad = 0xEC; data.length < dataCodewords(v); pad ^= 0xEC ^ 0x11) data.push(pad);

    // split into blocks, add error correction, interleave
    var ecLen = BLOCKS[v][0], blocks = [], pos = 0;
    BLOCKS[v][1].forEach(function (g) {
      for (var k = 0; k < g[0]; k++) {
        var d = data.slice(pos, pos + g[1]); pos += g[1];
        blocks.push({ data: d, ec: remainder(d, ecLen) });
      }
    });
    var result = [], maxData = Math.max.apply(null, blocks.map(function (b) { return b.data.length; }));
    for (i = 0; i < maxData; i++) blocks.forEach(function (b) { if (i < b.data.length) result.push(b.data[i]); });
    for (i = 0; i < ecLen; i++) blocks.forEach(function (b) { result.push(b.ec[i]); });
    return result;
  }

  function matrix(text, forceMask) {
    var bytes = utf8(String(text)), v = 0;
    for (var t = 1; t <= 10; t++) { if (bytes.length <= capacity(t)) { v = t; break; } }
    if (!v) throw new Error('QR: text too long');
    var size = 17 + 4 * v;
    var mod = [], isFn = [];
    for (var y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); isFn.push(new Array(size).fill(false)); }
    function setFn(x, y, dark) { mod[y][x] = !!dark; isFn[y][x] = true; }
    function bit(n, i) { return ((n >>> i) & 1) !== 0; }

    // finder patterns + separators
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
    // timing patterns first, so the finder squares are drawn on top of them
    for (var i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    // alignment patterns
    var pos = ALIGN[v], last = pos.length - 1;
    for (i = 0; i <= last; i++) for (var j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    // reserve format area (real bits drawn later) and version info
    function drawFormat(mask) {
      var data = (0 << 3) | mask, rem = data;      // error correction level M = 0
      for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      for (k = 0; k <= 5; k++) setFn(8, k, bit(bits, k));
      setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
      for (k = 9; k < 15; k++) setFn(14 - k, 8, bit(bits, k));
      for (k = 0; k < 8; k++) setFn(size - 1 - k, 8, bit(bits, k));
      for (k = 8; k < 15; k++) setFn(8, size - 15 + k, bit(bits, k));
      setFn(8, size - 8, true);                    // always-dark module
    }
    drawFormat(0);
    if (v >= 7) {
      var rem = v;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vbits = (v << 12) | rem;
      for (i = 0; i < 18; i++) {
        var b = bit(vbits, i), a = size - 11 + (i % 3), c = Math.floor(i / 3);
        setFn(a, c, b); setFn(c, a, b);
      }
    }

    // place data bits in the zig-zag order
    var cw = buildCodewords(bytes, v), idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0, yy = upward ? size - 1 - vert : vert;
          if (!isFn[yy][x] && idx < cw.length * 8) { mod[yy][x] = bit(cw[idx >>> 3], 7 - (idx & 7)); idx++; }
        }
      }
    }

    function applyMask(m) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2 + (x * y) % 3) === 0; break;
          case 6: inv = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + (x * y) % 3) % 2 === 0;
        }
        if (!isFn[y][x] && inv) mod[y][x] = !mod[y][x];
      }
    }

    function penalty() {
      var p = 0, y, x, run, k;
      for (var pass = 0; pass < 2; pass++) {
        for (y = 0; y < size; y++) {
          run = 1;
          for (x = 1; x < size; x++) {
            var cur = pass ? mod[x][y] : mod[y][x], prev = pass ? mod[x - 1][y] : mod[y][x - 1];
            if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
          }
          var line = [];
          for (x = 0; x < size; x++) line.push((pass ? mod[x][y] : mod[y][x]) ? 1 : 0);
          var s = line.join('');
          [/10111010000/g, /00001011101/g].forEach(function (re) {
            var m; re.lastIndex = 0;
            while ((m = re.exec(s)) !== null) { p += 40; re.lastIndex = m.index + 1; }
          });
        }
      }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
        var c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
      }
      var dark = 0; for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
      var total = size * size;
      k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      return p + k * 10;
    }

    var best = 0, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      if (forceMask !== undefined && m !== forceMask) continue;
      applyMask(m); drawFormat(m);
      var sc = penalty();
      if (sc < bestScore) { bestScore = sc; best = m; }
      applyMask(m);                                // undo
    }
    applyMask(best); drawFormat(best);
    return mod.map(function (row) { return row.slice(); });
  }

  var api = { matrix: matrix, maxLength: capacity(10) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QR = api;
})(typeof window !== 'undefined' ? window : globalThis);
