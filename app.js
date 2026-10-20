// ---------- Storage ----------
const STORAGE_KEY = 'recipebox.recipes';
const BASKET_KEY = 'recipebox.basket';
const CHECKED_KEY = 'recipebox.checked';
const ANSWERS_KEY = 'recipebox.answers';
const BUILT_KEY = 'recipebox.built';
const FAV_KEY = 'recipebox.favourites';
const HIDDEN_KEY = 'recipebox.hidden';

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  if (window.Sync) window.Sync.queue(key, value);
};

const getRecipes = () => load(STORAGE_KEY, []);
const setRecipes = (r) => save(STORAGE_KEY, r);
const getBasket = () => load(BASKET_KEY, []);
const setBasket = (b) => save(BASKET_KEY, b);
const getChecked = () => load(CHECKED_KEY, {});
const setChecked = (c) => save(CHECKED_KEY, c);
const getAnswers = () => load(ANSWERS_KEY, {});
const setAnswers = (a) => save(ANSWERS_KEY, a);
const getFavourites = () => load(FAV_KEY, []);
const setFavourites = (f) => save(FAV_KEY, f);
const getHidden = () => load(HIDDEN_KEY, []);
const setHidden = (h) => save(HIDDEN_KEY, h);
const isBuilt = () => !!load(BUILT_KEY, null);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// ---------- Questionnaire state ----------
const isComplete = (person) => !!getAnswers()[person]?.completedAt;
const allComplete = () => PEOPLE.every(isComplete);
const isReady = () => allComplete() && isBuilt();

const questionById = (id) => QUESTIONS.find((q) => q.id === id);
const optionFor = (qid, value) => questionById(qid)?.options?.find((o) => o.value === value);
const labelFor = (qid, value) => optionFor(qid, value)?.label ?? value;
const realValues = (list) => (list || []).filter((v) => v !== 'none');

const CUISINE_NAMES = Object.fromEntries(questionById('cuisines').options.map((o) => [o.value, o.label]));
const cuisineName = (c) => (CUISINE_NAMES[c] || c || '').replace(' classics', '').replace(' & BBQ', '');

const CUISINE_TINTS = {
  british: '#7c9cbf', italian: '#d9534f', indian: '#e8a33d', chinese: '#c0392b', thai: '#3fa66b',
  japanese: '#e06c8a', korean: '#b0413e', mexican: '#e67e22', 'middle-eastern': '#c99a3b',
  mediterranean: '#3a8fb7', spanish: '#e2a03f', french: '#6c5ce7', american: '#d35400',
};
const tintFor = (r) => CUISINE_TINTS[r.cuisine] || '#c2410c';

// ---------- Matching ----------
const FAN_SCORE = 4;   // score at which a recipe genuinely appeals to someone
const STAR_SCORE = 7;  // score at which one person's love earns it a place on its own
const DIET_RANK = { vegan: 0, vegetarian: 1, pescatarian: 2, meat: 3 };
const MEAL_WORDS = {
  breakfast: 'brunch', lunch: 'lunch', dinner: 'weeknight dinner', fakeaway: 'fakeaway',
  weekend: 'weekend project', dessert: 'pudding',
};
const GOAL_WORDS = {
  healthy: 'on the lighter side', 'high-protein': 'high protein', comfort: 'proper comfort food',
  budget: 'easy on the wallet', batch: 'great for leftovers', impress: 'one to impress',
  family: 'crowd-pleaser',
};

const FAV_STOPWORDS = new Set(['proper', 'really', 'anything', 'with', 'from', 'good', 'best', 'homemade',
  'home', 'made', 'like', 'love', 'favourite', 'meal', 'dish', 'food', 'local', 'takeaway', 'nice', 'just',
  'always', 'probably', 'have', 'that', 'this', 'mums', 'mum’s', "mum's", 'nans', 'classic', 'big', 'great']);

const totalTime = (r) => (r.prepTime || 0) + (r.cookTime || 0);

// How well one recipe fits one person. Returns { ok, score, reasons[], why }
function personFit(r, a) {
  if (!a) return { ok: false, score: 0, reasons: [], why: 'no answers' };

  if (DIET_RANK[r.diet] > DIET_RANK[a.diet ?? 'meat']) {
    return { ok: false, score: 0, reasons: [], why: labelFor('diet', a.diet).toLowerCase() };
  }
  const hated = (r.contains || []).filter((c) => realValues(a.dislikes).includes(c));
  if (hated.length) {
    return { ok: false, score: 0, reasons: [], why: `no ${labelFor('dislikes', hated[0]).toLowerCase()}` };
  }
  const tolerance = parseInt(a.spice ?? '1', 10);
  if (r.spice - tolerance >= 2) return { ok: false, score: 0, reasons: [], why: 'too spicy' };

  let score = 0;
  const reasons = [];
  // Each reason has a plural ("You both love…") and singular ("Liv loves…") form
  const add = (key, pts, plural, singular) => { score += pts; reasons.push({ key, plural, singular }); };

  const cuisine = cuisineName(r.cuisine);
  if ((a.cuisines || []).includes(r.cuisine)) add(`c:${r.cuisine}`, 3, `love ${cuisine} food`, `loves ${cuisine} food`);
  const protein = labelFor('proteins', r.protein).toLowerCase();
  if ((a.proteins || []).includes(r.protein)) add(`p:${r.protein}`, 2, `love ${protein}`, `loves ${protein}`);

  const meal = (r.meals || []).find((m) => (a.meals || []).includes(m));
  if (meal) add(`m:${meal}`, 2, `wanted ${MEAL_WORDS[meal]} ideas`, `wanted ${MEAL_WORDS[meal]} ideas`);
  else score -= 2;

  (r.tags || []).filter((t) => (a.goals || []).includes(t))
    .forEach((t) => add(`g:${t}`, 1, `wanted food that’s ${GOAL_WORDS[t]}`, `wanted food that’s ${GOAL_WORDS[t]}`));

  const limit = parseInt(a.time ?? '45', 10);
  const slowIsFine = (r.meals || []).some((m) => m === 'weekend' || m === 'dessert');
  if (totalTime(r) <= limit) add(`t:${limit}`, 1, `can fit it into a ${limit}-minute weeknight`, `can fit it into a ${limit}-minute weeknight`);
  else if (!slowIsFine) score -= 2;

  const skill = parseInt(a.skill ?? '2', 10);
  if (r.difficulty > skill) score -= 2 * (r.difficulty - skill);
  if (r.spice > tolerance) score -= 1;
  else if (r.spice && r.spice === tolerance) add('s', 1, 'like this much heat', 'likes this much heat');

  // Favourite meal: any meaningful word in common with the recipe gets a boost
  const favWords = (String(a.favourite || '').toLowerCase().match(/[a-z]{4,}/g) || [])
    .filter((w) => !FAV_STOPWORDS.has(w));
  const haystack = `${r.title} ${r.cuisine} ${r.protein}`.toLowerCase();
  if (favWords.some((w) => haystack.includes(w))) {
    const fav = String(a.favourite).trim();
    add('fav', 3, 'named something like this as a favourite', `’s favourite is “${fav}”, and this is in the same spirit`);
  }

  return { ok: true, score, reasons, why: '' };
}

