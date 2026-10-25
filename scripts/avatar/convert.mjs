// Converte um avatar Rocketbox (*_facial.fbx) para o GLB usado pelo app:
// mantém só as formas faciais necessárias (visemas, piscar, sorriso,
// sobrancelhas), tira as texturas (vão em arquivos à parte) e compacta.
//
// Uso (na raiz do projeto):
//   node scripts/avatar/convert.mjs <entrada_facial.fbx> <saida/model.glb>
// Depois compacte com gltf-transform (não é dependência fixa do projeto):
//   npx @gltf-transform/cli@4.1.1 weld saida/model.glb /tmp/w.glb
//   npx @gltf-transform/cli@4.1.1 meshopt /tmp/w.glb saida/model.glb --level medium
// Texturas: scripts/avatar/textures.py

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../..', import.meta.url).pathname;
const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('Uso: node scripts/avatar/convert.mjs <entrada.fbx> <saida.glb>'); process.exit(1); }

mkdirSync(`${root}.avatar-tmp`, { recursive: true });
copyFileSync(src, `${root}.avatar-tmp/${basename(src)}`);
const PORT = 5188;
const server = spawn(process.execPath, [`${root}scripts/serve.mjs`, root, String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/scripts/avatar/convert.html`);
  await page.waitForFunction('window.ready');
  const r = await page.evaluate((u) => window.convert(u), `/.avatar-tmp/${basename(src)}`);
  writeFileSync(dst, Buffer.from(r.b64, 'base64'));
  console.log(JSON.stringify(r.report, null, 1), '→', dst);
} finally {
  await browser.close();
  server.kill();
}
