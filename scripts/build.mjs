// Gera duas saídas a partir de src/:
//   dist/web/       versão para hospedar (PWA): index.html, app.js, app.css, sw.js, public/
//   dist/artifact/  arquivo único ai-care.html, para publicar como Artifact no claude.ai
// Uso: npm run build

import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const FONTS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Lexend:wght@500;600;700&display=swap';

await rm(`${root}dist`, { recursive: true, force: true });
await mkdir(`${root}dist/web`, { recursive: true });
await mkdir(`${root}dist/artifact`, { recursive: true });

const common = {
  bundle: true,
  format: 'iife',
  target: ['safari15'],
  minify: true,
  legalComments: 'none',
  write: false,
  define: { __AICARE_BUNDLED__: 'true' },
  // load.js usa import() dinâmico só no modo de desenvolvimento.
  logOverride: { 'unsupported-dynamic-import': 'silent', 'empty-import-meta': 'silent' },
};
const js = (await build({ ...common, entryPoints: [`${root}src/main.js`] })).outputFiles[0].text;
// Avatar 3D (three.js) em arquivo separado, carregado só quando usado.
const avatarJs = (await build({ ...common, entryPoints: [`${root}src/ui/components/avatar3d/entry.js`], legalComments: 'eof' })).outputFiles[0].text;
const css = (await build({ entryPoints: [`${root}src/styles/app.css`], bundle: true, minify: true, write: false, target: ['safari15'] })).outputFiles[0].text;

// ---------- dist/web ----------
let html = await readFile(`${root}index.html`, 'utf8');
html = html
  .replace('<link rel="stylesheet" href="src/styles/app.css">', '<link rel="stylesheet" href="app.css">')
  .replace(/\s*<script type="importmap">.*?<\/script>/s, '')
  .replace('<script type="module" src="src/main.js"></script>', '<script src="app.js" defer></script>');
await writeFile(`${root}dist/web/index.html`, html);
await writeFile(`${root}dist/web/app.js`, js);
await writeFile(`${root}dist/web/app.css`, css);
await writeFile(`${root}dist/web/avatar3d.js`, avatarJs);
await cp(`${root}sw.js`, `${root}dist/web/sw.js`);
await cp(`${root}public`, `${root}dist/web/public`, { recursive: true });

// ---------- dist/artifact ----------
// O Artifact envolve o arquivo em <html><head><body>, então aqui vão só
// título, estilos e conteúdo. O script marca o build para desligar o
// service worker, que o Artifact não permite.
const artifact = `<title>AI Care</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>
<div id="app"><noscript>O AI Care precisa de JavaScript ativado.</noscript></div>
<script>document.documentElement.dataset.build='artifact';document.documentElement.lang='pt-BR';</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
await writeFile(`${root}dist/artifact/ai-care.html`, artifact);
// Arquivos de apoio do Artifact (publicados ao lado da página).
await writeFile(`${root}dist/artifact/avatar3d.js`, avatarJs);
await cp(`${root}public/avatars`, `${root}dist/artifact/public/avatars`, { recursive: true });

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
console.log(`dist/web/app.js ${kb(js)} · avatar3d.js ${kb(avatarJs)} · app.css ${kb(css)} · dist/artifact/ai-care.html ${kb(artifact)}`);
