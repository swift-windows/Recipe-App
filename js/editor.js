/*
 * editor.js - the screen Sean actually uses in a customer's house.
 *
 * Design rules for on-site use:
 *  - the drawing is the data. Tapping a light sets what it is; nothing has to
 *    be interpreted afterwards.
 *  - big targets, numeric keypads, no scrolling to reach the common actions.
 *  - every change saves immediately. There is no save button to forget.
 */

import {
  PRODUCTS, OPENERS, OPENER_KEYS, OBSCURE_PATTERNS, BAR_TYPES, product,
  addColumn, removeColumn, removeRow, addFullTransom, splitLight,
  applyStandardAssumptions, paneCount, openingCount, itemIssues, paneLabel
} from './model.js';
import { renderElevation } from './elevation.js';
import { el, $, field, select, toggle, button, sheet, closeSheet, toast, confirmAction } from './ui.js';
import { putPhoto, getPhoto, deletePhoto, compressImage } from './store.js';

/** Small SVG of an opener symbol, for the picker buttons. */
function symbolSvg(key) {
  const s = OPENERS[key].symbol;
  const p = { left: '46,10 12,26 46,42', right: '12,10 46,26 12,42', up: '12,42 29,10 46,42', down: '12,10 29,42 46,10' };
  let inner = '';
  if (p[s]) inner = `<polyline points="${p[s]}" fill="none" stroke="currentColor" stroke-width="3"/>`;
  else if (s === 'tilt') inner = `<polyline points="46,10 12,26 46,42" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="12,10 29,42 46,10" fill="none" stroke="currentColor" stroke-width="3"/>`;
  else if (s === 'dummy') inner = `<rect x="12" y="10" width="34" height="32" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5 4"/>`;
  return `<svg viewBox="0 0 58 52" class="sym" aria-hidden="true"><rect x="4" y="4" width="50" height="44" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"/>${inner}</svg>`;
}

