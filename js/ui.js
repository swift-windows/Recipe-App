/* Form and list builders. Every input carries a data-path so a single
 * delegated handler in app.js can write it back to the model. */
(function (SW) {
  'use strict';
  var U = SW.ui = {};
  var M = SW.model, D = SW.draw;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  U.esc = esc;

  function f(label, inner, hint) {
    return '<div><label class="f">' + esc(label) + '</label>' + inner +
      (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
  }
  U.f = f;

  function txt(path, val, opts) {
    opts = opts || {};
    return '<input type="' + (opts.type || 'text') + '" data-path="' + path + '"' +
      ' value="' + esc(val === null || val === undefined ? '' : val) + '"' +
      (opts.step ? ' step="' + opts.step + '"' : '') +
      (opts.min !== undefined ? ' min="' + opts.min + '"' : '') +
      (opts.max !== undefined ? ' max="' + opts.max + '"' : '') +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + '>';
  }
  U.txt = txt;
  function numf(path, val, opts) {
    opts = opts || {}; opts.type = 'number';
    if (!opts.step) { opts.step = 'any'; }
    return txt(path, val, opts);
  }
  U.num = numf;

  function sel(path, val, options) {
    return '<select data-path="' + path + '">' + options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' +
        (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('') + '</select>';
  }
  U.sel = sel;

  function chk(path, val, label) {
    return '<label class="chk"><input type="checkbox" data-path="' + path + '"' +
      (val ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }
  U.chk = chk;

  function area(path, val, ph) {
    return '<textarea data-path="' + path + '" placeholder="' + esc(ph || '') + '">' +
      esc(val || '') + '</textarea>';
  }
  U.area = area;

  /* ---------------- customer block ---------------- */
  U.customerFields = function (q) {
    return f('Quote number', txt('quote.number', q.number)) +
      f('Date', txt('quote.date', q.date, { type: 'date' })) +
      f('Valid for (days)', numf('quote.validDays', q.validDays, { min: 0 })) +
      f('Status', sel('quote.status', q.status,
        [['draft', 'Draft'], ['sent', 'Sent'], ['won', 'Won'], ['lost', 'Lost']])) +
      f('Customer name', txt('quote.customer.name', q.customer.name)) +
      f('Phone', txt('quote.customer.phone', q.customer.phone, { type: 'tel' })) +
      f('Email', txt('quote.customer.email', q.customer.email, { type: 'email' })) +
      f('Postcode', txt('quote.customer.postcode', q.customer.postcode)) +
      '<div style="grid-column:span 2">' +
        f('Customer address', area('quote.customer.address', q.customer.address)) +
      '</div>' +
      '<div style="grid-column:span 2">' +
        f('Installation address', area('quote.siteAddress', q.siteAddress,
          'Leave blank to use the customer address')) +
      '</div>' +
      f('Lead time (weeks)', txt('quote.leadTimeWeeks', q.leadTimeWeeks)) +
      f('Discount %', numf('quote.discountPct', q.discountPct, { min: 0, max: 100 })) +
      f('Deposit %', numf('quote.depositPct', q.depositPct, { min: 0, max: 100 })) +
      f('VAT %', numf('quote.vatRate', q.vatRate === null ? '' : q.vatRate,
        { min: 0 }), 'Blank uses the price book rate') +
      '<div style="grid-column:span 4">' +
        f('Covering note on the quote', area('quote.notes', q.notes,
          'Leave blank for the standard wording')) +
      '</div>';
  };

  /* ---------------- item configuration ---------------- */
  var OPEN_TYPES = [
    ['fixed', 'Fixed'], ['side-hung', 'Side hung'], ['top-hung', 'Top hung'],
    ['bottom-hung', 'Bottom hung'], ['tilt-turn', 'Tilt & turn'], ['dummy', 'Dummy sash']
  ];
  var ABBR = { 'fixed': 'FIX', 'side-hung': 'SH', 'top-hung': 'TH',
               'bottom-hung': 'BH', 'tilt-turn': 'T&T', 'dummy': 'DUM' };

  U.configPane = function (item, sel_) {
    if (!item) {
      return '<div class="empty"><h3>No item selected</h3>' +
        '<p>Add an item to start drawing.</p></div>';
    }
    var s = [];
    s.push('<header><h3>Configuration</h3></header>');

    /* --- identity & size --- */
    s.push('<details class="acc" open><summary>Item &amp; size</summary><div class="body grid g2">' +
      f('Reference', txt('item.ref', item.ref, { placeholder: 'W1' })) +
      f('Location', txt('item.location', item.location, { placeholder: 'Front bedroom' })) +
      f('Product', sel('item.product', item.product,
        Object.keys(D.PRODUCTS).map(function (k) { return [k, D.PRODUCTS[k]]; }))) +
      f('Quantity', numf('item.qty', item.qty, { min: 1, step: 1 })) +
      (item.product === 'bay'
        ? f('Height (mm)', numf('item.height', item.height, { min: 100, step: 1 }))
        : f('Width (mm)', numf('item.width', item.width, { min: 100, step: 1 })) +
          f('Height (mm)', numf('item.height', item.height, { min: 100, step: 1 }))) +
      '</div></details>');

    /* --- layout --- */
    if (item.product === 'window' || item.product === 'fixed') {
      s.push(gridSection(item, sel_));
    } else if (item.product === 'bay') {
      s.push(baySection(item));
    } else {
      s.push(productSection(item));
    }

    /* --- finish --- */
    s.push('<details class="acc" open><summary>Finish &amp; hardware</summary><div class="body">' +
      '<div class="grid g2">' +
        f('Outside finish', swatches('item.finishOut', item.finishOut)) +
        f('Inside finish', swatches('item.finishIn', item.finishIn)) +
      '</div>' +
      '<div class="grid g2" style="margin-top:12px">' +
        f('Hardware', sel('item.hardware', item.hardware,
          Object.keys(D.HARDWARE).map(function (k) {
            return [k, D.HARDWARE[k].name]; }))) +
        f('Glazing', sel('item.glass', item.glass,
          Object.keys(M.GLASS).map(function (k) { return [k, M.GLASS[k]]; }))) +
      '</div>' +
      '<div class="row" style="margin-top:12px;flex-wrap:wrap;gap:14px">' +
        chk('item.obscure', item.obscure, 'Obscure glass') +
        chk('item.trickleVent', item.trickleVent, 'Trickle vents') +
        chk('item.cill', item.cill !== false, 'Cill') +
      '</div>' +
      '<div class="grid g2" style="margin-top:12px">' +
        f('Bar style', sel('item.barStyle', item.barStyle,
          [['georgian', 'Georgian (flat)'], ['astragal', 'Astragal (profiled)']])) +
      '</div>' +
      '</div></details>');

    /* --- pricing --- */
    s.push(pricingSection(item));

    s.push('<details class="acc"><summary>Notes on this item</summary>' +
      '<div class="body">' + area('item.notes', item.notes,
        'Anything the customer should see about this frame') + '</div></details>');

    return s.join('');
  };

  function swatches(path, val) {
    return '<div class="swatches">' + Object.keys(D.FINISHES).map(function (k) {
      var fin = D.FINISHES[k];
      return '<button type="button" class="sw' + (k === val ? ' on' : '') +
        '" data-swatch="' + path + '" data-value="' + k + '" title="' + esc(fin.name) +
        '" style="background:' + fin.face + '"></button>';
    }).join('') + '</div>';
  }

  function gridSection(item, sel_) {
    var L = D.layout(item);
    var nC = L.cols.length, nR = L.rows.length;
    var s = ['<details class="acc" open><summary>Layout</summary><div class="body">'];
    s.push('<div class="grid g2">' +
      f('Lights across', numf('grid.cols', nC, { min: 1, max: 6, step: 1 })) +
      f('Lights high', numf('grid.rows', nR, { min: 1, max: 4, step: 1 })) +
      '</div>');

    // Proportion inputs
    if (nC > 1) {
      s.push('<label class="f" style="margin-top:12px">Light widths (mm)</label>' +
        '<div class="grid" style="grid-template-columns:repeat(' + nC + ',1fr)">' +
        item.cols.slice(0, nC).map(function (w, i) {
          return numf('cols.' + i, Math.round(w), { min: 1, step: 1 });
        }).join('') + '</div>' +
        '<div class="hint">Scaled to fit the overall width — relative sizes are ' +
        'what matter.</div>');
    }
    if (nR > 1) {
      s.push('<label class="f" style="margin-top:12px">Light heights (mm)</label>' +
        '<div class="grid" style="grid-template-columns:repeat(' + nR + ',1fr)">' +
        item.rows.slice(0, nR).map(function (h, i) {
          return numf('rows.' + i, Math.round(h), { min: 1, step: 1 });
        }).join('') + '</div>');
    }

    // Cell picker, laid out the way the window actually looks.
    s.push('<label class="f" style="margin-top:14px">Lights — click to configure</label>');
    s.push('<div class="cellgrid" style="grid-template-columns:repeat(' + nC +
           ',1fr)">');
    for (var r = 0; r < nR; r++) {
      for (var c = 0; c < nC; c++) {
        var cell = D.cellAt(item, r, c);
        var key = 'r' + r + 'c' + c;
        var hinge = (cell.type === 'side-hung' || cell.type === 'tilt-turn')
          ? (cell.hinge === 'left' ? 'hinge L' : 'hinge R') : '';
        s.push('<button type="button" data-cell="' + key + '"' +
          (sel_ === key ? ' class="on"' : '') + '>' +
          (ABBR[cell.type] || 'FIX') +
          (hinge ? '<small>' + hinge + '</small>' : '') +
          ((cell.barsV || cell.barsH) ? '<small>bars</small>' : '') +
          '</button>');
      }
    }
    s.push('</div>');

    // Selected-cell editor
    if (sel_ && item.cells[sel_]) {
      var cc = item.cells[sel_];
      s.push('<div style="margin-top:12px;padding:12px;background:#F6F9FB;' +
        'border-radius:9px;border:1px solid var(--line)">' +
        '<label class="f">Selected light — ' + esc(sel_.toUpperCase()) + '</label>' +
        '<div class="grid g2">' +
          f('Opening', sel('cell.type', cc.type || 'fixed', OPEN_TYPES)) +
          ((cc.type === 'side-hung' || cc.type === 'tilt-turn')
            ? f('Hinge side', sel('cell.hinge', cc.hinge || 'left',
                [['left', 'Left'], ['right', 'Right']]))
            : '') +
          f('Vertical bars', numf('cell.barsV', cc.barsV || 0, { min: 0, max: 8, step: 1 })) +
          f('Horizontal bars', numf('cell.barsH', cc.barsH || 0, { min: 0, max: 8, step: 1 })) +
        '</div>' +
        '<div style="margin-top:10px">' +
          chk('cell.obscure', cc.obscure, 'Obscure this light') + '</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn sm" data-apply-all="1">Apply opening to all lights</button>' +
        '</div></div>');
    }
    s.push('</div></details>');
    return s.join('');
  }

  function productSection(item) {
    var s = ['<details class="acc" open><summary>Configuration</summary>' +
             '<div class="body grid g2">'];
    switch (item.product) {
      case 'door':
      case 'french':
        s.push(f('Door style', sel('item.doorStyle', item.doorStyle,
          [['solid', 'Solid / panelled'], ['half-glazed', 'Half glazed'],
           ['full-glazed', 'Fully glazed'], ['4-panel', 'Four panel'],
           ['2-glass-2-panel', 'Two glass / two panel'], ['cottage', 'Cottage']])));
        s.push(f('Handle', sel('item.handleStyle', item.handleStyle || 'lever',
          [['lever', 'Lever / pad'], ['pull', 'Bar pull handle']])));
        if (item.product === 'door') {
          s.push(f('Hinge side', sel('item.hingeSide', item.hingeSide || 'left',
            [['left', 'Left'], ['right', 'Right']])));
          s.push(f('Fanlight height (mm)', numf('item.fanlight', item.fanlight || 0,
            { min: 0, step: 1 })));
          s.push(f('Left sidelight (mm)', numf('item.sidelightLeft',
            item.sidelightLeft || 0, { min: 0, step: 1 })));
          s.push(f('Right sidelight (mm)', numf('item.sidelightRight',
            item.sidelightRight || 0, { min: 0, step: 1 })));
          s.push('<div style="grid-column:span 2" class="row" ' +
            'style="gap:14px;flex-wrap:wrap">' +
            chk('item.letterplate', item.letterplate, 'Letterplate') +
            chk('item.knocker', item.knocker, 'Knocker') +
            chk('item.obscureSidelights', item.obscureSidelights,
                'Obscure sidelights') + '</div>');
        }
        s.push(f('Glazing bars — vertical', numf('item.barsV', item.barsV || 0,
          { min: 0, max: 8, step: 1 })));
        s.push(f('Glazing bars — horizontal', numf('item.barsH', item.barsH || 0,
          { min: 0, max: 8, step: 1 })));
        break;

      case 'slider':
        s.push(f('Configuration', sel('item.config', item.config,
          [['OX', 'OX — one slider, one fixed'], ['XO', 'XO'],
           ['OXO', 'OXO — centre slider'], ['OXXO', 'OXXO — two sliders'],
           ['XX', 'XX — both slide']]),
          'O = fixed pane, X = sliding pane, read left to right from outside'));
        s.push(f('Glazing bars — vertical', numf('item.barsV', item.barsV || 0,
          { min: 0, max: 8, step: 1 })));
        break;

      case 'bifold':
        s.push(f('Number of leaves', numf('item.leaves', item.leaves,
          { min: 2, max: 8, step: 1 })));
        s.push(f('Traffic door on leaf', numf('item.trafficDoor',
          item.trafficDoor || 0, { min: 0, max: 8, step: 1 }),
          '0 for no traffic door'));
        break;

      case 'sash':
        s.push(f('Top sash proportion', numf('item.sashSplit', item.sashSplit,
          { min: 0.2, max: 0.8, step: 0.05 }), '0.5 gives equal sashes'));
        s.push(f('Top sash bars — vertical', numf('item.topBarsV',
          item.topBarsV || 0, { min: 0, max: 8, step: 1 })));
        s.push(f('Top sash bars — horizontal', numf('item.topBarsH',
          item.topBarsH || 0, { min: 0, max: 8, step: 1 })));
        s.push(f('Bottom sash bars — vertical', numf('item.botBarsV',
          item.botBarsV || 0, { min: 0, max: 8, step: 1 })));
        s.push(f('Bottom sash bars — horizontal', numf('item.botBarsH',
          item.botBarsH || 0, { min: 0, max: 8, step: 1 })));
        s.push('<div style="grid-column:span 2">' +
          chk('item.horns', item.horns !== false, 'Run-through horns') + '</div>');
        break;
    }
    s.push('</div></details>');
    return s.join('');
  }

  function baySection(item) {
    var s = ['<details class="acc" open><summary>Bay facets</summary><div class="body">'];
    s.push('<div class="hint" style="margin-bottom:10px">Facets run left to right ' +
      'as viewed from outside. The corner angle is measured inside the bay ' +
      'between that facet and the next one.</div>');
    (item.facets || []).forEach(function (fc, i) {
      s.push('<div style="padding:10px;border:1px solid var(--line);' +
        'border-radius:9px;margin-bottom:9px">' +
        '<label class="f">Facet ' + (i + 1) + '</label><div class="grid g2">' +
        f('Width (mm)', numf('facet.' + i + '.width', fc.width,
          { min: 100, step: 1 })) +
        (i < item.facets.length - 1
          ? f('Corner angle (°)', numf('facet.' + i + '.corner', fc.corner || 135,
              { min: 90, max: 180, step: 1 }))
          : '<div></div>') +
        f('Lights across', numf('facet.' + i + '.ncols',
          (fc.cols || [1]).length, { min: 1, max: 4, step: 1 })) +
        f('Opening', sel('facet.' + i + '.type',
          ((fc.cells && fc.cells.r0c0) || {}).type || 'fixed', OPEN_TYPES)) +
        '</div></div>');
    });
    s.push('<div class="row"><button class="btn sm" data-bay-add="1">Add facet</button>' +
      '<button class="btn sm ghost" data-bay-del="1">Remove last</button></div>');

    // Live geometry read-out — the numbers that get checked on site.
    var g = D.bayGeometry(item.facets.map(function (x) { return x.width; }),
      item.facets.slice(0, -1).map(function (x) { return x.corner || 135; }));
    var cornerSum = item.facets.slice(0, -1)
      .reduce(function (a, x) { return a + (x.corner || 135); }, 0);
    s.push('<div style="margin-top:12px;padding:12px;background:#F6F9FB;' +
      'border-radius:9px;border:1px solid var(--line);font-size:13px">' +
      '<b>Geometry check</b><br>' +
      'Running width (sum of facets): <b>' + Math.round(g.running) + ' mm</b><br>' +
      'Structural opening (wall to wall): <b>' + Math.round(g.opening) + ' mm</b><br>' +
      'Projection from wall: <b>' + Math.round(g.projection) + ' mm</b><br>' +
      'Corner angles total: <b>' + cornerSum + '°</b> over ' +
        (item.facets.length - 1) + ' corner' +
        (item.facets.length - 1 === 1 ? '' : 's') + '<br>' +
      '<span style="color:var(--mute)">Plan polygon has ' + g.polygonVertices +
      ' corners, so its interior angles total ' + g.polygonAngleSum + '°.</span>' +
      '</div>');
    s.push('</div></details>');
    return s.join('');
  }

  function pricingSection(item) {
    var pb = SW.state ? SW.state.priceBook : M.defaultPriceBook();
    var p = M.priceItem(item, pb);
    var s = ['<details class="acc" open><summary>Price</summary><div class="body">'];
    s.push(f('How this line is priced', sel('item.priceMode', item.priceMode,
      [['manual', 'Type the price in'],
       ['margin', 'Supplier cost + margin'],
       ['calc', 'Work it out from the price book']])));

    if (item.priceMode === 'manual') {
      s.push('<div style="margin-top:10px">' +
        f('Unit price (ex VAT)', numf('item.sellPrice', item.sellPrice,
          { min: 0, step: '0.01' })) + '</div>');
    } else if (item.priceMode === 'margin') {
      s.push('<div class="grid g2" style="margin-top:10px">' +
        f('Supplier cost (ex VAT)', numf('item.supplierCost', item.supplierCost,
          { min: 0, step: '0.01' })) +
        f('Margin %', numf('item.margin',
          item.margin === null || item.margin === undefined ? '' : item.margin,
          { min: 0, max: 99, step: '0.1' })) + '</div>' +
        '<div class="hint">Blank uses the price book default (' +
        M.num(pb.defaultMargin) + '%). Margin is taken on the selling price, ' +
        'not added to cost.</div>');
    } else {
      s.push('<div class="hint" style="margin-top:8px">' +
        M.areaM2(item).toFixed(2) + ' m², ' + M.countOpeners(item) +
        ' opening light(s). Rates come from the price book.</div>');
    }

    s.push('<div style="margin-top:10px">' +
      f('Extras / adjustment (±)', numf('item.extraCost', item.extraCost,
        { step: '0.01' })) + '</div>');

    s.push('<div style="margin-top:12px;padding:11px 13px;background:#F6F9FB;' +
      'border-radius:9px;border:1px solid var(--line)">' +
      p.breakdown.map(function (b) {
        return '<div style="display:flex;justify-content:space-between;' +
          'font-size:12.5px;color:var(--mute);padding:2px 0">' +
          '<span>' + esc(b.label) + '</span><span>' + M.money(b.value) +
          '</span></div>';
      }).join('') +
      '<div style="display:flex;justify-content:space-between;margin-top:7px;' +
      'padding-top:7px;border-top:1px solid var(--line);font-weight:700">' +
      '<span>' + p.qty + ' × ' + M.money(p.unit) + '</span>' +
      '<span>' + M.money(p.total) + '</span></div></div>');

    s.push('</div></details>');
    return s.join('');
  }

  /* ---------------- item list ---------------- */
  U.itemList = function (quote, pb, selId) {
    if (!quote.items.length) {
      return '<li style="cursor:default"><div class="meta">' +
        '<span>No items yet.</span></div></li>';
    }
    return quote.items.map(function (it) {
      var p = M.priceItem(it, pb);
      return '<li data-item="' + it.id + '"' + (it.id === selId ? ' class="on"' : '') +
        '><div class="thumb">' +
          SW.draw.render(it, { dims: false, key: false }) +
        '</div><div class="meta">' +
          '<b>' + esc(it.ref || D.PRODUCTS[it.product]) +
            (it.qty > 1 ? ' ×' + it.qty : '') + '</b>' +
          '<span>' + esc(it.location || (it.product === 'bay'
            ? 'bay' : it.width + '×' + it.height)) + '</span>' +
        '</div><div class="price">' + M.money(p.total) + '</div></li>';
    }).join('');
  };

  /* ---------------- quotes list ---------------- */
  U.quotesList = function (list, filter, pb) {
    var q = (filter || '').toLowerCase();
    var rows = list.filter(function (x) {
      if (!q) { return true; }
      return (x.number + ' ' + (x.customer && x.customer.name || '') + ' ' +
              (x.siteAddress || '')).toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) {
      return '<div class="empty"><h3>Nothing here yet</h3>' +
        '<p>Hit “New quote” to get started.</p></div>';
    }
    return '<table class="tbl"><thead><tr>' +
      '<th>Number</th><th>Customer</th><th>Site</th><th>Date</th>' +
      '<th class="num">Items</th><th class="num">Total inc VAT</th>' +
      '<th>Status</th><th></th></tr></thead><tbody>' +
      rows.map(function (x) {
        var t = M.priceQuote(x, pb);
        return '<tr data-quote="' + x.id + '" style="cursor:pointer">' +
          '<td><b>' + esc(x.number) + '</b></td>' +
          '<td>' + esc(x.customer && x.customer.name || '—') + '</td>' +
          '<td>' + esc((x.siteAddress || '').split('\n')[0] || '—') + '</td>' +
          '<td>' + esc(x.date) + '</td>' +
          '<td class="num">' + (x.items || []).length + '</td>' +
          '<td class="num">' + M.money(t.gross) + '</td>' +
          '<td><span class="pill ' + esc(x.status || 'draft') + '">' +
            esc(x.status || 'draft') + '</span></td>' +
          '<td class="num"><button class="btn sm danger" data-delq="' + x.id +
            '">Delete</button></td></tr>';
      }).join('') + '</tbody></table>';
  };

  /* ---------------- price book ---------------- */
  U.priceBookForm = function (pb) {
    var prods = Object.keys(D.PRODUCTS);
    function table(title, path, keys, labels, suffix) {
      return '<div class="card" style="margin-bottom:16px"><header><h3>' +
        esc(title) + '</h3></header><div class="body grid g4">' +
        keys.map(function (k, i) {
          return f((labels ? labels[i] : k) + (suffix || ''),
            numf('pb.' + path + '.' + k, pb[path][k], { step: 'any', min: 0 }));
        }).join('') + '</div></div>';
    }
    return '<div class="card" style="margin-bottom:16px"><header><h3>General</h3></header>' +
      '<div class="body grid g4">' +
        f('VAT rate %', numf('pb.vatRate', pb.vatRate, { min: 0, step: 'any' })) +
        f('Default margin %', numf('pb.defaultMargin', pb.defaultMargin,
          { min: 0, max: 99, step: 'any' })) +
        f('Per opening light £', numf('pb.openerCharge', pb.openerCharge,
          { min: 0, step: 'any' })) +
        f('Trickle vent £', numf('pb.trickleVent', pb.trickleVent,
          { min: 0, step: 'any' })) +
      '</div></div>' +
      table('Rate per m² (ex VAT)', 'ratePerM2', prods,
        prods.map(function (k) { return D.PRODUCTS[k]; }), ' £/m²') +
      table('Minimum charge per unit', 'minCharge', prods,
        prods.map(function (k) { return D.PRODUCTS[k]; }), ' £') +
      table('Fitting charge per unit', 'fitCharge', prods,
        prods.map(function (k) { return D.PRODUCTS[k]; }), ' £') +
      table('Glass uplift per m²', 'glassPerM2', Object.keys(M.GLASS),
        Object.keys(M.GLASS).map(function (k) { return M.GLASS[k]; }), ' £/m²') +
      table('Finish uplift', 'finishUplift', Object.keys(D.FINISHES),
        Object.keys(D.FINISHES).map(function (k) { return D.FINISHES[k].name; }), ' %');
  };

  /* ---------------- settings ---------------- */
  U.settingsForm = function (c) {
    var p = D.PROFILE;
    return '<div class="card" style="margin-bottom:16px">' +
      '<header><h3>Company details</h3></header><div class="body grid g2">' +
        f('Company name', txt('co.name', c.name)) +
        f('VAT number', txt('co.vat', c.vat)) +
        '<div style="grid-column:span 2">' +
          f('Address', area('co.address', c.address)) + '</div>' +
        f('Phone', txt('co.phone', c.phone)) +
        f('Email', txt('co.email', c.email)) +
        f('Website', txt('co.web', c.web)) +
        f('Accreditation', txt('co.accreditation', c.accreditation)) +
        f('Sort code', txt('co.sortCode', c.sortCode)) +
        f('Account number', txt('co.accountNumber', c.accountNumber)) +
        '<div style="grid-column:span 2">' +
          '<label class="f">Logo</label>' +
          '<div class="row"><input type="file" id="logo-file" accept="image/*">' +
          (c.logo ? '<img src="' + esc(c.logo) + '" style="height:44px;' +
            'border:1px solid var(--line);border-radius:6px;padding:3px">' +
            '<button class="btn sm ghost" id="logo-clear">Remove</button>' : '') +
          '</div><div class="hint">The blue swallow JPEG. Stored in this browser ' +
          'and printed on every quote.</div></div>' +
      '</div></div>' +

      '<div class="card" style="margin-bottom:16px">' +
      '<header><h3>Drawing profile sizes</h3></header><div class="body">' +
      '<div class="hint" style="margin-bottom:12px">These control how chunky the ' +
      'frames look on the drawings. Set them to match the system you quote on ' +
      'most often — they do not affect pricing.</div><div class="grid g4">' +
        f('Outer frame (mm)', numf('pf.outerFrame', p.outerFrame, { min: 20 })) +
        f('Sash (mm)', numf('pf.sash', p.sash, { min: 20 })) +
        f('Mullion (mm)', numf('pf.mullion', p.mullion, { min: 20 })) +
        f('Transom (mm)', numf('pf.transom', p.transom, { min: 20 })) +
        f('Glazing bead (mm)', numf('pf.bead', p.bead, { min: 4 })) +
        f('Glazing bar (mm)', numf('pf.barWidth', p.barWidth, { min: 6 })) +
        f('Door leaf stile (mm)', numf('pf.doorLeaf', p.doorLeaf, { min: 40 })) +
        f('Cill depth (mm)', numf('pf.cillDepth', p.cillDepth, { min: 10 })) +
      '</div></div></div>' +

      '<div class="card"><header><h3>Standard terms</h3></header><div class="body">' +
      '<div class="hint" style="margin-bottom:10px">One term per line. These are ' +
      'a starting point — check the wording is right for your contracts before ' +
      'you send anything out.</div>' +
      area('co.terms', (SW.state.defaultTerms || M.defaultTerms()).join('\n')) +
      '</div></div>';
  };

})(window.SW = window.SW || {});
