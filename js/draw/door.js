/* Doors: residential/composite, French pairs, stable doors,
 * inline sliders and bi-folds.
 */
(function (SW) {
  'use strict';
  var D = SW.draw;

  /* A raised-and-fielded panel: outer reveal, four chamfer bevels,
   * and a flat face. Lit from top-left. */
  D.panel = function (x, y, w, h, finishKey, depth) {
    if (w <= 20 || h <= 20) { return ''; }
    var face = D.finish(finishKey).face;
    var c = Math.min(depth || 26, w / 3, h / 3);
    var ix = x + c, iy = y + c, ix2 = x + w - c, iy2 = y + h - c;
    var o = [];
    o.push(D.rect(x, y, w, h, { fill: D.shade(face, -14) }));
    o.push(D.poly([[x, y], [x + w, y], [ix2, iy], [ix, iy]],
                  { fill: D.shade(face, -26) }));                      // top bevel (in shade)
    o.push(D.poly([[x, y], [ix, iy], [ix, iy2], [x, y + h]],
                  { fill: D.shade(face, -20) }));                      // left bevel
    o.push(D.poly([[x + w, y], [ix2, iy], [ix2, iy2], [x + w, y + h]],
                  { fill: D.shade(face, 12) }));                       // right bevel (lit)
    o.push(D.poly([[x, y + h], [x + w, y + h], [ix2, iy2], [ix, iy2]],
                  { fill: D.shade(face, 20) }));                       // bottom bevel (lit)
    o.push(D.rect(ix, iy, ix2 - ix, iy2 - iy,
                  { fill: face, stroke: D.shade(face, -30), 'stroke-width': 0.9 }));
    if (D.hasGrain(finishKey)) {
      o.push(D.rect(ix, iy, ix2 - ix, iy2 - iy,
                    { fill: 'url(#' + (D.panel._id || 'g') + '-grain)', opacity: 0.5 }));
    }
    o.push(D.rect(x, y, w, h, { fill: 'none', stroke: D.shade(face, -34),
                                'stroke-width': 1.2 }));
    return o.join('');
  };

  /* Door furniture ------------------------------------------------ */
  D.letterplate = function (cx, cy, hw) {
    var m = D.HARDWARE[hw] || D.HARDWARE.chrome;
    return D.rect(cx - 150, cy - 26, 300, 52,
             { rx: 9, fill: m.body, stroke: m.lo, 'stroke-width': 1.4 }) +
           D.rect(cx - 132, cy - 12, 264, 24,
             { rx: 6, fill: m.lo }) +
           D.rect(cx - 132, cy - 12, 264, 8, { rx: 4, fill: '#111', opacity: 0.55 }) +
           D.rect(cx - 144, cy - 21, 288, 7, { rx: 3, fill: m.hi, opacity: 0.7 });
  };

  D.knocker = function (cx, cy, hw) {
    var m = D.HARDWARE[hw] || D.HARDWARE.chrome;
    return D.el('circle', { cx: D.r2(cx), cy: D.r2(cy), r: 42,
                            fill: m.body, stroke: m.lo, 'stroke-width': 2 }) +
           D.el('circle', { cx: D.r2(cx), cy: D.r2(cy), r: 30,
                            fill: 'none', stroke: m.lo, 'stroke-width': 3 }) +
           D.el('circle', { cx: D.r2(cx - 12), cy: D.r2(cy - 13), r: 13,
                            fill: m.hi, opacity: 0.7 });
  };

  D.doorHandle = function (cx, cy, hw, style) {
    var m = D.HARDWARE[hw] || D.HARDWARE.chrome;
    var o = [];
    if (style === 'pull') {                       // bar pull handle
      o.push(D.rect(cx - 15, cy - 420, 30, 840,
        { rx: 15, fill: m.body, stroke: m.lo, 'stroke-width': 1.5 }));
      o.push(D.rect(cx - 9, cy - 405, 9, 810, { rx: 5, fill: m.hi, opacity: 0.7 }));
    } else {                                      // lever on backplate
      o.push(D.rect(cx - 20, cy - 130, 40, 260,
        { rx: 14, fill: m.body, stroke: m.lo, 'stroke-width': 1.4 }));
      o.push(D.rect(cx - 14, cy - 120, 11, 240, { rx: 5, fill: m.hi, opacity: 0.7 }));
      o.push(D.el('circle', { cx: D.r2(cx), cy: D.r2(cy - 58), r: 15,
                              fill: m.lo }));     // euro cylinder
      o.push(D.path('M' + D.r2(cx) + ' ' + D.r2(cy + 34) + 'h' + 96,
        { stroke: m.body, 'stroke-width': 22, 'stroke-linecap': 'round' }));
      o.push(D.path('M' + D.r2(cx) + ' ' + D.r2(cy + 30) + 'h' + 90,
        { stroke: m.hi, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.75 }));
      o.push(D.el('circle', { cx: D.r2(cx), cy: D.r2(cy + 34), r: 17, fill: m.body,
                              stroke: m.lo, 'stroke-width': 1.2 }));
    }
    return o.join('');
  };

  /* Threshold / low-threshold cill under a door. */
  D.threshold = function (x, y, w, hw) {
    var m = D.HARDWARE[hw] || D.HARDWARE.satin;
    return D.rect(x - 12, y, w + 24, 34,
             { fill: '#B9BEC1', stroke: '#8A9094', 'stroke-width': 1.4 }) +
           D.rect(x - 8, y + 3, w + 16, 8, { fill: '#E2E6E8', opacity: 0.8 }) +
           D.line(x - 8, y + 24, x + w + 8, y + 24,
             { stroke: '#8A9094', 'stroke-width': 1.2 });
  };

  /* Where the solid areas of each door style are, as a proportion of
   * leaf height — used to place the letterplate and knocker. null means
   * that style has nowhere sensible to put one. */
  var SOLID_ZONE = {
    'solid':           { plate: 0.62, knock: 0.24 },
    '4-panel':         { plate: 0.62, knock: 0.24 },
    'half-glazed':     { plate: 0.72, knock: 0.52 },
    'cottage':         { plate: 0.68, knock: 0.44 },
    '2-glass-2-panel': { plate: 0.74, knock: 0.55 },
    'full-glazed':     { plate: null, knock: null }
  };

  /* ---------------------------------------------------------------
   * A door leaf drawn inside a given box.
   * ------------------------------------------------------------- */
  D.doorLeaf = function (x, y, w, h, id, fk, opts) {
    opts = opts || {};
    D.panel._id = id;
    var p = D.PROFILE, o = [];
    var st = p.doorLeaf;
    var style = opts.style || 'half-glazed';
    var handleSide = opts.handleSide || 'right';

    o.push(D.el('g', { filter: 'url(#' + id + '-sh)' },
      D.rect(x, y, w, h, { fill: D.finish(fk).face,
                           stroke: D.shade(D.finish(fk).face, -34),
                           'stroke-width': 1.6 })));
    if (D.hasGrain(fk)) {
      o.push(D.rect(x, y, w, h, { fill: 'url(#' + id + '-grain)', opacity: 0.5 }));
    }

    var ix = x + st, iy = y + st, iw = w - st * 2, ih = h - st * 2;
    var glassOpts = { obscure: opts.obscure, barsV: opts.barsV, barsH: opts.barsH,
                      barStyle: opts.barStyle };
    var midY, topH, botH;

    switch (style) {
      case 'solid':
        o.push(D.panel(ix, iy, iw, ih * 0.42, fk));
        o.push(D.panel(ix, iy + ih * 0.42 + st * 0.6, iw,
                       ih * 0.58 - st * 0.6, fk));
        break;

      case 'full-glazed':
        o.push(D.glazing(ix, iy, iw, ih, id, fk, glassOpts));
        break;

      case 'half-glazed':
        midY = iy + ih * 0.46;
        o.push(D.glazing(ix, iy, iw, ih * 0.46, id, fk, glassOpts));
        o.push(D.rect(ix, midY, iw, p.doorMidRail,
          { fill: 'url(#' + id + '-fh)',
            stroke: D.shade(D.finish(fk).face, -34), 'stroke-width': 1.4 }));
        botH = ih - (midY - iy) - p.doorMidRail;
        o.push(D.panel(ix, midY + p.doorMidRail, iw, botH, fk));
        break;

      case '4-panel':
        midY = iy + ih * 0.5;
        var gapy = st * 0.5, halfw = (iw - st * 0.6) / 2;
        o.push(D.panel(ix, iy, halfw, ih * 0.5 - gapy, fk));
        o.push(D.panel(ix + halfw + st * 0.6, iy, halfw, ih * 0.5 - gapy, fk));
        o.push(D.panel(ix, midY + gapy, halfw, ih * 0.5 - gapy, fk));
        o.push(D.panel(ix + halfw + st * 0.6, midY + gapy, halfw,
                       ih * 0.5 - gapy, fk));
        break;

      case '2-glass-2-panel':
        topH = ih * 0.44;
        var hw2 = (iw - st * 0.6) / 2;
        o.push(D.glazing(ix, iy, hw2, topH, id, fk, glassOpts));
        o.push(D.glazing(ix + hw2 + st * 0.6, iy, hw2, topH, id, fk, glassOpts));
        o.push(D.rect(ix, iy + topH, iw, p.doorMidRail,
          { fill: 'url(#' + id + '-fh)',
            stroke: D.shade(D.finish(fk).face, -34), 'stroke-width': 1.4 }));
        botH = ih - topH - p.doorMidRail;
        o.push(D.panel(ix, iy + topH + p.doorMidRail, hw2, botH, fk));
        o.push(D.panel(ix + hw2 + st * 0.6, iy + topH + p.doorMidRail,
                       hw2, botH, fk));
        break;

      case 'cottage':                 // small top light over a wide panel
        topH = ih * 0.30;
        o.push(D.glazing(ix, iy, iw, topH, id, fk,
          Object.assign({}, glassOpts, { barsV: glassOpts.barsV || 2 })));
        o.push(D.rect(ix, iy + topH, iw, p.doorMidRail,
          { fill: 'url(#' + id + '-fh)',
            stroke: D.shade(D.finish(fk).face, -34), 'stroke-width': 1.4 }));
        botH = ih - topH - p.doorMidRail;
        o.push(D.panel(ix, iy + topH + p.doorMidRail, iw, botH * 0.55, fk));
        o.push(D.panel(ix, iy + topH + p.doorMidRail + botH * 0.55 + st * 0.5,
                       iw, botH * 0.45 - st * 0.5, fk));
        break;

      default:
        o.push(D.glazing(ix, iy, iw, ih, id, fk, glassOpts));
    }

    // Furniture. A letterplate or knocker only goes where there is solid
    // material to fix it to — never floating over a glazed aperture.
    var hx = handleSide === 'right' ? x + w - st / 2 : x + st / 2;
    var cy = y + h * (opts.handleHeight || 0.52);
    o.push(D.doorHandle(hx, cy, opts.hardware, opts.handleStyle));

    var solid = SOLID_ZONE[style] || SOLID_ZONE['half-glazed'];
    if (opts.letterplate && solid.plate !== null) {
      o.push(D.letterplate(x + w / 2, y + h * solid.plate, opts.hardware));
    }
    if (opts.knocker && solid.knock !== null) {
      o.push(D.knocker(x + w / 2, y + h * solid.knock, opts.hardware));
    }
    if (opts.hingeSide) {
      o.push(D.hinges(x, y, w, h, opts.hingeSide, opts.hardware, 3));
    }
    return o.join('');
  };

  /* ---------------------------------------------------------------
   * Residential door set: leaf, optional sidelights, optional fanlight.
   * ------------------------------------------------------------- */
  D.renderDoor = function (item, id) {
    var p = D.PROFILE, o = [];
    var fk = item.finishOut || 'white';
    var W = item.width, H = item.height;
    var slL = item.sidelightLeft || 0, slR = item.sidelightRight || 0;
    var fan = item.fanlight || 0;

    o.push(D.mitredFrame(0, 0, W, H, p.outerFrame, id, fk));

    var ix = p.outerFrame, iy = p.outerFrame;
    var iw = W - p.outerFrame * 2, ih = H - p.outerFrame * 2;

    // Fanlight across the head.
    if (fan > 0) {
      o.push(D.glazing(ix, iy, iw, fan, id, fk,
        { obscure: item.obscure, barsV: item.fanBarsV, barStyle: item.barStyle }));
      o.push(D.rect(ix, iy + fan, iw, p.transom,
        { fill: 'url(#' + id + '-fh)',
          stroke: D.shade(D.finish(fk).face, -34), 'stroke-width': 1.4 }));
      iy += fan + p.transom; ih -= fan + p.transom;
    }

    var x = ix;
    if (slL > 0) {
      o.push(D.glazing(x, iy, slL, ih, id, fk,
        { obscure: item.obscureSidelights, barsV: item.sideBarsV,
          barsH: item.sideBarsH, barStyle: item.barStyle }));
      x += slL;
      o.push(D.rect(x, iy, p.mullion, ih,
        { fill: 'url(#' + id + '-fv)',
          stroke: D.shade(D.finish(fk).face, -34), 'stroke-width': 1.4 }));
      x += p.mullion;
    }
    var leafW = iw - slL - slR - (slL > 0 ? p.mullion : 0) - (slR > 0 ? p.mullion : 0);
    var isPair = item.product === 'french' || item.leaves === 2;

    if (isPair) {
      var half = (leafW - 8) / 2;
      o.push(D.doorLeaf(x, iy, half, ih, id, fk, Object.assign({}, doorOpts(item), {
        handleSide: 'right', hingeSide: 'left', letterplate: false, knocker: false
      })));
      o.push(D.doorLeaf(x + half + 8, iy, half, ih, id, fk,
        Object.assign({}, doorOpts(item), {
          handleSide: 'left', hingeSide: 'right', letterplate: false, knocker: false
        })));
      o.push(D.openSymbol(x, iy, half, ih, 'side-hung', 'left'));
      o.push(D.openSymbol(x + half + 8, iy, half, ih, 'side-hung', 'right'));
    } else {
      var hinge = item.hingeSide || 'left';
      o.push(D.doorLeaf(x, iy, leafW, ih, id, fk, Object.assign({}, doorOpts(item), {
        handleSide: hinge === 'left' ? 'right' : 'left',
        hingeSide: hinge
      })));
      o.push(D.openSymbol(x, iy, leafW, ih, 'side-hung', hinge));
    }
    x += leafW;

    if (slR > 0) {
      o.push(D.rect(x, iy, p.mullion, ih,
        { fill: 'url(#' + id + '-fv)',
          stroke: D.shade(D.finish(fk).face, -34), 'stroke-width': 1.4 }));
      x += p.mullion;
      o.push(D.glazing(x, iy, slR, ih, id, fk,
        { obscure: item.obscureSidelights, barsV: item.sideBarsV,
          barsH: item.sideBarsH, barStyle: item.barStyle }));
    }

    o.push(D.threshold(0, H, W, item.hardware));
    return { svg: o.join(''), hasOpener: true };
  };

  function doorOpts(item) {
    return {
      style: item.doorStyle || 'half-glazed',
      hardware: item.hardware,
      handleStyle: item.handleStyle,
      letterplate: item.letterplate,
      knocker: item.knocker,
      obscure: item.obscure,
      barsV: item.barsV, barsH: item.barsH, barStyle: item.barStyle
    };
  }

  /* ---------------------------------------------------------------
   * Inline patio slider. config is a string of O (fixed) and X (sliding)
   * read left to right, e.g. "OX", "OXXO", "OXO".
   * ------------------------------------------------------------- */
  D.renderSlider = function (item, id) {
    var p = D.PROFILE, o = [];
    var fk = item.finishOut || 'white';
    var W = item.width, H = item.height;
    var cfg = (item.config || 'OX').toUpperCase().split('');
    var n = cfg.length;
    var interlock = 46;

    o.push(D.mitredFrame(0, 0, W, H, p.outerFrame, id, fk));
    var ix = p.outerFrame, iy = p.outerFrame;
    var iw = W - p.outerFrame * 2, ih = H - p.outerFrame * 2;
    // Panes overlap at the interlock, as they do on a real slider.
    var paneW = (iw + interlock * (n - 1)) / n;

    // Sliding panels overlap, so draw fixed panels first then sliders on top.
    var order = [], i;
    for (i = 0; i < n; i++) { if (cfg[i] === 'O') { order.push(i); } }
    for (i = 0; i < n; i++) { if (cfg[i] !== 'O') { order.push(i); } }

    order.forEach(function (i) {
      var px = ix + i * (paneW - interlock);
      var sashT = p.sash;
      var lift = cfg[i] === 'O' ? 0 : 1;
      o.push(D.el('g', lift ? { filter: 'url(#' + id + '-sh)' } : {},
        D.mitredFrame(px, iy, paneW, ih, sashT, id, fk)));
      o.push(D.glazing(px + sashT, iy + sashT, paneW - sashT * 2, ih - sashT * 2,
        id, fk, { obscure: item.obscure, barsV: item.barsV, barsH: item.barsH,
                  barStyle: item.barStyle }));
      if (cfg[i] !== 'O') {
        var dir = i < n / 2 ? 1 : -1;
        o.push(D.slideArrow(px, iy, paneW, ih, dir));
        var hx = dir > 0 ? px + paneW - sashT / 2 : px + sashT / 2;
        o.push(D.doorHandle(hx, iy + ih * 0.52, item.hardware, 'lever'));
      }
    });

    // Bottom track.
    o.push(D.rect(ix, H - p.outerFrame + 4, iw, p.outerFrame - 8,
      { fill: '#AFB5B8', stroke: '#8A9094', 'stroke-width': 1.2 }));
    o.push(D.threshold(0, H, W, item.hardware));
    return { svg: o.join(''), hasOpener: true };
  };

  /* ---------------------------------------------------------------
   * Bi-fold. leaves = number of panes; split e.g. "3-0" or "2-1".
   * ------------------------------------------------------------- */
  D.renderBifold = function (item, id) {
    var p = D.PROFILE, o = [];
    var fk = item.finishOut || 'white';
    var W = item.width, H = item.height;
    var n = Math.max(2, item.leaves || 3);

    o.push(D.mitredFrame(0, 0, W, H, p.outerFrame, id, fk));
    var ix = p.outerFrame, iy = p.outerFrame;
    var iw = W - p.outerFrame * 2, ih = H - p.outerFrame * 2;
    var gap = 6;
    var leafW = (iw - gap * (n - 1)) / n;
    var traffic = item.trafficDoor || 0;   // 0 = none, else 1-based leaf index

    for (var i = 0; i < n; i++) {
      var px = ix + i * (leafW + gap);
      o.push(D.el('g', { filter: 'url(#' + id + '-sh)' },
        D.mitredFrame(px, iy, leafW, ih, p.sash, id, fk)));
      o.push(D.glazing(px + p.sash, iy + p.sash, leafW - p.sash * 2, ih - p.sash * 2,
        id, fk, { obscure: item.obscure, barsV: item.barsV, barsH: item.barsH,
                  barStyle: item.barStyle }));
      // Leaves hinge alternately, so the elevation carries alternating
      // triangles — apex at the hinge, same convention as a casement.
      var hinge = i % 2 === 0 ? 'left' : 'right';
      o.push(D.openSymbol(px + p.sash, iy + p.sash, leafW - p.sash * 2,
                          ih - p.sash * 2, 'side-hung', hinge));
      if (traffic && i === traffic - 1) {
        o.push(D.doorHandle(px + leafW - p.sash / 2, iy + ih * 0.52,
                            item.hardware, 'lever'));
      }
    }
    // No concertina squiggle: the alternating triangles are the standard
    // way a bi-fold is shown on an elevation, and they read far cleaner.
    o.push(D.rect(ix, H - p.outerFrame + 4, iw, p.outerFrame - 8,
      { fill: '#AFB5B8', stroke: '#8A9094', 'stroke-width': 1.2 }));
    o.push(D.threshold(0, H, W, item.hardware));
    return { svg: o.join(''), hasOpener: true };
  };

})(window.SW = window.SW || {});
