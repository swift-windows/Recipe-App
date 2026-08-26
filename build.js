/*
 * build.js - bundles the app into one self-contained HTML file.
 *
 *   node build.js   ->   dist/survey.html
 *
 * Why: the Swift Hub serves single HTML blobs from KV at /tools/<slug>, and a
 * single file can also be emailed to yourself and opened offline from anywhere.
 * The modular source in js/ stays the thing you edit; this is the shipping copy.
 *
 * No dependencies - it rewrites the handful of ES module forms this codebase
 * actually uses into a tiny require() registry.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(here, p), 'utf8');

// Dependency order. Kept explicit rather than resolved, so a mistake shows up
// as a build error rather than a subtly wrong bundle.
const MODULES = [
  './model.js', './elevation.js', './ui.js', './store.js',
  './share.js', './report.js', './editor.js', './app.js'
];

/** Rewrite one ES module into a registry entry. */
function transform(src, name) {
  const exported = new Set();
  let out = src;

  // import { a, b as c } from './x.js'   /   import * as ns from './x.js'
  out = out.replace(
    /^import\s+([\s\S]+?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (all, clause, path) => {
      clause = clause.trim();
      if (clause.startsWith('*')) {
        const ns = clause.replace(/^\*\s*as\s+/, '').trim();
        return `const ${ns} = require('${path}');`;
      }
      if (clause.startsWith('{')) {
        const inner = clause.slice(1, -1).split(',').map(s => {
          const [a, b] = s.split(/\s+as\s+/).map(x => x.trim());
          return b ? `${a}: ${b}` : a;
        }).filter(Boolean).join(', ');
        return `const { ${inner} } = require('${path}');`;
      }
      throw new Error(`${name}: unsupported import form: ${all}`);
    }
  );

  // export function/const/let/class -> plain declaration, remembering the name
  out = out.replace(
    /^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z0-9_$]+)/gm,
    (_all, kind, id) => { exported.add(id); return `${kind} ${id}`; }
  );

  if (/^export\s/m.test(out)) {
    throw new Error(`${name}: an unsupported "export" form is left after transform`);
  }
  if (/^import\s/m.test(out)) {
    throw new Error(`${name}: an unsupported "import" form is left after transform`);
  }

  const assign = exported.size
    ? `\nObject.assign(exports, { ${[...exported].join(', ')} });\n`
    : '';
  return `__mods['${name}'] = function (module, exports, require) {\n${out}\n${assign}};`;
}

const bundle = MODULES.map(name => {
  let src = read(join('js', name.replace('./', '')));
  if (name === './app.js') {
    // The single-file build has no ./sw.js to register, and needs no cache -
    // the browser already has the whole app in one document.
    src = src.replace(/if \('serviceWorker' in navigator[\s\S]*?\n}\n?$/m, '');
  }
  return transform(src, name);
}).join('\n\n');

const css = read('css/app.css');
const icon = readFileSync(join(here, 'icons/icon-192.png')).toString('base64');
const html = read('index.html');
const title = (html.match(/<title>(.*?)<\/title>/) || [, 'Swift Survey'])[1];

const doc = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f2b46">
<title>${title}</title>
<link rel="icon" href="data:image/png;base64,${icon}">
<link rel="apple-touch-icon" href="data:image/png;base64,${icon}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
${css}
</style>
</head>
<body>
<main id="app"></main>
<noscript>This app needs JavaScript switched on.</noscript>
<script>
(function () {
  'use strict';
  var __mods = {}, __cache = {};
  function require(name) {
    if (__cache[name]) return __cache[name].exports;
    var m = { exports: {} };
    __cache[name] = m;
    __mods[name](m, m.exports, require);
    return m.exports;
  }

${bundle}

  require('./app.js');
})();
</script>
</body>
</html>
`;

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist/survey.html'), doc);
console.log(`dist/survey.html  ${(doc.length / 1024).toFixed(1)} kB`);
