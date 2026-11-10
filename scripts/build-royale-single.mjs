// Builds DROPZONE 100 into ONE self-contained HTML file (JS + CSS inlined) that runs by
// double-clicking it — no install, no web server. Output: royale/standalone/DROPZONE100.html
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'node_modules/.dropzone-single');
rmSync(outDir, { recursive: true, force: true });

await build({
  root: resolve(root, 'royale'),
  base: './',
  logLevel: 'warn',
  configFile: false,
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 100000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

let html = readFileSync(join(outDir, 'index.html'), 'utf8');
const assets = join(outDir, 'assets');
for (const f of readdirSync(assets)) {
  const code = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${code}</style>`);
  } else if (f.endsWith('.js')) {
    // classic inline module script; "</script" inside the bundle must not close the tag
    const safe = code.replace(/<\/script/gi, '<\\/script');
    html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => '');
    html = html.replace('</body>', () => `<script type="module">${safe}</script>\n</body>`);
  }
}
const dest = resolve(root, 'royale/standalone');
mkdirSync(dest, { recursive: true });
writeFileSync(join(dest, 'DROPZONE100.html'), html);
rmSync(outDir, { recursive: true, force: true });
console.log(`Wrote royale/standalone/DROPZONE100.html (${(html.length / 1024).toFixed(0)} KB)`);
