/* Data model, pricing and persistence. */
(function (SW) {
  'use strict';

  var M = SW.model = {};

  SW.COMPANY = {
    name: 'Swift Windows Limited',
    address: '82 High Street, Caterham, Surrey CR3 5UD',
    vat: '862 2868 967',
    sortCode: '09 01 50',
    accountNumber: '03902773',
    accreditation: 'ASSURE Registered',
    phone: '',
    email: 'info@swift-windows.com',
    web: '',
    logo: ''          // data URL, set in Settings
  };

  /* ---------------------------------------------------------------
   * Price book. Everything starts at zero on purpose — no invented
   * rates. The app shows a warning until it has been filled in.
   * ------------------------------------------------------------- */
  M.defaultPriceBook = function () {
    return {
      currency: '£',
      vatRate: 20,
      defaultMargin: 0,                 // % applied to supplier cost
      ratePerM2: { window: 0, fixed: 0, sash: 0, door: 0, french: 0,
                   slider: 0, bifold: 0, bay: 0 },
      minCharge: { window: 0, fixed: 0, sash: 0, door: 0, french: 0,
                   slider: 0, bifold: 0, bay: 0 },
      openerCharge: 0,                  // per opening light
      glassPerM2: { standard: 0, toughened: 0, obscure: 0, 'low-e': 0,
                    triple: 0, acoustic: 0, laminated: 0, leaded: 0 },
      finishUplift: { white: 0, cream: 0, anthracite: 0, agate: 0, black: 0,
                      chartwell: 0, painswick: 0, irishoak: 0, goldenoak: 0,
                      rosewood: 0, sagegreen: 0, duckegg: 0 },   // %
      fitCharge: { window: 0, fixed: 0, sash: 0, door: 0, french: 0,
                   slider: 0, bifold: 0, bay: 0 },               // per unit
      barsPerPane: 0,
      trickleVent: 0
    };
  };

  M.GLASS = {
    'standard':  'Standard double glazed unit',
    'low-e':     'Low-E energy efficient unit',
    'toughened': 'Toughened safety glass',
    'obscure':   'Obscure / privacy glass',
    'laminated': 'Laminated security glass',
    'acoustic':  'Acoustic glass',
    'triple':    'Triple glazed unit',
    'leaded':    'Leaded / decorative glass'
  };

  /* ---------------------------------------------------------------
   * Item factory.
   * ------------------------------------------------------------- */
  var seq = 0;
  M.newItem = function (product) {
    product = product || 'window';
    var it = {
      id: 'it' + Date.now().toString(36) + (++seq),
      product: product,
      ref: '',
      location: '',
      qty: 1,
      width: 1200,
      height: 1200,
      cols: [1],
      rows: [1],
      cells: { 'r0c0': { type: 'fixed', hinge: 'left' } },
      finishOut: 'white',
      finishIn: 'white',
      hardware: 'chrome',
      glass: 'low-e',
      obscure: false,
      barStyle: 'georgian',
      trickleVent: false,
      cill: true,
      notes: '',
      // pricing
      priceMode: 'manual',      // 'manual' | 'margin' | 'calc'
      sellPrice: 0,
      supplierCost: 0,
      margin: null,             // null = use price book default
      extraCost: 0
    };

    switch (product) {
      case 'fixed':
        it.cells = { 'r0c0': { type: 'fixed' } };
        break;
      case 'window':
        it.width = 1200; it.height = 1050;
        it.cols = [1, 1];
        it.cells = { 'r0c0': { type: 'side-hung', hinge: 'left' },
                     'r0c1': { type: 'side-hung', hinge: 'right' } };
        break;
      case 'door':
        it.width = 920; it.height = 2080;
        it.doorStyle = 'half-glazed';
        it.hingeSide = 'left';
        it.letterplate = true;
        it.knocker = false;
        it.handleStyle = 'lever';
        it.sidelightLeft = 0; it.sidelightRight = 0; it.fanlight = 0;
        it.obscure = true;
        it.cill = false;
        break;
      case 'french':
        it.width = 1500; it.height = 2080;
        it.doorStyle = 'full-glazed';
        it.leaves = 2;
        it.handleStyle = 'lever';
        it.cill = false;
        break;
      case 'slider':
        it.width = 2400; it.height = 2100;
        it.config = 'OX';
        it.cill = false;
        break;
      case 'bifold':
        it.width = 3000; it.height = 2100;
        it.leaves = 3;
        it.trafficDoor = 1;
        it.cill = false;
        break;
      case 'sash':
        it.width = 900; it.height = 1500;
        it.sashSplit = 0.5;
        it.horns = true;
        it.barStyle = 'astragal';
        it.topBarsV = 0; it.topBarsH = 0;
        it.botBarsV = 0; it.botBarsH = 0;
        break;
      case 'bay':
        it.height = 1200;
        it.facets = [
          { width: 600, corner: 135, cols: [1], rows: [1],
            cells: { 'r0c0': { type: 'side-hung', hinge: 'left' } } },
          { width: 1200, corner: 135, cols: [1, 1], rows: [1],
            cells: { 'r0c0': { type: 'fixed' }, 'r0c1': { type: 'fixed' } } },
          { width: 600, cols: [1], rows: [1],
            cells: { 'r0c0': { type: 'side-hung', hinge: 'right' } } }
        ];
        break;
    }
    return it;
  };

  /* Overall frame size implied by a set of light sizes, and the reverse.
   * Keeping these two in step is what makes the dimension lines on the
   * drawing add up — a schedule where the light sizes do not total the
   * overall width is worse than no schedule at all. */
  M.widthFromLights = function (cols) {
    var p = SW.draw.PROFILE;
    return cols.reduce(function (a, b) { return a + b; }, 0) +
           p.outerFrame * 2 + p.mullion * (cols.length - 1);
  };
  M.heightFromLights = function (rows) {
    var p = SW.draw.PROFILE;
    return rows.reduce(function (a, b) { return a + b; }, 0) +
           p.outerFrame * 2 + p.transom * (rows.length - 1);
  };
  M.fitLightsToWidth = function (item) {
    var p = SW.draw.PROFILE;
    var avail = item.width - p.outerFrame * 2 - p.mullion * (item.cols.length - 1);
    var sum = item.cols.reduce(function (a, b) { return a + b; }, 0) || 1;
    item.cols = item.cols.map(function (w) {
      return Math.max(1, Math.round(w * avail / sum));
    });
    item.width = M.widthFromLights(item.cols);
  };
  M.fitLightsToHeight = function (item) {
    var p = SW.draw.PROFILE;
    var avail = item.height - p.outerFrame * 2 - p.transom * (item.rows.length - 1);
    var sum = item.rows.reduce(function (a, b) { return a + b; }, 0) || 1;
    item.rows = item.rows.map(function (h) {
      return Math.max(1, Math.round(h * avail / sum));
    });
    item.height = M.heightFromLights(item.rows);
  };

  /* Rebuild the cells map when the grid size changes, keeping what fits. */
  M.resizeGrid = function (item, nCols, nRows) {
    var old = item.cells || {}, next = {};
    for (var r = 0; r < nRows; r++) {
      for (var c = 0; c < nCols; c++) {
        next['r' + r + 'c' + c] = old['r' + r + 'c' + c] ||
          { type: 'fixed', hinge: 'left' };
      }
    }
    item.cells = next;
    var p = SW.draw.PROFILE;
    var availW = item.width - p.outerFrame * 2 - p.mullion * (nCols - 1);
    var availH = item.height - p.outerFrame * 2 - p.transom * (nRows - 1);
    item.cols = trimTo(item.cols, nCols, availW / nCols);
    item.rows = trimTo(item.rows, nRows, availH / nRows);
    M.fitLightsToWidth(item);
    M.fitLightsToHeight(item);
    return item;
  };
  function trimTo(arr, n, fallback) {
    arr = (arr || []).slice(0, n);
    while (arr.length < n) { arr.push(Math.max(1, Math.round(fallback))); }
    return arr;
  }

  /* ---------------------------------------------------------------
   * Pricing.
   * ------------------------------------------------------------- */
  M.areaM2 = function (item) {
    if (item.product === 'bay') {
      var w = (item.facets || []).reduce(function (a, f) { return a + f.width; }, 0);
      return (w * item.height) / 1e6;
    }
    return (item.width * item.height) / 1e6;
  };

  M.countOpeners = function (item) {
    var n = 0, k;
    function scan(cells) {
      for (k in cells) {
        var t = cells[k].type;
        if (t && t !== 'fixed' && t !== 'dummy') { n++; }
      }
    }
    if (item.product === 'bay') {
      (item.facets || []).forEach(function (f) { scan(f.cells || {}); });
    } else if (item.cells) {
      scan(item.cells);
    }
    if (item.product === 'door')   { n += 1; }
    if (item.product === 'french') { n += 2; }
    if (item.product === 'slider') {
      n += ((item.config || 'OX').match(/X/g) || []).length;
    }
    if (item.product === 'bifold') { n += (item.leaves || 3); }
    return n;
  };

  /* Returns { unit, total, breakdown[] } — all ex VAT. */
  M.priceItem = function (item, pb) {
    pb = pb || M.defaultPriceBook();
    var qty = Math.max(1, item.qty || 1);
    var lines = [], unit = 0;

    if (item.priceMode === 'manual') {
      unit = num(item.sellPrice);
      lines.push({ label: 'Unit price', value: unit });

    } else if (item.priceMode === 'margin') {
      var cost = num(item.supplierCost);
      var mgn = item.margin === null || item.margin === undefined
        ? num(pb.defaultMargin) : num(item.margin);
      // Margin is on the SELL price, not a mark-up on cost:
      // sell = cost / (1 - margin/100). A 40% margin on a £500 cost is
      // £833.33, not £700 — getting this wrong is how you lose money.
      unit = mgn >= 100 ? cost : cost / (1 - mgn / 100);
      lines.push({ label: 'Supplier cost', value: cost });
      lines.push({ label: 'Margin @ ' + mgn + '%', value: unit - cost });

    } else {                                   // 'calc'
      var area = M.areaM2(item);
      var rate = num(pb.ratePerM2[item.product]);
      var base = area * rate;
      lines.push({ label: area.toFixed(2) + ' m² @ ' + money(rate) + '/m²',
                   value: base });

      var upl = num(pb.finishUplift[item.finishOut]);
      if (upl) {
        var u = base * upl / 100;
        lines.push({ label: SW.draw.finish(item.finishOut).name +
                            ' finish +' + upl + '%', value: u });
        base += u;
      }
      var op = M.countOpeners(item);
      if (op && num(pb.openerCharge)) {
        var oc = op * num(pb.openerCharge);
        lines.push({ label: op + ' × opening light', value: oc });
        base += oc;
      }
      var gr = num(pb.glassPerM2[item.obscure ? 'obscure' : item.glass]);
      if (gr) {
        var gc = area * gr;
        lines.push({ label: (M.GLASS[item.glass] || item.glass), value: gc });
        base += gc;
      }
      var fit = num(pb.fitCharge[item.product]);
      if (fit) { lines.push({ label: 'Fitting', value: fit }); base += fit; }

      var min = num(pb.minCharge[item.product]);
      if (min && base < min) {
        lines.push({ label: 'Minimum charge applied', value: min - base });
        base = min;
      }
      unit = base;
    }

    var extra = num(item.extraCost);
    if (extra) { lines.push({ label: 'Extras / adjustment', value: extra }); }
    unit += extra;
    if (unit < 0) { unit = 0; }

    return { unit: round2(unit), total: round2(unit * qty),
             qty: qty, breakdown: lines };
  };

  M.priceQuote = function (quote, pb) {
    var net = 0;
    var items = (quote.items || []).map(function (it) {
      var p = M.priceItem(it, pb);
      net += p.total;
      return p;
    });
    var discPct = num(quote.discountPct);
    var discount = round2(net * discPct / 100);
    var afterDisc = round2(net - discount);
    var extras = (quote.extras || []).reduce(function (a, e) {
      return a + num(e.amount);
    }, 0);
    var goods = round2(afterDisc + extras);
    var vatRate = quote.vatRate === undefined || quote.vatRate === null
      ? num(pb.vatRate) : num(quote.vatRate);
    var vat = round2(goods * vatRate / 100);
    var gross = round2(goods + vat);
    var depPct = num(quote.depositPct);
    return {
      items: items, net: round2(net), discountPct: discPct, discount: discount,
      extras: round2(extras), goods: goods, vatRate: vatRate, vat: vat,
      gross: gross,
      deposit: round2(gross * depPct / 100),
      balance: round2(gross - gross * depPct / 100)
    };
  };

  M.priceBookIsEmpty = function (pb) {
    var any = false;
    function walk(o) {
      for (var k in o) {
        if (typeof o[k] === 'object' && o[k]) { walk(o[k]); }
        else if (typeof o[k] === 'number' && o[k] > 0 &&
                 k !== 'vatRate' && k !== 'currency') { any = true; }
      }
    }
    walk(pb);
    return !any;
  };

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function money(n) { return '£' + n.toFixed(2); }
  M.num = num; M.round2 = round2;

  M.money = function (n) {
    var v = num(n);
    return '£' + v.toLocaleString('en-GB',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  /* ---------------------------------------------------------------
   * Quote factory + persistence.
   * ------------------------------------------------------------- */
  M.newQuote = function (nextNumber) {
    var d = new Date();
    return {
      id: 'q' + Date.now().toString(36),
      number: nextNumber || ('SW-' + d.getFullYear() + '-001'),
      date: d.toISOString().slice(0, 10),
      validDays: 30,
      customer: { name: '', address: '', postcode: '', phone: '', email: '' },
      siteAddress: '',
      items: [],
      extras: [],
      discountPct: 0,
      depositPct: 0,
      vatRate: null,
      leadTimeWeeks: '',
      notes: '',
      terms: M.defaultTerms(),
      status: 'draft'
    };
  };

  M.defaultTerms = function () {
    return [
      'This quotation is valid for the period shown above and is subject to a ' +
        'final site survey. Sizes shown are as measured or as supplied and will ' +
        'be confirmed at survey before manufacture.',
      'All work is carried out to current Building Regulations. Swift Windows ' +
        'Limited is ASSURE registered and your installation will be registered ' +
        'on completion.',
      'Prices include supply, delivery, installation and removal of your old ' +
        'frames unless stated otherwise.',
      'Making good is limited to internal plaster reveals where disturbed. ' +
        'Redecoration is not included.',
      'A deposit is payable on order with the balance due on completion.'
    ];
  };

  var KEY = 'swift-quotes-v1', PBKEY = 'swift-pricebook-v1',
      COKEY = 'swift-company-v1';

  M.load = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  };
  M.save = function (list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  };
  M.loadPriceBook = function () {
    try {
      var pb = JSON.parse(localStorage.getItem(PBKEY));
      return pb ? deepMerge(M.defaultPriceBook(), pb) : M.defaultPriceBook();
    } catch (e) { return M.defaultPriceBook(); }
  };
  M.savePriceBook = function (pb) {
    try { localStorage.setItem(PBKEY, JSON.stringify(pb)); } catch (e) {}
  };
  M.loadCompany = function () {
    try {
      var c = JSON.parse(localStorage.getItem(COKEY));
      return c ? deepMerge(JSON.parse(JSON.stringify(SW.COMPANY)), c)
               : JSON.parse(JSON.stringify(SW.COMPANY));
    } catch (e) { return JSON.parse(JSON.stringify(SW.COMPANY)); }
  };
  M.saveCompany = function (c) {
    try { localStorage.setItem(COKEY, JSON.stringify(c)); } catch (e) {}
  };

  function deepMerge(base, over) {
    for (var k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
        base[k] = deepMerge(base[k] || {}, over[k]);
      } else if (over[k] !== undefined) {
        base[k] = over[k];
      }
    }
    return base;
  }

  M.nextNumber = function (list) {
    var year = new Date().getFullYear();
    var max = 0;
    list.forEach(function (q) {
      var m = /^SW-(\d{4})-(\d+)$/.exec(q.number || '');
      if (m && +m[1] === year) { max = Math.max(max, +m[2]); }
    });
    return 'SW-' + year + '-' + String(max + 1).padStart(3, '0');
  };

})(window.SW = window.SW || {});
