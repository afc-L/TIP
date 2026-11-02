// Bundles the game into ONE self-contained HTML file (three.js, code and styles inlined).
// The result runs by double-clicking it — no server, no install, works offline.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const res = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(here, 'src/style.css'), 'utf8');
let html = readFileSync(join(here, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`);
html = html.replace(/<script type="module"[^>]*><\/script>/, () => `<script>${js}</script>`);
const out = join(here, 'TheHunt.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
