/*
 * report.js - turns a survey into the deliverable.
 *
 * Output is one Markdown document with three layers, in this order:
 *
 *   1. A survey report a human can read and check on site.
 *   2. A build plan (build-once families, VS2 step order) so the quote gets
 *      built the fast way rather than frame by frame.
 *   3. A fenced JSON payload carrying the exact structure, so Claude enters
 *      the quote from data rather than from prose.
 *
 * Layer 1 follows the block format required by the read-window-drawings skill.
 * Pure and DOM-free so it is testable under node.
 */

import {
  SCHEMA, PRODUCTS, product, OPENERS, panes, paneLabel, configCode, glassLine,
  openingCount, vs2PaneName, itemIssues, surveyIssues, buildFamilies,
  paneCount, isOpening
} from './model.js';

/* ------------------------------------------------------------------ *
 * Descriptions
 * ------------------------------------------------------------------ */

export function windowTypeLine(item) {
  const p = product(item.productKey);
  const cols = item.columns.length;
  const anyTransom = item.columns.some(c => c.rows.length > 1);
  const bits = [p.label];

  if (p.family === 'casement') {
    if (cols === 2 && item.columns.every(c => c.rows.length === 2)) bits.push('cruciform');
    else if (cols > 1 && anyTransom) bits.push(`${cols} lights with transom${cols > 1 ? 's' : ''}`);
    else if (cols > 1) bits.push(`${cols} lights`);
    else if (anyTransom) bits.push('with transom');
    else bits.push('single light');
    if (item.frenchMullion) bits.push('French mullion');
  } else if (p.family === 'bifold') {
    bits.push(`${item.bifold.leaves} leaf`);
  } else if (p.family === 'slider') {
    bits.push(`${item.slider.panes} pane`);
  } else if (p.family === 'sash') {
    bits.push(item.sash.style);
  } else if (p.family === 'bay') {
    bits.push(`${item.bay.type.toLowerCase()}, ${item.bay.facets} facets${item.bay.type === 'Angled' ? ` at ${item.bay.angle}°` : ''}`);
  }
  return bits.join(' - ');
}

/**
 * Light-by-light configuration. Deliberately a list rather than prose: an
 * ambiguous sentence about hinge hands is what causes a remake.
 */
export function configurationLines(item) {
  const p = product(item.productKey);
  const lines = [];

  if (p.family === 'casement' || p.family === 'door') {
    lines.push(`Code (left to right): ${configCode(item)}`);
    panes(item).forEach(({ pane, c, r }) => {
      const o = OPENERS[pane.opener];
      const flag = pane.assumed ? ' [assumed]' : '';
      const note = pane.notes ? ` - ${pane.notes}` : '';
      lines.push(`  - ${paneLabel(item, c, r)}: ${o.label}${flag}${note}`);
    });
    const opening = openingCount(item);
    lines.push(`Opening sashes: ${opening} (cross-check against shootbolt quantity on the supplier estimate)`);
  }

  if (p.family === 'composite' || p.family === 'door') {
    const d = item.door;
    if (d.style) lines.push(`Door style: ${d.style}`);
    if (d.hand) lines.push(`Handing: ${d.hand}`);
    if (d.opensInOut) lines.push(`Opens: ${d.opensInOut}`);
    if (d.threshold) lines.push(`Threshold: ${d.threshold}`);
    const iron = [d.letterplate && 'letterplate', d.knocker && 'knocker', d.cylinder].filter(Boolean);
    if (iron.length) lines.push(`Furniture: ${iron.join(', ')}`);
  }
  if (p.family === 'bifold') {
    lines.push(`Leaves: ${item.bifold.leaves}`);
    if (item.bifold.foldDirection) lines.push(`Fold / stack: ${item.bifold.foldDirection}`);
    if (item.bifold.trafficDoor) lines.push(`Traffic door: ${item.bifold.trafficDoor}`);
  }
  if (p.family === 'slider') {
    lines.push(`Panes: ${item.slider.panes}`);
    if (item.slider.slideDirection) lines.push(`Slides: ${item.slider.slideDirection}`);
    if (item.slider.dummyPanel) lines.push(`Fixed / dummy panel: ${item.slider.dummyPanel}`);
  }
  if (p.family === 'sash') {
    lines.push(`Style: ${item.sash.style}`);
    if (item.sash.horns) lines.push(`Sash horns: ${item.sash.horns}`);
    if (item.sash.sectionWidths) lines.push(`Section widths: ${item.sash.sectionWidths}`);
  }
  if (p.family === 'bay') {
    lines.push(`Coupled type: ${item.bay.type}${item.bay.type === 'Angled' ? ` at ${item.bay.angle}°` : ''}`);
    lines.push(`Facets: ${item.bay.facets}`);
    if (item.bay.facetWidths) lines.push(`Facet widths: ${item.bay.facetWidths}`);
    if (item.bay.poleRequired) lines.push('Load-bearing bay pole required (Parts Shop item).');
  }
  if (p.family === 'parts') {
    if (item.parts.unit) lines.push(`Unit: ${item.parts.unit}`);
    lines.push(`Quantity: ${item.parts.qty}`);
    if (item.parts.price) lines.push(`Selling price ex-VAT: £${item.parts.price}`);
  }
  return lines;
}

