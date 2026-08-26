/*
 * elevation.js - draws a frame as a surveyor's elevation, in SVG.
 *
 * Conventions follow the Swift Windows survey sheet: an opening sash is a
 * triangle whose APEX SITS ON THE HINGE EDGE. That is the same convention as
 * Whiteline's drawings, so what Sean draws here matches what comes back on the
 * supplier estimate.
 *
 * Every pane carries data-c / data-r so the editor can hit-test taps.
 */

import { OPENERS, product } from './model.js';

const PAD = 34;          // room for dimension text
const FRAME = 9;         // outer frame thickness, in svg units
const BAR = 7;           // mullion / transom thickness
const SASH = 7;          // sash frame inset for an opening light

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Split a span into weighted parts; falls back to equal parts. */
function split(total, weights) {
  const known = weights.filter(w => w > 0);
  if (!known.length || known.length !== weights.length) {
    const each = total / weights.length;
    return weights.map(() => each);
  }
  const sum = known.reduce((a, b) => a + b, 0);
  return weights.map(w => (w / sum) * total);
}

/**
 * Render an item to an SVG string.
 * opts: { selected: {c,r} | null, showDims: bool, width: px }
 */
export function renderElevation(item, opts = {}) {
  const fam = product(item.productKey).family;
  const showDims = opts.showDims !== false;

  // Aspect: use real mm when we have them, otherwise a sensible default so the
  // sketch still looks like a window rather than a square.
  const wMm = Number(item.width) || 1200;
  const hMm = Number(item.height) || (fam === 'composite' || fam === 'door' ? 2050 : 1050);
  const maxSide = 320;
  const scale = maxSide / Math.max(wMm, hMm);
  const W = Math.max(140, Math.round(wMm * scale));
  const H = Math.max(140, Math.round(hMm * scale));

  const vbW = W + PAD * 2;
  const vbH = H + PAD * 2;
  const x0 = PAD, y0 = PAD;

  const parts = [];
  parts.push(defs());

  // outer frame
  parts.push(`<rect class="ev-frame" x="${x0}" y="${y0}" width="${W}" height="${H}" rx="2"/>`);

  const inX = x0 + FRAME, inY = y0 + FRAME;
  const inW = W - FRAME * 2, inH = H - FRAME * 2;

  const colWidths = split(inW, item.columns.map(c => Number(c.width) || 0));

  let cx = inX;
  item.columns.forEach((col, c) => {
    const cw = colWidths[c];
    const rowHeights = split(inH, col.rows.map(r => Number(r.height) || 0));
    let cy = inY;
    col.rows.forEach((row, r) => {
      const rh = rowHeights[r];
      parts.push(pane(item, row.pane, c, r, cx, cy, cw, rh, opts));
      cy += rh;
      if (r < col.rows.length - 1) {
        // transom
        parts.push(`<rect class="ev-bar" x="${cx}" y="${cy - BAR / 2}" width="${cw}" height="${BAR}"/>`);
      }
    });
    cx += cw;
    if (c < item.columns.length - 1) {
      // mullion
      const cls = item.frenchMullion ? 'ev-bar ev-bar--french' : 'ev-bar';
      parts.push(`<rect class="${cls}" x="${cx - BAR / 2}" y="${inY}" width="${BAR}" height="${inH}"/>`);
    }
  });

  // family specific overlays
  if (fam === 'bifold') parts.push(bifoldOverlay(item, inX, inY, inW, inH));
  if (fam === 'slider') parts.push(sliderOverlay(item, inX, inY, inW, inH));
  if (fam === 'sash') parts.push(sashOverlay(item, inX, inY, inW, inH));
  if (fam === 'composite') parts.push(doorOverlay(item, inX, inY, inW, inH));

  if (showDims) {
    parts.push(dims(item, x0, y0, W, H, colWidths));
  }

  return `<svg class="ev" viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(item.ref || 'window')} elevation">${parts.join('')}</svg>`;
}

function defs() {
  return `<defs>
    <pattern id="obs" width="6" height="6" patternUnits="userSpaceOnUse">
      <path d="M0 6 L6 0" class="ev-hatch"/>
    </pattern>
    <pattern id="lead" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 7 L7 0 M7 14 L14 7" class="ev-lead"/>
    </pattern>
  </defs>`;
}