function matchRecipe(r, answers) {
  const fits = PEOPLE.map((p) => ({ person: p, ...personFit(r, answers[p]) }));
  const ok = fits.filter((f) => f.ok);
  // A "fan" is someone it genuinely appeals to, not just someone who can eat it
  const fans = ok.filter((f) => f.score >= FAN_SCORE);
  const both = fans.length === PEOPLE.length;
  const total = ok.reduce((s, f) => s + f.score, 0);

  // Merge reasons: if everyone shares one, say "You both…"
  const byKey = new Map();
  ok.forEach((f) => f.reasons.forEach((rs) => {
    if (!byKey.has(rs.key)) byKey.set(rs.key, { ...rs, people: [] });
    byKey.get(rs.key).people.push(f.person);
  }));
  const reasons = [...byKey.values()]
    .sort((x, y) => y.people.length - x.people.length)
    .slice(0, 5)
    .map(({ plural, singular, people }) => {
      if (people.length === 1) return `${people[0]}${singular.startsWith('’') ? '' : ' '}${singular}`;
      return `${people.length === PEOPLE.length && PEOPLE.length === 2 ? 'You both' : people.join(' & ')} ${plural}`;
    });

  return {
    both, total, ok: ok.length > 0,
    suits: (fans.length ? fans : ok).map((f) => f.person),
    best: Math.max(...ok.map((f) => f.score), -Infinity),
    // Puddings and brunches rarely score on cuisine or protein, so asking for them is enough
    asked: fans.some((f) => f.reasons.some((rs) => ['m:breakfast', 'm:lunch', 'm:dessert'].includes(rs.key))),
    scores: Object.fromEntries(fits.map((f) => [f.person, f.ok ? f.score : null])),
    notFor: fits.filter((f) => !f.ok).map((f) => ({ person: f.person, why: f.why })),
    reasons,
  };
}

// Fill the recipe box from the library using everyone's answers.
function buildBox() {
  const answers = getAnswers();
  const blocked = new Set(PEOPLE.flatMap((p) => realValues(answers[p]?.allergies)));
  const hidden = getHidden();
  const kept = getRecipes().filter((r) => r.source !== 'library');
  const keptLib = new Set(kept.map((r) => r.libId).filter(Boolean));

  const candidates = LIBRARY
    .filter((r) => !r.allergens.some((al) => blocked.has(al)))
    .filter((r) => !hidden.includes(r.id) && !keptLib.has(r.id))
    .map((r) => ({ r, m: matchRecipe(r, answers) }))
    .filter((x) => x.m.ok);

  // In if it appeals to everyone, or someone really loves it and nobody's ruled it out
  const strong = candidates.filter(({ m }) => m.both || m.best >= STAR_SCORE || m.asked);

  // Never leave the box looking empty: top up with the best of the rest
  let chosen = strong;
  if (chosen.length < 12) {
    const extra = candidates.filter((c) => !strong.includes(c)).sort((x, y) => y.m.total - x.m.total);
    chosen = [...strong, ...extra.slice(0, 12 - strong.length)];
  }

  chosen.sort((x, y) => (y.m.both - x.m.both) || (y.m.total - x.m.total));

  const now = Date.now();
  const fresh = chosen.map(({ r, m }, i) => ({
    ...r,
    id: `lib-${r.id}`,
    libId: r.id,
    source: 'library',
    image: '',
    match: m,
    rank: i,
    createdAt: now,
  }));

  setRecipes([...fresh, ...kept]);
  const ids = new Set([...fresh, ...kept].map((r) => r.id));
  setBasket(getBasket().filter((id) => ids.has(id)));
  save(BUILT_KEY, now);
  return { count: fresh.length, blocked: [...blocked] };
}

// ---------- Ingredient parsing & merging ----------
// Parses lines like "200 g flour", "2 eggs", "1/2 tsp salt", "1.5 cups milk"
const UNIT_ALIASES = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', pound: 'lb', pounds: 'lb',
  pinch: 'pinch', pinches: 'pinch',
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  can: 'can', cans: 'can',
};
const COUNTABLE_UNITS = { cup: 'cups', pinch: 'pinches', clove: 'cloves', slice: 'slices', can: 'cans' };

const parseQuantity = (token) => {
  // Handles "1", "1.5", "1/2", "1 1/2"
  if (!token) return null;
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const num = parseFloat(token);
  return isNaN(num) ? null : num;
};

