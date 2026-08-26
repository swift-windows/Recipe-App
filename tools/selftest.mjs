/*
 * Self test for the pure model/report layer. Run: npm test
 * No framework - just assertions, so it runs anywhere node does.
 */
import assert from 'node:assert/strict';
import {
  newSurvey, newItem, addColumn, addRow, addFullTransom, splitLight, applyStandardAssumptions,
  paneCount, openingCount, configCode, vs2PaneName, buildFamilies, suggestRef,
  itemIssues, criticalLocationWarnings, panes
} from '../js/model.js';
import { toMarkdown, toPayload, vs2Steps, windowTypeLine } from '../js/report.js';

let pass = 0;
function test(name, fn) {
  try { fn(); pass += 1; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

console.log('\nmodel\n-----');

test('a new item is a single-pane frame', () => {
  const it = newItem();
  assert.equal(paneCount(it), 1);
  assert.equal(it.columns.length, 1);
});

test('adding mullions makes columns', () => {
  const it = newItem();
  addColumn(it); addColumn(it);
  assert.equal(it.columns.length, 3);
  assert.equal(paneCount(it), 3);
});

test('partial transom splits one column only', () => {
  const it = newItem();
  addColumn(it); addColumn(it);          // 3 lights
  addRow(it, 0); addRow(it, 2);          // fanlights over the outer two
  assert.equal(paneCount(it), 5, 'should be 5 panes - matches the VS2 target count');
  assert.equal(it.columns[1].rows.length, 1);
});

test('splitting a light puts the new fanlight on top and keeps the light below', () => {
  const it = newItem();
  it.columns[0].rows[0].pane.opener = 'sideLeft';
  splitLight(it, 0);
  assert.equal(it.columns[0].rows.length, 2);
  assert.equal(it.columns[0].rows[0].pane.opener, 'fixed', 'new fanlight on top');
  assert.equal(it.columns[0].rows[1].pane.opener, 'sideLeft', 'original light keeps its opener, below');
});

test('a full transom does not steal an existing opener into the fanlight', () => {
  const it = newItem();
  addColumn(it);
  it.columns[0].rows[0].pane.opener = 'sideLeft';
  it.columns[1].rows[0].pane.opener = 'sideRight';
  addFullTransom(it);
  assert.equal(it.columns[0].rows[1].pane.opener, 'sideLeft');
  assert.equal(it.columns[1].rows[1].pane.opener, 'sideRight');
  assert.equal(it.columns[0].rows[0].pane.opener, 'fixed');
});

test('full transom splits every column', () => {
  const it = newItem();
  addColumn(it);
  addFullTransom(it);
  assert.equal(paneCount(it), 4);
});

test('VS2 pane naming - mullions only', () => {
  const it = newItem();
  addColumn(it);
  assert.equal(vs2PaneName(it, 0, 0).name, 'fullMullionPane0');
  assert.equal(vs2PaneName(it, 1, 0).name, 'fullMullionPane1');
});

test('VS2 pane naming - transoms, including the partial case', () => {
  const it = newItem();
  addColumn(it); addColumn(it);
  addRow(it, 0); addRow(it, 2);
  assert.equal(vs2PaneName(it, 0, 0).name, 'upperTransomPane0');
  assert.equal(vs2PaneName(it, 0, 1).name, 'lowerTransomPane0');
  assert.equal(vs2PaneName(it, 1, 0).name, 'fullMullionPane1', 'undivided column keeps mullion naming');
  assert.equal(vs2PaneName(it, 2, 0).name, 'upperTransomPane2');
});

test('VS2 pane naming admits when it does not know', () => {
  const it = newItem();
  addRow(it, 0); addRow(it, 0);          // three sections in one column
  assert.equal(vs2PaneName(it, 0, 1).confident, false);
});

test('three-section assumption: opener / fixed / opener', () => {
  const it = newItem();
  addColumn(it); addColumn(it);
  const applied = applyStandardAssumptions(it);
  assert.equal(configCode(it), 'SHL | F | SHR');
  assert.equal(openingCount(it), 2);
  assert.match(applied[0], /left opener, centre fixed, right opener/);
  assert.ok(panes(it).every(p => p.pane.assumed), 'assumed panes are flagged for the report');
});

test('cruciform assumption: fanlights fixed, lower opening', () => {
  const it = newItem();
  addColumn(it); addFullTransom(it);
  applyStandardAssumptions(it);
  assert.equal(configCode(it), 'F/SHL | F/SHR');
});

test('assumptions never overwrite a hand-set opener', () => {
  const it = newItem();
  addColumn(it); addColumn(it);
  it.columns[1].rows[0].pane.opener = 'topHung';   // surveyor set this deliberately
  it.columns[1].rows[0].pane.assumed = false;
  applyStandardAssumptions(it);
  assert.equal(it.columns[1].rows[0].pane.opener, 'topHung');
});

test('critical location: low cill wants toughened', () => {
  const it = newItem({ sillHeightFromFloor: 400, width: 1200, height: 1400, location: 'Lounge' });
  const w = criticalLocationWarnings(it);
  assert.equal(w.length, 1);
  assert.match(itemIssues(it).join(' '), /toughened/);
  it.columns[0].rows[0].pane.glass.toughened = true;
  assert.equal(criticalLocationWarnings(it).length, 0);
});

test('a door always counts as a critical location', () => {
  const it = newItem({ productKey: 'comp-door' });
  assert.equal(criticalLocationWarnings(it).length, 1);
});

test('missing sizes are reported, not silently accepted', () => {
  const issues = itemIssues(newItem());
  assert.match(issues.join(' '), /Width missing/);
  assert.match(issues.join(' '), /Height missing/);
  assert.match(issues.join(' '), /No location/);
});

test('refs auto-increment per family', () => {
  const s = newSurvey();
  s.items.push(newItem({ ref: suggestRef(s, 'upvc-casement') }));
  s.items.push(newItem({ ref: suggestRef(s, 'upvc-casement') }));
  s.items.push(newItem({ ref: suggestRef(s, 'comp-door') }));
  assert.deepEqual(s.items.map(i => i.ref), ['W1', 'W2', 'D1']);
});

console.log('\nbuild plan\n----------');

test('identical frames group into one build + duplicates', () => {
  const s = newSurvey();
  const mk = (ref, loc) => {
    const it = newItem({ ref, location: loc, width: 1200, height: 1050 });
    addColumn(it);
    applyStandardAssumptions(it);
    return it;
  };
  s.items.push(mk('W1', 'Bed 1'), mk('W2', 'Bed 2'), mk('W3', 'Bed 3'));
  const fams = buildFamilies(s);
  assert.equal(fams.length, 1);
  assert.equal(fams[0].duplicates.length, 2);
});

test('a different size is a different family', () => {
  const s = newSurvey();
  s.items.push(newItem({ ref: 'W1', width: 1200, height: 1050 }));
  s.items.push(newItem({ ref: 'W2', width: 900, height: 1050 }));
  assert.equal(buildFamilies(s).length, 2);
});

test('a different glass spec is a different family', () => {
  const s = newSurvey();
  const a = newItem({ ref: 'W1', width: 1200, height: 1050 });
  const b = newItem({ ref: 'W2', width: 1200, height: 1050 });
  b.columns[0].rows[0].pane.glass.obscure = 'Satin';
  s.items.push(a, b);
  assert.equal(buildFamilies(s).length, 2);
});

console.log('\nreport\n------');

function sampleSurvey() {
  const s = newSurvey({
    ref: 'SV-1001',
    surveyor: 'Sean',
    customer: { name: 'Mrs Patel', address: '14 Oak Road, Bristol', phone: '07700 900123', email: '' },
    defaults: { finishFrame: 'Smooth White', glass: 'Standard double glazed', cill: '150mm', handle: 'Connoisseur Chrome' }
  });

  const lounge = newItem({ ref: 'W1', location: 'Lounge', width: 1800, height: 1200, sillHeightFromFloor: 900 });
  addColumn(lounge); addColumn(lounge);
  addRow(lounge, 0); addRow(lounge, 2);
  applyStandardAssumptions(lounge);
  lounge.finish.frame = 'Smooth White';
  lounge.handle = 'Connoisseur Chrome';

  const bath = newItem({ ref: 'W2', location: 'Bathroom', width: 600, height: 900 });
  bath.columns[0].rows[0].pane.opener = 'topHung';
  bath.columns[0].rows[0].pane.glass.obscure = 'Satin';
  bath.columns[0].rows[0].pane.glass.toughened = true;

  const door = newItem({ ref: 'D1', location: 'Front door', productKey: 'comp-door', width: 900, height: 2050 });
  door.door = { style: 'Single', hand: 'Left hand open in', opensInOut: 'Inward', threshold: 'Low threshold', letterplate: true, knocker: false, cylinder: '3 star' };
  door.columns[0].rows[0].pane.glass.toughened = true;

  s.items.push(lounge, bath, door);
  return s;
}

test('markdown contains the required survey block fields', () => {
  const md = toMarkdown(sampleSurvey());
  ['Ref:', 'Room:', 'Width:', 'Height:', 'Window Type:', 'Configuration', 'Glass Specification',
   'Special Features', 'Assumptions Made', 'Queries'].forEach(k => {
    assert.ok(md.includes(k), `missing "${k}"`);
  });
});

test('markdown carries a parseable JSON payload', () => {
  const md = toMarkdown(sampleSurvey());
  const m = md.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(m, 'no json fence found');
  const parsed = JSON.parse(m[1]);
  assert.equal(parsed.schema, 'swift-survey/v1');
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items[0].grid.paneCount, 5);
  assert.equal(parsed.items[0].grid.layout[0].rows[0].vs2PaneName, 'upperTransomPane0');
});

test('payload states real sizes and never invents missing ones', () => {
  const p = toPayload(sampleSurvey());
  assert.equal(p.items[0].sizeMm.width, 1800);
  const s2 = newSurvey(); s2.items.push(newItem({ ref: 'W9' }));
  assert.equal(toPayload(s2).items[0].sizeMm.width, null);
});

test('build steps name the product tab and the exact opener tile', () => {
  const s = sampleSurvey();
  const steps = vs2Steps(s.items[0]).join('\n');
  assert.match(steps, /PVCu tab/);
  assert.match(steps, /\*uPVC Casement/);
  assert.match(steps, /Expected pane count after drawing: 5/);
  assert.match(steps, /partial transoms edge-to-mullion/);
  assert.match(steps, /TOP-RIGHT tile \(side-hung hinge-left\)/);
});

test('single glass spec collapses to Apply to All', () => {
  const it = newItem({ ref: 'W1', width: 1200, height: 1000 });
  addColumn(it);
  assert.match(vs2Steps(it).join('\n'), /Apply to All/);
});

test('mixed glass specs are applied per pane', () => {
  const it = newItem({ ref: 'W1', width: 1200, height: 1000 });
  addColumn(it);
  it.columns[1].rows[0].pane.glass.obscure = 'Satin';
  const steps = vs2Steps(it).join('\n');
  assert.match(steps, /Apply to Pane/);
  assert.ok(!/Apply to All/.test(steps));
});

test('glazing bars carry the Auto Grid warning', () => {
  const it = newItem({ ref: 'W1', width: 1200, height: 1000 });
  it.columns[0].rows[0].pane.glass.bars = 'Georgian';
  it.columns[0].rows[0].pane.glass.barRows = 3;
  it.columns[0].rows[0].pane.glass.barCols = 2;
  assert.match(vs2Steps(it).join('\n'), /Auto Grid tool to set 3 rows x 2 columns/);
});

test('bay build steps cover facets, angles and the Incomplete trap', () => {
  const it = newItem({ ref: 'BAY1', location: 'Lounge bay', productKey: 'bay', width: 2400, height: 1300 });
  it.bay = { type: 'Angled', facets: 3, angle: 135, facetWidths: '600 / 1200 / 600', poleRequired: true };
  const steps = vs2Steps(it).join('\n');
  assert.match(steps, /Coupled Items Type = Angled/);
  assert.match(steps, /Number of Facets = 3/);
  assert.match(steps, /Incomplete until every facet is built/);
  assert.match(steps, /135°/);
  assert.match(steps, /bay pole/);
});

test('window type describes a cruciform as a cruciform', () => {
  const it = newItem();
  addColumn(it); addFullTransom(it);
  assert.match(windowTypeLine(it), /cruciform/);
});

test('build step numbering does not skip over sub-lines', () => {
  const md = toMarkdown(sampleSurvey());
  const nums = [...md.matchAll(/^(\d+)\. /gm)].map(m => Number(m[1]));
  // every numbered list in the doc must run 1,2,3... with no gaps
  let expected = 1;
  nums.forEach(n => {
    if (n === 1) { expected = 2; return; }
    assert.equal(n, expected, `step numbering jumped to ${n}, expected ${expected}`);
    expected += 1;
  });
});

test('the toughened-glass warning is raised once, as a query', () => {
  const it = newItem({ ref: 'W1', location: 'Lounge', width: 1200, height: 1000, sillHeightFromFloor: 500 });
  const s = newSurvey({ customer: { name: 'X', address: '', phone: '', email: '' } });
  s.items.push(it);
  const md = toMarkdown(s);
  // It belongs in Queries (and so in the survey-wide list and the JSON payload),
  // but not in Assumptions Made - a missing spec is a question, not an assumption.
  const assumptions = md.split('**Assumptions Made:**')[1].split('**Queries:**')[0];
  assert.ok(!/critical location/.test(assumptions), 'warning should not appear under Assumptions Made');
  const queries = md.split('**Queries:**')[1].split('<details>')[0];
  assert.match(queries, /critical location/);
});

test('report highlights unanswered questions', () => {
  const s = newSurvey({ customer: { name: 'Test', address: '', phone: '', email: '' } });
  s.items.push(newItem({ ref: 'W1' }));       // no sizes, no location
  const md = toMarkdown(s);
  assert.match(md, /Everything needing an answer before ordering/);
  assert.match(md, /Width missing/);
});

console.log(`\n${pass} passed\n`);