function pane(item, p, c, r, x, y, w, h, opts) {
  const out = [];
  const sel = opts.selected && opts.selected.c === c && opts.selected.r === r;
  const g = p.glass;

  // glass
  let fill = 'ev-glass';
  if (g.obscure && g.obscure !== 'None (clear)') fill += ' ev-glass--obscure';
  out.push(`<rect class="${fill}" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  if (g.obscure && g.obscure !== 'None (clear)') {
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#obs)"/>`);
  }
  if (g.leaded) {
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#lead)"/>`);
  }

  // sash frame for anything that is not a bare fixed light
  const opener = p.opener;
  if (opener !== 'fixed') {
    out.push(`<rect class="ev-sash${opener === 'dummy' ? ' ev-sash--dummy' : ''}" x="${x + SASH / 2}" y="${y + SASH / 2}" width="${Math.max(0, w - SASH)}" height="${Math.max(0, h - SASH)}"/>`);
  }

  // opener symbol - apex on the hinge edge
  const sym = OPENERS[opener].symbol;
  const m = SASH + 4;
  const L = x + m, R = x + w - m, T = y + m, B = y + h - m;
  const line = pts => `<polyline class="ev-open" points="${pts}"/>`;
  if (sym === 'left')  out.push(line(`${R},${T} ${L},${(T + B) / 2} ${R},${B}`));
  if (sym === 'right') out.push(line(`${L},${T} ${R},${(T + B) / 2} ${L},${B}`));
  if (sym === 'up')    out.push(line(`${L},${B} ${(L + R) / 2},${T} ${R},${B}`));
  if (sym === 'down')  out.push(line(`${L},${T} ${(L + R) / 2},${B} ${R},${T}`));
  if (sym === 'tilt') {
    out.push(line(`${R},${T} ${L},${(T + B) / 2} ${R},${B}`));
    out.push(line(`${L},${T} ${(L + R) / 2},${B} ${R},${T}`));
  }

  // glazing bars
  if (g.bars && g.bars !== 'None' && (g.barRows > 1 || g.barCols > 1)) {
    const rows = Math.max(1, g.barRows || 1), cols = Math.max(1, g.barCols || 1);
    for (let i = 1; i < cols; i += 1) {
      const bx = x + (w / cols) * i;
      out.push(`<line class="ev-glazbar" x1="${bx}" y1="${y}" x2="${bx}" y2="${y + h}"/>`);
    }
    for (let i = 1; i < rows; i += 1) {
      const by = y + (h / rows) * i;
      out.push(`<line class="ev-glazbar" x1="${x}" y1="${by}" x2="${x + w}" y2="${by}"/>`);
    }
  }

  // markers
  const marks = [];
  if (g.toughened) marks.push('T');
  if (g.obscure && g.obscure !== 'None (clear)') marks.push('Obs');
  if (marks.length) {
    out.push(`<text class="ev-mark" x="${x + 5}" y="${y + h - 5}">${esc(marks.join(' '))}</text>`);
  }
  if (g.trickleVent) {
    out.push(`<rect class="ev-vent" x="${x + w / 2 - 12}" y="${y + 2}" width="24" height="5" rx="2"/>`);
  }

  // hit target - last so it sits on top
  out.push(`<rect class="ev-hit${sel ? ' is-selected' : ''}" data-c="${c}" data-r="${r}" x="${x}" y="${y}" width="${w}" height="${h}" tabindex="0" role="button" aria-label="${esc(OPENERS[opener].label)}"/>`);
  return out.join('');
}

function bifoldOverlay(item, x, y, w, h) {
  const n = Math.max(2, Number(item.bifold.leaves) || 2);
  const out = [];
  for (let i = 1; i < n; i += 1) {
    const lx = x + (w / n) * i;
    out.push(`<line class="ev-leaf" x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}"/>`);
  }
  for (let i = 0; i < n; i += 1) {
    const cx = x + (w / n) * (i + 0.5);
    const up = i % 2 === 0;
    out.push(`<polyline class="ev-open" points="${cx - 10},${up ? y + h - 14 : y + 14} ${cx},${up ? y + 14 : y + h - 14} ${cx + 10},${up ? y + h - 14 : y + 14}"/>`);
  }
  return out.join('');
}

