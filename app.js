// ---------- Storage ----------
const STORAGE_KEY = 'recipebox.recipes';
const BASKET_KEY = 'recipebox.basket';
const CHECKED_KEY = 'recipebox.checked';

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const getRecipes = () => load(STORAGE_KEY, []);
const setRecipes = (r) => save(STORAGE_KEY, r);
const getBasket = () => load(BASKET_KEY, []);
const setBasket = (b) => save(BASKET_KEY, b);
const getChecked = () => load(CHECKED_KEY, {});
const setChecked = (c) => save(CHECKED_KEY, c);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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

const formatQuantity = (n) => {
  if (n == null) return '';
  if (Number.isInteger(n)) return String(n);
  // Round to 2 decimals, strip trailing zeros
  return parseFloat(n.toFixed(2)).toString();
};

const formatIngredient = (ing) => {
  const parts = [];
  if (ing.quantity != null) parts.push(formatQuantity(ing.quantity));
  if (ing.unit) parts.push(ing.unit);
  if (ing.name) parts.push(ing.name);
  return parts.join(' ').trim();
};

// Merge ingredients across recipes by normalized (name, unit)
const mergeIngredients = (recipes) => {
  const map = new Map();
  for (const recipe of recipes) {
    for (const raw of recipe.ingredients) {
      const ing = parseIngredient(raw);
      if (!ing) continue;
      const key = `${ing.name.toLowerCase().trim()}|${ing.unit}`;
      if (!map.has(key)) {
        map.set(key, {
          name: ing.name,
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
  '': renderList,
  '/': renderList,
  '/new': renderForm,
  '/edit': renderForm,
  '/recipe': renderDetail,
  '/basket': renderBasket,
};

const parseHash = () => {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  return { path, params };
};

const router = () => {
  const { path, params } = parseHash();
  // Match against route prefixes
  let handler = routes['/'];
  for (const prefix of Object.keys(routes)) {
    if (prefix && path.startsWith(prefix)) {
      handler = routes[prefix];
    }
  }
  handler(params);
  updateBasketCount();
};

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

const navigate = (hash) => { location.hash = hash; };

const mountTemplate = (id) => {
  const tpl = document.getElementById(id);
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(tpl.content.cloneNode(true));
};

// ---------- Toast ----------
let toastTimer;
const toast = (msg) => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2000);
};

// ---------- Basket badge ----------
const updateBasketCount = () => {
  const count = getBasket().length;
  const badge = document.getElementById('basketCount');
  if (badge) badge.textContent = count;
};

// ---------- View: list ----------
function renderList() {
  mountTemplate('view-list');
  const recipes = getRecipes();
  const grid = document.getElementById('recipeGrid');
  const empty = document.getElementById('emptyState');

  if (recipes.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  const basket = getBasket();
  recipes.forEach((r) => {
    const inBasket = basket.includes(r.id);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      ${r.image
        ? `<img class="card-image" src="${r.image}" alt="">`
        : `<div class="card-image-placeholder">🍲</div>`}
      <div class="card-body">
        <h3></h3>
        <p class="card-meta"></p>
        <div class="card-actions">
          <button class="btn basket-toggle">${inBasket ? '✓ In basket' : '+ Add to basket'}</button>
        </div>
      </div>
    `;
    card.querySelector('h3').textContent = r.title;
    card.querySelector('.card-meta').textContent =
      `${r.servings || '?'} servings · ${(r.prepTime || 0) + (r.cookTime || 0)} min`;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.basket-toggle')) return;
      navigate(`#/recipe?id=${r.id}`);
    });
    card.querySelector('.basket-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBasket(r.id);
      renderList();
    });
    grid.appendChild(card);
  });
}

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
  document.getElementById('detailServings').textContent = `${recipe.servings} servings`;
  document.getElementById('detailTime').textContent =
    `${(recipe.prepTime || 0) + (recipe.cookTime || 0)} min total`;

  const img = document.getElementById('detailImage');
  if (recipe.image) {
    img.src = recipe.image;
    img.classList.remove('hidden');
  }

  const ingList = document.getElementById('detailIngredients');
  recipe.ingredients.forEach(line => {
    const li = document.createElement('li');
    li.textContent = line;
    ingList.appendChild(li);
  });

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

  document.getElementById('editBtn').href = `#/edit?id=${recipe.id}`;

  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (!confirm(`Delete "${recipe.title}"?`)) return;
    setRecipes(getRecipes().filter(r => r.id !== recipe.id));
    setBasket(getBasket().filter(b => b !== recipe.id));
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
    row.querySelector('a').textContent = r.title;
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