const parseIngredient = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Match leading quantity (with optional fraction part)
  const match = trimmed.match(/^([\d./\s]*\d[\d./]*)\s+(.*)$/);
  if (!match) {
    return { quantity: null, unit: '', name: trimmed, raw: trimmed };
  }
  const qtyToken = match[1].trim();
  const rest = match[2].trim();
  const quantity = parseQuantity(qtyToken);

  // Try to extract a unit
  const restWords = rest.split(/\s+/);
  const firstWord = restWords[0].toLowerCase().replace(/\.$/, '');
  if (UNIT_ALIASES[firstWord]) {
    return {
      quantity,
      unit: UNIT_ALIASES[firstWord],
      name: restWords.slice(1).join(' '),
      raw: trimmed,
    };
  }
  return { quantity, unit: '', name: rest, raw: trimmed };
};

const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const formatQuantity = (n) => {
  if (n == null) return '';
  if (n >= 10) return String(Math.round(n));
  const quarters = Math.round(n * 4) / 4;
  if (quarters === 0) return parseFloat(n.toFixed(2)).toString();
  const whole = Math.floor(quarters);
  const frac = quarters - whole;
  return `${whole || ''}${FRACTIONS[frac] || ''}` || '0';
};

const formatIngredient = (ing) => {
  const parts = [];
  if (ing.quantity != null) parts.push(formatQuantity(ing.quantity));
  if (ing.unit) parts.push(ing.quantity > 1 && COUNTABLE_UNITS[ing.unit] ? COUNTABLE_UNITS[ing.unit] : ing.unit);
  if (ing.name) parts.push(ing.name);
  return parts.join(' ').trim();
};

const scaleLine = (line, factor) => {
  const ing = parseIngredient(line);
  if (!ing || ing.quantity == null) return line;
  let quantity = ing.quantity * factor;
  // You can't buy half a whole chicken
  if (!ing.unit && /^whole\b/i.test(ing.name)) quantity = Math.max(1, Math.round(quantity));
  return formatIngredient({ ...ing, quantity });
};

