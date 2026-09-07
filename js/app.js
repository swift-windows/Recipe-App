/* Application controller: state, routing and event wiring. */
(function (SW) {
  'use strict';
  var M = SW.model, U = SW.ui, D = SW.draw;

  var state = SW.state = {
    quotes: [],
    quote: null,
    selItem: null,
    selCell: 'r0c0',
    priceBook: M.defaultPriceBook(),
    company: M.loadCompany(),
    defaultTerms: M.defaultTerms(),
    showDims: true,
    screen: 'quotes'
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call(
    (r || document).querySelectorAll(s)); };

  /* ---------------- boot ---------------- */
  function boot() {
    state.quotes = M.load();
    state.priceBook = M.loadPriceBook();
    state.company = M.loadCompany();
    try {
      var t = JSON.parse(localStorage.getItem('swift-terms-v1'));
      if (t && t.length) { state.defaultTerms = t; }
    } catch (e) {}
    try {
      var pf = JSON.parse(localStorage.getItem('swift-profile-v1'));
      if (pf) { Object.assign(D.PROFILE, pf); }
    } catch (e) {}

    if (!state.quotes.length) {
      var q = M.newQuote(M.nextNumber([]));
      q.terms = state.defaultTerms.slice();
      state.quotes.push(q);
      state.quote = q;
      seedDemo(q);
      persist();
    } else {
      state.quote = state.quotes[0];
    }
    state.selItem = state.quote.items[0] ? state.quote.items[0].id : null;

    wire();
    go('editor');
  }

  /* A couple of starter items so the app opens on something real
   * rather than a blank stage. Sizes are illustrative only. */
  function seedDemo(q) {
    var w = M.newItem('window');
    w.ref = 'W1'; w.location = 'Front elevation — lounge';
    w.width = 1800; w.height = 1200;
    w.cols = [500, 800, 500];
    M.resizeGrid(w, 3, 1);
    w.cells = {
      'r0c0': { type: 'side-hung', hinge: 'left' },
      'r0c1': { type: 'fixed' },
      'r0c2': { type: 'side-hung', hinge: 'right' }
    };
    w.finishOut = 'anthracite'; w.finishIn = 'white';
    var d = M.newItem('door');
    d.ref = 'D1'; d.location = 'Front entrance';
    d.doorStyle = 'half-glazed'; d.finishOut = 'anthracite'; d.finishIn = 'white';
    d.obscure = true;
    q.items.push(w, d);
  }

  /* ---------------- routing ---------------- */
  function go(name) {
    state.screen = name;
    $$('.screen').forEach(function (s) { s.classList.remove('on'); });
    var el = $('#screen-' + name);
    if (el) { el.classList.add('on'); }
    $$('.nav button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.screen === name);
    });
    render();
  }
  SW.go = go;

  /* ---------------- rendering ---------------- */
  function render() {
    var q = state.quote, pb = state.priceBook;
    switch (state.screen) {
      case 'quotes':
        $('#quotes-list').innerHTML =
          U.quotesList(state.quotes, $('#q-search').value, pb);
        break;
      case 'editor':
        renderEditor();
        break;
      case 'preview':
        $('#quote-doc').innerHTML =
          SW.quotedoc.render(q, pb, state.company);
        break;
      case 'pricebook':
        $('#pricebook-form').innerHTML = U.priceBookForm(pb);
        break;
      case 'settings':
        $('#settings-form').innerHTML = U.settingsForm(state.company);
        break;
    }
  }
  SW.render = render;

  function currentItem() {
    if (!state.quote) { return null; }
    return state.quote.items.filter(function (i) {
      return i.id === state.selItem; })[0] || null;
  }

  function renderEditor() {
    var q = state.quote, pb = state.priceBook, it = currentItem();

    $('#pb-warning').innerHTML = M.priceBookIsEmpty(pb)
      ? '<div class="banner warn"><b>Price book is empty.</b> ' +
        'That is deliberate — no rates have been invented for you. Price each ' +
        'line by hand or from supplier cost plus margin, or fill in the ' +
        '<a href="#" data-goto="pricebook">price book</a> once and reuse it.</div>'
      : '';

    if ($('#customer-fields').dataset.qid !== q.id ||
        !$('#customer-fields').children.length) {
      $('#customer-fields').innerHTML = U.customerFields(q);
      $('#customer-fields').dataset.qid = q.id;
    }
    var sum = $('#cust-acc > summary');
    if (sum) {
      sum.innerHTML = 'Customer &amp; job details' +
        '<span class="spacer"></span><span class="pill">' +
        U.esc(q.number) + '</span>' +
        (q.customer.name
          ? '<span style="font-weight:500;color:var(--mute)">' +
            U.esc(q.customer.name) + '</span>' : '');
    }

    $('#item-list').innerHTML = U.itemList(q, pb, state.selItem);
    $('#item-count').textContent = q.items.length;
    $('#config-pane').innerHTML = U.configPane(it, state.selCell);

    if (it) {
      $('#stage').innerHTML = D.render(it, { dims: state.showDims, key: true });
      $('#stage-title').textContent =
        (it.ref ? it.ref + ' — ' : '') + (D.PRODUCTS[it.product] || 'Drawing');
      var p = M.priceItem(it, pb);
      $('#stagebar').innerHTML =
        '<span>' + U.esc(D.describe(it)) + '</span><span class="spacer"></span>' +
        '<span>' + M.areaM2(it).toFixed(2) + ' m²</span>' +
        '<span>·</span><span><b>' + M.money(p.total) + '</b> ex VAT</span>';
    } else {
      $('#stage').innerHTML =
        '<div class="empty"><h3>Nothing to draw yet</h3>' +
        '<p>Add an item on the left.</p></div>';
      $('#stage-title').textContent = 'Drawing';
      $('#stagebar').innerHTML = '';
    }
    $('#btn-toggle-dims').classList.toggle('primary', state.showDims);
  }

  /* ---------------- persistence ---------------- */
  var saveTimer;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (!M.save(state.quotes)) {
        toast('Could not save — browser storage may be full');
      }
    }, 250);
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  SW.toast = toast;

  /* ---------------- generic path binding ---------------- */
  function setPath(path, value) {
    var it = currentItem(), q = state.quote;
    var parts = path.split('.');
    var root = parts.shift();

    if (root === 'quote') {
      assign(q, parts, value);
      if (parts[0] === 'number' || parts[0] === 'status') { persist(); }
      persist();
      return;
    }
    if (root === 'item' && it) {
      var key = parts[0];
      if (key === 'product') {
        changeProduct(it, value);
      } else {
        assign(it, parts, value);
        // Overall size changed: rescale the light sizes to match, so the
        // sub-dimensions still total the overall dimension.
        if (key === 'width' && it.cols && it.cols.length) {
          M.fitLightsToWidth(it);
        }
        if (key === 'height' && it.rows && it.rows.length) {
          M.fitLightsToHeight(it);
        }
      }
      persist(); return;
    }
    if (root === 'grid' && it) {
      var L = D.layout(it);
      var nC = parts[0] === 'cols' ? clampInt(value, 1, 6) : L.cols.length;
      var nR = parts[0] === 'rows' ? clampInt(value, 1, 4) : L.rows.length;
      M.resizeGrid(it, nC, nR);
      if (!it.cells[state.selCell]) { state.selCell = 'r0c0'; }
      persist(); return;
    }
    // A light size is a real dimension, so changing one changes the
    // overall frame size rather than silently squeezing its neighbours.
    if (root === 'cols' && it) {
      it.cols[+parts[0]] = Math.max(1, num(value));
      it.width = M.widthFromLights(it.cols);
      persist(); return;
    }
    if (root === 'rows' && it) {
      it.rows[+parts[0]] = Math.max(1, num(value));
      it.height = M.heightFromLights(it.rows);
      persist(); return;
    }
    if (root === 'cell' && it) {
      var c = it.cells[state.selCell];
      if (!c) { return; }
      assign(c, parts, value);
      persist(); return;
    }
    if (root === 'facet' && it) {
      var idx = +parts[0], fkey = parts[1], fc = it.facets[idx];
      if (!fc) { return; }
      if (fkey === 'ncols') {
        var n = clampInt(value, 1, 4);
        fc.cols = []; var cells = {};
        for (var i = 0; i < n; i++) {
          fc.cols.push(fc.width / n);
          cells['r0c' + i] = (fc.cells && fc.cells['r0c' + i]) || { type: 'fixed' };
        }
        fc.rows = [1]; fc.cells = cells;
      } else if (fkey === 'type') {
        fc.cells = fc.cells || {};
        Object.keys(fc.cells).forEach(function (k) {
          fc.cells[k].type = value;
          if (!fc.cells[k].hinge) { fc.cells[k].hinge = 'left'; }
        });
      } else {
        fc[fkey] = num(value);
      }
      persist(); return;
    }
    if (root === 'pb') {
      assign(state.priceBook, parts, value);
      M.savePriceBook(state.priceBook); return;
    }
    if (root === 'co') {
      if (parts[0] === 'terms') {
        state.defaultTerms = String(value).split('\n')
          .map(function (s) { return s.trim(); }).filter(Boolean);
        try {
          localStorage.setItem('swift-terms-v1',
            JSON.stringify(state.defaultTerms));
        } catch (e) {}
        return;
      }
      assign(state.company, parts, value);
      M.saveCompany(state.company); return;
    }
    if (root === 'pf') {
      D.PROFILE[parts[0]] = Math.max(1, num(value));
      try {
        localStorage.setItem('swift-profile-v1', JSON.stringify(D.PROFILE));
      } catch (e) {}
      return;
    }
  }

  function assign(obj, parts, value) {
    for (var i = 0; i < parts.length - 1; i++) {
      obj[parts[i]] = obj[parts[i]] || {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function clampInt(v, lo, hi) {
    var n = Math.round(num(v)); return Math.min(hi, Math.max(lo, n || lo));
  }

  function changeProduct(it, product) {
    var fresh = M.newItem(product);
    // Carry across the things that are genuinely product-independent.
    ['ref', 'location', 'qty', 'finishOut', 'finishIn', 'hardware', 'glass',
     'obscure', 'notes', 'priceMode', 'sellPrice', 'supplierCost', 'margin',
     'extraCost', 'barStyle'].forEach(function (k) {
      if (it[k] !== undefined) { fresh[k] = it[k]; }
    });
    if (product !== 'bay') { fresh.width = it.width; fresh.height = it.height; }
    else { fresh.height = it.height; }
    fresh.id = it.id;
    var idx = state.quote.items.indexOf(it);
    state.quote.items[idx] = fresh;
    state.selCell = 'r0c0';
  }

  /* ---------------- events ---------------- */
  function wire() {
    $$('.nav button').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.screen); });
    });

    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.dataset || !el.dataset.path) { return; }
      var v = el.type === 'checkbox' ? el.checked
            : el.type === 'number' ? (el.value === '' ? null : parseFloat(el.value))
            : el.value;
      if (el.type === 'number' && v === null &&
          /margin|vatRate/.test(el.dataset.path)) { v = null; }
      else if (el.type === 'number' && v === null) { v = 0; }
      setPath(el.dataset.path, v);

      // Live-redraw without rebuilding the pane the user is typing in.
      if (state.screen === 'editor') {
        var it = currentItem();
        if (it) {
          if (/^cols\.|^rows\./.test(el.dataset.path)) {
            var wBox = document.querySelector('[data-path="item.width"]');
            var hBox = document.querySelector('[data-path="item.height"]');
            if (wBox) { wBox.value = Math.round(it.width); }
            if (hBox) { hBox.value = Math.round(it.height); }
          }
          $('#stage').innerHTML = D.render(it, { dims: state.showDims, key: true });
          $('#item-list').innerHTML = U.itemList(state.quote, state.priceBook,
                                                 state.selItem);
          var p = M.priceItem(it, state.priceBook);
          $('#stagebar').innerHTML =
            '<span>' + U.esc(D.describe(it)) + '</span><span class="spacer"></span>' +
            '<span>' + M.areaM2(it).toFixed(2) + ' m²</span><span>·</span>' +
            '<span><b>' + M.money(p.total) + '</b> ex VAT</span>';
        }
      }
    });

    // Selects and checkboxes need a full re-render (they change the form shape).
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el.dataset || !el.dataset.path) { return; }
      if (el.tagName === 'SELECT' || el.type === 'checkbox' ||
          /^grid\.|^facet\.\d+\.ncols/.test(el.dataset.path)) {
        render();
      }
    });

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : e.target.parentNode;
      var el;

      if ((el = t.closest('[data-goto]'))) {
        e.preventDefault(); go(el.dataset.goto); return;
      }
      if ((el = t.closest('[data-swatch]'))) {
        setPath(el.dataset.swatch, el.dataset.value); render(); return;
      }
      if ((el = t.closest('[data-cell]'))) {
        state.selCell = el.dataset.cell; render(); return;
      }
      if ((el = t.closest('[data-item]'))) {
        state.selItem = el.dataset.item; state.selCell = 'r0c0'; render(); return;
      }
      if ((el = t.closest('[data-delq]'))) {
        e.stopPropagation(); deleteQuote(el.dataset.delq); return;
      }
      if ((el = t.closest('[data-quote]'))) {
        openQuote(el.dataset.quote); return;
      }
      if (t.closest('[data-apply-all]')) { applyToAll(); return; }
      if (t.closest('[data-bay-add]')) { bayAdd(1); return; }
      if (t.closest('[data-bay-del]')) { bayAdd(-1); return; }
      if (t.closest('#logo-clear')) {
        state.company.logo = ''; M.saveCompany(state.company); render(); return;
      }
    });

    $('#btn-add-item').addEventListener('click', addItem);
    $('#btn-dup').addEventListener('click', duplicateItem);
    $('#btn-del').addEventListener('click', deleteItem);
    $('#btn-new').addEventListener('click', newQuote);
    $('#btn-print').addEventListener('click', function () {
      go('preview');
      setTimeout(function () { window.print(); }, 120);
    });
    $('#btn-toggle-dims').addEventListener('click', function () {
      state.showDims = !state.showDims; render();
    });
    $('#btn-svg').addEventListener('click', saveSVG);
    $('#q-search').addEventListener('input', render);
    $('#btn-export').addEventListener('click', exportBackup);
    $('#btn-import').addEventListener('click', function () {
      $('#file-import').click();
    });
    $('#file-import').addEventListener('change', importBackup);

    document.addEventListener('change', function (e) {
      if (e.target.id === 'logo-file') { readLogo(e.target.files[0]); }
    });

    window.addEventListener('beforeunload', function () {
      M.save(state.quotes);
    });
  }

  /* ---------------- item actions ---------------- */
  function addItem() {
    var dlg = document.createElement('dialog');
    var keys = Object.keys(D.PRODUCTS);
    dlg.innerHTML = '<header><h3>What are you adding?</h3></header>' +
      '<div class="body"><div class="prodpick">' +
      keys.map(function (k) {
        var demo = M.newItem(k);
        if (k === 'bay') { demo.height = 900; }
        return '<button data-p="' + k + '">' +
          D.render(demo, { dims: false, key: false }) +
          D.PRODUCTS[k] + '</button>';
      }).join('') + '</div></div>' +
      '<footer><button class="btn" value="cancel">Cancel</button></footer>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]');
      if (b) {
        var it = M.newItem(b.dataset.p);
        it.ref = nextRef(b.dataset.p);
        state.quote.items.push(it);
        state.selItem = it.id; state.selCell = 'r0c0';
        persist(); dlg.close(); render();
      }
      if (e.target.value === 'cancel') { dlg.close(); }
    });
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.showModal();
  }

  function nextRef(product) {
    var prefix = (product === 'door' || product === 'french' ||
                  product === 'slider' || product === 'bifold') ? 'D' : 'W';
    var n = state.quote.items.filter(function (i) {
      return (i.ref || '').charAt(0) === prefix; }).length + 1;
    return prefix + n;
  }

  function duplicateItem() {
    var it = currentItem();
    if (!it) { return; }
    var copy = JSON.parse(JSON.stringify(it));
    copy.id = 'it' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    copy.ref = nextRef(copy.product);
    state.quote.items.splice(state.quote.items.indexOf(it) + 1, 0, copy);
    state.selItem = copy.id;
    persist(); render();
  }

  function deleteItem() {
    var it = currentItem();
    if (!it) { return; }
    if (!confirm('Delete ' + (it.ref || 'this item') + '?')) { return; }
    var i = state.quote.items.indexOf(it);
    state.quote.items.splice(i, 1);
    var next = state.quote.items[Math.min(i, state.quote.items.length - 1)];
    state.selItem = next ? next.id : null;
    persist(); render();
  }

  function applyToAll() {
    var it = currentItem();
    if (!it) { return; }
    var src = it.cells[state.selCell];
    if (!src) { return; }
    Object.keys(it.cells).forEach(function (k) {
      it.cells[k].type = src.type;
      it.cells[k].hinge = src.hinge;
    });
    persist(); render();
  }

  function bayAdd(dir) {
    var it = currentItem();
    if (!it || it.product !== 'bay') { return; }
    if (dir > 0) {
      var last = it.facets[it.facets.length - 1];
      last.corner = last.corner || 135;
      it.facets.push({ width: 600, cols: [1], rows: [1],
        cells: { 'r0c0': { type: 'fixed' } } });
    } else if (it.facets.length > 2) {
      it.facets.pop();
      delete it.facets[it.facets.length - 1].corner;
    }
    persist(); render();
  }

  /* ---------------- quote actions ---------------- */
  function newQuote() {
    var q = M.newQuote(M.nextNumber(state.quotes));
    q.terms = state.defaultTerms.slice();
    state.quotes.unshift(q);
    state.quote = q; state.selItem = null;
    $('#customer-fields').dataset.qid = '';
    persist(); go('editor');
    toast('Started ' + q.number);
  }

  function openQuote(id) {
    var q = state.quotes.filter(function (x) { return x.id === id; })[0];
    if (!q) { return; }
    state.quote = q;
    state.selItem = q.items[0] ? q.items[0].id : null;
    state.selCell = 'r0c0';
    $('#customer-fields').dataset.qid = '';
    go('editor');
  }

  function deleteQuote(id) {
    var q = state.quotes.filter(function (x) { return x.id === id; })[0];
    if (!q || !confirm('Delete quote ' + q.number + '? This cannot be undone.')) {
      return;
    }
    state.quotes = state.quotes.filter(function (x) { return x.id !== id; });
    if (state.quote === q) {
      state.quote = state.quotes[0] || M.newQuote(M.nextNumber(state.quotes));
      if (!state.quotes.length) { state.quotes.push(state.quote); }
      state.selItem = state.quote.items[0] ? state.quote.items[0].id : null;
    }
    persist(); render();
  }

  /* ---------------- import / export ---------------- */
  function exportBackup() {
    var data = {
      exported: new Date().toISOString(),
      quotes: state.quotes, priceBook: state.priceBook,
      company: state.company, terms: state.defaultTerms, profile: D.PROFILE
    };
    download('swift-quotes-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify(data, null, 2), 'application/json');
    toast('Backup downloaded');
  }

  function importBackup(e) {
    var file = e.target.files[0];
    if (!file) { return; }
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d.quotes) { throw new Error('no quotes in file'); }
        if (!confirm('Replace everything currently in the app with this backup?')) {
          return;
        }
        state.quotes = d.quotes;
        if (d.priceBook) { state.priceBook = d.priceBook; M.savePriceBook(d.priceBook); }
        if (d.company) { state.company = d.company; M.saveCompany(d.company); }
        if (d.terms) { state.defaultTerms = d.terms; }
        if (d.profile) { Object.assign(D.PROFILE, d.profile); }
        state.quote = state.quotes[0];
        state.selItem = state.quote && state.quote.items[0]
          ? state.quote.items[0].id : null;
        persist(); go('quotes');
        toast('Backup restored');
      } catch (err) {
        toast('That file did not look like a Swift Windows backup');
      }
    };
    fr.readAsText(file);
    e.target.value = '';
  }

  function saveSVG() {
    var it = currentItem();
    if (!it) { return; }
    var svg = D.render(it, { dims: state.showDims, key: true });
    download((it.ref || 'drawing') + '.svg',
      '<?xml version="1.0" encoding="UTF-8"?>\n' + svg, 'image/svg+xml');
  }

  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function readLogo(file) {
    if (!file) { return; }
    if (file.size > 900 * 1024) {
      toast('That logo is a bit big — try one under 900KB');
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      state.company.logo = fr.result;
      M.saveCompany(state.company);
      render();
      toast('Logo saved');
    };
    fr.readAsDataURL(file);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

})(window.SW = window.SW || {});
