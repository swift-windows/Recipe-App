/* Renderer entry point: wraps a product renderer in a complete SVG
 * document with dimension lines, a view key and sensible padding.
 */
(function (SW) {
  'use strict';
  var D = SW.draw;

  var RENDERERS = {
    'window':  D.renderFrame,
    'fixed':   D.renderFrame,
    'door':    D.renderDoor,
    'french':  D.renderDoor,
    'slider':  D.renderSlider,
    'bifold':  D.renderBifold,
    'sash':    D.renderSash
  };

  D.PRODUCTS = {
    'window': 'Casement window',
    'fixed':  'Fixed light',
    'sash':   'Vertical sliding sash',
    'door':   'Residential door',
    'french': 'French doors',
    'slider': 'Patio slider',
    'bifold': 'Bi-fold doors',
    'bay':    'Bay window'
  };

  var uid = 0;

  /* Render one item. opts: { dims:true, key:true, width:px } */
  D.render = function (item, opts) {
    opts = opts || {};
    var id = 'sw' + (++uid);
    var fk = item.finishOut || 'white';

    if (item.product === 'bay') { return renderBay(item, id, opts); }

    var fn = RENDERERS[item.product] || D.renderFrame;
    var out = fn(item, id);
    var W = item.width, H = item.height;
    var fs = Math.max(W, H) / 23;
    var showDims = opts.dims !== false;
    var showKey  = opts.key !== false;

    var padL = showDims ? fs * 3.4 : fs * 0.6;
    var padR = fs * 1.4;
    var padT = fs * 1.0;
    var padB = (showDims ? fs * 3.0 : fs * 0.8) + (showKey ? fs * 2.0 : 0)
             + (item.cill !== false || item.product === 'door' ? 70 : 0);

    var g = [D.defs(id, fk)];
    g.push(D.el('g', { transform: 'translate(0,0)' }, out.svg));

    if (showDims) {
      var dimY = H + (item.cill !== false ? D.PROFILE.cillDepth : 0) + fs * 1.7;
      g.push(D.dimH(0, W, dimY, fmt(W), { ext: fs * 1.1, fs: fs }));
      g.push(D.dimV(0, H, -fs * 1.7, fmt(H), { ext: fs * 1.1, fs: fs }));

      // Second tier: individual light widths on multi-light frames.
      if (out.layout && out.layout.cols.length > 1) {
        var y2 = dimY + fs * 1.5;
        out.layout.cols.forEach(function (c) {
          g.push(D.dimH(c.x, c.x + c.w, y2, fmt(c.w), { fs: fs * 0.78 }));
        });
        padB += fs * 1.5;
      }
    }
    if (showKey) {
      // Size the key so it always fits the drawing width — a clipped
      // caption on a customer-facing quote looks amateur.
      var keyLen = out.hasOpener ? 88 : 22;
      var keyFs = Math.min(fs * 0.78, (W + padL + padR) / (keyLen * 0.5));
      g.push(D.viewKey(0, H + padB - fs * 0.5, W, out.hasOpener, keyFs));
    }

    var vb = [-padL, -padT, W + padL + padR, H + padT + padB];
    return svgDoc(vb, g.join(''), opts);
  };

  /* Bay: an elevation strip of each facet plus the plan below it. */
  function renderBay(item, id, opts) {
    var facets = item.facets || [];
    if (!facets.length) { return svgDoc([0, 0, 100, 100], ''); }
    var fk = item.finishOut || 'white';
    // Facets butt directly against each other: on a real bay the two
    // outer frames meet in a corner post, so a gap would be wrong.
    var gap = 0, x = 0, maxH = 0, i;
    var g = [D.defs(id, fk)];
    var parts = [], joints = [];

    facets.forEach(function (f, idx) {
      var sub = {
        product: 'window', width: f.width, height: item.height,
        cols: f.cols || [f.width], rows: f.rows || [item.height],
        cells: f.cells || {}, finishOut: fk, hardware: item.hardware,
        obscure: item.obscure, barStyle: item.barStyle, cill: false,
        trickleVent: item.trickleVent
      };
      var r = D.renderFrame(sub, id);
      parts.push(D.el('g', { transform: 'translate(' + D.r2(x) + ',0)' }, r.svg) +
                 D.dimH(x, x + f.width, item.height + 120, fmt(f.width),
                        { fs: Math.max(item.height, 1200) / 26 }));
      x += f.width + gap;
      if (idx < facets.length - 1) {
        joints.push({ x: x, angle: f.corner || 135 });
      }
      maxH = Math.max(maxH, item.height);
    });
    var elevW = x - gap;
    var fs = Math.max(elevW, maxH) / 26;

    g.push(D.el('g', {}, parts.join('')));

    // Mark each corner post so the elevation reads as one bay rather
    // than a row of separate windows.
    joints.forEach(function (j) {
      g.push(D.line(j.x, -fs * 0.35, j.x, maxH + fs * 0.35,
        { stroke: '#1D3D4C', 'stroke-width': 3, 'stroke-dasharray': '18 14',
          opacity: 0.55 }));
      g.push(D.text(j.x, -fs * 0.6, j.angle + '\u00B0',
        { 'text-anchor': 'middle', 'font-size': fs * 0.8, fill: '#1D3D4C',
          'font-weight': 700 }));
    });
    g.push(D.cill(0, maxH, elevW, fk));
    g.push(D.dimV(0, maxH, -fs * 1.8, fmt(maxH), { ext: fs * 1.1, fs: fs }));

    var plan = D.renderBayPlan(item, id);
    var planY = maxH + fs * 4.2;
    var scale = Math.min(1, elevW / Math.max(plan.geom.opening, 1));
    g.push(D.el('g', { transform: 'translate(' + D.r2((elevW - plan.geom.opening * scale) / 2) +
                                  ',' + D.r2(planY) + ') scale(' + D.r2(scale) + ')' },
      plan.svg));
    g.push(D.text(elevW / 2, planY + plan.geom.projection * scale + fs * 3.2,
      'Plan view — projection ' + Math.round(plan.geom.projection) +
      'mm, structural opening ' + Math.round(plan.geom.opening) + 'mm',
      { 'text-anchor': 'middle', 'font-size': fs * 0.85, fill: '#7A8A93',
        'font-family': 'Inter, Helvetica, Arial, sans-serif',
        'font-style': 'italic' }));

    var padL = fs * 3.4, padR = fs * 1.4, padT = fs * 1.9, padB = fs * 4.5;
    var totalH = planY + plan.geom.projection * scale + fs * 3.2;
    return svgDoc([-padL, -padT, elevW + padL + padR, totalH + padT + padB],
                  g.join(''), opts);
  }

  function fmt(n) { return Math.round(n) + ''; }

  function svgDoc(vb, inner, opts) {
    opts = opts || {};
    var a = {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: vb.map(D.r2).join(' '),
      preserveAspectRatio: 'xMidYMid meet',
      'font-family': 'Inter, Helvetica, Arial, sans-serif'
    };
    if (opts.width)  { a.width = opts.width; }
    if (opts.height) { a.height = opts.height; }
    a.class = 'sw-drawing';
    return D.el('svg', a, inner);
  }

  /* Plain-English description of a configuration.
   * opts.finish = false leaves the finish out, for places that already
   * list it on their own row. */
  D.describe = function (item, opts) {
    opts = opts || {};
    var bits = [];
    var p = D.PRODUCTS[item.product] || 'Frame';
    bits.push(p);
    if (item.product === 'window' || item.product === 'fixed') {
      var counts = {};
      var L = D.layout(item);
      for (var r = 0; r < L.rows.length; r++) {
        for (var c = 0; c < L.cols.length; c++) {
          var t = D.cellAt(item, r, c).type || 'fixed';
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      var names = { 'fixed': 'fixed light', 'dummy': 'dummy sash',
                    'side-hung': 'side-hung opener', 'top-hung': 'top-hung opener',
                    'bottom-hung': 'bottom-hung vent', 'tilt-turn': 'tilt & turn' };
      var parts = [];
      for (var k in counts) {
        parts.push(counts[k] + ' × ' + (names[k] || k) + (counts[k] > 1 ? 's' : ''));
      }
      bits.push(parts.join(', '));
    }
    if (item.product === 'door' || item.product === 'french') {
      var styles = { 'solid': 'solid panelled', 'half-glazed': 'half glazed',
                     'full-glazed': 'fully glazed', '4-panel': 'four panel',
                     '2-glass-2-panel': 'two glass / two panel',
                     'cottage': 'cottage style' };
      var db = [styles[item.doorStyle] || item.doorStyle];
      if (item.product === 'door') {
        db.push('hinged ' + (item.hingeSide || 'left'));
        if (item.sidelightLeft)  { db.push(item.sidelightLeft + 'mm left sidelight'); }
        if (item.sidelightRight) { db.push(item.sidelightRight + 'mm right sidelight'); }
        if (item.fanlight)       { db.push(item.fanlight + 'mm fanlight'); }
        if (item.letterplate)    { db.push('letterplate'); }
        if (item.knocker)        { db.push('knocker'); }
      }
      bits.push(db.join(', '));
    }
    if (item.product === 'sash') {
      var sb = [];
      if (item.topBarsV || item.topBarsH || item.botBarsV || item.botBarsH) {
        sb.push('glazing bars');
      }
      if (item.horns !== false) { sb.push('run-through horns'); }
      if (sb.length) { bits.push(sb.join(', ')); }
    }
    if (item.product === 'slider') { bits.push('configuration ' + (item.config || 'OX')); }
    if (item.product === 'bifold') {
      bits.push((item.leaves || 3) + ' leaves' +
                (item.trafficDoor ? ', traffic door on leaf ' + item.trafficDoor : ''));
    }
    if (item.product === 'bay') {
      bits.push((item.facets || []).length + '-facet bay');
    }
    if (opts.finish !== false) {
      bits.push(D.finish(item.finishOut).name + ' outside' +
        (item.finishIn && item.finishIn !== item.finishOut
          ? ' / ' + D.finish(item.finishIn).name + ' inside' : ''));
    }
    return bits.filter(Boolean).join(' · ');
  };

})(window.SW = window.SW || {});