// Merge ingredients across recipes by normalized (name, unit).
// Prep notes after a comma ("onion, finely chopped") are dropped so like merges with like.
const mergeIngredients = (recipes) => {
  const map = new Map();
  for (const recipe of recipes) {
    for (const raw of recipe.ingredients) {
      const ing = parseIngredient(raw);
      if (!ing) continue;
      const name = ing.name.split(',')[0].trim();
      const key = `${name.toLowerCase()}|${ing.unit}`;
      if (!map.has(key)) {
        map.set(key, {
          name,
          unit: ing.unit,
          quantity: ing.quantity,
          sources: [recipe.title],
          unmergeable: ing.quantity == null,
        });
      } else {
        const existing = map.get(key);
        if (ing.quantity != null && existing.quantity != null) {
          existing.quantity += ing.quantity;
        } else if (ing.quantity != null && existing.quantity == null) {
          existing.quantity = ing.quantity;
          existing.unmergeable = false;
        }
        if (!existing.sources.includes(recipe.title)) {
          existing.sources.push(recipe.title);
        }
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// ---------- Routing ----------
const routes = {
  '/': renderList,
  '/start': renderStart,
  '/quiz': renderQuiz,
  '/tastes': renderTastes,
  '/new': renderForm,
  '/edit': renderForm,
  '/recipe': renderDetail,
  '/basket': renderBasket,
};
// Pages you can reach before the questionnaire is done
const OPEN_ROUTES = ['/start', '/quiz'];

const parseHash = () => {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  return { path, params };
};

const router = () => {
  const { path, params } = parseHash();
  let handler = routes[path] || renderList;
  if (!isReady() && !OPEN_ROUTES.includes(path)) handler = renderStart;
  document.body.classList.toggle('locked', !isReady());
  document.querySelectorAll('nav .navlink').forEach((a) => {
    const target = a.getAttribute('href').replace(/^#/, '');
    a.classList.toggle('active', target === path || (target === '/' && path === '/recipe'));
  });
  handler(params);
  updateBasketCount();
  window.scrollTo(0, 0);
};

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', async () => {
  // Pull the shared box down before the first render so both phones agree
  if (window.Sync) await window.Sync.start(router);
  router();
});

const navigate = (hash) => {
  if (location.hash === hash) router();
  else location.hash = hash;
};

const mountTemplate = (id) => {
  const tpl = document.getElementById(id);
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(tpl.content.cloneNode(true));
};

const mountHTML = (html) => {
  const app = document.getElementById('app');
  app.innerHTML = html;
  return app;
};

// ---------- Toast ----------
let toastTimer;
const toast = (msg) => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
};

// ---------- Basket badge ----------
const updateBasketCount = () => {
  const count = getBasket().length;
  const badge = document.getElementById('basketCount');
  if (badge) badge.textContent = count;
};

// ---------- View: start (questionnaire hub) ----------
function renderStart() {
  const answers = getAnswers();
  const done = PEOPLE.filter(isComplete);
  const ready = done.length === PEOPLE.length;
  const names = PEOPLE.join(' & ');

  const personCard = (p) => {
    const a = answers[p];
    const complete = !!a?.completedAt;
    const started = a && !complete && Object.keys(a).length > 0;
    return `
      <div class="person-card ${complete ? 'done' : ''}">
        <div class="avatar">${esc(p[0])}</div>
        <h3>${esc(p)}</h3>
        <p class="person-status">${complete ? '✓ All done' : started ? 'Halfway there' : 'Not started yet'}</p>
        <a class="btn ${complete ? 'btn-ghost' : 'btn-primary'}" href="#/quiz?who=${encodeURIComponent(p)}&q=0">
          ${complete ? 'Change answers' : started ? 'Carry on' : `Start ${esc(p)}’s questions`}
        </a>
      </div>`;
  };

  mountHTML(`
    <section class="view start">
      <div class="hero">
        <p class="eyebrow">Your recipe box is empty… on purpose</p>
        <h2>Let’s find food you’ll <em>both</em> love.</h2>
        <p class="lede">Before a single recipe goes in, ${esc(names)} each answer ${QUESTIONS.length} quick questions:
          what you eat, what you can’t stand, how hot you like it and how long you’ve got.
          Then we’ll fill the box with recipes picked for the two of you.</p>
      </div>
      <div class="people">${PEOPLE.map(personCard).join('')}</div>
      <div class="build-row">
        <button id="buildBtn" class="btn btn-primary btn-big" ${ready ? '' : 'disabled'}>
          ${ready ? (isBuilt() ? '🔄 Rebuild our recipe box' : '✨ Build our recipe box') : `Waiting on ${esc(PEOPLE.filter((p) => !isComplete(p)).join(' & '))}`}
        </button>
        ${ready && isBuilt() ? '<a href="#/" class="btn btn-ghost">Back to recipes</a>' : ''}
      </div>
      <p class="fineprint">${window.Sync?.active
        ? 'Your answers are shared, so you can each fill these in on your own phone.'
        : 'Answers are saved on this device. Hand the phone over when it’s their turn.'}</p>
    </section>`);

  document.getElementById('buildBtn').addEventListener('click', () => runBuild());
}

async function runBuild() {
  const answers = getAnswers();
  const overlay = document.getElementById('buildOverlay');
  const lines = overlay.querySelector('.build-lines');
  lines.innerHTML = '';
  overlay.classList.remove('hidden');

  const result = buildBox();
  const loves = [...new Set(PEOPLE.flatMap((p) => answers[p]?.cuisines || []))].slice(0, 3).map(cuisineName);
  const steps = [
    ...PEOPLE.map((p) => `Reading ${p}’s answers…`),
    result.blocked.length ? `Keeping ${result.blocked.map((b) => labelFor('allergies', b).toLowerCase()).join(', ')} off the menu…` : 'Checking allergies…',
    loves.length ? `Hunting down the best ${loves.join(', ')}…` : 'Hunting down the good stuff…',
    `Picked ${result.count} recipes for you 🎉`,
  ];
  for (const s of steps) {
    const li = document.createElement('li');
    li.textContent = s;
    lines.appendChild(li);
    await new Promise((r) => setTimeout(r, 550));
  }
  await new Promise((r) => setTimeout(r, 700));
  overlay.classList.add('hidden');
  navigate('#/');
}

// ---------- View: questionnaire ----------
function renderQuiz(params) {
  const who = params.get('who');
  if (!PEOPLE.includes(who)) { navigate('#/start'); return; }
  const qi = Math.max(0, Math.min(QUESTIONS.length - 1, parseInt(params.get('q') || '0', 10)));
  const q = QUESTIONS[qi];
  const answers = getAnswers();
  const mine = answers[who] || {};
  let value = mine[q.id] ?? (q.type === 'multi' ? [] : '');

  const optionsHTML = () => {
    if (q.type === 'text') {
      return `<textarea id="quizText" class="quiz-text" rows="3" maxlength="300" placeholder="${esc(q.placeholder || '')}">${esc(value)}</textarea>`;
    }
    return `<div class="options ${q.type}">${q.options.map((o) => {
      const on = q.type === 'multi' ? value.includes(o.value) : value === o.value;
      return `<button type="button" class="option ${on ? 'on' : ''}" data-value="${esc(o.value)}" aria-pressed="${on}">
          <span class="option-emoji">${o.emoji}</span><span>${esc(o.label)}</span></button>`;
    }).join('')}</div>`;
  };

  mountHTML(`
    <section class="view quiz">
      <div class="quiz-top">
        <a href="#/start" class="back">← ${esc(who)}’s questions</a>
        <span class="quiz-count">${qi + 1} of ${QUESTIONS.length}</span>
      </div>
      <div class="progress"><span style="width:${((qi) / QUESTIONS.length) * 100}%"></span></div>
      <h2 class="quiz-title">${esc(q.title)}</h2>
      ${q.subtitle ? `<p class="quiz-sub">${esc(q.subtitle)}</p>` : ''}
      ${q.type === 'multi' ? '<p class="quiz-hint">Tap all that apply</p>' : ''}
      <div id="quizBody">${optionsHTML()}</div>
      <div class="quiz-nav">
        <button id="quizBack" class="btn btn-ghost" ${qi === 0 ? 'disabled' : ''}>← Back</button>
        <button id="quizNext" class="btn btn-primary">${qi === QUESTIONS.length - 1 ? 'Finish ✓' : 'Next →'}</button>
      </div>
    </section>`);

  const nextBtn = document.getElementById('quizNext');
  const valid = () => {
    if (q.type === 'text') return q.optional || String(value).trim().length > 0;
    if (q.type === 'multi') return value.length >= (q.min || 1);
    return !!value;
  };
  const refresh = () => { nextBtn.disabled = !valid(); };
  const persist = () => {
    const all = getAnswers();
    all[who] = { ...(all[who] || {}), [q.id]: value };
    setAnswers(all);
  };

  const body = document.getElementById('quizBody');
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.option');
    if (!btn) return;
    const v = btn.dataset.value;
    if (q.type === 'single') {
      value = v;
      persist();
      body.innerHTML = optionsHTML();
      refresh();
      setTimeout(() => goNext(), 220); // single choice: move straight on
      return;
    }
    if (v === q.none) value = value.includes(v) ? [] : [v];
    else {
      value = value.filter((x) => x !== q.none);
      value = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    }
    persist();
    body.innerHTML = optionsHTML();
    refresh();
  });
  const text = document.getElementById('quizText');
  if (text) {
    text.addEventListener('input', () => { value = text.value; persist(); refresh(); });
    text.focus();
  }

  const goNext = () => {
    if (!valid()) return;
    persist();
    if (qi < QUESTIONS.length - 1) {
      navigate(`#/quiz?who=${encodeURIComponent(who)}&q=${qi + 1}`);
      return;
    }
    const all = getAnswers();
    all[who] = { ...all[who], completedAt: Date.now() };
    setAnswers(all);
    const waiting = PEOPLE.filter((p) => !isComplete(p));
    if (waiting.length) {
      toast(`Nice one, ${who}! Over to ${waiting[0]} 👋`);
      navigate('#/start');
    } else if (isBuilt()) {
      runBuild().then(() => toast('Recipe box updated with your new answers'));
    } else {
      toast('Everyone’s done. Time to build the box!');
      navigate('#/start');
    }
  };
  nextBtn.addEventListener('click', goNext);
  document.getElementById('quizBack').addEventListener('click', () => {
    navigate(`#/quiz?who=${encodeURIComponent(who)}&q=${qi - 1}`);
  });
  refresh();
}

