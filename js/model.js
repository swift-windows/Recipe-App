/*
 * model.js - pure, DOM-free data model for a Swift Windows site survey.
 *
 * Everything in here is deliberately free of browser APIs so it can be unit
 * tested under node (tools/selftest.mjs) and reused by any exporter.
 *
 * The structure mirrors how Tommy Trinder's VS2 configurator actually builds a
 * frame, so a survey converts into build steps with no interpretation:
 *
 *   item.columns[]        -> the vertical mullions you draw on the VS2 canvas
 *   column.rows[]         -> the transoms within that column (partial transoms
 *                            are the normal case, so transoms are per column)
 *   pane.opener           -> the tile you pick in the "Opener at Pane X" dialog
 */

export const SCHEMA = 'swift-survey/v1';

/* ------------------------------------------------------------------ *
 * Catalogue - keys match the product tiles in Tommy Trinder
 * ------------------------------------------------------------------ */

export const PRODUCTS = [
  // family 'casement' uses the freehand grid builder (VS2 step 5a)
  { key: 'upvc-casement',        label: 'uPVC Casement',              family: 'casement',  tt: '*uPVC Casement',                       tab: 'PVCu' },
  { key: 'upvc-flush',           label: 'uPVC Flush Casement',        family: 'casement',  tt: '*uPVC Flush Casement',                 tab: 'PVCu' },
  { key: 'alu-casement',         label: 'Sheerline Classic Casement', family: 'casement',  tt: '*Sheerline Classic Beaded Casement',   tab: 'Aluminium' },
  { key: 'alu-flush',            label: 'Sheerline Classic Flush',    family: 'casement',  tt: '*Sheerline Classic Flush Beaded Casement', tab: 'Aluminium' },
  { key: 'tilt-turn',            label: 'Tilt & Turn Window',         family: 'casement',  tt: 'Tilt Turn Window',                     tab: 'PVCu' },
  { key: 'timber-casement',      label: 'Timber Stormproof Casement', family: 'casement',  tt: '3. Stormproof Casement',               tab: 'Timber' },

  // doors
  { key: 'comp-door',            label: 'Composite Door',             family: 'composite', tt: '*Comp Door Composite Door',            tab: 'PVCu' },
  { key: 'upvc-entrance',        label: 'uPVC Entrance Door',         family: 'door',      tt: '*uPVC Entrance Door',                  tab: 'PVCu' },
  { key: 'upvc-french',          label: 'uPVC French Door',           family: 'door',      tt: '*uPVC French Door',                    tab: 'PVCu' },
  { key: 'alu-french',           label: 'Aluminium French Door',      family: 'door',      tt: 'Sheerline Prestige French Door',       tab: 'Aluminium' },

  // pickers rather than freehand
  { key: 'bifold',               label: 'Bi-fold Door',               family: 'bifold',    tt: '*Alunet Bifold',                       tab: 'Aluminium' },
  { key: 'patio-slider',         label: 'Patio / Sliding Door',       family: 'slider',    tt: 'Smart Visoglide Slider',               tab: 'Aluminium' },
  { key: 'upvc-patio',           label: 'uPVC Patio Door',            family: 'slider',    tt: '*uPVC Patio Door',                     tab: 'PVCu' },
  { key: 'sash-roseview',        label: 'Sliding Sash (Roseview)',    family: 'sash',      tt: 'Heritage Rose',                        tab: 'Roseview' },
  { key: 'sash-bereco',          label: 'Sliding Sash (Bereco)',      family: 'sash',      tt: 'Bereco Traditional Sliding Sash',      tab: 'Bereco' },
  { key: 'sash-timberlook',      label: 'Timberlook Flush Sash',      family: 'sash',      tt: 'Timberlook Flush Sash Window',         tab: 'Timberlook' },

  // coupled / bay - a bay IS a coupled item set to Angled
  { key: 'bay',                  label: 'Bay / Bow (coupled)',        family: 'bay',       tt: 'PVC Coupled Item',                     tab: 'PVCu' },
  { key: 'coupled-flat',         label: 'Coupled Item (flat)',        family: 'bay',       tt: 'PVC Coupled Item',                     tab: 'PVCu' },

  // ancillaries - these skip VS2 entirely (Parts Shop)
  { key: 'parts',                label: 'Extra / Parts Shop item',    family: 'parts',     tt: 'Parts Shop',                           tab: 'Parts Shop' }
];

