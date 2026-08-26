/*
 * app.js - screens and routing.
 *
 * Routes are hash based so the app works from a file:// copy, a static host or
 * the Swift Hub, with no server involved.
 */

import {
  newSurvey, newItem, suggestRef, product, surveyIssues, itemIssues,
  buildFamilies, openingCount, paneCount, PRODUCTS
} from './model.js';
import { toMarkdown, toPayload, toSummary, windowTypeLine } from './report.js';
import { renderElevation } from './elevation.js';
import { renderItemScreen } from './editor.js';
import * as store from './store.js';
import * as out from './share.js';
import { el, $, field, select, button, toast, confirmAction, sheet, closeSheet } from './ui.js';

const root = document.getElementById('app');
let ctx = null;

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

function go(route) {
  window.location.hash = `#/${route}`;
}

function currentRoute() {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h || 'home';
}

function render() {
  // Sheets are appended to <body>, so they outlive a screen swap. Close any
  // open sheet on navigation or the product picker sits over the new screen.
  closeSheet();
  const route = currentRoute();
  const [head, a] = route.split('/');
  root.innerHTML = '';
  let screen;

  if (head === 'survey' && a) {
    const survey = store.load(a);
    if (!survey) { go('home'); return; }
    ctx = makeCtx(survey);
    screen = surveyScreen(ctx);
  } else if (head === 'item' && a) {
    const [surveyId, itemId] = a.split('~');
    const survey = store.load(surveyId);
    const item = survey && survey.items.find(i => i.id === itemId);
    if (!item) { go('home'); return; }
    ctx = makeCtx(survey);
    screen = renderItemScreen(ctx, item);
  } else if (head === 'report' && a) {
    const survey = store.load(a);
    if (!survey) { go('home'); return; }
    ctx = makeCtx(survey);
    screen = reportScreen(ctx);
  } else if (head === 'settings') {
    screen = settingsScreen();
  } else {
    screen = homeScreen();
  }
  root.appendChild(screen);
  window.scrollTo(0, 0);
}

function makeCtx(survey) {
  return {
    survey,
    save: () => { store.save(survey); },
    go
  };
}

window.addEventListener('hashchange', render);

/* ------------------------------------------------------------------ *
 * Home - list of surveys
 * ------------------------------------------------------------------ */

function homeScreen() {
  const wrap = el('div', { class: 'screen' });
  wrap.appendChild(el('header', { class: 'topbar topbar--home' }, [
    el('div', { class: 'topbar__title' }, [
      el('strong', { text: 'Swift Survey' }),
      el('span', { class: 'topbar__sub', text: 'draw it, size it, send it to Claude' })
    ]),
    button('Settings', () => go('settings'), { class: 'topbar__back' })
  ]));

  const body = el('div', { class: 'screen__body' });
  wrap.appendChild(body);

  body.appendChild(button('＋ New survey', () => {
    const s = store.settings();
    const survey = newSurvey({
      surveyor: s.surveyor,
      defaults: { finishFrame: s.defaultFinish, finishSash: '', glass: '', cill: s.defaultCill, handle: s.defaultHandle }
    });
    store.save(survey);
    go(`survey/${survey.id}`);
  }, { variant: 'primary', class: 'btn--block' }));

  const list = store.loadAll().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (!list.length) {
    body.appendChild(el('p', { class: 'empty', text: 'No surveys yet. Start one before you knock on the door.' }));
  }
  list.forEach(s => {
    const issues = surveyIssues(s).length + s.items.reduce((n, i) => n + itemIssues(i).length, 0);
    body.appendChild(el('button', {
      type: 'button', class: 'rowcard', onclick: () => go(`survey/${s.id}`)
    }, [
      el('div', { class: 'rowcard__main' }, [
        el('strong', { text: s.customer.name || 'Untitled survey' }),
        el('span', { class: 'rowcard__sub', text: `${(s.customer.address || '').split('\n')[0] || 'no address'} · ${s.items.length} item${s.items.length === 1 ? '' : 's'}` })
      ]),
      issues ? el('span', { class: 'pill pill--warn', text: `${issues} to check` }) : el('span', { class: 'pill', text: 'ready' })
    ]));
  });

  body.appendChild(el('div', { class: 'spacer' }));
  return wrap;
}