// ---------- View: our tastes ----------
function renderTastes() {
  const answers = getAnswers();
  const list = (qid, vals) => {
    const v = realValues(vals);
    if (!v.length) return '<span class="muted">None</span>';
    return v.map((x) => `<span class="pill">${optionFor(qid, x)?.emoji || ''} ${esc(labelFor(qid, x))}</span>`).join(' ');
  };
  const shared = (qid) => {
    const sets = PEOPLE.map((p) => new Set(realValues(answers[p]?.[qid])));
    return [...sets[0]].filter((v) => sets.every((s) => s.has(v)));
  };
  const commonCuisines = shared('cuisines');
  const commonProteins = shared('proteins');
  const blocked = [...new Set(PEOPLE.flatMap((p) => realValues(answers[p]?.allergies)))];

  const personBlock = (p) => {
    const a = answers[p] || {};
    return `
      <div class="taste-card">
        <div class="taste-head"><div class="avatar">${esc(p[0])}</div><h3>${esc(p)}</h3>
          <a class="btn btn-ghost btn-small" href="#/quiz?who=${encodeURIComponent(p)}&q=0">Edit</a></div>
        <dl>
          <dt>Eats</dt><dd>${esc(labelFor('diet', a.diet))}</dd>
          <dt>Allergies</dt><dd>${list('allergies', a.allergies)}</dd>
          <dt>Can’t stand</dt><dd>${list('dislikes', a.dislikes)}</dd>
          <dt>Loves</dt><dd>${list('cuisines', a.cuisines)}</dd>
          <dt>On the plate</dt><dd>${list('proteins', a.proteins)}</dd>
          <dt>Heat</dt><dd>${esc(labelFor('spice', a.spice))}</dd>
          <dt>Weeknights</dt><dd>${esc(labelFor('time', a.time))}</dd>
          <dt>Confidence</dt><dd>${esc(labelFor('skill', a.skill))}</dd>
          <dt>Goals</dt><dd>${list('goals', a.goals)}</dd>
          <dt>Meals</dt><dd>${list('meals', a.meals)}</dd>
          <dt>Favourite</dt><dd>${esc(a.favourite || '—')}</dd>
          ${a.notes ? `<dt>Notes</dt><dd>${esc(a.notes)}</dd>` : ''}
        </dl>
      </div>`;
  };

  mountHTML(`
    <section class="view tastes">
      <h2>Our tastes</h2>
      <div class="common">
        <div><h4>💛 Common ground</h4>
          <p>${commonCuisines.length ? `You both love ${commonCuisines.map(cuisineName).join(', ')}.` : 'No cuisines in common, so we’ve found something for each of you.'}
          ${commonProteins.length ? ` You’re both happy with ${commonProteins.map((v) => labelFor('proteins', v).toLowerCase()).join(', ')}.` : ''}</p></div>
        <div><h4>🚫 Kept off the menu</h4>
          <p>${blocked.length ? blocked.map((b) => labelFor('allergies', b)).join(', ') : 'No allergies. Lucky you.'}</p></div>
      </div>
      <div class="taste-grid">${PEOPLE.map(personBlock).join('')}</div>
      <div class="actions">
        <button id="rebuildBtn" class="btn btn-primary">🔄 Rebuild recipe box</button>
        <button id="exportBtn" class="btn">📋 Copy answers</button>
        <button id="resetBtn" class="btn btn-danger">Start again from scratch</button>
      </div>
      <p class="fineprint">“Copy answers” gives you everything as text, handy if you want Claude to hand-pick more recipes for you.</p>
    </section>`);

  document.getElementById('rebuildBtn').addEventListener('click', () => runBuild());
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const text = JSON.stringify(getAnswers(), null, 2);
    try { await navigator.clipboard.writeText(text); toast('Answers copied'); } catch { toast('Copy failed'); }
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Wipe both questionnaires and every suggested recipe? Your own uploaded recipes are kept.')) return;
    setAnswers({});
    save(BUILT_KEY, null);
    setHidden([]);
    setRecipes(getRecipes().filter((r) => r.source !== 'library'));
    navigate('#/start');
  });
}

// ---------- View: list ----------
const filters = { q: '', chip: 'all', cuisine: '' };

const matchBadge = (r) => {
  if (!r.match) return r.source === 'library' ? '' : '<span class="match-badge mine">📝 Your recipe</span>';
  if (r.match.both) return '<span class="match-badge both">💛 Both of you</span>';
  return `<span class="match-badge one">⭐ ${esc(r.match.suits.join(' & '))}’s pick</span>`;
};
const spiceIcons = (n) => (n ? '🌶️'.repeat(n) : '');

