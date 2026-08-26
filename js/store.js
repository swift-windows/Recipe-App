/*
 * store.js - offline persistence.
 *
 * Surveys are small JSON and live in localStorage, which is synchronous and
 * therefore safe to write on every keystroke. Photos are large, so they live in
 * IndexedDB and surveys only hold their ids.
 *
 * Everything here degrades rather than throws: a survey in a customer's hallway
 * with no signal must never lose data because a quota check failed.
 */

const KEY = 'swift-survey:surveys:v1';
const SETTINGS = 'swift-survey:settings:v1';
const DB_NAME = 'swift-survey-photos';
const DB_STORE = 'photos';

/* ---------------- surveys ---------------- */

export function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Could not read saved surveys', e);
    return [];
  }
}

export function saveAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Could not save surveys', e);
    return false;
  }
}

export function load(id) {
  return loadAll().find(s => s.id === id) || null;
}

export function save(survey) {
  survey.updatedAt = new Date().toISOString();
  const list = loadAll();
  const i = list.findIndex(s => s.id === survey.id);
  if (i >= 0) list[i] = survey; else list.unshift(survey);
  return saveAll(list);
}

export function remove(id) {
  saveAll(loadAll().filter(s => s.id !== id));
}

/* ---------------- settings ---------------- */

const DEFAULT_SETTINGS = {
  surveyor: '',
  defaultFinish: 'Smooth White',
  defaultCill: '150mm',
  defaultHandle: '',
  sendEmail: '',
  postUrl: '',
  postToken: ''
};

export function settings() {
  try {
    return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS) || '{}'));
  } catch {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

export function saveSettings(patch) {
  const next = Object.assign(settings(), patch);
  try { localStorage.setItem(SETTINGS, JSON.stringify(next)); } catch (e) { console.error(e); }
  return next;
}

/* ---------------- photos (IndexedDB) ---------------- */

let dbPromise = null;
function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function putPhoto(id, dataUrl) {
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const tx = d.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(dataUrl, id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch (e) {
    console.error('photo save failed', e);
    return false;
  }
}

export async function getPhoto(id) {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const tx = d.transaction(DB_STORE, 'readonly');
      const r = tx.objectStore(DB_STORE).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return null;
  }
}

export async function deletePhoto(id) {
  try {
    const d = await db();
    await new Promise(res => {
      const tx = d.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = res;
      tx.onerror = res;
    });
  } catch { /* nothing to do */ }
}

/**
 * Shrink a camera photo before storing it. Phone cameras produce 4-12MB files
 * and a survey can carry dozens; 1400px on the long edge is plenty to read a
 * reveal or a lintel and keeps the whole survey shareable.
 */
export function compressImage(file, maxSide = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('bad image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
