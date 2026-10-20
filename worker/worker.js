// Cloudflare Worker for Recipe Box.
// Serves the app files from KV (FILES) and keeps each household's shared
// recipe box in D1 (DB), keyed by the code in the ?box= link.
const TYPES = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' };
const FILES = ['index.html', 'styles.css', 'questions.js', 'library.js', 'sync.js', 'app.js'];
const ANSWERS = 'recipebox.answers';
const MAX_BODY = 1_500_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const box = url.pathname.match(/^\/api\/box\/([A-Za-z0-9_-]{6,64})$/);
    if (box) return handleBox(request, env, box[1]);

    let key = url.pathname.replace(/^\/+/, '') || 'index.html';
    if (!FILES.includes(key)) key = 'index.html';
    const body = await env.FILES.get(key, { cacheTtl: 60 });
    if (body === null) return new Response('Not found', { status: 404 });
    return new Response(body, { headers: { 'content-type': TYPES[key.split('.').pop()], 'cache-control': 'no-cache' } });
  },
};

async function handleBox(request, env, id) {
  const row = await env.DB.prepare('SELECT data FROM boxes WHERE id = ?').bind(id).first();
  const state = row ? JSON.parse(row.data) : {};

  if (request.method === 'POST') {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return new Response('Too large', { status: 413 });
    let patch;
    try { patch = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }

    for (const [k, v] of Object.entries(patch.set || {})) {
      if (k === ANSWERS) continue;
      if (v == null) delete state[k]; else state[k] = v;
    }
    // Answers merge per person so two phones never overwrite each other
    const answers = state[ANSWERS] || {};
    for (const [person, v] of Object.entries(patch.answers || {})) {
      if (v == null) delete answers[person]; else answers[person] = v;
    }
    state[ANSWERS] = answers;

    await env.DB.prepare(
      'INSERT INTO boxes (id, data, updated) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated',
    ).bind(id, JSON.stringify(state), Date.now()).run();
  } else if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  return new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