const applyFilters = (recipes) => {
  const favs = getFavourites();
  const q = filters.q.trim().toLowerCase();
  return recipes.filter((r) => {
    if (q && !`${r.title} ${r.blurb || ''} ${r.cuisine || ''} ${r.ingredients.join(' ')}`.toLowerCase().includes(q)) return false;
    if (filters.cuisine && r.cuisine !== filters.cuisine) return false;
    switch (filters.chip) {
      case 'both': return !!r.match?.both;
      case 'quick': return totalTime(r) <= 30;
      case 'fav': return favs.includes(r.id);
      case 'mine': return !r.match;
      case 'all': return true;
      default: return !!r.match?.suits.includes(filters.chip) && !r.match.both;
    }
  });
};

function renderList() {
  mountTemplate('view-list');
  const recipes = getRecipes();
  const both = recipes.filter((r) => r.match?.both).length;

  document.getElementById('listGreeting').textContent = `Hello ${PEOPLE.join(' & ')} 👋`;
  document.getElementById('listSummary').textContent =
    `${recipes.length} recipes in your box${both ? `, ${both} you’ll both enjoy` : ''}.`;

  const chips = [
    ['all', 'All'], ['both', '💛 Both of you'],
    ...PEOPLE.map((p) => [p, `⭐ ${p}’s picks`]),
    ['quick', '⚡ 30 min or less'], ['fav', '♥ Favourites'], ['mine', '📝 Our own'],
  ];
  const chipRow = document.getElementById('chipRow');
  chipRow.innerHTML = chips.map(([k, l]) => `<button class="chip ${filters.chip === k ? 'on' : ''}" data-chip="${esc(k)}">${esc(l)}</button>`).join('');
  chipRow.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    filters.chip = c.dataset.chip;
    renderList();
  });

  const cuisineSel = document.getElementById('cuisineFilter');
  const cuisines = [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))].sort();
  cuisineSel.innerHTML = `<option value="">All cuisines</option>${cuisines.map((c) => `<option value="${esc(c)}" ${filters.cuisine === c ? 'selected' : ''}>${esc(cuisineName(c))}</option>`).join('')}`;
  cuisineSel.addEventListener('change', () => { filters.cuisine = cuisineSel.value; drawGrid(); });

  const search = document.getElementById('searchBox');
  search.value = filters.q;
  search.addEventListener('input', () => { filters.q = search.value; drawGrid(); });

  document.getElementById('surpriseBtn').addEventListener('click', () => {
    const pool = applyFilters(recipes);
    const best = pool.filter((r) => r.match?.both);
    const pick = (best.length ? best : pool)[Math.floor(Math.random() * (best.length || pool.length))];
    if (pick) navigate(`#/recipe?id=${pick.id}`);
    else toast('Nothing matches those filters');
  });

  drawGrid();

  function drawGrid() {
    const grid = document.getElementById('recipeGrid');
    const empty = document.getElementById('emptyState');
    grid.innerHTML = '';
    const shown = applyFilters(getRecipes());
    empty.classList.toggle('hidden', shown.length > 0);
    const basket = getBasket();
    const favs = getFavourites();

    shown.forEach((r) => {
      const inBasket = basket.includes(r.id);
      const fav = favs.includes(r.id);
      const card = document.createElement('article');
      card.className = 'card';
      card.style.setProperty('--tint', tintFor(r));
      card.innerHTML = `
        <div class="card-hero">
          ${r.image ? `<img class="card-image" src="${r.image}" alt="">` : `<span class="card-emoji">${esc(r.emoji || '🍲')}</span>`}
          <button class="fav-btn ${fav ? 'on' : ''}" aria-label="Favourite">${fav ? '♥' : '♡'}</button>
          ${matchBadge(r)}
        </div>
        <div class="card-body">
          <h3></h3>
          <p class="card-blurb"></p>
          <p class="card-meta"></p>
          <div class="card-actions">
            <button class="btn btn-small basket-toggle">${inBasket ? '✓ In basket' : '+ Basket'}</button>
          </div>
        </div>`;
      card.querySelector('h3').textContent = r.title;
      card.querySelector('.card-blurb').textContent = r.blurb || '';
      card.querySelector('.card-meta').textContent = [
        `⏱ ${totalTime(r)} min`,
        r.cuisine ? cuisineName(r.cuisine) : '',
        spiceIcons(r.spice),
      ].filter(Boolean).join(' · ');
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        navigate(`#/recipe?id=${r.id}`);
      });
      card.querySelector('.basket-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBasket(r.id);
        drawGrid();
      });
      card.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavourite(r.id);
        drawGrid();
      });
      grid.appendChild(card);
    });
  }
}

const toggleFavourite = (id) => {
  const favs = getFavourites();
  const on = !favs.includes(id);
  setFavourites(on ? [...favs, id] : favs.filter((f) => f !== id));
  toast(on ? 'Added to favourites ♥' : 'Removed from favourites');
};

// ---------- View: form (upload/edit) ----------
function renderForm(params) {
  mountTemplate('view-form');
  const id = params.get('id');
  const isEdit = !!id;
  const recipes = getRecipes();
  const existing = isEdit ? recipes.find((r) => r.id === id) : null;

  if (isEdit && !existing) {
    navigate('#/');
    return;
  }

  if (isEdit) {
    document.getElementById('formTitle').textContent = 'Edit recipe';
  }

  const form = document.getElementById('recipeForm');
  const preview = document.getElementById('imagePreview');
  let imageData = existing ? existing.image : '';

  if (existing) {
    form.title.value = existing.title;
    form.servings.value = existing.servings;
    form.prepTime.value = existing.prepTime;
    form.cookTime.value = existing.cookTime;
    form.ingredients.value = existing.ingredients.join('\n');
    form.steps.value = existing.steps.join('\n');
    if (existing.image) {
      preview.src = existing.image;
      preview.classList.remove('hidden');
    }
  }

  form.image.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    imageData = await resizeImage(dataUrl, 800, 600);
    preview.src = imageData;
    preview.classList.remove('hidden');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const ingredients = data.get('ingredients').split('\n').map(s => s.trim()).filter(Boolean);
    const steps = data.get('steps').split('\n').map(s => s.trim()).filter(Boolean);

    if (ingredients.length === 0 || steps.length === 0) {
      toast('Add at least one ingredient and one step.');
      return;
    }

    const recipe = {
      ...(existing || {}),
      id: existing ? existing.id : uid(),
      title: data.get('title').trim(),
      servings: parseInt(data.get('servings')) || 1,
      prepTime: parseInt(data.get('prepTime')) || 0,
      cookTime: parseInt(data.get('cookTime')) || 0,
      image: imageData,
      ingredients,
      steps,
      createdAt: existing ? existing.createdAt : Date.now(),
    };
    // An edited suggestion becomes yours, so a rebuild won't overwrite it
    if (recipe.source === 'library') recipe.source = 'edited';

    const next = isEdit
      ? recipes.map(r => r.id === recipe.id ? recipe : r)
      : [recipe, ...recipes];
    setRecipes(next);
    toast(isEdit ? 'Recipe updated' : 'Recipe saved');
    navigate(`#/recipe?id=${recipe.id}`);
  });
}