export function glassLines(item) {
  const lines = [];
  const seen = new Map();
  panes(item).forEach(({ pane, c, r }) => {
    const spec = glassLine(pane.glass) || 'Clear, standard double glazed';
    if (!seen.has(spec)) seen.set(spec, []);
    seen.get(spec).push(paneLabel(item, c, r));
  });
  if (seen.size === 1) {
    lines.push(`All lights: ${[...seen.keys()][0]}`);
  } else {
    seen.forEach((where, spec) => lines.push(`  - ${where.join(', ')}: ${spec}`));
  }
  return lines;
}

export function specialFeatures(item) {
  const out = [];
  if (item.frenchMullion) out.push('French mullion - both sashes open, no fixed central mullion when open.');
  if (item.finish.frame) out.push(`Frame finish: ${item.finish.frame}`);
  if (item.finish.sash && item.finish.sash !== item.finish.frame) out.push(`Sash finish: ${item.finish.sash}`);
  if (item.finish.cill) out.push(`Cill finish: ${item.finish.cill}`);
  if (item.cill) out.push(`Cill: ${item.cill}`);
  if (item.handle) out.push(`Handles: ${item.handle}`);
  if (item.hardwareNotes) out.push(`Hardware: ${item.hardwareNotes}`);
  const vents = panes(item).filter(p => p.pane.glass.trickleVent).length;
  if (vents) out.push(`Trickle vents: ${vents}`);
  if (item.sillHeightFromFloor) out.push(`Cill height from floor: ${item.sillHeightFromFloor}mm`);
  if (item.notes) out.push(item.notes);
  if (item.photos && item.photos.length) out.push(`${item.photos.length} site photo(s) attached.`);
  return out;
}

