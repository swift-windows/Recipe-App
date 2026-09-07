/* Swift Windows Quoting — drawing core.
 * Shared primitives for every window/door renderer.
 * All geometry is in millimetres. The SVG viewBox is in mm too, so a
 * 1200mm window is literally 1200 units wide. No scaling guesswork.
 */
(function (SW) {
  'use strict';

  var D = SW.draw = SW.draw || {};

  /* ---------------------------------------------------------------
   * Profile sizes (mm). These are drawing proportions, not a supplier
   * spec — they are editable in Settings so the elevation matches
   * whatever system the job is actually quoted on.
   * ------------------------------------------------------------- */
  D.PROFILE = {
    outerFrame: 70,   // face width of the outer frame
    sash:       70,   // face width of an opening sash
    mullion:    70,   // vertical divider between lights
    transom:    70,   // horizontal divider between lights
    bead:       14,   // glazing bead sightline
    cillDepth:  40,   // cill nose below the frame
    cillOversail: 25, // how far the cill runs past the frame each side
    barWidth:   22,   // georgian / astragal bar face
    doorLeaf:   105,  // door leaf stile/rail face width
    doorMidRail: 160,
    sashHorn:   45    // box-sash horn projection
  };

  /* ---------------------------------------------------------------
   * Colour handling.
   * Each finish carries a base face colour plus derived light/dark
   * edges so mitred members read with real depth rather than flat fill.
   * ------------------------------------------------------------- */
  D.FINISHES = {
    'white':        { name: 'White',              face: '#F2F3F1', grain: false },
    'cream':        { name: 'Cream',              face: '#EFE7D2', grain: false },
    'anthracite':   { name: 'Anthracite Grey',    face: '#383E42', grain: true  },
    'agate':        { name: 'Agate Grey',         face: '#7C837F', grain: true  },
    'black':        { name: 'Black',              face: '#26282A', grain: true  },
    'chartwell':    { name: 'Chartwell Green',    face: '#B7C4B0', grain: true  },
    'painswick':    { name: 'Painswick',          face: '#A9A9A0', grain: true  },
    'irishoak':     { name: 'Irish Oak',          face: '#8A5A2B', grain: true  },
    'goldenoak':    { name: 'Golden Oak',         face: '#9C6428', grain: true  },
    'rosewood':     { name: 'Rosewood',           face: '#5C2418', grain: true  },
    'sagegreen':    { name: 'Sage Green',         face: '#7E8C74', grain: true  },
    'duckegg':      { name: 'Duck Egg Blue',      face: '#8FA9AE', grain: true  }
  };

  D.finish = function (key) {
    return D.FINISHES[key] || D.FINISHES.white;
  };

  /* Shade a hex colour by a percentage. +ve lightens, -ve darkens. */
  D.shade = function (hex, pct) {
    var c = hex.replace('#', '');
    if (c.length === 3) { c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; }
    var r = parseInt(c.substr(0, 2), 16),
        g = parseInt(c.substr(2, 2), 16),
        b = parseInt(c.substr(4, 2), 16);
    var t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return '#' + [r, g, b].map(function (v) {
      var s = v.toString(16); return s.length === 1 ? '0' + s : s;
    }).join('');
  };

  /* ---------------------------------------------------------------
   * Tiny SVG string builders. Building markup as strings keeps the
   * whole renderer synchronous and printable — no DOM round-trips.
   * ------------------------------------------------------------- */
  function attrs(o) {
    var out = '';
    for (var k in o) {
      if (o[k] === null || o[k] === undefined || o[k] === '') { continue; }
      out += ' ' + k + '="' + String(o[k]).replace(/"/g, '&quot;') + '"';
    }
    return out;
  }
  D.attrs = attrs;
  D.el   = function (tag, o, inner) {
    return inner === undefined
      ? '<' + tag + attrs(o) + '/>'
      : '<' + tag + attrs(o) + '>' + inner + '</' + tag + '>';
  };
  D.rect = function (x, y, w, h, o) {
    o = o || {}; o.x = r2(x); o.y = r2(y); o.width = r2(Math.max(0, w)); o.height = r2(Math.max(0, h));
    return D.el('rect', o);
  };
  D.line = function (x1, y1, x2, y2, o) {
    o = o || {}; o.x1 = r2(x1); o.y1 = r2(y1); o.x2 = r2(x2); o.y2 = r2(y2);
    return D.el('line', o);
  };
  D.path = function (d, o) { o = o || {}; o.d = d; return D.el('path', o); };
  D.poly = function (pts, o) {
    o = o || {};
    o.points = pts.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' ');
    return D.el('polygon', o);
  };
  D.text = function (x, y, s, o) {
    o = o || {}; o.x = r2(x); o.y = r2(y);
    return D.el('text', o, esc(s));
  };
  function r2(n) { return Math.round(n * 100) / 100; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  D.r2 = r2; D.esc = esc;

  /* ---------------------------------------------------------------
   * Gradient / pattern definitions. Emitted once per drawing.
   * ------------------------------------------------------------- */
  D.defs = function (id, finishKey) {
    var f = D.finish(finishKey);
    var base = f.face;
    var out = [];

    // Frame face: subtle top-light / bottom-shade so members look solid.
    out.push(D.el('linearGradient', { id: id + '-fh', x1: '0', y1: '0', x2: '0', y2: '1' },
      D.el('stop', { offset: '0%',   'stop-color': D.shade(base, 16) }) +
      D.el('stop', { offset: '45%',  'stop-color': base }) +
      D.el('stop', { offset: '100%', 'stop-color': D.shade(base, -14) })));

    // Vertical members are lit from the left instead.
    out.push(D.el('linearGradient', { id: id + '-fv', x1: '0', y1: '0', x2: '1', y2: '0' },
      D.el('stop', { offset: '0%',   'stop-color': D.shade(base, 14) }) +
      D.el('stop', { offset: '45%',  'stop-color': base }) +
      D.el('stop', { offset: '100%', 'stop-color': D.shade(base, -12) })));

    // Glass: cool sky-toward-ground gradient. Deliberately restrained —
    // a quote drawing should read as a technical elevation, not clipart.
    out.push(D.el('linearGradient', { id: id + '-glass', x1: '0', y1: '0', x2: '0.35', y2: '1' },
      D.el('stop', { offset: '0%',   'stop-color': '#D9E6EC' }) +
      D.el('stop', { offset: '38%',  'stop-color': '#C6D8E1' }) +
      D.el('stop', { offset: '70%',  'stop-color': '#BFD2DB' }) +
      D.el('stop', { offset: '100%', 'stop-color': '#CFDDE2' })));

    // Obscure glass gets a fine texture over the same base.
    out.push(D.el('pattern', { id: id + '-obscure', width: 26, height: 26,
                               patternUnits: 'userSpaceOnUse' },
      D.rect(0, 0, 26, 26, { fill: '#C9D9E0' }) +
      D.path('M0 26 L26 0 M-6 6 L6 -6 M20 32 L32 20',
             { stroke: '#DCE8ED', 'stroke-width': 6, fill: 'none' })));

    // Woodgrain overlay for foiled finishes.
    if (f.grain) {
      out.push(D.el('pattern', { id: id + '-grain', width: 60, height: 14,
                                 patternUnits: 'userSpaceOnUse' },
        D.path('M0 3 Q15 0 30 3 T60 3 M0 9 Q18 12 34 9 T60 9',
               { stroke: D.shade(base, -22), 'stroke-width': 1.1,
                 fill: 'none', opacity: 0.5 })));
    }

    // Soft drop shadow used under sashes and door leaves.
    out.push(D.el('filter', { id: id + '-sh', x: '-8%', y: '-8%',
                              width: '120%', height: '120%' },
      D.el('feDropShadow', { dx: 0, dy: 4, stdDeviation: 5,
                             'flood-color': '#0d2430', 'flood-opacity': 0.28 })));

    return D.el('defs', {}, out.join(''));
  };

  D.hasGrain = function (finishKey) { return D.finish(finishKey).grain; };

  /* ---------------------------------------------------------------
   * A framed member drawn as a mitred picture-frame band.
   * Given an outer box and a face width, returns the four mitred
   * quads plus the mitre lines. This is what sells the drawing as a
   * real window — square-cut corners always look wrong.
   * ------------------------------------------------------------- */
  D.mitredFrame = function (x, y, w, h, t, id, finishKey, opts) {
    opts = opts || {};
    var o = [], gv = 'url(#' + id + '-fv)', gh = 'url(#' + id + '-fh)';
    var x2 = x + w, y2 = y + h, ix = x + t, iy = y + t, ix2 = x2 - t, iy2 = y2 - t;
    var edge = D.shade(D.finish(finishKey).face, -34);
    var stroke = { stroke: edge, 'stroke-width': opts.thin ? 1.2 : 1.6, 'stroke-linejoin': 'round' };

    // Head, cill, and the two jambs as mitred trapeziums.
    o.push(D.poly([[x, y], [x2, y], [ix2, iy], [ix, iy]],
                  Object.assign({ fill: gh }, stroke)));                 // head
    o.push(D.poly([[x, y2], [x2, y2], [ix2, iy2], [ix, iy2]],
                  Object.assign({ fill: gh }, stroke)));                 // cill
    o.push(D.poly([[x, y], [ix, iy], [ix, iy2], [x, y2]],
                  Object.assign({ fill: gv }, stroke)));                 // left jamb
    o.push(D.poly([[x2, y], [ix2, iy], [ix2, iy2], [x2, y2]],
                  Object.assign({ fill: gv }, stroke)));                 // right jamb

    if (D.hasGrain(finishKey)) {
      o.push(D.path(
        'M' + x + ' ' + y + 'H' + x2 + 'V' + y2 + 'H' + x + 'Z ' +
        'M' + ix + ' ' + iy + 'H' + ix2 + 'V' + iy2 + 'H' + ix + 'Z',
        { fill: 'url(#' + id + '-grain)', 'fill-rule': 'evenodd', opacity: 0.55 }));
    }
    return o.join('');
  };

  /* ---------------------------------------------------------------
   * Glazed aperture: bead rebate, glass, sheen, and the shadow the
   * frame casts onto the glass.
   * ------------------------------------------------------------- */
  D.glazing = function (x, y, w, h, id, finishKey, glassOpts) {
    glassOpts = glassOpts || {};
    if (w <= 0 || h <= 0) { return ''; }
    var o = [];
    var b = Math.min(D.PROFILE.bead, w / 2 - 1, h / 2 - 1);
    var edge = D.shade(D.finish(finishKey).face, -30);

    // Glazing bead — a narrow chamfer inside the sightline.
    o.push(D.rect(x, y, w, h, { fill: D.shade(D.finish(finishKey).face, -8),
                                stroke: edge, 'stroke-width': 1.2 }));
    var gx = x + b, gy = y + b, gw = w - 2 * b, gh = h - 2 * b;
    if (gw <= 0 || gh <= 0) { return o.join(''); }

    var fill = glassOpts.obscure ? 'url(#' + id + '-obscure)' : 'url(#' + id + '-glass)';
    o.push(D.rect(gx, gy, gw, gh, { fill: fill }));

    // Diagonal sheen — one clean band, clipped to the pane.
    var cid = id + '-c' + (D.glazing._n = (D.glazing._n || 0) + 1);
    o.push(D.el('clipPath', { id: cid }, D.rect(gx, gy, gw, gh, {})));
    o.push(D.el('g', { 'clip-path': 'url(#' + cid + ')' },
      D.poly([[gx - gh * 0.9, gy + gh], [gx + gw * 0.34, gy - 10],
              [gx + gw * 0.56, gy - 10], [gx - gh * 0.9 + gw * 0.22, gy + gh]],
             { fill: '#FFFFFF', opacity: 0.28 }) +
      D.poly([[gx + gw * 0.62, gy - 10], [gx + gw * 0.70, gy - 10],
              [gx + gw * 0.70 - gh, gy + gh], [gx + gw * 0.62 - gh, gy + gh]],
             { fill: '#FFFFFF', opacity: 0.16 })));

    // Inner shadow from the surrounding frame, top and left only.
    o.push(D.path('M' + D.r2(gx) + ' ' + D.r2(gy + gh) + 'V' + D.r2(gy) + 'H' + D.r2(gx + gw),
      { stroke: '#7C97A3', 'stroke-width': 3, fill: 'none', opacity: 0.5 }));
    o.push(D.rect(gx, gy, gw, gh, { fill: 'none', stroke: '#8FA8B2', 'stroke-width': 1 }));

    // Georgian / astragal bars.
    if (glassOpts.barsV || glassOpts.barsH) {
      o.push(D.bars(gx, gy, gw, gh, glassOpts.barsV | 0, glassOpts.barsH | 0,
                    id, finishKey, glassOpts.barStyle));
    }
    return o.join('');
  };

  /* Glazing bars across a pane. barsV/barsH are the number of BARS,
   * so 1 vertical bar gives 2 panes. */
  D.bars = function (x, y, w, h, nv, nh, id, finishKey, style) {
    var o = [], bw = D.PROFILE.barWidth;
    var face = D.finish(finishKey).face;
    var g = 'url(#' + id + '-fv)', gh2 = 'url(#' + id + '-fh)';
    var edge = D.shade(face, -30);
    var proud = style === 'astragal';
    var i, px, py;

    for (i = 1; i <= nv; i++) {
      px = x + (w * i) / (nv + 1) - bw / 2;
      o.push(D.rect(px, y, bw, h, { fill: g, stroke: edge, 'stroke-width': 0.9 }));
      if (proud) {
        o.push(D.rect(px + bw * 0.28, y, bw * 0.44, h,
                      { fill: D.shade(face, 20), opacity: 0.85 }));
      }
    }
    for (i = 1; i <= nh; i++) {
      py = y + (h * i) / (nh + 1) - bw / 2;
      o.push(D.rect(x, py, w, bw, { fill: gh2, stroke: edge, 'stroke-width': 0.9 }));
      if (proud) {
        o.push(D.rect(x, py + bw * 0.28, w, bw * 0.44,
                      { fill: D.shade(face, 20), opacity: 0.85 }));
      }
    }
    return o.join('');
  };

  /* ---------------------------------------------------------------
   * Hardware.
   * ------------------------------------------------------------- */
  D.HARDWARE = {
    'chrome':   { name: 'Polished Chrome', body: '#C9CDD1', hi: '#F4F6F7', lo: '#8D9398' },
    'satin':    { name: 'Satin Chrome',    body: '#B4B9BD', hi: '#E1E5E7', lo: '#83888C' },
    'white':    { name: 'White',           body: '#F0F1EF', hi: '#FFFFFF', lo: '#B9BCB8' },
    'black':    { name: 'Matt Black',      body: '#33373A', hi: '#5A6064', lo: '#1B1E20' },
    'gold':     { name: 'Antique Gold',    body: '#B79553', hi: '#E4CB8E', lo: '#7E6431' },
    'graphite': { name: 'Graphite',        body: '#4A5054', hi: '#767D82', lo: '#2A2F32' }
  };

  /* Espagnolette handle on a casement sash. side = 'left'|'right' —
   * the side the handle sits on (opposite the hinges). */
  D.casementHandle = function (sx, sy, sw, sh, side, hw) {
    var m = D.HARDWARE[hw] || D.HARDWARE.white;
    var cy = sy + sh / 2;
    var inset = D.PROFILE.sash / 2;
    var cx = side === 'left' ? sx + inset : sx + sw - inset;
    var dir = side === 'left' ? -1 : 1;
    var o = [];
    // Backplate
    o.push(D.rect(cx - 13, cy - 46, 26, 92,
      { rx: 8, fill: m.body, stroke: m.lo, 'stroke-width': 1.2 }));
    o.push(D.rect(cx - 9, cy - 42, 7, 84, { rx: 3.5, fill: m.hi, opacity: 0.75 }));
    // Lever sweeping down and away from the hinge
    o.push(D.path('M' + D.r2(cx) + ' ' + D.r2(cy) +
                  'q' + D.r2(dir * 26) + ' 4 ' + D.r2(dir * 34) + ' 46',
      { stroke: m.body, 'stroke-width': 15, 'stroke-linecap': 'round', fill: 'none' }));
    o.push(D.path('M' + D.r2(cx) + ' ' + D.r2(cy - 3) +
                  'q' + D.r2(dir * 26) + ' 4 ' + D.r2(dir * 33) + ' 44',
      { stroke: m.hi, 'stroke-width': 4.5, 'stroke-linecap': 'round',
        fill: 'none', opacity: 0.8 }));
    o.push(D.el('circle', { cx: D.r2(cx), cy: D.r2(cy), r: 11,
                            fill: m.body, stroke: m.lo, 'stroke-width': 1.2 }));
    o.push(D.el('circle', { cx: D.r2(cx - 3), cy: D.r2(cy - 3), r: 4.5,
                            fill: m.hi, opacity: 0.85 }));
    return o.join('');
  };

  /* Butt hinges shown on the hinge stile. */
  D.hinges = function (sx, sy, sw, sh, hingeSide, hw, count) {
    var m = D.HARDWARE[hw] || D.HARDWARE.white;
    var o = [], n = count || (sh > 1200 ? 3 : 2);
    var x = hingeSide === 'left' ? sx + 4 : sx + sw - 12;
    for (var i = 0; i < n; i++) {
      var y = sy + sh * (i + 1) / (n + 1) - 45;
      o.push(D.rect(x, y, 8, 90, { rx: 3, fill: m.body,
                                   stroke: m.lo, 'stroke-width': 0.8 }));
    }
    return o.join('');
  };

  /* Trickle vent let into the head of a frame. */
  D.trickleVent = function (x, y, w, finishKey) {
    var face = D.finish(finishKey).face;
    var vw = Math.min(400, w * 0.45), vx = x + (w - vw) / 2;
    var o = [];
    o.push(D.rect(vx, y + 12, vw, 26, { rx: 5, fill: D.shade(face, -12),
                                        stroke: D.shade(face, -38), 'stroke-width': 1 }));
    for (var i = 0; i < 9; i++) {
      o.push(D.rect(vx + 14 + i * ((vw - 28) / 9), y + 18, (vw - 28) / 18, 14,
                    { rx: 2, fill: D.shade(face, -42), opacity: 0.75 }));
    }
    return o.join('');
  };

  /* Cill under the frame, with a nose and a shadow line. */
  D.cill = function (x, y, w, finishKey) {
    var p = D.PROFILE, face = D.finish(finishKey).face;
    var cx = x - p.cillOversail, cw = w + p.cillOversail * 2;
    var o = [];
    o.push(D.poly([[cx, y], [cx + cw, y], [cx + cw - 10, y + p.cillDepth],
                   [cx + 10, y + p.cillDepth]],
      { fill: D.shade(face, -6), stroke: D.shade(face, -36), 'stroke-width': 1.6 }));
    o.push(D.rect(cx + 4, y + 2, cw - 8, 7, { fill: D.shade(face, 22), opacity: 0.8 }));
    o.push(D.line(cx + 8, y + p.cillDepth - 8, cx + cw - 8, y + p.cillDepth - 8,
      { stroke: D.shade(face, -30), 'stroke-width': 1.1, opacity: 0.8 }));
    return o.join('');
  };

  SW.draw = D;
})(window.SW = window.SW || {});
