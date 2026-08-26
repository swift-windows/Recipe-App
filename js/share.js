/*
 * share.js - getting the report off the phone and to Claude.
 *
 * Four routes, because signal in a customer's house is not guaranteed:
 *   Share     - the OS share sheet (Claude app, WhatsApp, Mail, Drive...)
 *   Copy      - clipboard, for pasting straight into a Claude chat
 *   Download  - a .md file, works with no signal at all
 *   Send      - POST to an endpoint (e.g. the Swift Hub) when one is configured
 */

import { toast } from './ui.js';

export function fileName(survey, ext = 'md') {
  const who = (survey.customer.name || 'survey').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const when = (survey.surveyedAt || new Date().toISOString().slice(0, 10));
  return `survey-${who}-${when}.${ext}`.toLowerCase();
}

export function download(text, name, mime = 'text/markdown') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Report copied — paste it into Claude');
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to a selection copy.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? 'Report copied — paste it into Claude' : 'Could not copy — use Download instead');
    return ok;
  }
}

export async function share(survey, text, summary) {
  const name = fileName(survey);
  const title = `Window survey — ${survey.customer.name || 'customer'}`;
  // Sharing as a file keeps the whole report intact; some targets only take text.
  try {
    if (navigator.canShare) {
      const file = new File([text], name, { type: 'text/markdown' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text: summary });
        return true;
      }
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
    console.error('share failed', e);
  }
  toast('Sharing not available here — use Copy or Download');
  return false;
}

export function mailto(survey, to, summary) {
  const subject = encodeURIComponent(`Window survey — ${survey.customer.name || 'customer'}`);
  const body = encodeURIComponent(
    `${summary}\n\nThe full survey report is attached — or paste it into Claude and say "quote this up in Tommy Trinder".\n`
  );
  window.location.href = `mailto:${encodeURIComponent(to || '')}?subject=${subject}&body=${body}`;
}

/**
 * POST the report to a configured endpoint. Left unset by default: nothing
 * leaves the phone unless Sean has entered a URL in Settings.
 */
export async function post(url, token, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: `Bearer ${token}` } : {}
    ),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}