export function assumptionLines(item) {
  const out = [];
  const assumed = panes(item).filter(p => p.pane.assumed);
  if (assumed.length) {
    out.push(`Opening configuration assumed for: ${assumed.map(p => paneLabel(item, p.c, p.r)).join(', ')} - confirm before ordering.`);
  }
  if (!item.columns.some(c => c.width)) {
    if (item.columns.length > 1) out.push('Individual section widths not measured - assumed equal sections.');
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * VS2 build steps
 * ------------------------------------------------------------------ */

export function vs2Steps(item) {
  const p = product(item.productKey);
  const steps = [];
  steps.push(`New Item -> ${p.tab} tab -> click the image for "${p.tt}".`);
  steps.push(`Set Job Type "${item.jobType}" and Location "${item.location || '(NOT RECORDED)'}", then Save.`);

  if (p.family === 'casement') {
    const cols = item.columns.length;
    const transomCols = item.columns.map((c, i) => (c.rows.length > 1 ? i : -1)).filter(i => i >= 0);
    steps.push(`Draw the outer frame, then ${cols - 1} full mullion${cols - 1 === 1 ? '' : 's'}` +
      (transomCols.length
        ? `, then ${transomCols.length} transom${transomCols.length === 1 ? '' : 's'} in column${transomCols.length === 1 ? '' : 's'} ${transomCols.map(i => i + 1).join(', ')} only (draw partial transoms edge-to-mullion, after all mullions).`
        : '.'));
    steps.push(`Expected pane count after drawing: ${paneCount(item)}. Verify before confirming with the green tick - bars cannot be added afterwards.`);
    steps.push(`Set overall dimensions ${item.width || '?'} x ${item.height || '?'} mm (Basic Frame Size).`);
    const openers = panes(item).filter(x => x.pane.opener !== 'fixed');
    if (openers.length) {
      steps.push('Openers tab - click each pane twice to reach the "Opener at Pane X" dialog:');
      openers.forEach(({ pane, c, r }) => {
        const nm = vs2PaneName(item, c, r);
        const o = OPENERS[pane.opener];
        steps.push(`  - ${nm.name}${nm.confident ? '' : ' (name unverified, identify visually)'} = ${paneLabel(item, c, r)}: ${o.vs2}`);
      });
      steps.push(`Verify ${openingCount(item)} handle object(s) exist before moving on - a sash without a handle is a dummy.`);
    } else {
      steps.push('Openers tab - no openers, leave every pane fixed.');
    }
  } else if (p.family === 'sash') {
    steps.push(`"Select Sash Window Style" -> ${item.sash.style}.`);
    steps.push(`Set overall dimensions ${item.width || '?'} x ${item.height || '?'} mm.`);
    if (item.sash.sectionWidths) steps.push(`Change Internal Widths -> ${item.sash.sectionWidths} (set the outer sections, let the middle take the balance).`);
    if (item.sash.horns) steps.push(`Profile tab -> Sash Horns: ${item.sash.horns}.`);
  } else if (p.family === 'bifold') {
    steps.push(`"Select Bi-Fold Door Style" -> ${item.bifold.leaves} leaf, fold/stack ${item.bifold.foldDirection || '(NOT RECORDED)'}, traffic door ${item.bifold.trafficDoor || '(NOT RECORDED)'}.`);
    steps.push(`Set overall dimensions ${item.width || '?'} x ${item.height || '?'} mm.`);
  } else if (p.family === 'slider') {
    steps.push(`"Select Patio Door Style" -> ${item.slider.panes} pane, sliding ${item.slider.slideDirection || '(NOT RECORDED)'}${item.slider.dummyPanel ? `, fixed panel ${item.slider.dummyPanel}` : ''}.`);
    steps.push(`Set overall dimensions ${item.width || '?'} x ${item.height || '?'} mm.`);
  } else if (p.family === 'composite') {
    steps.push(`"Select Door Style" -> ${item.door.style || '(layout NOT RECORDED)'}, hand ${item.door.hand || '(NOT RECORDED)'}.`);
    steps.push(`Set overall dimensions ${item.width || '?'} x ${item.height || '?'} mm.`);
    steps.push('Slab itself is priced in the CompDoor portal - the TT item is the quote line.');
  } else if (p.family === 'door') {
    steps.push(`Draw the frame${item.columns.length > 1 ? ` with ${item.columns.length - 1} mullion(s)` : ''}, then set ${item.width || '?'} x ${item.height || '?'} mm.`);
    steps.push(`Handing ${item.door.hand || '(NOT RECORDED)'}, opens ${item.door.opensInOut || '(NOT RECORDED)'}.`);
  } else if (p.family === 'bay') {
    steps.push(`Setup dialog: Coupled Items Type = ${item.bay.type}, Number of Facets = ${item.bay.facets}.`);
    steps.push(`Elevation view: overall ${item.width || '?'} x ${item.height || '?'} mm; facet widths ${item.bay.facetWidths || '(NOT RECORDED)'}.`);
    steps.push('Populate each facet via its "+" button - the item shows Incomplete until every facet is built. Use Duplicate Facet where facets repeat.');
    if (item.bay.type === 'Angled') steps.push(`Plan view (hexagon icon) -> set each facet joint angle to ${item.bay.angle}°.`);
    if (item.bay.poleRequired) steps.push('Add a load-bearing bay pole from the Parts Shop as a separate line.');
  } else if (p.family === 'parts') {
    steps.push(`Parts Shop item - plain form, no VS2. Quantity ${item.parts.qty}${item.parts.unit ? ` ${item.parts.unit}` : ''}${item.parts.price ? `, selling price ex-VAT £${item.parts.price}` : ''}.`);
    return steps;
  }

  // Finish / glass / hardware apply to every configured product
  if (item.finish.frame) {
    steps.push(`Finish tab -> click the outer frame -> Manage Frame Finish -> ${item.finish.frame} -> Apply to Item.`);
  }
  const glassSpecs = new Set(panes(item).map(x => glassLine(x.pane.glass) || 'clear'));
  if (glassSpecs.size === 1) {
    const only = [...glassSpecs][0];
    steps.push(`Glass tab -> ${only === 'clear' ? 'standard clear' : only} -> Apply to All.`);
  } else {
    panes(item).forEach(({ pane, c, r }) => {
      const spec = glassLine(pane.glass);
      if (spec) steps.push(`Glass tab -> ${vs2PaneName(item, c, r).name} (${paneLabel(item, c, r)}): ${spec} -> Apply to Pane.`);
    });
  }
  panes(item).forEach(({ pane, c, r }) => {
    const g = pane.glass;
    if (g.bars && g.bars !== 'None') {
      steps.push(`Glazing tab -> ${vs2PaneName(item, c, r).name}: bar type ${g.bars}, then use the Auto Grid tool to set ${g.barRows || '?'} rows x ${g.barCols || '?'} columns (selecting a bar type alone draws nothing).`);
    }
  });
  if (item.handle) steps.push(`Hardware tab -> click a sash -> Manage Hardware -> handles: ${item.handle}.`);
  const vents = panes(item).filter(x => x.pane.glass.trickleVent);
  if (vents.length) steps.push(`Hardware tab -> Ventilation -> trickle vents on: ${vents.map(x => paneLabel(item, x.c, x.r)).join(', ')}.`);
  if (item.cill) steps.push(`Profile tab -> cill: ${item.cill}.`);
  return steps;
}

/* ------------------------------------------------------------------ *
 * JSON payload
 * ------------------------------------------------------------------ */

export function toPayload(survey) {
  return {
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    survey: {
      ref: survey.ref,
      surveyedAt: survey.surveyedAt,
      surveyor: survey.surveyor,
      customer: survey.customer,
      notes: survey.notes,
      defaults: survey.defaults
    },
    items: survey.items.map(item => {
      const p = product(item.productKey);
      return {
        ref: item.ref,
        location: item.location,
        quantity: item.quantity,
        product: { key: item.productKey, label: p.label, family: p.family, tommyTrinder: p.tt, tab: p.tab },
        jobType: item.jobType,
        sizeMm: { width: item.width, height: item.height, note: 'Basic Frame Size - excludes cill' },
        sillHeightFromFloorMm: item.sillHeightFromFloor,
        grid: {
          columns: item.columns.length,
          paneCount: paneCount(item),
          openingSashes: openingCount(item),
          layout: item.columns.map((col, c) => ({
            index: c,
            widthMm: col.width,
            rows: col.rows.map((row, r) => ({
              index: r,
              heightMm: row.height,
              label: paneLabel(item, c, r),
              vs2PaneName: vs2PaneName(item, c, r).name,
              vs2PaneNameConfident: vs2PaneName(item, c, r).confident,
              opener: row.pane.opener,
              openerLabel: OPENERS[row.pane.opener].label,
              opens: isOpening(row.pane.opener),
              vs2OpenerAction: OPENERS[row.pane.opener].vs2,
              assumed: row.pane.assumed,
              glass: row.pane.glass,
              notes: row.pane.notes
            }))
          }))
        },
        frenchMullion: item.frenchMullion,
        finish: item.finish,
        cill: item.cill,
        handle: item.handle,
        hardwareNotes: item.hardwareNotes,
        door: p.family === 'door' || p.family === 'composite' ? item.door : undefined,
        bifold: p.family === 'bifold' ? item.bifold : undefined,
        slider: p.family === 'slider' ? item.slider : undefined,
        sash: p.family === 'sash' ? item.sash : undefined,
        bay: p.family === 'bay' ? item.bay : undefined,
        parts: p.family === 'parts' ? item.parts : undefined,
        notes: item.notes,
        queries: item.queries,
        assumptions: assumptionLines(item),
        issues: itemIssues(item),
        vs2Steps: vs2Steps(item),
        photoCount: (item.photos || []).length
      };
    }),
    buildPlan: buildFamilies(survey).map(f => ({
      buildRef: f.build.ref,
      buildLocation: f.build.location,
      duplicateInto: f.duplicates.map(d => ({ ref: d.ref, location: d.location }))
    })),
    openIssues: surveyIssues(survey)
  };
}

/* ------------------------------------------------------------------ *
 * Markdown report
 * ------------------------------------------------------------------ */

function block(title, lines) {
  if (!lines || !lines.length) return `**${title}:** none\n`;
  if (lines.length === 1 && !lines[0].startsWith('  ')) return `**${title}:** ${lines[0]}\n`;
  return `**${title}:**\n${lines.map(l => (l.startsWith('  ') ? l : `  - ${l}`)).join('\n')}\n`;
}

export function toMarkdown(survey) {
  const L = [];
  const c = survey.customer;

  L.push(`# Window Survey - ${c.name || 'Customer not recorded'}`);
  L.push('');
  L.push(`> Generated by the Swift Windows survey app. Hand this whole file to Claude and say`);
  L.push(`> **"quote this up in Tommy Trinder"** - the tommy-trinder skill reads the build steps`);
  L.push(`> and the JSON payload at the end and enters the quote.`);
  L.push('');
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| Survey ref | ${survey.ref || '-'} |`);
  L.push(`| Customer | ${c.name || '-'} |`);
  L.push(`| Address | ${(c.address || '-').replace(/\n/g, ', ')} |`);
  L.push(`| Phone | ${c.phone || '-'} |`);
  L.push(`| Email | ${c.email || '-'} |`);
  L.push(`| Surveyed | ${survey.surveyedAt || '-'} |`);
  L.push(`| Surveyor | ${survey.surveyor || '-'} |`);
  L.push(`| Items | ${survey.items.length} |`);
  L.push('');

  if (survey.notes) {
    L.push('## Job notes');
    L.push('');
    L.push(survey.notes);
    L.push('');
  }

  const d = survey.defaults;
  const defaultBits = [
    d.finishFrame && `Frame finish: ${d.finishFrame}`,
    d.finishSash && `Sash finish: ${d.finishSash}`,
    d.glass && `Glass: ${d.glass}`,
    d.cill && `Cill: ${d.cill}`,
    d.handle && `Handles: ${d.handle}`
  ].filter(Boolean);
  if (defaultBits.length) {
    L.push('## Job-wide specification');
    L.push('');
    defaultBits.forEach(b => L.push(`- ${b}`));
    L.push('');
    L.push('Apply these to every item unless an item says otherwise.');
    L.push('');
  }

  /* ---- build plan ---- */
  const families = buildFamilies(survey);
  const repeats = families.filter(f => f.duplicates.length);
  L.push('## Build plan for Tommy Trinder');
  L.push('');
  if (repeats.length) {
    L.push('Build these frames once, then use the **duplicate icon** on the Items list and rename - the whole configuration carries over. Finish the source frame completely before duplicating; a copy does not inherit later edits.');
    L.push('');
    repeats.forEach(f => {
      L.push(`- Build **${f.build.ref} (${f.build.location})**, then duplicate into: ${f.duplicates.map(x => `**${x.ref}** (${x.location})`).join(', ')}`);
    });
    L.push('');
    const saved = repeats.reduce((n, f) => n + f.duplicates.length, 0);
    L.push(`That is ${families.length} frame${families.length === 1 ? '' : 's'} to build for ${survey.items.length} item${survey.items.length === 1 ? '' : 's'} - ${saved} saved by duplicating.`);
  } else {
    L.push('No repeated frames - every item needs building individually.');
  }
  L.push('');

  /* ---- items ---- */
  L.push('## Items');
  L.push('');
  survey.items.forEach((item, i) => {
    const p = product(item.productKey);
    L.push(`### ${item.ref || `Item ${i + 1}`} - ${item.location || 'location not recorded'}`);
    L.push('');
    L.push('```');
    L.push(`Ref:                 ${item.ref || '-'}`);
    L.push(`Room:                ${item.location || '-'}`);
    L.push(`Width:               ${item.width ? `${item.width} mm` : 'NOT MEASURED'}`);
    L.push(`Height:              ${item.height ? `${item.height} mm` : 'NOT MEASURED'}`);
    L.push(`Window Type:         ${windowTypeLine(item)}`);
    L.push('```');
    L.push('');
    if (item.quantity > 1) L.push(`**Quantity:** ${item.quantity}\n`);
    L.push(block('Configuration', configurationLines(item)));
    L.push(block('Glass Specification', glassLines(item)));
    L.push(block('Special Features', specialFeatures(item)));
    L.push(block('Assumptions Made', assumptionLines(item)));
    const q = [];
    if (item.queries) q.push(item.queries);
    itemIssues(item).forEach(x => q.push(x));
    L.push(block('Queries', q));
    L.push('');
    L.push(`<details><summary>Tommy Trinder build steps - ${item.ref || `item ${i + 1}`}</summary>`);
    L.push('');
    let stepNo = 0;
    vs2Steps(item).forEach(s => {
      // sub-lines (openers, per-pane glass) hang off the step above them and
      // must not consume a number, or the list reads 6, 11, 12...
      if (s.startsWith('  ')) { L.push(s); return; }
      stepNo += 1;
      L.push(`${stepNo}. ${s}`);
    });
    L.push('');
    L.push('</details>');
    L.push('');
  });

  /* ---- open issues ---- */
  const issues = surveyIssues(survey);
  const itemQ = survey.items.flatMap(it => itemIssues(it).map(x => `${it.ref || it.location}: ${x}`));
  if (issues.length || itemQ.length) {
    L.push('## Everything needing an answer before ordering');
    L.push('');
    [...issues, ...itemQ].forEach(x => L.push(`- ${x}`));
    L.push('');
  }

  /* ---- payload ---- */
  L.push('## Structured data');
  L.push('');
  L.push('Machine-readable copy of the whole survey. Prefer this over the prose above when entering the quote.');
  L.push('');
  L.push('```json');
  L.push(JSON.stringify(toPayload(survey), null, 2));
  L.push('```');
  L.push('');

  return L.join('\n');
}

/** Short plain-text summary, for a covering message. */
export function toSummary(survey) {
  const fams = buildFamilies(survey);
  const opening = survey.items.reduce((n, i) => n + openingCount(i), 0);
  return [
    `${survey.customer.name || 'Survey'} - ${survey.items.length} item(s), ${fams.length} unique frame(s) to build, ${opening} opening sash(es).`,
    survey.customer.address ? survey.customer.address.replace(/\n/g, ', ') : '',
    `Surveyed ${survey.surveyedAt}${survey.surveyor ? ` by ${survey.surveyor}` : ''}.`
  ].filter(Boolean).join('\n');
}
