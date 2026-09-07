/* Sanity checks for the numbers that cost real money if they are wrong.
 * Run with:  node test/checks.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['js/draw/core.js', 'js/draw/symbols.js', 'js/draw/window.js', 'js/draw/door.js',
 'js/draw/special.js', 'js/draw/index.js', 'js/model.js'
].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx,
                               { filename: f }));

const SW = ctx.SW, M = SW.model, D = SW.draw;
let pass = 0, fail = 0;

function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}
function near(name, got, want, tol) {
  tol = tol === undefined ? 0.01 : tol;
  ok(name, Math.abs(got - want) <= tol, 'got ' + got + ', expected ' + want);
}

console.log('\nPricing');
{
  const pb = M.defaultPriceBook();
  const it = M.newItem('window');
  it.priceMode = 'margin'; it.supplierCost = 500; it.margin = 40;
  // Margin is taken on the sell price: 500 / 0.6 = 833.33, NOT 500 * 1.4.
  near('40% margin on £500 cost sells at £833.33',
       M.priceItem(it, pb).unit, 833.33);

  it.margin = 0;
  near('0% margin sells at cost', M.priceItem(it, pb).unit, 500);

  it.priceMode = 'manual'; it.sellPrice = 1200; it.qty = 3;
  const p = M.priceItem(it, pb);
  near('qty multiplies the line total', p.total, 3600);

  it.qty = 1; it.extraCost = -100;
  near('negative adjustment comes off', M.priceItem(it, pb).unit, 1100);
}

console.log('\nQuote totals');
{
  const pb = M.defaultPriceBook();
  const q = M.newQuote('SW-2026-001');
  const a = M.newItem('window'); a.priceMode = 'manual'; a.sellPrice = 1000;
  const b = M.newItem('door');   b.priceMode = 'manual'; b.sellPrice = 1500;
  q.items = [a, b];
  q.discountPct = 10; q.depositPct = 25; q.vatRate = 20;

  const t = M.priceQuote(q, pb);
  near('net of both lines', t.net, 2500);
  near('10% discount', t.discount, 250);
  near('goods after discount', t.goods, 2250);
  near('VAT at 20%', t.vat, 450);
  near('gross', t.gross, 2700);
  near('25% deposit', t.deposit, 675);
  near('balance = gross - deposit', t.balance, 2025);
  near('deposit + balance = gross', t.deposit + t.balance, t.gross);
}

console.log('\nFrame geometry — sub-dimensions must total the overall');
{
  const p = D.PROFILE;
  [[1800, 3, 1], [2400, 4, 2], [900, 1, 1], [1500, 2, 3]].forEach(([w, nc, nr]) => {
    const it = M.newItem('window');
    it.width = w; it.height = 1200;
    M.resizeGrid(it, nc, nr);
    const L = D.layout(it);
    const sumLights = it.cols.reduce((a, b) => a + b, 0);
    const rebuilt = sumLights + p.outerFrame * 2 + p.mullion * (nc - 1);
    near(`${nc}×${nr} at ${w}mm: light widths + frame + mullions = overall`,
         rebuilt, it.width, 1.5);
    const drawnSum = L.cols.reduce((a, c) => a + c.w, 0) +
                     p.outerFrame * 2 + p.mullion * (nc - 1);
    near(`${nc}×${nr} at ${w}mm: drawn lights span the frame`,
         drawnSum, it.width, 1.5);
  });
}

console.log('\nBay geometry');
{
  // 600 / 1200 / 600 with 135° corners is a standard 45° splayed bay.
  // Projection = 600 × sin45 = 424.26
  // Opening    = 1200 + 2 × 600 × cos45 = 2048.53
  const g = D.bayGeometry([600, 1200, 600], [135, 135]);
  near('45° bay projects 600·sin45', g.projection, 424.26, 0.5);
  near('45° bay opening = 1200 + 2·600·cos45', g.opening, 2048.53, 0.5);
  near('running width is the sum of the facets', g.running, 2400);
  ok('plan polygon is a quadrilateral for a 3-facet bay',
     g.polygonVertices === 4, 'got ' + g.polygonVertices);
  near('its interior angles total 360°', g.polygonAngleSum, 360);

  // A square (90°) bay projects by the full return length.
  const sq = D.bayGeometry([600, 1200, 600], [90, 90]);
  near('90° bay projects the full return', sq.projection, 600, 0.5);
  near('90° bay opening equals the front facet', sq.opening, 1200, 0.5);

  // A flat run (180° corners) must not project at all.
  const flat = D.bayGeometry([600, 1200, 600], [180, 180]);
  near('180° corners give no projection', flat.projection, 0, 0.5);
  near('180° corners give a flat 2400 run', flat.opening, 2400, 0.5);
}

console.log('\nAreas and opener counts');
{
  const it = M.newItem('window');
  it.width = 2000; it.height = 1500;
  near('2000 × 1500 is 3.00 m²', M.areaM2(it), 3.0);

  M.resizeGrid(it, 3, 1);
  it.cells = { r0c0: { type: 'side-hung' }, r0c1: { type: 'fixed' },
               r0c2: { type: 'top-hung' } };
  ok('two openers counted, fixed light ignored', M.countOpeners(it) === 2,
     'got ' + M.countOpeners(it));

  const sl = M.newItem('slider'); sl.config = 'OXXO';
  ok('OXXO has two sliding panes', M.countOpeners(sl) === 2,
     'got ' + M.countOpeners(sl));

  const bay = M.newItem('bay');
  near('bay area uses the running width',
       M.areaM2(bay), (600 + 1200 + 600) * bay.height / 1e6);
}

console.log('\nRenderer produces valid output for every product');
{
  Object.keys(D.PRODUCTS).forEach(k => {
    const svg = D.render(M.newItem(k), { dims: true, key: true });
    ok(k + ' renders an svg', /^<svg[\s\S]+<\/svg>$/.test(svg));
    ok(k + ' has no NaN in its geometry', svg.indexOf('NaN') === -1);
    ok(k + ' has a finite viewBox',
       /viewBox="(-?[\d.]+ ){3}-?[\d.]+"/.test(svg));
  });
}

console.log('\nPrice book starts empty on purpose');
{
  ok('a fresh price book reports as empty',
     M.priceBookIsEmpty(M.defaultPriceBook()));
  const pb = M.defaultPriceBook(); pb.ratePerM2.window = 350;
  ok('once a rate is set it no longer reports empty', !M.priceBookIsEmpty(pb));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
