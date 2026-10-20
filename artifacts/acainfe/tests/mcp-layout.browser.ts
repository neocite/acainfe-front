// Verificação visual isolada: autenticação/API simuladas só no navegador de teste.
// Uso: pnpm --filter @workspace/acainfe exec tsx tests/mcp-layout.browser.ts <URL-dev-do-app>
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const appUrl = process.argv[2];
assert.ok(appUrl, 'Informe a URL de desenvolvimento do app.');
const profile = await mkdtemp(join(tmpdir(), 'acainfe-mcp-layout-'));
const chrome = spawn('chromium', [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket: WebSocket | undefined;
let sequence = 0;
let sessionId: string | undefined;
const pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void }>();
const errors: string[] = [];
const company = {
  tenant: { id: 'layout-company', status: 'ACTIVE', taxRegime: 'SIMPLES_NACIONAL', integrations: { abacatepay: true } },
  company: { legalName: 'EMPRESA DE TESTE VISUAL' },
  availability: { status: 'AVAILABLE' }, readiness: { canIssue: true, missing: [], recommended: [] }, pendingTaxReview: 0,
};
let items: unknown[] = [{
  id: 'layout-key', label: 'Claude Code do notebook', last4: 'abcd',
  createdAt: '2026-10-20T12:00:00Z', lastUsedAt: null, createdVia: 'APP', legacy: false,
}];

function send(method: string, params: object = {}, root = false): Promise<any> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket!.send(JSON.stringify({ id, method, params, ...(!root && sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression: string): Promise<any> {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Página não chegou ao estado esperado: ${expression}`);
}

try {
  const wsUrl = await new Promise<string>((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('Chromium não iniciou.')), 15000);
    chrome.stderr.on('data', chunk => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.once('error', error => { clearTimeout(timer); reject(error); });
    chrome.once('exit', code => { clearTimeout(timer); reject(new Error(`Chromium encerrou (${code}).`)); });
  });
  socket = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    socket!.addEventListener('open', () => resolve(), { once: true });
    socket!.addEventListener('error', () => reject(new Error('Falha na conexão com o navegador.')), { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
      }
    } else if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      const description = details.exception?.description || JSON.stringify(details);
      // O proxy de desenvolvimento pode bloquear o WebSocket de hot reload.
      // Isso não é erro da página: ignorar apenas esta assinatura do Vite,
      // com aviso explícito, mantendo falhas de aplicação como erro do teste.
      if (/^Error: WebSocket closed without opened\./.test(description) && /\/@vite\/client:/.test(description)) {
        console.warn('WARN: WebSocket de hot reload indisponível no proxy dev; renderização e medidas verificadas normalmente.');
      } else errors.push(description);
    } else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const path = new URL(request.url).pathname;
      let data: unknown;
      if (path === '/api/auth/user') data = { id: 'layout-user', email: 'layout@example.test', name: 'Pessoa de teste' };
      else if (path === '/api/app/me') data = { user: { name: 'Pessoa de teste' }, companies: [company] };
      else if (path === '/api/app/companies/layout-company') data = company;
      else if (path.endsWith('/billing')) data = { amountDueCents: 0 };
      else if (path.endsWith('/products')) data = [];
      else if (path.endsWith('/mcp-keys')) data = { items };
      else data = { message: 'Rota não prevista no teste' };
      // Toda chamada /api é interceptada; nunca cria/revoga chaves reais.
      void send('Fetch.fulfillRequest', {
        requestId, responseCode: data ? 200 : 404,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(data)).toString('base64'),
      }).catch(error => errors.push(String(error)));
    }
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, true);
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, true)).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
  for (const width of [1280, 402, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    if (width === 1280) {
      await send('Page.navigate', { url: appUrl });
      await waitFor('!!document.querySelector(".mcp-key-row")');
      await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b => b.textContent.includes("Configuração")).click()');
    }
    await waitFor('!!document.querySelector(".wizard-card .mcp-keys--onboarding .mcp-key-row")');
    const layout = await evaluate(`(() => {
      const card = document.querySelector('.wizard-card');
      const form = card.querySelector('form');
      const keys = card.querySelector('.mcp-keys--onboarding');
      const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width }; };
      return { card:rect(card), form:rect(form), keys:rect(keys),
        viewport:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        generateButtons:[...keys.querySelectorAll('button')].filter(b => b.textContent.includes('Gerar nova chave')).length,
        title:keys.querySelector('h3').textContent, count:document.querySelectorAll('.mcp-keys').length };
    })()`);
    assert.equal(layout.count, 1);
    assert.equal(layout.title, 'Chaves ativas');
    assert.equal(layout.generateButtons, 0);
    assert.ok(Math.abs(layout.form.left - layout.keys.left) <= 1, JSON.stringify(layout));
    assert.ok(Math.abs(layout.form.right - layout.keys.right) <= 1, JSON.stringify(layout));
    assert.ok(layout.keys.top >= layout.form.bottom, JSON.stringify(layout));
    assert.ok(layout.keys.right <= layout.card.right, JSON.stringify(layout));
    assert.ok(layout.scrollWidth <= layout.viewport, JSON.stringify(layout));
    const metrics = await send('Page.getLayoutMetrics');
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { ...metrics.cssContentSize, scale: 1 },
    });
    const file = join(tmpdir(), `acainfe-mcp-layout-${width}.png`);
    await writeFile(file, Buffer.from(screenshot.data, 'base64'));
    console.log(`PASS ${width}px: lista dentro do card, bordas internas alinhadas, sem overflow e sem geração duplicada. ${file}`);
  }
  items = [];
  await evaluate('[...document.querySelectorAll(".mcp-keys button")].find(b => b.textContent === "Atualizar").click()');
  await waitFor('!!document.querySelector(".mcp-keys-empty")');
  assert.equal(await evaluate('document.querySelector(".mcp-keys").textContent.includes("Gerar nova chave")'), false);
  assert.ok(await evaluate('document.querySelector(".mcp-keys-empty").textContent.includes("Gere uma acima para conectar o assistente.")'));
  assert.deepEqual(errors, []);
  console.log('PASS estado vazio: orientação para o gerador acima, sem botão duplicado.');
} finally {
  socket?.close();
  await new Promise<void>(resolve => {
    if (chrome.exitCode !== null) resolve();
    else { chrome.once('exit', () => resolve()); chrome.kill('SIGTERM'); }
  });
  // Subprocessos do Chromium podem terminar de gravar após a saída do processo pai.
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
