/* Grid-based frame renderer.
 * Covers fixed lights, casements, fanlights, tilt & turn — anything that
 * is a rectangular frame divided by mullions and transoms.
 */
(function (SW) {
  'use strict';
  var D = SW.draw;

  /* Work out the pixel box of every cell in the grid. */
  D.layout = function (item) {
    var p = D.PROFILE;
    var of_ = p.outerFrame, mu = p.mullion, tr = p.transom;
    var W = item.width, H = item.height;
    var cols = (item.cols && item.cols.length ? item.cols : [W]).slice();
    var rows = (item.rows && item.rows.length ? item.rows : [H]).slice();

    var innerW = W - of_ * 2 - mu * (cols.length - 1);
    var innerH = H - of_ * 2 - tr * (rows.length - 1);
    var sumC = cols.reduce(function (a, b) { return a + (b > 0 ? b : 1); }, 0);
    var sumR = rows.reduce(function (a, b) { return a + (b > 0 ? b : 1); }, 0);

    // Light sizes are held as real sightline dimensions. They are only
    // rescaled if they no longer fit the frame — normally they are used
    // exactly as entered, so the dimension line never tells a fib.
    var cx = [], x = of_, i;
    for (i = 0; i < cols.length; i++) {
      var w = innerW * ((cols[i] > 0 ? cols[i] : 1) / sumC);
      cx.push({ x: x, w: w });
      x += w + mu;
    }
    var ry = [], y = of_;
    for (i = 0; i < rows.length; i++) {
      var h = innerH * ((rows[i] > 0 ? rows[i] : 1) / sumR);
      ry.push({ y: y, h: h });
      y += h + tr;
    }
    return { cols: cx, rows: ry, innerW: innerW, innerH: innerH };
  };

  D.cellAt = function (item, r, c) {
    var key = 'r' + r + 'c' + c;
    return (item.cells && item.cells[key]) || { type: 'fixed', hinge: 'left' };
  };

  /* A single opening sash sitting inside an aperture. */
  D.sash = function (bx, by, bw, bh, cell, id, finishKey, item) {
    var p = D.PROFILE, o = [];
    var gap = 6;                                   // shadow gap around the sash
    var sx = bx + gap, sy = by + gap,
        sw = bw - gap * 2, sh = bh - gap * 2;
    if (sw <= 0 || sh <= 0) { return ''; }

    o.push(D.rect(bx, by, bw, bh, { fill: D.shade(D.finish(finishKey).face, -40),
                                    opacity: 0.35 }));
    o.push(D.el('g', { filter: 'url(#' + id + '-sh)' },
      D.mitredFrame(sx, sy, sw, sh, p.sash, id, finishKey)));
    o.push(D.glazing(sx + p.sash, sy + p.sash, sw - p.sash * 2, sh - p.sash * 2,
      id, finishKey, {
        obscure: cell.obscure || item.obscure,
        barsV: cell.barsV, barsH: cell.barsH, barStyle: item.barStyle
      }));
    return o.join('');
  };

  /* Full frame elevation. Returns SVG inner markup, drawn at 0,0. */
  D.renderFrame = function (item, id) {
    var p = D.PROFILE, o = [];
    var fk = item.finishOut || 'white';
    var W = item.width, H = item.height;
    var L = D.layout(item);
    var hasOpener = false;

    // Outer frame
    o.push(D.mitredFrame(0, 0, W, H, p.outerFrame, id, fk));

    // Mullions and transoms drawn as full bands behind the lights so
    // the joints read correctly where they cross.
    var i, j;
    for (i = 0; i < L.cols.length - 1; i++) {
      var mx = L.cols[i].x + L.cols[i].w;
      o.push(D.rect(mx, p.outerFrame, p.mullion, H - p.outerFrame * 2,
        { fill: 'url(#' + id + '-fv)', stroke: D.shade(D.finish(fk).face, -34),
          'stroke-width': 1.4 }));
    }
    for (j = 0; j < L.rows.length - 1; j++) {
      var ty = L.rows[j].y + L.rows[j].h;
      o.push(D.rect(p.outerFrame, ty, W - p.outerFrame * 2, p.transom,
        { fill: 'url(#' + id + '-fh)', stroke: D.shade(D.finish(fk).face, -34),
          'stroke-width': 1.4 }));
    }
    if (D.hasGrain(fk)) {
      for (i = 0; i < L.cols.length - 1; i++) {
        o.push(D.rect(L.cols[i].x + L.cols[i].w, p.outerFrame, p.mullion,
          H - p.outerFrame * 2, { fill: 'url(#' + id + '-grain)', opacity: 0.5 }));
      }
      for (j = 0; j < L.rows.length - 1; j++) {
        o.push(D.rect(p.outerFrame, L.rows[j].y + L.rows[j].h, W - p.outerFrame * 2,
          p.transom, { fill: 'url(#' + id + '-grain)', opacity: 0.5 }));
      }
    }

    // Lights
    for (j = 0; j < L.rows.length; j++) {
      for (i = 0; i < L.cols.length; i++) {
        var cell = D.cellAt(item, j, i);
        var b = { x: L.cols[i].x, y: L.rows[j].y, w: L.cols[i].w, h: L.rows[j].h };
        var opening = cell.type && cell.type !== 'fixed';
        if (opening) { hasOpener = true; }

        if (opening || cell.type === 'dummy') {
          o.push(D.sash(b.x, b.y, b.w, b.h, cell, id, fk, item));
        } else {
          o.push(D.glazing(b.x, b.y, b.w, b.h, id, fk, {
            obscure: cell.obscure || item.obscure,
            barsV: cell.barsV, barsH: cell.barsH, barStyle: item.barStyle
          }));
        }
      }
    }

    // Hardware and opening symbols on top of everything.
    for (j = 0; j < L.rows.length; j++) {
      for (i = 0; i < L.cols.length; i++) {
        var c2 = D.cellAt(item, j, i);
        if (!c2.type || c2.type === 'fixed' || c2.type === 'dummy') { continue; }
        var bx = L.cols[i].x + 6, by = L.rows[j].y + 6;
        var bw = L.cols[i].w - 12, bh = L.rows[j].h - 12;
        o.push(D.openSymbol(bx + p.sash, by + p.sash,
                            bw - p.sash * 2, bh - p.sash * 2, c2.type, c2.hinge));
        var hSide = c2.hinge === 'left' ? 'right' : 'left';
        if (c2.type === 'side-hung' || c2.type === 'tilt-turn') {
          o.push(D.casementHandle(bx, by, bw, bh, hSide, item.hardware));
          o.push(D.hinges(bx, by, bw, bh, c2.hinge, item.hardware));
        } else if (c2.type === 'top-hung' || c2.type === 'bottom-hung') {
          // Handle centred on the bottom (or top) rail of the vent.
          var hy = c2.type === 'top-hung' ? by + bh - p.sash / 2 : by + p.sash / 2;
          o.push(D.ventHandle(bx + bw / 2, hy, item.hardware));
        }
      }
    }

    if (item.trickleVent) { o.push(D.trickleVent(0, 0, W, fk)); }
    if (item.cill !== false) { o.push(D.cill(0, H, W, fk)); }

    return { svg: o.join(''), hasOpener: hasOpener, layout: L };
  };

  /* Small centred handle for top/bottom hung vents. */
  D.ventHandle = function (cx, cy, hw) {
    var m = D.HARDWARE[hw] || D.HARDWARE.white;
    return D.rect(cx - 52, cy - 11, 104, 22,
             { rx: 10, fill: m.body, stroke: m.lo, 'stroke-width': 1.2 }) +
           D.rect(cx - 46, cy - 7, 92, 6, { rx: 3, fill: m.hi, opacity: 0.8 });
  };

})(window.SW = window.SW || {});
