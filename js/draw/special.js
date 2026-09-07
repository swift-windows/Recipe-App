/* Vertical sliding sash windows and bay window sets (elevation + plan). */
(function (SW) {
  'use strict';
  var D = SW.draw;

  /* ---------------------------------------------------------------
   * Box sash / vertical slider.
   * Drawn from outside, so the BOTTOM sash sits on the outer plane and
   * overlaps the top sash at the meeting rail. Run-through horns hang
   * from the bottom rail of the top sash.
   * ------------------------------------------------------------- */
  D.renderSash = function (item, id) {
    var p = D.PROFILE, o = [];
    var fk = item.finishOut || 'white';
    var W = item.width, H = item.height;
    var split = item.sashSplit || 0.5;            // proportion taken by the top sash
    var meet = 70;

    o.push(D.mitredFrame(0, 0, W, H, p.outerFrame, id, fk));
    var ix = p.outerFrame, iy = p.outerFrame;
    var iw = W - p.outerFrame * 2, ih = H - p.outerFrame * 2;

    var topH = ih * split, botH = ih - topH;
    var glassOpts = { obscure: item.obscure, barStyle: item.barStyle || 'astragal' };

    // Top sash (inner plane) — drawn first so the bottom sash overlaps it.
    o.push(D.mitredFrame(ix, iy, iw, topH + meet / 2, p.sash, id, fk));
    o.push(D.glazing(ix + p.sash, iy + p.sash, iw - p.sash * 2,
      topH + meet / 2 - p.sash * 2, id, fk,
      Object.assign({}, glassOpts, { barsV: item.topBarsV, barsH: item.topBarsH })));

    // Run-through horns on the top sash.
    if (item.horns !== false) {
      var hy = iy + topH + meet / 2;
      var face = D.finish(fk).face;
      [ix + 2, ix + iw - p.sash - 2].forEach(function (hx) {
        o.push(D.path('M' + D.r2(hx) + ' ' + D.r2(hy - p.sash) +
                      'h' + p.sash +
                      'v' + p.sashHorn +
                      'q0 ' + D.r2(p.sashHorn * 0.4) + ' -' + D.r2(p.sash * 0.45) + ' ' +
                        D.r2(p.sashHorn * 0.4) +
                      'h-' + D.r2(p.sash * 0.55) + 'Z',
          { fill: 'url(#' + id + '-fv)', stroke: D.shade(face, -34),
            'stroke-width': 1.3, 'stroke-linejoin': 'round' }));
      });
    }

    // Bottom sash (outer plane).
    var by = iy + topH - meet / 2;
    o.push(D.el('g', { filter: 'url(#' + id + '-sh)' },
      D.mitredFrame(ix, by, iw, botH + meet / 2, p.sash, id, fk)));
    o.push(D.glazing(ix + p.sash, by + p.sash, iw - p.sash * 2,
      botH + meet / 2 - p.sash * 2, id, fk,
      Object.assign({}, glassOpts, { barsV: item.botBarsV, barsH: item.botBarsH })));

    // Sash lifts and the fitch fastener on the meeting rail.
    var m = D.HARDWARE[item.hardware] || D.HARDWARE.chrome;
    var lifty = by + botH + meet / 2 - p.sash - 90;
    [iw * 0.3, iw * 0.7].forEach(function (fx) {
      o.push(D.path('M' + D.r2(ix + fx - 55) + ' ' + D.r2(lifty) +
                    'q55 60 110 0',
        { stroke: m.body, 'stroke-width': 17, fill: 'none',
          'stroke-linecap': 'round' }));
      o.push(D.path('M' + D.r2(ix + fx - 50) + ' ' + D.r2(lifty + 2) +
                    'q50 50 100 0',
        { stroke: m.hi, 'stroke-width': 5, fill: 'none',
          'stroke-linecap': 'round', opacity: 0.7 }));
    });
    o.push(D.el('circle', { cx: D.r2(ix + iw / 2), cy: D.r2(iy + topH),
                            r: 30, fill: m.body, stroke: m.lo, 'stroke-width': 1.6 }));
    o.push(D.path('M' + D.r2(ix + iw / 2) + ' ' + D.r2(iy + topH) + 'l64 26',
      { stroke: m.body, 'stroke-width': 18, 'stroke-linecap': 'round' }));

    // Vertical travel arrows.
    o.push(D.el('g', { opacity: 0.8 },
      vArrow(ix + iw / 2, by + botH * 0.55, 200, '#1D3D4C')));

    if (item.cill !== false) { o.push(D.cill(0, H, W, fk)); }
    return { svg: o.join(''), hasOpener: true };
  };

  function vArrow(cx, cy, len, col) {
    var h = 44, half = len / 2;
    return D.line(cx, cy - half + h, cx, cy + half - h,
             { stroke: col, 'stroke-width': 5, 'stroke-linecap': 'round' }) +
           D.poly([[cx, cy - half], [cx - h * 0.42, cy - half + h],
                   [cx + h * 0.42, cy - half + h]], { fill: col }) +
           D.poly([[cx, cy + half], [cx - h * 0.42, cy + half - h],
                   [cx + h * 0.42, cy + half - h]], { fill: col });
  }

  /* ---------------------------------------------------------------
   * Bay geometry.
   *
   * Facets are given left to right with their on-face widths (mm) and
   * the corner angle at each internal junction (the angle measured
   * INSIDE the bay between adjacent facets, e.g. 135 for a standard
   * splayed bay). The wall abutment angles are derived, not assumed.
   *
   * Returns plan points plus the two numbers that actually matter on
   * site: projection from the wall face, and the structural opening.
   * ------------------------------------------------------------- */
  D.bayGeometry = function (facets, corners) {
    // Walk the facet polyline. Facet 0 leaves the left wall abutment at
    // an angle derived from the first corner; we start it at 0 deg and
    // rotate afterwards so the run is symmetric about the wall line.
    var pts = [{ x: 0, y: 0 }];
    var heading = 0, i;
    var turns = [];
    for (i = 0; i < facets.length; i++) {
      if (i > 0) {
        var turn = 180 - (corners[i - 1] || 135);   // exterior turn angle
        turns.push(turn);
        heading += turn;
      }
      var rad = heading * Math.PI / 180;
      var last = pts[pts.length - 1];
      pts.push({ x: last.x + facets[i] * Math.cos(rad),
                 y: last.y + facets[i] * Math.sin(rad) });
    }
    // Rotate so the chord from first to last point lies on the wall line.
    var first = pts[0], lastP = pts[pts.length - 1];
    var chordAng = Math.atan2(lastP.y - first.y, lastP.x - first.x);
    var ca = Math.cos(-chordAng), sa = Math.sin(-chordAng);
    var rot = pts.map(function (pt) {
      var dx = pt.x - first.x, dy = pt.y - first.y;
      return { x: dx * ca - dy * sa, y: dx * sa + dy * ca };
    });
    var projection = 0, opening = rot[rot.length - 1].x;
    rot.forEach(function (pt) { projection = Math.max(projection, Math.abs(pt.y)); });
    // Normalise so the bay projects downward (positive y) on screen.
    var flip = rot.reduce(function (a, pt) { return a + pt.y; }, 0) < 0;
    if (flip) { rot = rot.map(function (pt) { return { x: pt.x, y: -pt.y }; }); }

    var running = facets.reduce(function (a, b) { return a + b; }, 0);
    // Plan polygon = facets + the closing wall line, so n = facets + 1
    // vertices; interior angles of that polygon sum to (n-2) x 180.
    var nVerts = facets.length + 1;
    var angleSum = (nVerts - 2) * 180;

    return {
      points: rot,
      projection: projection,
      opening: opening,
      running: running,
      corners: corners.slice(),
      polygonVertices: nVerts,
      polygonAngleSum: angleSum
    };
  };

  /* Plan view of a bay, with angles and projection annotated. */
  D.renderBayPlan = function (item, id) {
    var g = D.bayGeometry(item.facets.map(function (f) { return f.width; }),
                          item.facets.slice(0, -1).map(function (f) {
                            return f.corner || 135;
                          }));
    var o = [], pts = g.points;
    var fk = item.finishOut || 'white';
    var t = 70;                                  // frame thickness in plan

    // Wall line
    o.push(D.line(-260, 0, g.opening + 260, 0,
      { stroke: '#8A9499', 'stroke-width': 10, 'stroke-linecap': 'round' }));
    o.push(D.path(hatch(-260, g.opening + 260), { stroke: '#B6BEC2',
      'stroke-width': 4, opacity: 0.6 }));

    // Bay frame drawn as a thick polyline.
    var d = 'M' + pts.map(function (p) { return D.r2(p.x) + ' ' + D.r2(p.y); })
                     .join('L');
    o.push(D.path(d, { stroke: D.shade(D.finish(fk).face, -40),
                       'stroke-width': t + 6, fill: 'none',
                       'stroke-linejoin': 'round', 'stroke-linecap': 'butt' }));
    o.push(D.path(d, { stroke: D.finish(fk).face, 'stroke-width': t,
                       fill: 'none', 'stroke-linejoin': 'round' }));
    o.push(D.path(d, { stroke: '#BFD2DB', 'stroke-width': t * 0.34,
                       fill: 'none', 'stroke-linejoin': 'round' }));

    // Corner angle labels.
    for (var i = 1; i < pts.length - 1; i++) {
      var ang = item.facets[i - 1].corner || 135;
      o.push(D.el('circle', { cx: D.r2(pts[i].x), cy: D.r2(pts[i].y), r: 13,
                              fill: '#1D3D4C' }));
      o.push(D.text(pts[i].x, pts[i].y + (pts[i].y > 0 ? 96 : -60), ang + '°',
        { 'text-anchor': 'middle', 'font-size': 62, fill: '#1D3D4C',
          'font-weight': 700, 'font-family': 'Inter, Helvetica, Arial, sans-serif' }));
    }

    // Projection and opening dimensions.
    o.push(D.dimV(0, g.projection, -170, Math.round(g.projection) + ' proj.',
                  { ext: 170 }));
    o.push(D.dimH(0, g.opening, -150, Math.round(g.opening) + ' opening',
                  { ext: 120 }));
    return { svg: o.join(''), geom: g };
  };

  function hatch(x1, x2) {
    var d = '';
    for (var x = x1; x < x2; x += 60) {
      d += 'M' + D.r2(x) + ' -10L' + D.r2(x - 34) + ' -60';
    }
    return d;
  }

})(window.SW = window.SW || {});