export function product(key) {
  return PRODUCTS.find(p => p.key === key) || PRODUCTS[0];
}

/* ------------------------------------------------------------------ *
 * Openers - the four tiles in VS2's "Opener at Pane X" dialog, plus
 * the states you get before you touch it.
 * ------------------------------------------------------------------ */

export const OPENERS = {
  fixed:      { label: 'Fixed',                      short: 'F',   symbol: 'none',   vs2: 'Leave pane untouched (no sash)' },
  sideLeft:   { label: 'Side-hung, hinge left',      short: 'SHL', symbol: 'left',   vs2: 'Opener dialog: TOP-RIGHT tile (side-hung hinge-left)' },
  sideRight:  { label: 'Side-hung, hinge right',     short: 'SHR', symbol: 'right',  vs2: 'Opener dialog: TOP-LEFT tile (side-hung hinge-right)' },
  topHung:    { label: 'Top-hung',                   short: 'TH',  symbol: 'up',     vs2: 'Opener dialog: BOTTOM-LEFT tile (top-hung)' },
  bottomHung: { label: 'Bottom-hung',                short: 'BH',  symbol: 'down',   vs2: 'Opener dialog: bottom-hung (check availability on profile)' },
  tiltTurn:   { label: 'Tilt & turn',                short: 'T&T', symbol: 'tilt',   vs2: 'Tilt & Turn product only' },
  dummy:      { label: 'Dummy sash (fixed, sashed)', short: 'D',   symbol: 'dummy',  vs2: 'Opener dialog: BOTTOM-RIGHT tile (Dummy)' }
};

export const OPENER_KEYS = Object.keys(OPENERS);

/** Openers that actually open - used for the shootbolt / hinge count cross-check. */
export function isOpening(key) {
  return key !== 'fixed' && key !== 'dummy';
}

/* ------------------------------------------------------------------ *
 * Glass
 * ------------------------------------------------------------------ */

export const OBSCURE_PATTERNS = ['None (clear)', 'Satin', 'Stippolyte', 'Cotswold', 'Everglade', 'Minster', 'Pelerine', 'Contora'];
export const BAR_TYPES = ['None', 'Georgian', 'Astragal', 'Leaded', 'Diamonds'];

export function newGlass() {
  return {
    obscure: 'None (clear)',
    toughened: false,
    leaded: false,
    bars: 'None',
    barRows: 0,
    barCols: 0,
    trickleVent: false,
    notes: ''
  };
}

/* ------------------------------------------------------------------ *
 * Constructors
 * ------------------------------------------------------------------ */