const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Resize via canvas to keep localStorage manageable
const resizeImage = (dataUrl, maxW, maxH) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    let { width, height } = img;
    const ratio = Math.min(maxW / width, maxH / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    resolve(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.src = dataUrl;
});

// ---------- View: detail ----------
function renderDetail(params) {
  mountTemplate('view-detail');
  const id = params.get('id');
  const recipe = getRecipes().find(r => r.id === id);
  if (!recipe) {
    navigate('#/');
    return;
  }

  document.getElementById('detailTitle').textContent = recipe.title;
  document.getElementById('detailBlurb').textContent = recipe.blurb || '';
  document.getElementById('detailTime').textContent =
    `⏱ ${totalTime(recipe)} min (${recipe.prepTime || 0} prep, ${recipe.cookTime || 0} cook)`;
  const extra = [
    recipe.cuisine ? cuisineName(recipe.cuisine) : '',
    recipe.difficulty ? ['', 'Easy', 'A bit of effort', 'Challenging'][recipe.difficulty] : '',
    spiceIcons(recipe.spice),
  ].filter(Boolean).join(' · ');
  document.getElementById('detailExtra').textContent = extra;
  document.getElementById('detailBadge').innerHTML = matchBadge(recipe);

  const hero = document.getElementById('detailHero');
  hero.style.setProperty('--tint', tintFor(recipe));
  if (recipe.image) {
    hero.innerHTML = `<img class="detail-image" src="${recipe.image}" alt="">`;
  } else {
    hero.innerHTML = `<span class="detail-emoji">${esc(recipe.emoji || '🍲')}</span>`;
  }

  // Why it's in the box
  const why = document.getElementById('detailWhy');
  if (recipe.match) {
    const lines = [...recipe.match.reasons];
    recipe.match.notFor.forEach((n) => lines.push(`Not one for ${n.person} (${n.why})`));
    why.innerHTML = `<h4>Why it’s in your box</h4><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  } else {
    why.remove();
  }

  const allergenEl = document.getElementById('detailAllergens');
  if (recipe.allergens?.length) {
    allergenEl.innerHTML = `<strong>Contains:</strong> ${recipe.allergens.map((a) => esc(labelFor('allergies', a))).join(', ')}.
      <span class="muted">Always check packet labels, as brands vary.</span>`;
  } else if (recipe.libId) {
    allergenEl.innerHTML = '<span class="muted">No major allergens in the recipe as written. Always check packet labels.</span>';
  } else {
    allergenEl.remove();
  }

  // Servings scaler
  let servings = recipe.servings || 1;
  const ingList = document.getElementById('detailIngredients');
  const servingsEl = document.getElementById('servingsCount');
  const drawIngredients = () => {
    servingsEl.textContent = servings;
    ingList.innerHTML = '';
    const factor = servings / (recipe.servings || 1);
    recipe.ingredients.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = scaleLine(line, factor);
      li.addEventListener('click', () => li.classList.toggle('got'));
      ingList.appendChild(li);
    });
  };
  document.getElementById('servingsDown').addEventListener('click', () => { if (servings > 1) { servings--; drawIngredients(); } });
  document.getElementById('servingsUp').addEventListener('click', () => { if (servings < 24) { servings++; drawIngredients(); } });
  drawIngredients();

  const stepsList = document.getElementById('detailSteps');
  recipe.steps.forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    stepsList.appendChild(li);
  });

  document.getElementById('cookBtn').addEventListener('click', () => startCookingMode(recipe));

  const basketBtn = document.getElementById('basketBtn');
  const refreshBasketBtn = () => {
    const inBasket = getBasket().includes(recipe.id);
    basketBtn.textContent = inBasket ? '✓ Remove from basket' : '+ Add to basket';
  };
  refreshBasketBtn();
  basketBtn.addEventListener('click', () => {
    toggleBasket(recipe.id);
    refreshBasketBtn();
    updateBasketCount();
  });

  const favBtn = document.getElementById('favBtn');
  const refreshFav = () => {
    const on = getFavourites().includes(recipe.id);
    favBtn.textContent = on ? '♥ Favourite' : '♡ Favourite';
    favBtn.classList.toggle('on', on);
  };
  refreshFav();
  favBtn.addEventListener('click', () => { toggleFavourite(recipe.id); refreshFav(); });

  document.getElementById('editBtn').href = `#/edit?id=${recipe.id}`;

  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (!confirm(`Delete "${recipe.title}"?`)) return;
    setRecipes(getRecipes().filter(r => r.id !== recipe.id));
    setBasket(getBasket().filter(b => b !== recipe.id));
    // Don't let a rebuild bring back a suggestion you've binned
    if (recipe.libId) setHidden([...new Set([...getHidden(), recipe.libId])]);
    toast('Recipe deleted');
    navigate('#/');
  });
}

