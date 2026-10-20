// ---------- Sharing between phones ----------
// Open the app with ?box=CODE and everything it saves is mirrored to the
// server, so each person can use their own phone and still share one box.
// Without a code the app just keeps everything on this device, as before.
window.Sync = (() => {
  const BOX_KEY = 'recipebox.box';
  const ANSWERS = 'recipebox.answers';
  const SHARED = [
    'recipebox.recipes', 'recipebox.basket', 'recipebox.checked', ANSWERS,
    'recipebox.built', 'recipebox.favourites', 'recipebox.hidden',
  ];
  // Pages where a refresh would yank the screen from under someone
  const BUSY_ROUTES = ['/quiz', '/new', '/edit'];

  const read = (k) => {
    try { const raw = localStorage.getItem(k); return raw == null ? undefined : JSON.parse(raw); } catch { return undefined; }
  };
  const write = (k, v) => {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ }
  };
  const clone = (v) => JSON.parse(JSON.stringify(v ?? {}));
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

  let box = new URLSearchParams(location.search).get('box');
  try {
    if (box) localStorage.setItem(BOX_KEY, box);
    else box = localStorage.getItem(BOX_KEY);
  } catch { /* blocked */ }
  const api = box ? `/api/box/${encodeURIComponent(box)}` : null;

  // Answers are sent per person, so two phones filling in at once can't overwrite each other
  let pending = { set: {}, answers: {} };
  let lastAnswers = clone(read(ANSWERS));
  let lastSeen = '';
  let timer = null;
  let onChange = null;

  const hasPending = () => Object.keys(pending.set).length > 0 || Object.keys(pending.answers).length > 0;

  function queue(key, value) {
    if (!api || !SHARED.includes(key)) return;
    if (key === ANSWERS) {
      const next = value || {};
      for (const p of new Set([...Object.keys(lastAnswers), ...Object.keys(next)])) {
        if (JSON.stringify(lastAnswers[p]) !== JSON.stringify(next[p])) pending.answers[p] = next[p] ?? null;
      }
      lastAnswers = clone(next);
    } else {
      pending.set[key] = value ?? null;
    }
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  }

  async function flush() {
    if (!hasPending()) return;
    const body = pending;
    pending = { set: {}, answers: {} };
    try {
      const res = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      apply(await res.json());
    } catch {
      // Offline or a blip: keep it and try again shortly
      pending = { set: { ...body.set, ...pending.set }, answers: { ...body.answers, ...pending.answers } };
      clearTimeout(timer);
      timer = setTimeout(flush, 5000);
    }
  }

  // Copy the server's state onto this phone, keeping anything not yet sent
  function apply(state) {
    const json = JSON.stringify(state);
    if (json === lastSeen) return false;
    lastSeen = json;
    for (const k of SHARED) {
      if (k in pending.set) continue;
      if (k === ANSWERS) {
        const merged = { ...(state[k] || {}) };
        for (const [p, v] of Object.entries(pending.answers)) {
          if (v == null) delete merged[p]; else merged[p] = v;
        }
        write(k, merged);
        lastAnswers = clone(merged);
      } else {
        write(k, state[k]);
      }
    }
    return true;
  }

  async function pull() {
    const res = await fetch(api, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function refresh() {
    if (hasPending()) return;
    try {
      const changed = apply(await pull());
      const path = location.hash.replace(/^#/, '').split('?')[0] || '/';
      if (changed && onChange && !BUSY_ROUTES.includes(path)) onChange();
    } catch { /* try again next time */ }
  }

  async function start(render) {
    if (!api) return;
    onChange = render;
    try {
      const remote = await withTimeout(pull(), 5000);
      // First visit from this phone: send up anything the box doesn't have yet,
      // e.g. answers filled in before the phones were linked
      const remoteAnswers = remote[ANSWERS] || {};
      for (const [p, mine] of Object.entries(read(ANSWERS) || {})) {
        const theirs = remoteAnswers[p];
        if (!theirs || (!theirs.completedAt && mine.completedAt)) pending.answers[p] = mine;
      }
      for (const k of SHARED) {
        if (k !== ANSWERS && remote[k] === undefined && read(k) !== undefined) pending.set[k] = read(k);
      }
      apply(remote);
      flush();
    } catch { /* offline: carry on with what's on this phone */ }
    setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }

  return { start, queue, active: !!api };
})();