let seq = 0;
/** Deterministic-ish id. Not security relevant. */
export function uid(prefix = 'id') {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function newPane() {
  return { id: uid('pane'), opener: 'fixed', glass: newGlass(), assumed: false, notes: '' };
}

export function newColumn(rows = 1) {
  return {
    id: uid('col'),
    width: null,                       // mm, optional - only when sections are unequal
    rows: Array.from({ length: rows }, () => ({ id: uid('row'), height: null, pane: newPane() }))
  };
}

export function newItem(patch = {}) {
  const item = {
    id: uid('item'),
    ref: '',
    location: '',
    productKey: 'upvc-casement',
    jobType: 'Supply & Fit - Remove & replace',
    quantity: 1,
    width: null,                       // mm - Basic Frame Size, NOT overall incl. cill
    height: null,
    sillHeightFromFloor: null,         // mm - drives the critical-location check
    columns: [newColumn(1)],
    frenchMullion: false,
    finish: { frame: '', sash: '', cill: '' },
    cill: '',
    handle: '',
    hardwareNotes: '',
    // family specific
    door: { style: '', hand: '', opensInOut: '', threshold: '', letterplate: false, knocker: false, cylinder: '' },
    bifold: { leaves: 3, foldDirection: '', trafficDoor: '' },
    slider: { panes: 2, slideDirection: '', dummyPanel: '' },
    sash: { style: 'Double', horns: '', sectionWidths: '' },
    bay: { type: 'Angled', facets: 3, angle: 135, facetWidths: '', poleRequired: false },
    parts: { unit: '', qty: 1, price: null },
    photos: [],                        // ids into the photo store
    notes: '',
    queries: '',
    createdAt: new Date().toISOString()
  };
  return Object.assign(item, patch);
}

export function newSurvey(patch = {}) {
  return Object.assign({
    id: uid('survey'),
    schema: SCHEMA,
    ref: '',
    customer: { name: '', address: '', phone: '', email: '' },
    surveyor: '',
    surveyedAt: new Date().toISOString().slice(0, 10),
    defaults: { finishFrame: '', finishSash: '', glass: '', cill: '', handle: '' },
    notes: '',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, patch);
}

/* ------------------------------------------------------------------ *
 * Grid operations - "drawing" the frame
 * ------------------------------------------------------------------ */

/** Total number of panes (lights) in the frame. */
export function paneCount(item) {
  return item.columns.reduce((n, c) => n + c.rows.length, 0);
}

/** Add a mullion: a new column, inheriting the row split of its neighbour. */
export function addColumn(item, afterIndex = item.columns.length - 1) {
  const template = item.columns[afterIndex] || item.columns[0];
  const col = newColumn(template ? template.rows.length : 1);
  item.columns.splice(afterIndex + 1, 0, col);
  return col;
}

export function removeColumn(item, index) {
  if (item.columns.length <= 1) return false;
  item.columns.splice(index, 1);
  return true;
}

/** Add a transom to ONE column (partial transoms are the common case). */
export function addRow(item, colIndex) {
  const col = item.columns[colIndex];
  if (!col) return null;
  const row = { id: uid('row'), height: null, pane: newPane() };
  col.rows.push(row);
  return row;
}

/**
 * Split a light by adding a transom above it. The new section goes on TOP and
 * the existing light keeps its configuration below, because a surveyor adding
 * a transom is adding a fanlight over an existing light - not turning that
 * light into the fanlight.
 */
export function splitLight(item, colIndex) {
  const col = item.columns[colIndex];
  if (!col) return null;
  const row = { id: uid('row'), height: null, pane: newPane() };
  col.rows.unshift(row);
  return row;
}

export function removeRow(item, colIndex, rowIndex) {
  const col = item.columns[colIndex];
  if (!col || col.rows.length <= 1) return false;
  col.rows.splice(rowIndex, 1);
  return true;
}

/**
 * Apply a transom across every column at once (a full-width transom).
 * Uses the same fanlight-on-top rule as splitLight, so an opener already set
 * on a light stays with that light rather than becoming the fanlight.
 */
export function addFullTransom(item) {
  item.columns.forEach((col, i) => {
    if (col.rows.length === 1) splitLight(item, i);
  });
}

/** Walk every pane with its position. Rows are ordered top -> bottom. */
export function eachPane(item, fn) {
  item.columns.forEach((col, c) => {
    col.rows.forEach((row, r) => fn(row.pane, c, r, col, row));
  });
}

export function panes(item) {
  const out = [];
  eachPane(item, (pane, c, r, col, row) => out.push({ pane, c, r, col, row }));
  return out;
}

/* ------------------------------------------------------------------ *
 * VS2 pane naming
 *
 * From the tommy-trinder skill: panes are named fullMullionPane0/1/...,
 * or upperTransomPane0/1/2 and lowerTransomPane0/1/2, numbered left to
 * right. We reproduce that where the frame matches a shape VS2 names
 * predictably, and flag anything more exotic rather than guessing.
 * ------------------------------------------------------------------ */

export function vs2PaneName(item, c, r) {
  const col = item.columns[c];
  const anyTransom = item.columns.some(x => x.rows.length > 1);
  if (!anyTransom) {
    return item.columns.length === 1 ? { name: 'pane0', confident: true }
                                     : { name: `fullMullionPane${c}`, confident: true };
  }
  if (col.rows.length === 1) return { name: `fullMullionPane${c}`, confident: true };
  if (col.rows.length === 2) {
    return { name: r === 0 ? `upperTransomPane${c}` : `lowerTransomPane${c}`, confident: true };
  }
  // three or more sections in one column - VS2's naming here is not documented,
  // so say so instead of inventing one.
  return { name: `column${c}Section${r}`, confident: false };
}

/* ------------------------------------------------------------------ *
 * Surveyor assumptions (from the read-window-drawings skill)
 * ------------------------------------------------------------------ */

/**
 * Fill in opening configuration the way an experienced UK surveyor would when
 * the drawing does not say. Only touches panes still flagged `assumed` or
 * untouched-and-fixed, and records what it did so the report can declare it.
 */
export function applyStandardAssumptions(item) {
  const applied = [];
  const cols = item.columns;
  const anyTransom = cols.some(c => c.rows.length > 1);

  // Cruciform (2 x 2): fanlights fixed, lower sections opening.
  if (cols.length === 2 && cols.every(c => c.rows.length === 2)) {
    cols.forEach((col, c) => {
      set(col.rows[0].pane, 'fixed');
      set(col.rows[1].pane, c === 0 ? 'sideLeft' : 'sideRight');
    });
    applied.push('Cruciform window: fanlights assumed fixed, lower sections assumed opening (side-hung, hinges to the outside).');
    return applied;
  }

  // Three sections across: left opener, centre fixed, right opener.
  if (cols.length === 3 && !anyTransom) {
    set(cols[0].rows[0].pane, 'sideLeft');
    set(cols[1].rows[0].pane, 'fixed');
    set(cols[2].rows[0].pane, 'sideRight');
    applied.push('Three-section window: assumed left opener, centre fixed, right opener.');
    return applied;
  }

  // Two sections across: both opening, hinges to the outside.
  if (cols.length === 2 && !anyTransom) {
    set(cols[0].rows[0].pane, 'sideLeft');
    set(cols[1].rows[0].pane, 'sideRight');
    applied.push('Two-section window: assumed both sections opening, hinges to the outside.');
    return applied;
  }

  // Fanlights over some or all lights: fanlights top-hung, main lights below opening.
  if (anyTransom) {
    cols.forEach((col, c) => {
      if (col.rows.length === 2) {
        set(col.rows[0].pane, 'topHung');
        set(col.rows[1].pane, c === 0 ? 'sideLeft' : 'sideRight');
      }
    });
    applied.push('Fanlights assumed top-hung over side-hung main lights.');
  }
  return applied;

  function set(pane, opener) {
    if (pane.opener === 'fixed' || pane.assumed) {
      pane.opener = opener;
      pane.assumed = true;
      return true;
    }
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Derived description
 * ------------------------------------------------------------------ */

/** Human label for a light's position, surveyor style. */
export function paneLabel(item, c, r) {
  const col = item.columns[c];
  const across = item.columns.length;
  const acrossName = across === 1 ? '' :
    (c === 0 ? 'Left' : c === across - 1 ? 'Right' : (across === 3 ? 'Centre' : `Light ${c + 1}`));
  if (col.rows.length === 1) return acrossName || 'Single light';
  const downName = col.rows.length === 2 ? (r === 0 ? 'top' : 'bottom') : `section ${r + 1}`;
  return acrossName ? `${acrossName} ${downName}` : downName[0].toUpperCase() + downName.slice(1);
}

/** Compact configuration code, e.g. "SHL | F | SHR". */
export function configCode(item) {
  return item.columns.map(col =>
    col.rows.map(row => OPENERS[row.pane.opener].short).join('/')
  ).join(' | ');
}

/** Describe glass in one line; empty string when it is plain clear glass. */
export function glassLine(glass) {
  const bits = [];
  if (glass.obscure && glass.obscure !== 'None (clear)') bits.push(`${glass.obscure} obscure`);
  if (glass.toughened) bits.push('toughened');
  if (glass.leaded) bits.push('leaded');
  if (glass.bars && glass.bars !== 'None') {
    const grid = glass.barRows && glass.barCols ? ` ${glass.barRows}x${glass.barCols}` : '';
    bits.push(`${glass.bars.toLowerCase()} bars${grid}`);
  }
  if (glass.trickleVent) bits.push('trickle vent');
  if (glass.notes) bits.push(glass.notes);
  return bits.join(', ');
}

/** Count of genuinely opening sashes - cross-check against shootbolt qty. */
export function openingCount(item) {
  return panes(item).filter(p => isOpening(p.pane.opener)).length;
}

/* ------------------------------------------------------------------ *
 * Building Regulations helpers
 * ------------------------------------------------------------------ */

/**
 * Critical locations under Approved Document K: glazing in doors and side
 * panels, and glazing below 800mm from floor level (1500mm beside a door).
 * Returns the panes that should be toughened but are not marked as such.
 */
export function criticalLocationWarnings(item) {
  const fam = product(item.productKey).family;
  const out = [];
  const doorFamily = fam === 'door' || fam === 'composite';
  panes(item).forEach(({ pane, c, r }) => {
    if (pane.glass.toughened) return;
    if (doorFamily) {
      out.push({ c, r, why: 'glazing in a door or its side panel' });
      return;
    }
    const sill = item.sillHeightFromFloor;
    if (sill !== null && sill !== undefined && sill !== '' && Number(sill) < 800) {
      const isLowest = r === item.columns[c].rows.length - 1;
      if (isLowest) out.push({ c, r, why: `cill ${sill}mm from floor, below the 800mm critical-location threshold` });
    }
  });
  return out;
}

/**
 * Egress / means of escape: habitable rooms above ground level generally need
 * an openable escape window. We cannot know the room use, so this only fires
 * as a prompt when nothing in the frame opens.
 */
export function hasNoOpener(item) {
  const fam = product(item.productKey).family;
  if (fam !== 'casement') return false;
  return openingCount(item) === 0;
}

/* ------------------------------------------------------------------ *
 * Validation - what is missing before this can be quoted
 * ------------------------------------------------------------------ */

export function itemIssues(item) {
  const issues = [];
  const fam = product(item.productKey).family;
  if (!item.location) issues.push('No location/room recorded - VS2 requires a Location of at least 2 characters.');
  if (fam !== 'parts') {
    if (!item.width) issues.push('Width missing.');
    if (!item.height) issues.push('Height missing.');
  }
  if (fam === 'door' || fam === 'composite') {
    if (!item.door.hand) issues.push('Door handing not recorded.');
    if (!item.door.opensInOut) issues.push('Door opens in/out not recorded.');
  }
  if (fam === 'bifold' && !item.bifold.foldDirection) issues.push('Bi-fold fold/stack direction not recorded.');
  if (fam === 'slider' && !item.slider.slideDirection) issues.push('Sliding direction not recorded.');
  if (fam === 'bay') {
    if (!item.bay.facets) issues.push('Number of bay facets not recorded.');
    if (!item.bay.facetWidths) issues.push('Facet widths not recorded - a bay cannot be ordered without them.');
  }
  if (hasNoOpener(item)) issues.push('No opening sash in this frame - confirm this is intended (escape/ventilation).');
  criticalLocationWarnings(item).forEach(w => {
    issues.push(`${paneLabel(item, w.c, w.r)}: toughened glass not specified but this is a critical location (${w.why}).`);
  });
  return issues;
}

export function surveyIssues(survey) {
  const out = [];
  if (!survey.customer.name) out.push('Customer name missing.');
  if (!survey.items.length) out.push('No items surveyed.');
  const refs = new Map();
  survey.items.forEach(it => {
    if (!it.ref) return;
    refs.set(it.ref, (refs.get(it.ref) || 0) + 1);
  });
  [...refs.entries()].filter(([, n]) => n > 1).forEach(([ref]) => out.push(`Duplicate item reference "${ref}".`));
  return out;
}

/* ------------------------------------------------------------------ *
 * Build families - the "build once, then duplicate" speed win
 * ------------------------------------------------------------------ */

/**
 * Signature of everything VS2 carries over when you hit the duplicate icon.
 * Two items with the same signature = build one, duplicate, rename.
 */
export function buildSignature(item) {
  const shape = item.columns.map(col =>
    col.rows.map(row => `${row.pane.opener}:${glassLine(row.pane.glass) || 'clear'}`).join('/')
  ).join('|');
  return [
    item.productKey,
    item.width, item.height,
    shape,
    item.finish.frame, item.finish.sash, item.cill, item.handle,
    item.frenchMullion ? 'FM' : ''
  ].join('~');
}

/** Group items into build-once families, largest first. */
export function buildFamilies(survey) {
  const map = new Map();
  survey.items.forEach(item => {
    if (product(item.productKey).family === 'parts') return;
    const sig = buildSignature(item);
    if (!map.has(sig)) map.set(sig, []);
    map.get(sig).push(item);
  });
  return [...map.values()]
    .map(members => ({ build: members[0], duplicates: members.slice(1) }))
    .sort((a, b) => b.duplicates.length - a.duplicates.length);
}

/** Auto reference like W1, W2, D1 based on what is already used. */
export function suggestRef(survey, productKey) {
  const fam = product(productKey).family;
  const prefix = fam === 'door' || fam === 'composite' ? 'D'
    : fam === 'bifold' ? 'BF'
    : fam === 'slider' ? 'PD'
    : fam === 'bay' ? 'BAY'
    : fam === 'parts' ? 'X'
    : 'W';
  let n = 1;
  const used = new Set(survey.items.map(i => i.ref));
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}