// ---------- Basket ----------
const toggleBasket = (id) => {
  const basket = getBasket();
  const next = basket.includes(id) ? basket.filter(b => b !== id) : [...basket, id];
  setBasket(next);
  updateBasketCount();
  toast(basket.includes(id) ? 'Removed from basket' : 'Added to basket');
};

// ---------- View: basket ----------
function renderBasket() {
  mountTemplate('view-basket');
  const basket = getBasket();
  const recipes = getRecipes().filter(r => basket.includes(r.id));
  const recipesEl = document.getElementById('basketRecipes');
  const listEl = document.getElementById('shoppingList');
  const empty = document.getElementById('basketEmpty');
  const itemsEl = document.getElementById('shoppingItems');

  if (recipes.length === 0) {
    empty.classList.remove('hidden');
    listEl.classList.add('hidden');
    return;
  }

  recipes.forEach(r => {
    const row = document.createElement('div');
    row.className = 'basket-recipe';
    row.innerHTML = `
      <a href="#/recipe?id=${r.id}" class="navlink"></a>
      <button class="btn btn-ghost">Remove</button>
    `;
    row.querySelector('a').textContent = `${r.emoji || '🍲'} ${r.title}`;
    row.querySelector('button').addEventListener('click', () => {
      toggleBasket(r.id);
      renderBasket();
    });
    recipesEl.appendChild(row);
  });

  const merged = mergeIngredients(recipes);
  const checkedState = getChecked();

  merged.forEach((item, idx) => {
    const li = document.createElement('li');
    const itemKey = `${item.name.toLowerCase()}|${item.unit}`;
    const isChecked = !!checkedState[itemKey];
    if (isChecked) li.classList.add('checked');
    li.innerHTML = `
      <input type="checkbox" id="item-${idx}" ${isChecked ? 'checked' : ''}>
      <label for="item-${idx}"></label>
      <span class="shopping-source"></span>
    `;
    li.querySelector('label').textContent = formatIngredient(item);
    li.querySelector('.shopping-source').textContent =
      item.sources.length > 1 ? `${item.sources.length} recipes` : '';
    li.querySelector('input').addEventListener('change', (e) => {
      const c = getChecked();
      if (e.target.checked) c[itemKey] = true; else delete c[itemKey];
      setChecked(c);
      li.classList.toggle('checked', e.target.checked);
    });
    itemsEl.appendChild(li);
  });

  document.getElementById('copyListBtn').addEventListener('click', async () => {
    const text = merged.map(formatIngredient).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Shopping list copied');
    } catch {
      toast('Copy failed — select and copy manually');
    }
  });

  document.getElementById('clearBasketBtn').addEventListener('click', () => {
    if (!confirm('Clear all recipes from your basket?')) return;
    setBasket([]);
    setChecked({});
    renderBasket();
  });
}

// ---------- Cooking mode ----------
let cookState = null;
let timerInterval = null;
let wakeLock = null;

async function startCookingMode(recipe) {
  cookState = { recipe, step: 0 };
  document.getElementById('cookingMode').classList.remove('hidden');
  document.getElementById('cookTitle').textContent = recipe.title;
  document.getElementById('cookStepTotal').textContent = recipe.steps.length;
  renderCookStep();

  // Keep screen awake during cooking
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* not granted */ }
  }
  document.addEventListener('keydown', handleCookKeys);
}

function renderCookStep() {
  const { recipe, step } = cookState;
  document.getElementById('cookStepNum').textContent = step + 1;
  document.getElementById('cookStepText').textContent = recipe.steps[step];
  document.getElementById('cookPrevBtn').disabled = step === 0;
  const nextBtn = document.getElementById('cookNextBtn');
  nextBtn.textContent = step === recipe.steps.length - 1 ? 'Finish ✓' : 'Next →';
  // Pre-fill the timer if the step mentions minutes
  const mins = recipe.steps[step].match(/(\d+)(?:–\d+)?\s*minutes?/);
  if (mins) document.getElementById('timerMinutes').value = mins[1];
}

function exitCookingMode() {
  document.getElementById('cookingMode').classList.add('hidden');
  cookState = null;
  stopTimer();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  document.removeEventListener('keydown', handleCookKeys);
}

function handleCookKeys(e) {
  if (!cookState) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); cookNext(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); cookPrev(); }
  else if (e.key === 'Escape') exitCookingMode();
}

function cookNext() {
  if (!cookState) return;
  if (cookState.step >= cookState.recipe.steps.length - 1) {
    exitCookingMode();
    toast('Done! Enjoy your meal 🍽️');
    return;
  }
  cookState.step++;
  renderCookStep();
}

function cookPrev() {
  if (!cookState || cookState.step === 0) return;
  cookState.step--;
  renderCookStep();
}

// Timer
function startTimer() {
  const minutes = parseInt(document.getElementById('timerMinutes').value);
  if (!minutes || minutes < 0) return;
  stopTimer();
  let remaining = minutes * 60;
  const display = document.getElementById('timerDisplay');
  display.classList.remove('alarm');

  const tick = () => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    if (remaining <= 0) {
      stopTimer();
      display.classList.add('alarm');
      display.textContent = 'TIME!';
      try { beep(); } catch {}
      return;
    }
    remaining--;
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function beep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.start(ctx.currentTime + i * 0.4);
    osc.stop(ctx.currentTime + i * 0.4 + 0.2);
  }
}

// Cooking mode global handlers (set up once)
document.addEventListener('click', (e) => {
  if (e.target.id === 'cookExitBtn') exitCookingMode();
  else if (e.target.id === 'cookNextBtn') cookNext();
  else if (e.target.id === 'cookPrevBtn') cookPrev();
  else if (e.target.id === 'timerStartBtn') startTimer();
});