export function renderItemScreen(ctx, item) {
  const wrap = el('div', { class: 'screen' });
  const redraw = () => {
    const next = renderItemScreen(ctx, item);
    wrap.replaceWith(next);
  };
  const touch = () => { ctx.save(); };

  const fam = product(item.productKey).family;

  /* ---------- header ---------- */
  wrap.appendChild(el('header', { class: 'topbar' }, [
    button('‹ Back', () => ctx.go(`survey/${ctx.survey.id}`), { class: 'topbar__back' }),
    el('div', { class: 'topbar__title' }, [
      el('strong', { text: item.ref || 'Item' }),
      el('span', { class: 'topbar__sub', text: item.location || 'no location yet' })
    ]),
    button('Delete', () => {
      if (!confirmAction(`Delete ${item.ref || 'this item'}?`)) return;
      ctx.survey.items = ctx.survey.items.filter(i => i.id !== item.id);
      ctx.save();
      ctx.go(`survey/${ctx.survey.id}`);
    }, { class: 'topbar__danger' })
  ]));

  const main = el('div', { class: 'screen__body' });
  wrap.appendChild(main);

  /* ---------- identity ---------- */
  main.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row row--2' }, [
      field('Ref', item.ref, v => { item.ref = v; touch(); }, { placeholder: 'W1' }),
      field('Room / location', item.location, v => { item.location = v; touch(); updateTitle(); }, { placeholder: 'Lounge front' })
    ]),
    select('Product', item.productKey, PRODUCTS.map(p => [p.key, p.label]), v => {
      item.productKey = v; touch(); redraw();
    }, { hint: `Tommy Trinder: ${product(item.productKey).tt} (${product(item.productKey).tab} tab)` })
  ]));

  function updateTitle() {
    const sub = $('.topbar__sub', wrap);
    if (sub) sub.textContent = item.location || 'no location yet';
  }

  /* ---------- the drawing ---------- */
  const drawCard = el('section', { class: 'card card--draw' });
  main.appendChild(drawCard);

  const canvas = el('div', { class: 'canvas', html: renderElevation(item, { showDims: true }) });
  canvas.addEventListener('click', e => {
    const hit = e.target.closest('.ev-hit');
    if (!hit) return;
    openPaneSheet(Number(hit.dataset.c), Number(hit.dataset.r));
  });
  canvas.addEventListener('keydown', e => {
    const hit = e.target.closest('.ev-hit');
    if (!hit || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    openPaneSheet(Number(hit.dataset.c), Number(hit.dataset.r));
  });
  drawCard.appendChild(canvas);

  const counts = el('p', { class: 'counts' });
  const refreshCounts = () => {
    counts.textContent = `${paneCount(item)} light${paneCount(item) === 1 ? '' : 's'} · ${openingCount(item)} opening · ${item.columns.length} section${item.columns.length === 1 ? '' : 's'} across`;
  };
  refreshCounts();
  drawCard.appendChild(counts);

  if (fam === 'casement' || fam === 'door') {
    drawCard.appendChild(el('div', { class: 'tools' }, [
      button('＋ Mullion', () => { addColumn(item); touch(); redraw(); }, { variant: 'tool' }),
      button('＋ Transom', () => { addFullTransom(item); touch(); redraw(); }, { variant: 'tool' }),
      button('－ Mullion', () => {
        if (!removeColumn(item, item.columns.length - 1)) { toast('Only one section left'); return; }
        touch(); redraw();
      }, { variant: 'tool' }),
      button('Auto-configure', () => {
        const applied = applyStandardAssumptions(item);
        touch(); redraw();
        toast(applied.length ? applied[0] : 'No standard assumption fits this shape');
      }, { variant: 'tool' })
    ]));
    drawCard.appendChild(el('p', { class: 'hint', text: 'Tap a light to set how it opens and its glass. “＋ Transom” adds a fanlight across every section; to add one over a single light, tap that light and choose “Add fanlight above”.' }));
  }

  /* ---------- sizes ---------- */
  main.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Sizes (mm)' }),
    el('div', { class: 'row row--2' }, [
      field('Width', item.width, v => { item.width = num(v); touch(); refreshDrawing(); }, { type: 'number', inputmode: 'numeric', placeholder: '1800' }),
      field('Height', item.height, v => { item.height = num(v); touch(); refreshDrawing(); }, { type: 'number', inputmode: 'numeric', placeholder: '1200' })
    ]),
    el('p', { class: 'hint', text: 'Basic Frame Size — the frame only. A 150mm cill adds about 30mm to the overall height; do not include it here.' }),
    field('Cill height from floor', item.sillHeightFromFloor, v => { item.sillHeightFromFloor = num(v); touch(); }, {
      type: 'number', inputmode: 'numeric', placeholder: 'e.g. 900',
      hint: 'Below 800mm makes this a critical location — the report will ask for toughened glass.'
    }),
    item.columns.length > 1
      ? el('div', {}, [
        el('h4', { class: 'card__subtitle', text: 'Section widths (optional)' }),
        el('div', { class: 'row row--wrap' }, item.columns.map((col, i) =>
          field(`Section ${i + 1}`, col.width, v => { col.width = num(v); touch(); refreshDrawing(); }, { type: 'number', inputmode: 'numeric', placeholder: 'equal' })
        )),
        el('p', { class: 'hint', text: 'Leave blank for equal sections. Fill these in when the lights are deliberately unequal.' })
      ])
      : null
  ]));

  function refreshDrawing() {
    canvas.innerHTML = renderElevation(item, { showDims: true });
    refreshCounts();
  }

  /* ---------- family specific ---------- */
  const spec = el('section', { class: 'card' });
  spec.appendChild(el('h3', { class: 'card__title', text: 'Specification' }));

  if (fam === 'composite' || fam === 'door') {
    spec.appendChild(el('div', { class: 'row row--2' }, [
      select('Door style', item.door.style, ['', 'Single', 'Door + side panel left', 'Door + side panel right', 'Door + 2 side panels', 'Door + toplight', 'French pair'], v => { item.door.style = v; touch(); }),
      select('Handing', item.door.hand, ['', 'Left hand', 'Right hand'], v => { item.door.hand = v; touch(); refreshDrawing(); })
    ]));
    spec.appendChild(el('div', { class: 'row row--2' }, [
      select('Opens', item.door.opensInOut, ['', 'Inward', 'Outward'], v => { item.door.opensInOut = v; touch(); }),
      select('Threshold', item.door.threshold, ['', 'Standard', 'Low threshold', 'Part M compliant'], v => { item.door.threshold = v; touch(); })
    ]));
    spec.appendChild(el('div', { class: 'row row--wrap' }, [
      toggle('Letterplate', item.door.letterplate, v => { item.door.letterplate = v; touch(); }),
      toggle('Knocker', item.door.knocker, v => { item.door.knocker = v; touch(); })
    ]));
    spec.appendChild(field('Cylinder / security', item.door.cylinder, v => { item.door.cylinder = v; touch(); }, { placeholder: '3 star' }));
  }
  if (fam === 'bifold') {
    spec.appendChild(el('div', { class: 'row row--2' }, [
      select('Leaves', item.bifold.leaves, [2, 3, 4, 5, 6, 7], v => { item.bifold.leaves = Number(v); touch(); refreshDrawing(); }),
      select('Fold / stack', item.bifold.foldDirection, ['', 'All left', 'All right', 'Split 2 left / 1 right', 'Split 1 left / 2 right', 'Split even'], v => { item.bifold.foldDirection = v; touch(); })
    ]));
    spec.appendChild(select('Traffic door', item.bifold.trafficDoor, ['', 'None', 'Left leaf', 'Right leaf'], v => { item.bifold.trafficDoor = v; touch(); }));
  }
  if (fam === 'slider') {
    spec.appendChild(el('div', { class: 'row row--2' }, [
      select('Panes', item.slider.panes, [2, 3, 4], v => { item.slider.panes = Number(v); touch(); refreshDrawing(); }),
      select('Slides', item.slider.slideDirection, ['', 'Left', 'Right', 'Both (centre opening)'], v => { item.slider.slideDirection = v; touch(); refreshDrawing(); })
    ]));
    spec.appendChild(field('Fixed / dummy panel', item.slider.dummyPanel, v => { item.slider.dummyPanel = v; touch(); }, { placeholder: 'e.g. right hand panel fixed' }));
  }
  if (fam === 'sash') {
    spec.appendChild(el('div', { class: 'row row--2' }, [
      select('Style', item.sash.style, ['Single', 'Double', 'Triple'], v => { item.sash.style = v; touch(); refreshDrawing(); }),
      select('Sash horns', item.sash.horns, ['', 'None', 'Belsay', 'Belsay top only', 'Victorian'], v => { item.sash.horns = v; touch(); })
    ]));
    spec.appendChild(field('Section widths', item.sash.sectionWidths, v => { item.sash.sectionWidths = v; touch(); }, { placeholder: '750 / 1200 / 750', hint: 'Set the outer sections and let the middle take the balance.' }));
  }
  if (fam === 'bay') {
    spec.appendChild(el('div', { class: 'row row--2' }, [
      select('Type', item.bay.type, ['Angled', 'Flat'], v => { item.bay.type = v; touch(); redraw(); }),
      select('Facets', item.bay.facets, [1, 2, 3, 4, 5, 6, 7, 8], v => { item.bay.facets = Number(v); touch(); })
    ]));
    if (item.bay.type === 'Angled') {
      spec.appendChild(select('Bay angle', item.bay.angle, [135, 90, 150, 160], v => { item.bay.angle = Number(v); touch(); }, { hint: 'VS2 defaults to 135°.' }));
    }
    spec.appendChild(field('Facet widths', item.bay.facetWidths, v => { item.bay.facetWidths = v; touch(); }, { placeholder: '600 / 1200 / 600', hint: 'Front and returns, in order. A bay cannot be ordered without these.' }));
    spec.appendChild(toggle('Load-bearing bay pole required', item.bay.poleRequired, v => { item.bay.poleRequired = v; touch(); }));
  }
  if (fam === 'parts') {
    spec.appendChild(el('div', { class: 'row row--2' }, [
      field('Unit', item.parts.unit, v => { item.parts.unit = v; touch(); }, { placeholder: 'm² / each' }),
      field('Quantity', item.parts.qty, v => { item.parts.qty = num(v) ?? 1; touch(); }, { type: 'number', inputmode: 'decimal' })
    ]));
    spec.appendChild(field('Selling price ex-VAT', item.parts.price, v => { item.parts.price = num(v); touch(); }, { type: 'number', inputmode: 'decimal' }));
  }

  if (fam === 'casement') {
    spec.appendChild(toggle('French mullion (both sashes open, no fixed centre)', item.frenchMullion, v => { item.frenchMullion = v; touch(); refreshDrawing(); }));
  }

  spec.appendChild(el('div', { class: 'row row--2' }, [
    field('Frame finish', item.finish.frame, v => { item.finish.frame = v; touch(); }, { placeholder: ctx.survey.defaults.finishFrame || 'Smooth White' }),
    field('Sash finish', item.finish.sash, v => { item.finish.sash = v; touch(); }, { placeholder: 'same as frame' })
  ]));
  spec.appendChild(el('div', { class: 'row row--2' }, [
    field('Cill', item.cill, v => { item.cill = v; touch(); }, { placeholder: ctx.survey.defaults.cill || '150mm' }),
    field('Handles', item.handle, v => { item.handle = v; touch(); }, { placeholder: ctx.survey.defaults.handle || 'Connoisseur Chrome' })
  ]));
  spec.appendChild(el('div', { class: 'row row--2' }, [
    field('Quantity', item.quantity, v => { item.quantity = Number(v) || 1; touch(); }, { type: 'number', inputmode: 'numeric' }),
    select('Job type', item.jobType, [
      'Supply & Fit - Remove & replace', 'Supply & Fit - New opening', 'Supply Only'
    ], v => { item.jobType = v; touch(); })
  ]));
  spec.appendChild(field('Hardware notes', item.hardwareNotes, v => { item.hardwareNotes = v; touch(); }, { placeholder: 'restrictors, keyed alike…' }));
  main.appendChild(spec);

  /* ---------- photos ---------- */
  const photoCard = el('section', { class: 'card' }, [el('h3', { class: 'card__title', text: 'Photos' })]);
  const strip = el('div', { class: 'photos' });
  photoCard.appendChild(strip);
  const fileInput = el('input', {
    type: 'file', accept: 'image/*', capture: 'environment', class: 'visually-hidden',
    onchange: async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        const id = `photo-${item.id}-${Date.now()}`;
        const ok = await putPhoto(id, dataUrl);
        if (!ok) { toast('Could not save that photo'); return; }
        item.photos.push(id);
        touch();
        drawPhotos();
      } catch (err) {
        console.error(err);
        toast('Could not read that photo');
      }
      e.target.value = '';
    }
  });
  photoCard.appendChild(fileInput);
  photoCard.appendChild(button('📷 Add photo', () => fileInput.click(), { variant: 'tool' }));
  main.appendChild(photoCard);

  async function drawPhotos() {
    strip.innerHTML = '';
    for (const id of item.photos) {
      const src = await getPhoto(id);
      if (!src) continue;
      const img = el('img', { class: 'photos__img', src, alt: 'site photo' });
      const del = button('✕', async () => {
        if (!confirmAction('Remove this photo?')) return;
        await deletePhoto(id);
        item.photos = item.photos.filter(p => p !== id);
        touch();
        drawPhotos();
      }, { class: 'photos__del', ariaLabel: 'Remove photo' });
      strip.appendChild(el('div', { class: 'photos__cell' }, [img, del]));
    }
  }
  drawPhotos();

  /* ---------- notes and queries ---------- */
  main.appendChild(el('section', { class: 'card' }, [
    field('Notes', item.notes, v => { item.notes = v; touch(); }, { multiline: true, rows: 3, placeholder: 'access, scaffold, lintel, anything the fitter needs' }),
    field('Queries for the customer', item.queries, v => { item.queries = v; touch(); }, { multiline: true, rows: 2, placeholder: 'anything left undecided' })
  ]));

  /* ---------- issues ---------- */
  const issues = itemIssues(item);
  if (issues.length) {
    main.appendChild(el('section', { class: 'card card--warn' }, [
      el('h3', { class: 'card__title', text: 'Still needed' }),
      el('ul', { class: 'list' }, issues.map(i => el('li', { text: i })))
    ]));
  }

  main.appendChild(el('div', { class: 'spacer' }));

  /* ---------- pane sheet ---------- */
  function openPaneSheet(c, r) {
    const col = item.columns[c];
    if (!col) return;
    const row = col.rows[r];
    if (!row) return;
    const pane = row.pane;
    const body = el('div');

    const rerenderSheet = () => {
      const s = openPaneSheet(c, r);
      return s;
    };

    body.appendChild(el('h4', { class: 'sheet__sub', text: 'How does it open?' }));
    const grid = el('div', { class: 'openers' });
    OPENER_KEYS.forEach(key => {
      const active = pane.opener === key;
      grid.appendChild(el('button', {
        type: 'button',
        class: `opener ${active ? 'is-on' : ''}`,
        onclick: () => {
          pane.opener = key;
          pane.assumed = false;       // a deliberate choice is no longer an assumption
          touch();
          refreshDrawing();
          closeSheet();
          openPaneSheet(c, r);
        }
      }, [
        el('span', { class: 'opener__sym', html: symbolSvg(key) }),
        el('span', { class: 'opener__label', text: OPENERS[key].label })
      ]));
    });
    body.appendChild(grid);

    body.appendChild(el('h4', { class: 'sheet__sub', text: 'Glass' }));
    body.appendChild(select('Obscure', pane.glass.obscure, OBSCURE_PATTERNS, v => {
      pane.glass.obscure = v; touch(); refreshDrawing();
    }));
    body.appendChild(el('div', { class: 'row row--wrap' }, [
      toggle('Toughened', pane.glass.toughened, v => { pane.glass.toughened = v; touch(); refreshDrawing(); }),
      toggle('Leaded', pane.glass.leaded, v => { pane.glass.leaded = v; touch(); refreshDrawing(); }),
      toggle('Trickle vent', pane.glass.trickleVent, v => { pane.glass.trickleVent = v; touch(); refreshDrawing(); })
    ]));
    body.appendChild(select('Glazing bars', pane.glass.bars, BAR_TYPES, v => {
      pane.glass.bars = v; touch(); refreshDrawing();
    }));
    body.appendChild(el('div', { class: 'row row--2' }, [
      field('Bar rows', pane.glass.barRows, v => { pane.glass.barRows = Number(v) || 0; touch(); refreshDrawing(); }, { type: 'number', inputmode: 'numeric' }),
      field('Bar columns', pane.glass.barCols, v => { pane.glass.barCols = Number(v) || 0; touch(); refreshDrawing(); }, { type: 'number', inputmode: 'numeric' })
    ]));
    body.appendChild(field('Note for this light', pane.notes, v => { pane.notes = v; touch(); }, { placeholder: 'e.g. escape window' }));

    body.appendChild(el('h4', { class: 'sheet__sub', text: 'This light' }));
    body.appendChild(el('div', { class: 'row row--wrap' }, [
      button('Add fanlight above (transom)', () => {
        splitLight(item, c); touch(); refreshDrawing(); closeSheet();
      }, { variant: 'tool' }),
      col.rows.length > 1 ? button('Remove this section', () => {
        removeRow(item, c, r); touch(); refreshDrawing(); closeSheet();
      }, { variant: 'tool' }) : null,
      item.columns.length > 1 ? button('Remove this section across', () => {
        removeColumn(item, c); touch(); refreshDrawing(); closeSheet();
      }, { variant: 'tool' }) : null
    ]));
    if (col.rows.length > 1) {
      body.appendChild(field('Section height (mm)', row.height, v => { row.height = num(v); touch(); refreshDrawing(); }, {
        type: 'number', inputmode: 'numeric', placeholder: 'equal', hint: 'e.g. the fanlight height'
      }));
    }

    return sheet(`${paneLabel(item, c, r)} — light ${r + 1} of section ${c + 1}`, body);
  }

  return wrap;
}

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
