/*
 * Generates docs/example-report.md - a worked example of what the app hands to
 * Claude. Run: node tools/example.mjs > docs/example-report.md
 */
import { newSurvey, newItem, addColumn, addFullTransom, splitLight, applyStandardAssumptions } from '../js/model.js';
import { toMarkdown } from '../js/report.js';

const s = newSurvey({
  ref: 'SV-2041', surveyor: 'Sean',
  customer: { name: 'Mrs Patel', address: '14 Oak Road\nBristol BS9 3QQ', phone: '07700 900123', email: 'patel@example.com' },
  defaults: { finishFrame: 'Smooth White', finishSash: '', glass: 'Standard double glazed', cill: '150mm', handle: 'Connoisseur Chrome' },
  notes: 'Scaffold needed to rear. Park on drive.'
});

// Lounge: 3 lights, fanlights over outer two
const lounge = newItem({ ref: 'W1', location: 'Lounge front', width: 1800, height: 1200, sillHeightFromFloor: 700 });
addColumn(lounge); addColumn(lounge);
splitLight(lounge, 0); splitLight(lounge, 2);
applyStandardAssumptions(lounge);
lounge.finish.frame = 'Smooth White'; lounge.cill = '150mm'; lounge.handle = 'Connoisseur Chrome';

// Two identical bedrooms
const bed = () => {
  const b = newItem({ ref: 'W2', location: 'Bed 1', width: 1200, height: 1050 });
  addColumn(b); applyStandardAssumptions(b);
  b.finish.frame = 'Smooth White'; b.cill = '150mm'; b.handle = 'Connoisseur Chrome';
  return b;
};
const b1 = bed();
const b2 = bed(); b2.ref = 'W3'; b2.location = 'Bed 2';

// Bathroom, obscure + toughened, georgian bars
const bath = newItem({ ref: 'W4', location: 'Bathroom', width: 600, height: 900 });
bath.columns[0].rows[0].pane.opener = 'topHung';
Object.assign(bath.columns[0].rows[0].pane.glass, { obscure: 'Satin', toughened: true, bars: 'Georgian', barRows: 3, barCols: 2, trickleVent: true });
bath.finish.frame = 'Smooth White';

// Front door
const door = newItem({ ref: 'D1', location: 'Front door', productKey: 'comp-door', width: 900, height: 2050 });
door.door = { style: 'Door + side panel right', hand: 'Left hand', opensInOut: 'Inward', threshold: 'Low threshold', letterplate: true, knocker: false, cylinder: '3 star' };
door.columns[0].rows[0].pane.glass.toughened = true;

// Bay
const bay = newItem({ ref: 'BAY1', location: 'Lounge bay', productKey: 'bay', width: 2400, height: 1300 });
bay.bay = { type: 'Angled', facets: 3, angle: 135, facetWidths: '600 / 1200 / 600', poleRequired: true };

s.items.push(lounge, b1, b2, bath, door, bay);
console.log(toMarkdown(s));