/* ------------------------------------------------------------------ *
 * Survey - customer details + item list
 * ------------------------------------------------------------------ */

function surveyScreen(c) {
  const { survey } = c;
  const wrap = el('div', { class: 'screen' });
  const touch = () => c.save();

  wrap.appendChild(el('header', { class: 'topbar' }, [
    button('‹ Surveys', () => go('home'), { class: 'topbar__back' }),
    el('div', { class: 'topbar__title' }, [
      el('strong', { text: survey.customer.name || 'New survey' }),
      el('span', { class: 'topbar__sub', text: `${survey.items.length} item${survey.items.length === 1 ? '' : 's'}` })
    ]),
    button('Report', () => go(`report/${survey.id}`), { variant: 'primary', class: 'topbar__cta' })
  ]));

  const body = el('div', { class: 'screen__body' });
  wrap.appendChild(body);

  /* customer */
  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Customer' }),
    field('Name', survey.customer.name, v => { survey.customer.name = v; touch(); }, { placeholder: 'Mrs Patel' }),
    field('Address', survey.customer.address, v => { survey.customer.address = v; touch(); }, { multiline: true, rows: 2 }),
    el('div', { class: 'row row--2' }, [
      field('Phone', survey.customer.phone, v => { survey.customer.phone = v; touch(); }, { type: 'tel', inputmode: 'tel' }),
      field('Email', survey.customer.email, v => { survey.customer.email = v; touch(); }, { type: 'email', inputmode: 'email' })
    ]),
    el('div', { class: 'row row--2' }, [
      field('Survey ref', survey.ref, v => { survey.ref = v; touch(); }, { placeholder: 'optional' }),
      field('Date', survey.surveyedAt, v => { survey.surveyedAt = v; touch(); }, { type: 'date' })
    ]),
    field('Surveyor', survey.surveyor, v => { survey.surveyor = v; touch(); })
  ]));

  /* job-wide spec */
  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Job-wide specification' }),
    el('p', { class: 'hint', text: 'Set once here and it applies to every item unless an item overrides it.' }),
    el('div', { class: 'row row--2' }, [
      field('Frame finish', survey.defaults.finishFrame, v => { survey.defaults.finishFrame = v; touch(); }, { placeholder: 'Smooth White' }),
      field('Cill', survey.defaults.cill, v => { survey.defaults.cill = v; touch(); }, { placeholder: '150mm' })
    ]),
    el('div', { class: 'row row--2' }, [
      field('Glass', survey.defaults.glass, v => { survey.defaults.glass = v; touch(); }, { placeholder: 'Standard double glazed' }),
      field('Handles', survey.defaults.handle, v => { survey.defaults.handle = v; touch(); }, { placeholder: 'Connoisseur Chrome' })
    ]),
    field('Job notes', survey.notes, v => { survey.notes = v; touch(); }, { multiline: true, rows: 3, placeholder: 'access, parking, scaffold, timescales' })
  ]));

  /* items */
  body.appendChild(el('h3', { class: 'section-title', text: 'Items' }));

  survey.items.forEach(item => {
    const issues = itemIssues(item).length;
    const card = el('div', { class: 'itemcard' }, [
      el('button', {
        type: 'button', class: 'itemcard__hit', onclick: () => go(`item/${survey.id}~${item.id}`)
      }, [
        el('div', { class: 'itemcard__thumb', html: renderElevation(item, { showDims: false }) }),
        el('div', { class: 'itemcard__meta' }, [
          el('strong', { text: `${item.ref || '—'} · ${item.location || 'no location'}` }),
          el('span', { class: 'rowcard__sub', text: windowTypeLine(item) }),
          el('span', { class: 'rowcard__sub', text: `${item.width || '?'} × ${item.height || '?'} mm · ${paneCount(item)} light${paneCount(item) === 1 ? '' : 's'} · ${openingCount(item)} opening` }),
          issues ? el('span', { class: 'pill pill--warn', text: `${issues} to check` }) : el('span', { class: 'pill', text: 'complete' })
        ])
      ]),
      el('div', { class: 'itemcard__actions' }, [
        button('Duplicate', () => {
          const copy = JSON.parse(JSON.stringify(item));
          copy.id = `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          copy.ref = suggestRef(survey, copy.productKey);
          copy.location = `${item.location} (copy)`;
          copy.photos = [];
          survey.items.push(copy);
          touch();
          render();
        }, { variant: 'tool' })
      ])
    ]);
    body.appendChild(card);
  });

  body.appendChild(button('＋ Add window or door', () => openAddSheet(c), { variant: 'primary', class: 'btn--block' }));

  const issues = surveyIssues(survey);
  if (issues.length) {
    body.appendChild(el('section', { class: 'card card--warn' }, [
      el('h3', { class: 'card__title', text: 'Still needed' }),
      el('ul', { class: 'list' }, issues.map(i => el('li', { text: i })))
    ]));
  }

  body.appendChild(el('div', { class: 'row row--wrap' }, [
    button('Delete survey', () => {
      if (!confirmAction(`Delete the survey for ${survey.customer.name || 'this customer'}? This cannot be undone.`)) return;
      store.remove(survey.id);
      go('home');
    }, { variant: 'danger' })
  ]));

  body.appendChild(el('div', { class: 'spacer' }));
  return wrap;
}

function openAddSheet(c) {
  const { survey } = c;
  const body = el('div');
  body.appendChild(el('p', { class: 'hint', text: 'Pick what you are standing in front of.' }));
  const grid = el('div', { class: 'picker' });
  PRODUCTS.forEach(p => {
    grid.appendChild(el('button', {
      type: 'button', class: 'picker__btn', onclick: () => {
        const item = newItem({
          productKey: p.key,
          ref: suggestRef(survey, p.key),
          jobType: 'Supply & Fit - Remove & replace'
        });
        item.finish.frame = survey.defaults.finishFrame || '';
        item.cill = survey.defaults.cill || '';
        item.handle = survey.defaults.handle || '';
        survey.items.push(item);
        c.save();
        go(`item/${survey.id}~${item.id}`);
      }
    }, [
      el('strong', { text: p.label }),
      el('span', { class: 'picker__sub', text: p.tab })
    ]));
  });
  body.appendChild(grid);
  sheet('Add an item', body);
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

function reportScreen(c) {
  const { survey } = c;
  const wrap = el('div', { class: 'screen' });
  const md = toMarkdown(survey);
  const summary = toSummary(survey);

  wrap.appendChild(el('header', { class: 'topbar' }, [
    button('‹ Back', () => go(`survey/${survey.id}`), { class: 'topbar__back' }),
    el('div', { class: 'topbar__title' }, [
      el('strong', { text: 'Report' }),
      el('span', { class: 'topbar__sub', text: survey.customer.name || '' })
    ])
  ]));

  const body = el('div', { class: 'screen__body' });
  wrap.appendChild(body);

  const issues = [...surveyIssues(survey), ...survey.items.flatMap(i => itemIssues(i).map(x => `${i.ref || i.location}: ${x}`))];
  if (issues.length) {
    body.appendChild(el('section', { class: 'card card--warn' }, [
      el('h3', { class: 'card__title', text: `${issues.length} thing${issues.length === 1 ? '' : 's'} to check before you leave` }),
      el('ul', { class: 'list' }, issues.map(i => el('li', { text: i }))),
      el('p', { class: 'hint', text: 'You can still send the report — these are carried through as queries so nothing gets quoted on a guess.' })
    ]));
  }

  const families = buildFamilies(survey);
  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Summary' }),
    el('ul', { class: 'list' }, [
      el('li', { text: `${survey.items.length} item${survey.items.length === 1 ? '' : 's'}` }),
      el('li', { text: `${families.length} frame${families.length === 1 ? '' : 's'} to build, the rest duplicated` }),
      el('li', { text: `${survey.items.reduce((n, i) => n + openingCount(i), 0)} opening sashes in total` })
    ])
  ]));

  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Send it' }),
    el('p', { class: 'hint', text: 'Send this to Claude and say “quote this up in Tommy Trinder”. The report carries the build steps and a structured payload, so nothing has to be re-typed.' }),
    el('div', { class: 'row row--wrap' }, [
      button('Share', () => out.share(survey, md, summary), { variant: 'primary' }),
      button('Copy report', () => out.copy(md), { variant: 'primary' }),
      button('Download .md', () => out.download(md, out.fileName(survey, 'md')), { variant: 'tool' }),
      button('Download .json', () => out.download(JSON.stringify(toPayload(survey), null, 2), out.fileName(survey, 'json'), 'application/json'), { variant: 'tool' }),
      button('Email', () => out.mailto(survey, store.settings().sendEmail, summary), { variant: 'tool' })
    ]),
    store.settings().postUrl
      ? button('Send to Swift Hub', async e => {
        const s = store.settings();
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
          await out.post(s.postUrl, s.postToken, { markdown: md, payload: toPayload(survey) });
          toast('Sent');
        } catch (err) {
          console.error(err);
          toast(`Send failed: ${err.message}`);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Send to Swift Hub';
        }
      }, { variant: 'primary' })
      : null
  ]));

  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Preview' }),
    el('pre', { class: 'preview', text: md })
  ]));

  body.appendChild(el('div', { class: 'spacer' }));
  return wrap;
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

function settingsScreen() {
  const wrap = el('div', { class: 'screen' });
  const s = store.settings();
  wrap.appendChild(el('header', { class: 'topbar' }, [
    button('‹ Back', () => go('home'), { class: 'topbar__back' }),
    el('div', { class: 'topbar__title' }, [el('strong', { text: 'Settings' })])
  ]));
  const body = el('div', { class: 'screen__body' });
  wrap.appendChild(body);

  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Defaults for new surveys' }),
    field('Surveyor name', s.surveyor, v => store.saveSettings({ surveyor: v })),
    field('Frame finish', s.defaultFinish, v => store.saveSettings({ defaultFinish: v })),
    field('Cill', s.defaultCill, v => store.saveSettings({ defaultCill: v })),
    field('Handles', s.defaultHandle, v => store.saveSettings({ defaultHandle: v }))
  ]));

  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Sending' }),
    field('Email reports to', s.sendEmail, v => store.saveSettings({ sendEmail: v }), { type: 'email', inputmode: 'email' }),
    field('Post endpoint (optional)', s.postUrl, v => store.saveSettings({ postUrl: v }), {
      placeholder: 'https://…/api/survey',
      hint: 'Leave blank and nothing ever leaves the phone automatically. Set it to post the report straight to the Swift Hub.'
    }),
    field('Endpoint token', s.postToken, v => store.saveSettings({ postToken: v }), { type: 'password' })
  ]));

  body.appendChild(el('section', { class: 'card' }, [
    el('h3', { class: 'card__title', text: 'Data' }),
    el('p', { class: 'hint', text: 'Surveys live on this device only. Export a backup before clearing browser data or changing phone.' }),
    el('div', { class: 'row row--wrap' }, [
      button('Export all surveys', () => {
        out.download(JSON.stringify(store.loadAll(), null, 2), 'swift-surveys-backup.json', 'application/json');
      }, { variant: 'tool' }),
      button('Import backup', () => importBackup(), { variant: 'tool' })
    ])
  ]));

  body.appendChild(el('div', { class: 'spacer' }));
  return wrap;
}

function importBackup() {
  const input = el('input', {
    type: 'file', accept: 'application/json', class: 'visually-hidden',
    onchange: e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const list = JSON.parse(reader.result);
          if (!Array.isArray(list)) throw new Error('not a survey backup');
          const existing = store.loadAll();
          const byId = new Map(existing.map(s => [s.id, s]));
          list.forEach(s => byId.set(s.id, s));
          store.saveAll([...byId.values()]);
          toast(`Imported ${list.length} survey(s)`);
          render();
        } catch (err) {
          toast(`Could not import: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }
  });
  document.body.appendChild(input);
  input.click();
  setTimeout(() => input.remove(), 60000);
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('offline cache unavailable', err));
}
