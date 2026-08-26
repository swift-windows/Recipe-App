/*
 * ui.js - the small amount of DOM plumbing this app needs.
 * No framework: the whole app is a few screens and a lot of buttons.
 */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined || c === false) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** A labelled field. `onInput` gets the raw string value. */
export function field(label, value, onInput, opts = {}) {
  const id = `f-${Math.random().toString(36).slice(2, 8)}`;
  const input = el(opts.multiline ? 'textarea' : 'input', {
    id,
    class: 'input',
    value: value == null ? '' : value,
    type: opts.type || 'text',
    inputmode: opts.inputmode || null,
    placeholder: opts.placeholder || '',
    rows: opts.rows || null,
    oninput: e => onInput(e.target.value)
  });
  if (opts.multiline) input.value = value == null ? '' : value;
  return el('label', { class: `field ${opts.className || ''}` }, [
    el('span', { class: 'field__label', text: label }),
    input,
    opts.hint ? el('span', { class: 'field__hint', text: opts.hint }) : null
  ]);
}

export function select(label, value, options, onChange, opts = {}) {
  const sel = el('select', { class: 'input', onchange: e => onChange(e.target.value) });
  options.forEach(o => {
    const [val, text] = Array.isArray(o) ? o : [o, o];
    sel.appendChild(el('option', { value: val, selected: String(val) === String(value) }, String(text)));
  });
  return el('label', { class: `field ${opts.className || ''}` }, [
    el('span', { class: 'field__label', text: label }),
    sel,
    opts.hint ? el('span', { class: 'field__hint', text: opts.hint }) : null
  ]);
}

export function toggle(label, checked, onChange) {
  return el('label', { class: 'toggle' }, [
    el('input', { type: 'checkbox', checked: !!checked, onchange: e => onChange(e.target.checked) }),
    el('span', { text: label })
  ]);
}

export function button(text, onClick, opts = {}) {
  return el('button', {
    class: `btn ${opts.variant ? `btn--${opts.variant}` : ''} ${opts.class || ''}`,
    type: 'button',
    onclick: onClick,
    'aria-label': opts.ariaLabel || null
  }, text);
}

/* ---------------- bottom sheet ---------------- */

let openSheet = null;

export function sheet(title, contentNode, opts = {}) {
  closeSheet();
  const body = el('div', { class: 'sheet__body' }, [contentNode]);
  const panel = el('div', { class: 'sheet__panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    el('div', { class: 'sheet__head' }, [
      el('h2', { class: 'sheet__title', text: title }),
      button('Done', () => closeSheet(), { variant: 'primary', class: 'sheet__done' })
    ]),
    body
  ]);
  const back = el('div', { class: 'sheet', onclick: e => { if (e.target === back) closeSheet(); } }, [panel]);
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('is-open'));
  openSheet = { back, onClose: opts.onClose };
  return { close: closeSheet, body };
}

export function closeSheet() {
  if (!openSheet) return;
  const { back, onClose } = openSheet;
  openSheet = null;
  back.classList.remove('is-open');
  setTimeout(() => back.remove(), 180);
  if (onClose) onClose();
}

/* ---------------- toast ---------------- */

let toastTimer = null;
export function toast(message, ms = 2600) {
  let node = document.getElementById('toast');
  if (!node) {
    node = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-on'), ms);
}

export function confirmAction(message) {
  return window.confirm(message);
}