function sliderOverlay(item, x, y, w, h) {
  const n = Math.max(2, Number(item.slider.panes) || 2);
  const out = [];
  for (let i = 1; i < n; i += 1) {
    const lx = x + (w / n) * i;
    out.push(`<line class="ev-leaf" x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}"/>`);
  }
  const dir = String(item.slider.slideDirection || '').toLowerCase();
  const midY = y + h / 2;
  const arrow = dir.includes('left')
    ? `<polyline class="ev-open" points="${x + w * 0.45},${midY - 9} ${x + w * 0.28},${midY} ${x + w * 0.45},${midY + 9}"/><line class="ev-open" x1="${x + w * 0.28}" y1="${midY}" x2="${x + w * 0.55}" y2="${midY}"/>`
    : `<polyline class="ev-open" points="${x + w * 0.55},${midY - 9} ${x + w * 0.72},${midY} ${x + w * 0.55},${midY + 9}"/><line class="ev-open" x1="${x + w * 0.45}" y1="${midY}" x2="${x + w * 0.72}" y2="${midY}"/>`;
  out.push(arrow);
  return out.join('');
}

function sashOverlay(item, x, y, w, h) {
  const style = String(item.sash.style || 'Double').toLowerCase();
  const n = style.startsWith('tri') ? 3 : style.startsWith('sing') ? 1 : 2;
  const out = [];
  for (let i = 1; i < n; i += 1) {
    const ly = y + (h / n) * i;
    out.push(`<rect class="ev-bar" x="${x}" y="${ly - BAR / 2}" width="${w}" height="${BAR}"/>`);
  }
  // vertical slide arrows
  const cx = x + w / 2;
  out.push(`<line class="ev-open" x1="${cx}" y1="${y + h * 0.32}" x2="${cx}" y2="${y + h * 0.62}"/>`);
  out.push(`<polyline class="ev-open" points="${cx - 8},${y + h * 0.40} ${cx},${y + h * 0.30} ${cx + 8},${y + h * 0.40}"/>`);
  out.push(`<polyline class="ev-open" points="${cx - 8},${y + h * 0.54} ${cx},${y + h * 0.64} ${cx + 8},${y + h * 0.54}"/>`);
  return out.join('');
}

function doorOverlay(item, x, y, w, h) {
  const hand = String(item.door.hand || '').toLowerCase();
  const hingeLeft = hand.includes('left');
  const T = y + 14, B = y + h - 14, L = x + 14, R = x + w - 14;
  const tri = hingeLeft
    ? `${R},${T} ${L},${(T + B) / 2} ${R},${B}`
    : `${L},${T} ${R},${(T + B) / 2} ${L},${B}`;
  const knobX = hingeLeft ? x + w - 22 : x + 22;
  return `${hand ? `<polyline class="ev-open" points="${tri}"/>` : ''}<circle class="ev-knob" cx="${knobX}" cy="${y + h * 0.55}" r="4"/>`;
}

function dims(item, x0, y0, W, H, colWidths) {
  const out = [];
  const wTxt = item.width ? `${item.width}` : '?';
  const hTxt = item.height ? `${item.height}` : '?';

  // width arrow under the frame
  const yy = y0 + H + 16;
  out.push(`<line class="ev-dim" x1="${x0}" y1="${yy}" x2="${x0 + W}" y2="${yy}"/>`);
  out.push(`<line class="ev-dim" x1="${x0}" y1="${yy - 5}" x2="${x0}" y2="${yy + 5}"/>`);
  out.push(`<line class="ev-dim" x1="${x0 + W}" y1="${yy - 5}" x2="${x0 + W}" y2="${yy + 5}"/>`);
  out.push(`<text class="ev-dimtxt" x="${x0 + W / 2}" y="${yy + 15}" text-anchor="middle">${esc(wTxt)}</text>`);

  // height arrow to the left
  const xx = x0 - 16;
  out.push(`<line class="ev-dim" x1="${xx}" y1="${y0}" x2="${xx}" y2="${y0 + H}"/>`);
  out.push(`<line class="ev-dim" x1="${xx - 5}" y1="${y0}" x2="${xx + 5}" y2="${y0}"/>`);
  out.push(`<line class="ev-dim" x1="${xx - 5}" y1="${y0 + H}" x2="${xx + 5}" y2="${y0 + H}"/>`);
  out.push(`<text class="ev-dimtxt" x="${xx - 6}" y="${y0 + H / 2}" text-anchor="middle" transform="rotate(-90 ${xx - 6} ${y0 + H / 2})">${esc(hTxt)}</text>`);

  // per-section widths, only when measured
  if (item.columns.length > 1 && item.columns.some(c => c.width)) {
    let cx = x0 + FRAME;
    item.columns.forEach((col, i) => {
      const cw = colWidths[i];
      if (col.width) {
        out.push(`<text class="ev-subdim" x="${cx + cw / 2}" y="${y0 - 8}" text-anchor="middle">${esc(col.width)}</text>`);
      }
      cx += cw;
    });
  }
  return out.join('');
}
