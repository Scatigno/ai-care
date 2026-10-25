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
// WebGL por software, para o avatar 3D funcionar sem placa de vídeo.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

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
    await page.waitForSelector('.avatar-host[data-avatar="3d"] .avatar3d[data-ready]', { timeout: 30000 });
    assert.equal(await page.getAttribute('.avatar3d', 'data-gender'), 'male');
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

  await step('rotinas: exigem autorização e falam no horário', async () => {
    await page.evaluate(() => window.__aicare.navigate('rotinas'));
    assert.match(await page.textContent('.routine-list'), /Desligada/, 'exemplo nasce desligado');
    await page.click('text=Nova rotina');
    await page.selectOption('#rt-type', 'mensagem');
    await page.fill('#rt-msg', 'Hora de beber água.');
    await page.click('.modal-actions >> text=Criar rotina');
    assert.match(await page.textContent('.modal .form-error'), /autorização/);
    await page.check('#rt-consent');
    await page.click('.modal-actions >> text=Criar rotina');
    await page.waitForSelector('.routine:has-text("Mensagem personalizada")');
    await page.click('.routine:has-text("Mensagem personalizada") >> text=Ouvir agora');
    await page.waitForSelector('.modal-reminder:has-text("Hora de beber água.")');
    await page.click('.modal-reminder >> text=Obrigado');
    // Simula o horário chegando: rotina das 1 minuto atrás
    await page.evaluate(() => window.__aicare.store.update((d) => {
      const r = d.routines.find((x) => x.type === 'mensagem');
      const t = new Date(Date.now() - 60_000);
      r.time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      r.days = [0, 1, 2, 3, 4, 5, 6];
    }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForSelector('.modal-reminder:has-text("Hora de beber água.")');
    await page.click('.modal-reminder >> text=Obrigado');
  });

  await step('manter a tela ligada liga e desliga sem erro', async () => {
    await page.evaluate(() => window.__aicare.navigate('configuracoes'));
    await page.click('label[for="set-awake"]');
    assert.equal(await page.evaluate(() => window.__aicare.store.getState().settings.keepAwake), true);
    await page.click('label[for="set-awake"]');
    assert.equal(await page.evaluate(() => window.__aicare.store.getState().settings.keepAwake), false);
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
      for (const id of ['inicio', 'menu', 'moradores', 'memorias', 'lembretes', 'rotinas', 'compras', 'cameras', 'emergencia', 'configuracoes', 'recursos']) {
        await page.evaluate((v) => window.__aicare.navigate(v), id);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(sw <= vp.width, `${name}/${id}: largura ${sw} > ${vp.width}`);
        if (id === 'inicio' || id === 'menu') await page.screenshot({ path: `${SHOTS}/${name}-${id}.png` });
      }
    }
  });

  await step('modo conversa e chamada pelo nome (reconhecimento de fala simulado)', async () => {
    const ctx2 = await browser.newContext({ viewport: VIEWPORTS['ipad-paisagem'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => errors.push(`[voz] ${e.message}`));
    await p2.addInitScript(() => {
      const instances = [];
      class FakeSR {
        constructor() { this.continuous = false; instances.push(this); }
        start() { this.active = true; setTimeout(() => this.onstart?.(), 5); }
        stop() { if (!this.active) return; this.active = false; setTimeout(() => this.onend?.(), 5); }
        abort() { this.stop(); }
      }
      window.SpeechRecognition = FakeSR;
      const current = () => [...instances].reverse().find((i) => i.active);
      window.__voice = {
        active: () => Boolean(current()),
        continuous: () => Boolean(current()?.continuous),
        say(text) {
          const r = current();
          r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
          if (!r.continuous) r.stop();
        },
      };
    });
    await p2.goto(BASE, { waitUntil: 'networkidle' });
    await p2.evaluate(() => {
      window.__aicare.store.update((d) => { d.settings.onboardingDone = true; d.settings.assistant = { gender: 'female', name: 'Clara' }; d.settings.voice.enabled = false; });
      document.querySelector('.onboarding')?.remove();
    });
    await p2.click('.mic-btn');
    await p2.waitForFunction(() => window.__voice.active());
    assert.equal(await p2.isVisible('.live-mic'), true, 'indicador de microfone aceso');
    await p2.evaluate(() => window.__voice.say('que horas são'));
    await p2.waitForSelector('.msg-assistant:has-text("Agora são")');
    await p2.waitForFunction(() => window.__voice.active(), null, { timeout: 3000 });
    assert.equal(await p2.getAttribute('.mic-btn', 'aria-pressed'), 'true', 'continua em conversa sem novo toque');
    await p2.evaluate(() => window.__voice.say('adicione pipoca na lista'));
    await p2.waitForSelector('.msg-assistant:has-text("pipoca")');
    await p2.waitForFunction(() => window.__voice.active(), null, { timeout: 3000 });
    await p2.evaluate(() => window.__voice.say('tchau'));
    await p2.waitForSelector('.msg-assistant:has-text("Até logo")');
    await p2.waitForTimeout(800);
    assert.equal(await p2.evaluate(() => window.__voice.active()), false, 'despedida encerra a escuta');
    assert.equal(await p2.isVisible('.live-mic'), false);

    // Mãos livres direto da tela principal, com confirmação de privacidade.
    await p2.click('.handsfree-btn');
    await p2.click('.modal button:text-is("Ativar")');
    await p2.waitForFunction(() => window.__voice.active() && window.__voice.continuous());
    assert.equal(await p2.getAttribute('.handsfree-btn', 'aria-pressed'), 'true');
    assert.match(await p2.textContent('.handsfree-btn'), /diga "Clara"/);
    const before = await p2.locator('.msg').count();
    await p2.evaluate(() => window.__voice.say('vamos almoçar daqui a pouco'));
    await p2.waitForTimeout(300);
    assert.equal(await p2.locator('.msg').count(), before, 'conversa sem o nome é ignorada');
    await p2.evaluate(() => window.__voice.say('Clara, que dia é hoje'));
    await p2.waitForSelector('.msg-assistant:has-text("Hoje é")');
    assert.match(await p2.textContent('.mic-label'), /Ouvindo|Conversando/);
    await p2.screenshot({ path: `${SHOTS}/modo-conversa.png` });
    await p2.click('.handsfree-btn');
    await p2.waitForTimeout(300);
    assert.equal(await p2.evaluate(() => window.__voice.active()), false, 'desligar a opção fecha o microfone');
    await ctx2.close();
  });

  await step('avatar 3D: mexe a boca junto com a fala e troca de modelo', async () => {
    const ctx3 = await browser.newContext({ viewport: VIEWPORTS['ipad-retrato'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const p3 = await ctx3.newPage();
    p3.on('pageerror', (e) => errors.push(`[avatar] ${e.message}`));
    // Voz simulada: começa, avisa cada palavra e termina, como o Safari.
    await p3.addInitScript(() => {
      const fake = {
        speaking: false, pending: false,
        getVoices: () => [],
        cancel() { this.speaking = false; },
        speak(u) {
          this.speaking = true;
          setTimeout(() => u.onstart?.(), 10);
          const words = [...u.text.matchAll(/\S+/g)];
          words.forEach((m, i) => setTimeout(() => u.onboundary?.({ name: 'word', charIndex: m.index }), 30 + i * 260));
          setTimeout(() => { this.speaking = false; u.onend?.(); }, 60 + words.length * 260);
        },
        addEventListener() {}, removeEventListener() {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    });
    await p3.goto(BASE, { waitUntil: 'networkidle' });
    await p3.evaluate(() => {
      window.__aicare.store.update((d) => { d.settings.onboardingDone = true; d.settings.assistant = { gender: 'female', name: 'Clara' }; });
      document.querySelector('.onboarding')?.remove();
    });
    await p3.waitForSelector('.avatar3d[data-ready]', { timeout: 30000 });
    assert.equal(await p3.getAttribute('.avatar3d', 'data-gender'), 'female');
    assert.match(await p3.textContent('.stage-note'), /não é uma pessoa real/);
    await p3.fill('#chat-input', 'que horas são');
    await p3.click('.composer-send');
    await p3.waitForSelector('.assistant[data-mode="speaking"]');
    let maxOpen = 0;
    for (let i = 0; i < 12; i++) {
      await p3.waitForTimeout(80);
      const w = await p3.evaluate(() => document.querySelector('.avatar-host').avatarApi.debug().weights);
      maxOpen = Math.max(maxOpen, ...Object.values(w));
    }
    assert.ok(maxOpen > 0.3, `boca se mexe durante a fala (máx ${maxOpen.toFixed(2)})`);
    await p3.screenshot({ path: `${SHOTS}/avatar3d-falando.png` });
    await p3.waitForSelector('.assistant[data-mode="idle"]', { timeout: 10000 });
    await p3.waitForTimeout(400);
    const after = await p3.evaluate(() => document.querySelector('.avatar-host').avatarApi.debug());
    assert.equal(after.speaking, false);
    assert.ok(Math.max(0, ...Object.values(after.weights)) < 0.1, 'boca fecha quando a fala termina');

    // Trocar para masculino troca o modelo sem recarregar.
    await p3.evaluate(() => window.__aicare.store.update((d) => { d.settings.assistant = { gender: 'male', name: 'Rafael' }; }));
    await p3.waitForSelector('.avatar3d[data-gender="male"]', { timeout: 30000 });

    // Desligar o 3D volta para a ilustração.
    await p3.evaluate(() => window.__aicare.navigate('configuracoes'));
    await p3.click('label[for="set-avatar3d"]');
    await p3.evaluate(() => window.__aicare.navigate('inicio'));
    await p3.waitForSelector('.avatar-host[data-avatar="svg"] .avatar-stage');
    assert.equal(await p3.locator('.avatar3d').count(), 0);
    await ctx3.close();
  });

  await step('sem WebGL, usa a ilustração sem erro', async () => {
    const ctx4 = await browser.newContext({ viewport: VIEWPORTS.celular, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const p4 = await ctx4.newPage();
    p4.on('pageerror', (e) => errors.push(`[sem webgl] ${e.message}`));
    await p4.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); };
    });
    await p4.goto(BASE, { waitUntil: 'networkidle' });
    await p4.evaluate(() => {
      window.__aicare.store.update((d) => { d.settings.onboardingDone = true; d.settings.assistant = { gender: 'female', name: 'Clara' }; });
      document.querySelector('.onboarding')?.remove();
    });
    await p4.waitForSelector('.avatar-host[data-avatar="svg"] .avatar-stage');
    assert.match(await p4.textContent('.stage-note'), /Avatar ilustrado/);
    await ctx4.close();
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
