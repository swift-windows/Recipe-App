/* Opening symbols and dimension lines.
 *
 * Convention used throughout: every elevation is drawn AS VIEWED FROM
 * OUTSIDE. Opening lights carry a dashed "V" whose APEX SITS ON THE
 * HINGE SIDE — the standard UK trade convention. A key is printed on
 * the drawing so the customer is never guessing.
 */
(function (SW) {
  'use strict';
  var D = SW.draw;

  var DASH = { stroke: '#1D3D4C', 'stroke-width': 3.2, fill: 'none',
               'stroke-dasharray': '26 18', 'stroke-linecap': 'round',
               'stroke-linejoin': 'round', opacity: 0.85 };

  function v(pts) { return D.poly ? null : null; }

  /* Draw the opening indicator inside a sash aperture. */
  D.openSymbol = function (x, y, w, h, type, hinge) {
    if (!type || type === 'fixed') { return ''; }
    var inset = Math.min(w, h) * 0.06;
    var x1 = x + inset, y1 = y + inset, x2 = x + w - inset, y2 = y + h - inset;
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var o = [];

    function vee(ax, ay, b1x, b1y, b2x, b2y) {
      return D.path('M' + D.r2(b1x) + ' ' + D.r2(b1y) +
                    'L' + D.r2(ax) + ' ' + D.r2(ay) +
                    'L' + D.r2(b2x) + ' ' + D.r2(b2y), DASH);
    }

    switch (type) {
      case 'side-hung':
        // Apex on the hinge stile, arms to the two corners of the handle side.
        if (hinge === 'left') { o.push(vee(x1, my, x2, y1, x2, y2)); }
        else                  { o.push(vee(x2, my, x1, y1, x1, y2)); }
        break;
      case 'top-hung':
        o.push(vee(mx, y1, x1, y2, x2, y2));
        break;
      case 'bottom-hung':      // hopper / inward opening vent
        o.push(vee(mx, y2, x1, y1, x2, y1));
        break;
      case 'tilt-turn':
        // Both actions shown: turn (side) plus tilt (bottom).
        if (hinge === 'left') { o.push(vee(x1, my, x2, y1, x2, y2)); }
        else                  { o.push(vee(x2, my, x1, y1, x1, y2)); }
        o.push(vee(mx, y2, x1, y1, x2, y1));
        break;
      case 'sliding-left':
      case 'sliding-right':
        o.push(D.slideArrow(x, y, w, h, type === 'sliding-left' ? -1 : 1));
        break;
    }
    return o.join('');
  };

  /* Horizontal sliding arrow for patio / inline sliders. */
  D.slideArrow = function (x, y, w, h, dir) {
    var cy = y + h / 2, len = Math.min(w * 0.5, 420);
    var sx = x + w / 2 - (dir * len) / 2, ex = sx + dir * len;
    var head = 46;
    return D.line(sx, cy, ex - dir * head * 0.5, cy,
                  { stroke: '#1D3D4C', 'stroke-width': 5, 'stroke-linecap': 'round',
                    opacity: 0.85 }) +
           D.poly([[ex, cy], [ex - dir * head, cy - head * 0.42],
                   [ex - dir * head, cy + head * 0.42]],
                  { fill: '#1D3D4C', opacity: 0.85 });
  };

  /* Folding indicator for bi-folds: a crisp concertina strip along the
   * bottom rail, plus a travel arrow showing which way the stack goes. */
  D.foldSymbol = function (x, y, w, h, leaves, stackDir) {
    var o = [], step = w / leaves;
    // Sit the concertina just clear of the bottom rail so it does not
    // clutter the glass or fight with the opening triangles.
    var cy = y + h + 26;
    var amp = Math.min(step * 0.14, 44);
    var d = 'M' + D.r2(x) + ' ' + D.r2(cy);
    for (var i = 0; i < leaves; i++) {
      d += 'L' + D.r2(x + step * (i + 0.5)) + ' ' + D.r2(cy - amp);
      d += 'L' + D.r2(x + step * (i + 1)) + ' ' + D.r2(cy);
    }
    o.push(D.path(d, { stroke: '#1D3D4C', 'stroke-width': 4, fill: 'none',
                       opacity: 0.75, 'stroke-linejoin': 'miter',
                       'stroke-linecap': 'round' }));
    o.push(D.slideArrow(x + w * 0.30, cy + amp * 0.6, w * 0.4, amp * 2,
                        stackDir === 'left' ? -1 : 1));
    return o.join('');
  };

  /* ---------------------------------------------------------------
   * Dimension lines. Extension lines, arrow ticks, and a mm label
   * on a knocked-out background so it stays readable over the frame.
   * ------------------------------------------------------------- */
  var DIM_COL = '#4A5C66';

  function tick(x, y, ang) {
    var r = 13, a = ang * Math.PI / 180;
    return D.line(x - Math.cos(a) * r, y - Math.sin(a) * r,
                  x + Math.cos(a) * r, y + Math.sin(a) * r,
                  { stroke: DIM_COL, 'stroke-width': 2.4 });
  }

  D.dimH = function (x1, x2, y, label, opts) {
    opts = opts || {};
    var o = [], ext = opts.ext || 0, fs = opts.fs || 62;
    o.push(D.line(x1, y, x2, y, { stroke: DIM_COL, 'stroke-width': 2 }));
    o.push(tick(x1, y, 45)); o.push(tick(x2, y, 45));
    if (ext) {
      o.push(D.line(x1, y - ext, x1, y + 8, { stroke: DIM_COL, 'stroke-width': 1.2,
                                              opacity: 0.55 }));
      o.push(D.line(x2, y - ext, x2, y + 8, { stroke: DIM_COL, 'stroke-width': 1.2,
                                              opacity: 0.55 }));
    }
    var cx = (x1 + x2) / 2, tw = String(label).length * fs * 0.6 + 22;
    o.push(D.rect(cx - tw / 2, y - fs * 0.78, tw, fs * 1.12,
                  { fill: '#FFFFFF', opacity: 0.92, rx: 6 }));
    o.push(D.text(cx, y + fs * 0.3, label,
                  { 'text-anchor': 'middle', 'font-size': fs, fill: DIM_COL,
                    'font-family': 'Inter, Helvetica, Arial, sans-serif',
                    'font-weight': 600 }));
    return o.join('');
  };

  D.dimV = function (y1, y2, x, label, opts) {
    opts = opts || {};
    var o = [], ext = opts.ext || 0, fs = opts.fs || 62;
    o.push(D.line(x, y1, x, y2, { stroke: DIM_COL, 'stroke-width': 2 }));
    o.push(tick(x, y1, 45)); o.push(tick(x, y2, 45));
    if (ext) {
      o.push(D.line(x - ext, y1, x + 8, y1, { stroke: DIM_COL, 'stroke-width': 1.2,
                                              opacity: 0.55 }));
      o.push(D.line(x - ext, y2, x + 8, y2, { stroke: DIM_COL, 'stroke-width': 1.2,
                                              opacity: 0.55 }));
    }
    var cy = (y1 + y2) / 2, tw = String(label).length * fs * 0.6 + 22;
    o.push(D.el('g', { transform: 'rotate(-90 ' + D.r2(x) + ' ' + D.r2(cy) + ')' },
      D.rect(x - tw / 2, cy - fs * 0.78, tw, fs * 1.12,
             { fill: '#FFFFFF', opacity: 0.92, rx: 6 }) +
      D.text(x, cy + fs * 0.3, label,
             { 'text-anchor': 'middle', 'font-size': fs, fill: DIM_COL,
               'font-family': 'Inter, Helvetica, Arial, sans-serif',
               'font-weight': 600 })));
    return o.join('');
  };

  /* Key printed beneath the elevation. */
  D.viewKey = function (x, y, w, hasOpeners, fs) {
    fs = fs || 52;
    var txt = hasOpeners
      ? 'Viewed from outside — dashed lines indicate opening lights, apex at hinge side'
      : 'Viewed from outside';
    return D.text(x + w / 2, y, txt,
      { 'text-anchor': 'middle', 'font-size': fs, fill: '#7A8A93',
        'font-family': 'Inter, Helvetica, Arial, sans-serif', 'font-style': 'italic' });
  };

})(window.SW = window.SW || {});
