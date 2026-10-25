// Teste de ponta a ponta no Chromium (Playwright), nos tamanhos do iPad Pro
// 12,9" (6ª geração) e de um celular. Sobe um servidor local próprio.
// Uso: npm run e2e            (testa o código-fonte)
//      npm run e2e -- dist    (testa o build em dist/web)

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('../..', import.meta.url).pathname;
const target = process.argv[2] === 'dist' ? 'dist/web' : '.';
const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = `${root}test-results`;

const VIEWPORTS = {
  'ipad-paisagem': { width: 1366, height: 1024 },
  'ipad-retrato': { width: 1024, height: 1366 },
  celular: { width: 400, height: 860 },
};

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  ✗ ${name}\n    ${err.message.split('\n').join('\n    ')}`);
  }
}

const server = spawn(process.execPath, [`${root}scripts/serve.mjs`, `${root}${target}`, String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();

try {
  const context = await browser.newContext({ viewport: VIEWPORTS['ipad-paisagem'], hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  console.log(`AI Care — teste de ponta a ponta (${target})`);
  await page.goto(BASE, { waitUntil: 'networkidle' });

  await step('configuração inicial: escolher assistente masculino e nome', async () => {
    assert.ok(await page.isVisible('.onboarding'));
    await page.click('text=Começar');
    await page.click('.assistant-option >> nth=1');
    await page.fill('#ob-name', 'Rafael');
    await page.click('text=Continuar');
    await page.click('text=Começar a usar');
    assert.ok(await page.isVisible('.onboarding'), 'não deve avançar sem marcar a confirmação');
    await page.check('#ob-agree');
    await page.click('text=Começar a usar');
    assert.ok(!(await page.isVisible('.onboarding')));
    assert.equal(await page.textContent('.stage-name'), 'Rafael');
    assert.equal(await page.getAttribute('.avatar-stage', 'data-gender'), 'male');
    assert.match(await page.textContent('.chat-log'), /Eu sou o Rafael/);
  });

  await step('indicadores de microfone e câmera ficam ocultos quando desligados', async () => {
    assert.equal(await page.isVisible('.live-mic'), false);
    assert.equal(await page.isVisible('.live-cam'), false);
  });

  await step('conversa: adicionar itens à lista de compras', async () => {
    await page.fill('#chat-input', 'Adicione café e açúcar na lista');
    await page.press('#chat-input', 'Enter');
    await page.waitForSelector('.msg-assistant:has-text("Coloquei café e açúcar")');
    await page.click('.nav-item:has-text("Compras")');
    const text = await page.textContent('.shop-list');
    assert.match(text, /Café/);
    assert.match(text, /Açúcar/);
  });

  await step('conversa: criar lembrete por texto', async () => {
    await page.click('.nav-item:has-text("Assistente")');
    await page.fill('#chat-input', 'Me lembre de regar a horta amanhã às 7h');
    await page.press('#chat-input', 'Enter');
    await page.waitForSelector('.msg-assistant:has-text("Lembrete criado")');
    await page.click('.nav-item:has-text("Lembretes")');
    assert.match(await page.textContent('.page'), /Regar a horta/);
  });

  await step('conversa: guardar e consultar memória', async () => {
    await page.click('.nav-item:has-text("Assistente")');
    await page.fill('#chat-input', 'Lembre que eu gosto de música sertaneja');
    await page.press('#chat-input', 'Enter');
    await page.waitForSelector('.msg-assistant:has-text("Guardei em preferências")');
    await page.click('.nav-item:has-text("Memórias")');
    assert.match(await page.textContent('.memory-groups'), /Gosto de música sertaneja/);
  });

  await step('moradores: validação e cadastro fictício', async () => {
    await page.click('.nav-item:has-text("Moradores")');
    await page.click('text=Novo cadastro');
    await page.click('.modal-actions >> text=Cadastrar');
    assert.match(await page.textContent('.modal .form-error'), /fictícios/);
    await page.check('#rf-fictitious');
    await page.click('.modal-actions >> text=Cadastrar');
    assert.match(await page.textContent('.modal'), /Informe o nome/);
    await page.fill('#rf-name', 'Joaquim Teste');
    await page.fill('#rf-treatment', 'Seu Joaquim');
    await page.click('.modal-actions >> text=Cadastrar');
    await page.waitForSelector('.person-card:has-text("Joaquim Teste")');
  });

  await step('trocar quem está usando (identificação manual)', async () => {
    await page.click('.resident-chip');
    await page.click('.picker-item:has-text("Seu Joaquim")');
    assert.match(await page.textContent('.resident-chip'), /Seu Joaquim/);
  });

  await step('excluir morador apaga as memórias dele', async () => {
    await page.click('.nav-item:has-text("Assistente")');
    await page.fill('#chat-input', 'Lembre que eu prefiro chá');
    await page.press('#chat-input', 'Enter');
    await page.waitForSelector('.msg-assistant:has-text("Guardei")');
    const id = await page.evaluate(() => window.__aicare.store.getState().session.activeResidentId);
    await page.click('.nav-item:has-text("Moradores")');
    await page.click('.person-card:has-text("Joaquim Teste") >> text=Editar');
    await page.click('.modal-actions >> text=Excluir');
    await page.click('.modal-sm >> button:has-text("Excluir")');
    const left = await page.evaluate((rid) => window.__aicare.store.getState().memories.filter((m) => m.residentId === rid).length, id);
    assert.equal(left, 0);
    assert.equal(await page.isVisible('.person-card:has-text("Joaquim Teste")'), false);
  });

  await step('SOS: avisa que nada foi enviado e registra como teste', async () => {
    await page.click('.sos-btn');
    await page.waitForSelector('.modal-sos');
    const text = await page.textContent('.modal-sos');
    assert.match(text, /Nenhum alerta foi enviado/);
    assert.match(text, /192/);
    await page.screenshot({ path: `${SHOTS}/sos.png` });
    await page.click('.modal-sos >> text=Ver histórico');
    assert.match(await page.textContent('.page'), /Teste · não enviado/);
    const alert = await page.evaluate(() => window.__aicare.store.getState().alerts[0]);
    assert.equal(alert.delivered, false);
  });

  await step('emergência por voz/texto abre o SOS', async () => {
    await page.click('.nav-item:has-text("Assistente")');
    await page.fill('#chat-input', 'socorro');
    await page.press('#chat-input', 'Enter');
    await page.waitForSelector('.modal-sos');
    await page.keyboard.press('Escape');
    assert.equal(await page.isVisible('.modal-sos'), false);
  });

  await step('lembrete vencido mostra aviso na tela', async () => {
    await page.evaluate(() => window.__aicare.store.update((d) => {
      d.reminders.push({ id: 'rem_e2e', householdId: d.session.householdId, residentId: null, title: 'Teste de aviso', dueAt: new Date(Date.now() - 30_000).toISOString(), repeat: 'none', done: false, lastFiredAt: null, createdAt: new Date().toISOString() });
    }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForSelector('.modal-reminder:has-text("Teste de aviso")');
    await page.click('.modal-reminder >> text=Feito');
    const done = await page.evaluate(() => window.__aicare.store.getState().reminders.find((r) => r.id === 'rem_e2e').done);
    assert.equal(done, true);
  });

  await step('microfone indisponível mostra aviso em vez de falhar', async () => {
    await page.click('.mic-btn');
    await page.waitForTimeout(600);
    const listening = await page.getAttribute('.mic-btn', 'aria-pressed');
    const toastShown = await page.isVisible('.toast');
    assert.ok(listening === 'true' || toastShown, 'deve ouvir ou explicar por que não pode');
    if (listening === 'true') await page.click('.mic-btn');
  });

  await step('câmera exige confirmação antes de ligar', async () => {
    await page.click('.nav-item:has-text("Câmeras")');
    await page.click('text=Ligar câmera');
    assert.match(await page.textContent('.camera-status'), /Marque a confirmação/);
    assert.equal(await page.isVisible('.live-cam'), false);
  });

  await step('dispositivo externo nunca aparece como conectado', async () => {
    await page.click('text=Cadastrar dispositivo');
    await page.fill('#dv-name', 'Câmera da cozinha');
    await page.fill('#dv-room', 'Cozinha');
    await page.selectOption('#dv-type', 'ip-rtsp');
    await page.fill('#dv-addr', 'rtsp://admin:1234@192.168.0.20/stream');
    await page.click('.modal-actions >> text=Cadastrar');
    assert.match(await page.textContent('.modal'), /Remova usuário e senha/);
    await page.fill('#dv-addr', 'rtsp://192.168.0.20/stream');
    await page.click('.modal-actions >> text=Cadastrar');
    const row = await page.textContent('.device:has-text("Câmera da cozinha")');
    assert.match(row, /Não conectado/);
  });

  await step('modo escuro pelo botão do topo', async () => {
    await page.click('.topbar .icon-btn');
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert.ok(theme === 'dark' || theme === 'light');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.click('.topbar .icon-btn');
    const bg2 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.notEqual(bg, bg2);
  });

  await step('dados continuam após recarregar a página', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.isVisible('.onboarding'), false);
    const state = await page.evaluate(() => window.__aicare.store.getState());
    assert.ok(state.shopping.some((i) => i.name === 'Café'));
    assert.equal(state.settings.assistant.name, 'Rafael');
  });

  await step('todas as telas sem rolagem horizontal (iPad e celular)', async () => {
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(vp);
      for (const id of ['inicio', 'menu', 'moradores', 'memorias', 'lembretes', 'compras', 'cameras', 'emergencia', 'configuracoes', 'recursos']) {
        await page.evaluate((v) => window.__aicare.navigate(v), id);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(sw <= vp.width, `${name}/${id}: largura ${sw} > ${vp.width}`);
        if (id === 'inicio' || id === 'menu') await page.screenshot({ path: `${SHOTS}/${name}-${id}.png` });
      }
    }
  });

  await step('nenhum erro de JavaScript durante o teste', async () => {
    assert.deepEqual(errors, []);
  });
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} de ${results.length} passaram. Capturas em test-results/.`);
process.exit(failed ? 1 : 0);
