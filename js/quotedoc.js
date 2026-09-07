/* Builds the printable quote document. */
(function (SW) {
  'use strict';
  var Q = SW.quotedoc = {};
  var M = SW.model;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }

  function dateUK(iso) {
    if (!iso) { return ''; }
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) { return iso; }
    return d.toLocaleDateString('en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) { return ''; }
    d.setDate(d.getDate() + (+n || 0));
    return d.toISOString().slice(0, 10);
  }

  var ITEMS_FIRST = 3, ITEMS_REST = 4;

  Q.render = function (quote, pb, company) {
    company = company || SW.COMPANY;
    var totals = M.priceQuote(quote, pb);
    var items = quote.items || [];

    // Split items across pages.
    var pages = [], i = 0;
    if (!items.length) { pages.push([]); }
    while (i < items.length) {
      var n = pages.length === 0 ? ITEMS_FIRST : ITEMS_REST;
      pages.push(items.slice(i, i + n));
      i += n;
    }
    var totalPages = pages.length + 1;      // + summary page

    var out = pages.map(function (chunk, idx) {
      return page(
        (idx === 0 ? letterhead(quote, company) + parties(quote, company) +
                     intro(quote) : slimHead(quote, company)) +
        '<div class="qitems">' +
          chunk.map(function (it, k) {
            return itemBlock(it, totals.items[items.indexOf(it)], quote, pb);
          }).join('') +
        '</div>',
        company, idx + 1, totalPages);
    });

    out.push(page(
      slimHead(quote, company) +
      summary(quote, totals) +
      terms(quote) +
      acceptance(quote, company, totals),
      company, totalPages, totalPages));

    return out.join('');
  };

  function page(inner, company, n, of_) {
    return '<div class="page">' + inner + footer(company, n, of_) + '</div>';
  }

  function logoMark(company) {
    if (company.logo) {
      return '<div class="logo"><img src="' + esc(company.logo) + '" alt=""></div>';
    }
    return '<div class="logo"><svg viewBox="0 0 64 64">' +
      '<path fill="#1E7FA8" d="M4 30c11-3 19-9 25-17 1 6 0 11-2 15 7-2 13-6 18-12 ' +
      '1 8-2 15-7 20 5 0 9-1 13-4-4 10-13 17-24 18l-3 12-5-11c-6 0-12-2-16-6 ' +
      '4 1 8 1 11 0-6-3-10-8-11-15z"/></svg></div>';
  }

  function letterhead(q, c) {
    var valid = q.validDays ? addDays(q.date, q.validDays) : '';
    return '<div class="qhead">' +
      '<div class="co">' + logoMark(c) + '<div>' +
        '<h1>' + esc(c.name) + '</h1>' +
        '<address>' + nl(c.address) +
          (c.phone ? '<br>' + esc(c.phone) : '') +
          (c.email ? ' · ' + esc(c.email) : '') +
          (c.web ? '<br>' + esc(c.web) : '') +
          '<br>VAT Reg. ' + esc(c.vat) +
          (c.accreditation ? ' · ' + esc(c.accreditation) : '') +
        '</address>' +
      '</div></div>' +
      '<div class="doc"><div class="t">Quotation</div><table>' +
        row('Number', '<b>' + esc(q.number) + '</b>') +
        row('Date', esc(dateUK(q.date))) +
        (valid ? row('Valid until', esc(dateUK(valid))) : '') +
        (q.leadTimeWeeks ? row('Lead time', esc(q.leadTimeWeeks) + ' weeks') : '') +
      '</table></div></div>';
  }
  function row(k, v) { return '<tr><td>' + k + '</td><td>' + v + '</td></tr>'; }

  function slimHead(q, c) {
    return '<div class="qhead" style="padding-bottom:4mm;border-bottom-width:1pt">' +
      '<div class="co">' + logoMark(c) +
      '<div><h1 style="font-size:14pt">' + esc(c.name) + '</h1>' +
      '<address>Quotation ' + esc(q.number) + ' · ' +
        esc(q.customer && q.customer.name ? q.customer.name : '') + '</address>' +
      '</div></div>' +
      '<div class="doc"><table>' + row('Date', esc(dateUK(q.date))) + '</table></div>' +
      '</div>';
  }

  function parties(q, c) {
    var cu = q.customer || {};
    var addr = [cu.address, cu.postcode].filter(Boolean).join('\n');
    return '<div class="qparties">' +
      '<div><h4>Prepared for</h4><div class="v">' +
        '<b>' + esc(cu.name || '—') + '</b>' +
        (addr ? '<br>' + nl(addr) : '') +
        (cu.phone ? '<br>' + esc(cu.phone) : '') +
        (cu.email ? '<br>' + esc(cu.email) : '') +
      '</div></div>' +
      '<div><h4>Installation address</h4><div class="v">' +
        nl(q.siteAddress || addr || '—') +
      '</div></div></div>';
  }

  function intro(q) {
    var t = q.notes && q.notes.trim()
      ? q.notes
      : 'Thank you for the opportunity to quote for your project. Everything ' +
        'below is supplied and fitted by our own installation teams, and each ' +
        'item is drawn to the sizes noted so you can see exactly what you are ' +
        'getting before you commit. Any questions at all, please just ring.';
    return '<div class="qintro">' + nl(t) + '</div>';
  }

  function itemBlock(item, priced, quote, pb) {
    priced = priced || M.priceItem(item, pb);
    var svg = SW.draw.render(item, { dims: true, key: false });
    var dims = item.product === 'bay'
      ? (item.facets || []).map(function (f) { return f.width; }).join(' + ') +
        ' mm wide × ' + item.height + ' mm high'
      : item.width + ' × ' + item.height + ' mm';
    var openers = M.countOpeners(item) > 0;

    var dl = [];
    dl.push(['Size', dims]);
    dl.push(['Finish', SW.draw.finish(item.finishOut).name +
      (item.finishIn && item.finishIn !== item.finishOut
        ? ' outside / ' + SW.draw.finish(item.finishIn).name + ' inside' : '')]);
    dl.push(['Glazing', (M.GLASS[item.glass] || item.glass) +
      (item.obscure ? ', obscure' : '')]);
    if (SW.draw.HARDWARE[item.hardware]) {
      dl.push(['Hardware', SW.draw.HARDWARE[item.hardware].name]);
    }
    if (item.trickleVent) { dl.push(['Ventilation', 'Trickle vents fitted']); }

    return '<div class="qitem">' +
      '<div class="drawwrap"><div class="draw">' + svg + '</div>' +
        '<div class="drawkey">Viewed from outside' +
        (openers ? ' — dashed lines indicate opening lights, ' +
                   'apex at the hinge side' : '') + '</div></div>' +
      '<div class="info">' +
        '<h3>' + esc(item.ref || SW.draw.PRODUCTS[item.product] || 'Item') + '</h3>' +
        '<div class="sub">' + esc(item.location || '') + '</div>' +
        '<div class="desc">' + esc(SW.draw.describe(item, { finish: false })) +
          '</div>' +
        '<dl>' + dl.map(function (p) {
          return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>';
        }).join('') + '</dl>' +
        (item.notes ? '<div class="note">' + nl(item.notes) + '</div>' : '') +
        '<div class="money">' +
          '<span class="q">' + priced.qty + ' × ' + M.money(priced.unit) +
            (priced.qty > 1 ? '' : '') + '</span>' +
          '<span class="p">' + M.money(priced.total) + '</span>' +
        '</div>' +
      '</div></div>';
  }

  function summary(q, t) {
    var r = [];
    r.push('<tr><td>Frames &amp; installation</td><td>' + M.money(t.net) + '</td></tr>');
    if (t.discount) {
      r.push('<tr><td>Discount (' + t.discountPct + '%)</td><td>−' +
             M.money(t.discount) + '</td></tr>');
    }
    (q.extras || []).forEach(function (e) {
      r.push('<tr><td>' + esc(e.description || 'Additional work') + '</td><td>' +
             M.money(e.amount) + '</td></tr>');
    });
    r.push('<tr class="sep"><td>Total excluding VAT</td><td>' +
           M.money(t.goods) + '</td></tr>');
    r.push('<tr><td>VAT @ ' + t.vatRate + '%</td><td>' + M.money(t.vat) + '</td></tr>');
    r.push('<tr class="total"><td>Total</td><td>' + M.money(t.gross) + '</td></tr>');
    if (q.depositPct) {
      r.push('<tr class="dep"><td>Deposit on order (' + q.depositPct + '%)</td><td>' +
             M.money(t.deposit) + '</td></tr>');
      r.push('<tr class="dep"><td>Balance on completion</td><td>' +
             M.money(t.balance) + '</td></tr>');
    }
    return '<div class="qsum"><table>' + r.join('') + '</table></div>';
  }

  function terms(q) {
    var list = (q.terms && q.terms.length) ? q.terms : M.defaultTerms();
    var half = Math.ceil(list.length / 2);
    return '<div class="qterms"><h4>Terms &amp; conditions</h4>' +
      '<div class="cols">' +
        '<ol>' + list.slice(0, half).map(li).join('') + '</ol>' +
        '<ol start="' + (half + 1) + '">' +
          list.slice(half).map(li).join('') + '</ol>' +
      '</div></div>';
  }
  function li(t) { return '<li>' + nl(t) + '</li>'; }

  function acceptance(q, c, t) {
    return '<div class="qaccept"><h4>Acceptance of quotation</h4>' +
      '<p>I accept the above quotation of <b>' + M.money(t.gross) +
      '</b> including VAT and instruct ' + esc(c.name) +
      ' to proceed, subject to final survey.</p>' +
      '<div class="sigs">' +
        '<div><div class="sig"></div><div class="sigl">Customer signature</div></div>' +
        '<div><div class="sig"></div><div class="sigl">Date</div></div>' +
      '</div></div>';
  }

  function footer(c, n, of_) {
    return '<div class="qfoot">' +
      '<div class="pay"><b>' + esc(c.name) + '</b> · ' + esc(c.address) +
        '<br>VAT ' + esc(c.vat) +
        (c.sortCode ? ' · Sort code ' + esc(c.sortCode) : '') +
        (c.accountNumber ? ' · Account ' + esc(c.accountNumber) : '') +
      '</div>' +
      '<div class="pagenum">Page ' + n + ' of ' + of_ + '</div></div>';
  }

})(window.SW = window.SW || {});
