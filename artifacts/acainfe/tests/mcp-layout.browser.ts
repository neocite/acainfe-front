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
let publicPrice = 123;
let keyListRequests = 0;
const company = {
  tenant: { id: 'layout-company', status: 'ACTIVE', taxRegime: 'SIMPLES_NACIONAL', integrations: { abacatepay: true } },
  abacatepay: { connected: true, connectedAt: '2026-10-01T12:00:00Z', webhookEndpoint: 'https://old.example.test/hooks/abacatepay', webhookUpToDate: false as boolean | null, defaultProduct: { decided: false, productId: null as string | null } },
  company: { legalName: 'EMPRESA DE TESTE VISUAL' },
  availability: { status: 'AVAILABLE' }, readiness: { canIssue: true, missing: [], recommended: [{field:'defaultProduct',message:'Escolha o produto padrão para pagamentos sem produto.'}] }, pendingTaxReview: 0,
};
const fiscal = {
  company: { cnpj: '12345678000195', legalName: 'EMPRESA DE TESTE VISUAL', tradeName: 'Negócio de teste',
    municipalRegistration: '123456', city: { code: '3548708', name: 'São Bernardo do Campo', uf: 'SP' },
    taxRegimeLabel: 'Simples Nacional', simplesNacionalTaxRateBps: 600, simplesRateIsEstimate: true,
    cnaes: [{ code: '6201-5/01', description: 'Desenvolvimento de software', primary: true }] },
  emission: { systemLabel: 'GINFES', environment: 'PRODUCTION', approvalRequired: false, series: '900', nextNumber: 1 },
  issRate: { bps: 201, source: 'SIMPLES_ESTIMATE' },
  approximateTaxes: { rateBps: 1553, descriptionTemplate: 'Valor aprox dos tributos: R$ [ValorTributos]. Fonte: IBPT' },
  certificate: { present: true, expiresAt: '2027-12-31', expired: false, daysUntilExpiry: 437 },
  accountant: { name: 'Contabilidade de teste', email: 'contador@example.test' },
  products: [{ name: 'Assinatura de software', status: 'PENDING_REVIEW', nationalServiceCode: '010701', localServiceCode: '0107', nbsCode: '115022000', warnings: ['Confirme a sugestão de tributação com seu contador antes de emitir.'] }],
  readiness: { missing: [], recommended: [{ field: 'approximateTaxes', message: 'Confirme o percentual do IBPT com seu contador.' }] },
  text: 'Resumo fiscal para conferência.',
};
let items: unknown[] = [{
  id: 'layout-key', label: 'Claude Code do notebook', last4: 'abcd',
  createdAt: '2026-10-20T12:00:00Z', lastUsedAt: null, createdVia: 'APP', legacy: false,
}];
const webhookCalls: { method: string; body: unknown }[] = [];
const decisionCalls: unknown[] = [];
const gatewayCalls: unknown[] = [];
const pastPeriod = { period:'2026-10',isCurrentMonth:true,requiresConfirmation:false,available:{count:1,totalCents:10000,withoutItems:0},alreadyIssued:0,imported:0,refunded:0,ignored:0 };
let pastItem = { id:'sale-test',paidAt:'2026-10-10T12:00:00Z',amountCents:10000,status:'AVAILABLE',ignoredReason:'' };

function send(method: string, params: object = {}, root = false): Promise<any> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket!.send(JSON.stringify({ id, method, params, ...(!root && sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression: string): Promise<any> {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  console.error('Estado ao expirar espera:', await evaluate(`({url:location.href,scrollY,viewport:innerHeight,
    anchors:[...document.querySelectorAll('main section[id]')].map(el=>({id:el.id,top:el.getBoundingClientRect().top}))})`));
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
      let responseCode = 200;
      if (path === '/api/public/pricing') data = { pricePerInvoiceCents: publicPrice, monthlyFeeCents: 0 };
      else if (path === '/api/auth/user') data = { id: 'layout-user', email: 'layout@example.test', name: 'Pessoa de teste' };
      else if (path === '/api/app/me') data = { user: { name: 'Pessoa de teste' }, companies: [company] };
      else if (path === '/api/app/companies/layout-company') data = company;
      else if (path.endsWith('/billing')) data = { amountDueCents: 0 };
      else if (path.endsWith('/mcp-connection')) data = {mcpUrl:'https://example.test/mcp',keyPlaceholder:'<SUA_CHAVE>',authorizationHeader:'Authorization: Bearer <SUA_CHAVE>',claudeCodeCommand:'claude mcp add acainfe -H "Authorization: Bearer <SUA_CHAVE>"',jsonConfig:{mcpServers:{acainfe:{url:'https://example.test/mcp',headers:{Authorization:'Bearer <SUA_CHAVE>'}}}}};
      else if (path.endsWith('/products')) data = [{id:'product-test',name:'Curso de teste'}];
      else if (path.endsWith('/abacatepay/default-product')) {
        const body=JSON.parse(request.postData!); decisionCalls.push(body);
        company.abacatepay.defaultProduct={decided:true,productId:body.productId};
        company.readiness.recommended=[];
        data={defaultProduct:company.abacatepay.defaultProduct};
      }
      else if (path.endsWith('/abacatepay')) {
        gatewayCalls.push(JSON.parse(request.postData!));
        company.abacatepay.connected=true;
        data={imported:1,pendingTaxReview:[{id:'product-test',name:'Curso de teste'}],skippedTestProducts:['Teste'],mergedDuplicates:[],pastSales:{periods:[pastPeriod]},defaultProduct:{decided:false,productId:null,suggestedProductId:'product-test',options:[{id:'product-test',name:'Curso de teste'}]}};
      }
      else if (path.endsWith('/past-sales/items')) data={items:[pastItem]};
      else if (path.endsWith('/past-sales/ignore')) {
        const body=JSON.parse(request.postData!);
        pastItem={...pastItem,status:body.ignored?'IGNORED':'AVAILABLE',ignoredReason:body.reason||''};
        pastPeriod.ignored=body.ignored?1:0;pastPeriod.available.count=body.ignored?0:1;
        data={};
      }
      else if (path.endsWith('/past-sales')) data={periods:[pastPeriod]};
      else if (path.endsWith('/mcp-keys')) { keyListRequests++; data = { items }; }
      else if (path.endsWith('/fiscal-settings')) data = fiscal;
      else if (path.endsWith('/abacatepay/webhook') && request.method === 'POST') {
        const body = request.postData ? JSON.parse(request.postData) : undefined;
        webhookCalls.push({ method: request.method, body });
        if (!body?.apiKey) { responseCode = 403; data = { message: 'Permissão WEBHOOK:CREATE necessária.' }; }
        else {
          const previous = { webhookId: 'old-hook', endpoint: company.abacatepay.webhookEndpoint };
          company.abacatepay.webhookEndpoint = 'https://current.example.test/hooks/abacatepay';
          company.abacatepay.webhookUpToDate = true;
          data = { webhookId: 'new-hook', endpoint: company.abacatepay.webhookEndpoint, previous };
        }
      }
      else data = { message: 'Rota não prevista no teste' };
      // Toda chamada /api é interceptada; nunca cria/revoga chaves reais.
      void send('Fetch.fulfillRequest', {
        requestId, responseCode: data ? responseCode : 404,
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
  // Testar a apresentação pública com preço vivo, isolando as chamadas de API no próprio browser.
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const publicUrl = new URL(appUrl); publicUrl.pathname = '/'; publicUrl.search = ''; publicUrl.hash = '';
  await send('Page.navigate', { url: publicUrl.toString() });
  await waitFor('document.querySelector(".csr-proofline strong")?.textContent.replace(/\\s+/g, " ").includes("R$ 1,23")');
  const landing = await evaluate(`(() => ({
    price:document.querySelector('.csr-proofline strong').textContent.replace(/\\s+/g,' ').trim(),
    monthly:document.querySelector('.csr-result-meta').textContent.replace(/\\s+/g,' ').trim(),
    calculator:document.querySelector('.csr-result-main strong').textContent.replace(/\\s+/g,' ').trim(),
    heroLinks:[...document.querySelectorAll('.csr-hero-actions a')].map(a=>({text:a.textContent.replace(/[↗↓]/g,'').trim(),href:a.getAttribute('href')})),
    login:document.querySelector('.csr-nav-link').getAttribute('href'),
    footer:document.querySelector('.csr-footer').textContent.replace(/\\s+/g,' ').trim(),
    emailHref:document.querySelector('.csr-company a')?.getAttribute('href'),
    sectionOrder:[...document.querySelectorAll('main section[id]')].map(el=>el.id),
    text:document.querySelector('main').textContent.replace(/\\s+/g,' ')
  }))()`);
  assert.ok(landing.price.includes('R$ 1,23'), JSON.stringify(landing));
  assert.ok(landing.monthly.includes('Sem mensalidade'), JSON.stringify(landing));
  assert.ok(landing.text.includes('R$ 1,23 por nota emitida com sucesso'), JSON.stringify(landing.text));
  assert.ok(!landing.text.includes('R$ 0,80'), JSON.stringify(landing.text));
  await evaluate('document.fonts.ready.then(() => true)');
  // Navegação rápida entre âncoras não deve competir com a animação de scroll no teste.
  await evaluate('document.documentElement.style.scrollBehavior = "auto"');
  assert.ok(landing.calculator.includes('R$ 59,04'), landing.calculator);
  assert.ok(landing.text.includes('Cada pagamento aprovado no AbacatePay vira uma NFS-e'), landing.text);
  assert.ok(!/hotmart/i.test(landing.text), landing.text);
  assert.ok(landing.footer.includes('marca da Extractify') && landing.footer.includes('CNPJ: 28.095.894/0001-60'), landing.footer);
  assert.ok(landing.footer.includes('contato@extractify.com.br'), landing.footer);
  assert.equal(landing.emailHref, 'mailto:contato@extractify.com.br');
  assert.deepEqual(landing.heroLinks.map((link: { text: string }) => link.text), ['Começar agora', 'Ver como funciona']);
  assert.equal(landing.heroLinks[0].href, '/app');
  assert.equal(landing.heroLinks[1].href, '#como-funciona');
  assert.equal(landing.login, '/app');
  assert.ok(!landing.text.includes('Começar grátis'));
  assert.deepEqual(landing.sectionOrder, ['simulador', 'como-funciona', 'so-paga-se-vender', 'disponibilidade', 'duvidas', 'comece']);
  await evaluate('document.querySelector(".csr-hero-actions a[href=\\"#como-funciona\\"]").click()');
  await waitFor('location.hash === "#como-funciona" && document.querySelector("#como-funciona").getBoundingClientRect().top >= 0 && document.querySelector("#como-funciona").getBoundingClientRect().top < 100');
  for (const id of ['simulador', 'como-funciona', 'disponibilidade', 'duvidas']) {
    await evaluate(`document.querySelector('.csr-nav nav a[href="#${id}"]').click()`);
    await waitFor(`location.hash === "#${id}" && document.querySelector("#${id}").getBoundingClientRect().top >= -1 && document.querySelector("#${id}").getBoundingClientRect().top < innerHeight / 2`);
  }
  await evaluate('document.querySelectorAll(".csr-faq-list summary")[0].click()');
  assert.equal(await evaluate('document.querySelector(".csr-faq-list details").open'), true);
  for (const title of ['Termos de uso', 'Política de privacidade', 'Contato']) {
    await evaluate(`[...document.querySelectorAll('.csr-footer-legal button')].find(b=>b.textContent==='${title}').click()`);
    await waitFor(`document.querySelector('.ac-modal h3')?.textContent === '${title}'`);
    if (title === 'Contato') {
      assert.equal(await evaluate('document.querySelector(".ac-modal a")?.getAttribute("href")'), 'mailto:contato@extractify.com.br');
      assert.ok((await evaluate('document.querySelector(".ac-modal p").textContent')).includes('contato@extractify.com.br'));
    }
    await evaluate('[...document.querySelectorAll(".ac-modal button")].find(b=>b.textContent==="Fechar").click()');
    await waitFor('!document.querySelector(".ac-modal")');
  }
  publicPrice = 80;
  await send('Page.navigate', { url: publicUrl.toString() });
  await waitFor('document.querySelector(".csr-result-main strong")?.textContent.replace(/\\s+/g, " ").includes("R$ 38,40")');
  for (const width of [1280, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const value of [12, 48, 126]) {
      await evaluate(`[...document.querySelectorAll('.csr-presets button')].find(b=>b.textContent.includes('${value} notas')).click()`);
      await waitFor(`document.querySelector('#csr-invoices').value === '${value}'`);
      assert.ok((await evaluate('document.querySelector(".csr-result-main strong").textContent')).replace(/\s+/g, ' ').includes(
        new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(value * .8).replace(/\s+/g,' ')));
    }
    await evaluate('document.querySelector("#csr-invoices").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await waitFor('document.querySelector("#csr-invoices").value === "127"');
    await evaluate(`(() => { const input=document.querySelector('#csr-ticket');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'100.50');
      input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor('document.querySelector(".csr-result p").textContent.includes("0,80%")');
    assert.ok(!(await evaluate('document.querySelector(".csr-meter span").style.width')).includes('NaN'));
    await evaluate(`(() => { const input=document.querySelector('#csr-invoices');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0');
      input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor('document.querySelector(".csr-result p").textContent.includes("0,00%")');
    assert.ok((await evaluate('document.querySelector(".csr-result-main strong").textContent')).replace(/\s+/g,' ').includes('R$ 0,00'));
    await evaluate(`(() => { const input=document.querySelector('#csr-ticket');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'197');
      input.dispatchEvent(new Event('input',{bubbles:true}));
      [...document.querySelectorAll('.csr-presets button')].find(b=>b.textContent.includes('48 notas')).click(); })()`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const bounds = await evaluate('(() => {const r=document.querySelector(".csr-hero").getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
    const image = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true,clip:bounds});
    await writeFile(join(tmpdir(), `acainfe-studio-${width}.png`), Buffer.from(image.data,'base64'));
    console.log(`PASS studio ${width}px: preço da API, presets, teclado, ticket decimal, mês sem venda e sem overflow.`);
  }
  for (const width of [1280, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const footer = await evaluate(`(() => {
      const root=document.documentElement, section=document.querySelector('.csr-footer');
      const company=document.querySelector('.csr-company'), email=company.querySelector('a');
      const data=[...company.querySelectorAll('span')].map(span=>span.textContent.trim());
      return {pageWidth:root.scrollWidth,viewportWidth:innerWidth,
        brand:data[0],cnpj:data[1],email:email.textContent.trim(),
        emailHref:email.getAttribute('href'),companyWidth:company.getBoundingClientRect().width,
        companyScrollWidth:company.scrollWidth};
    })()`);
    assert.ok(footer.pageWidth <= footer.viewportWidth, JSON.stringify(footer));
    assert.equal(footer.brand, 'O açaínfe é uma marca da Extractify.');
    assert.equal(footer.cnpj, 'CNPJ: 28.095.894/0001-60');
    assert.equal(footer.email, 'contato@extractify.com.br');
    assert.equal(footer.emailHref, 'mailto:contato@extractify.com.br');
    assert.ok(footer.companyScrollWidth <= footer.companyWidth + 1, JSON.stringify(footer));
    await evaluate('document.querySelector(".csr-footer").scrollIntoView({behavior:"instant"})');
    const footerShot = await send('Page.captureScreenshot', {format:'png'});
    await writeFile(join(tmpdir(), `acainfe-extractify-footer-${width}.png`), Buffer.from(footerShot.data,'base64'));
    console.log(`PASS rodapé Extractify/CNPJ/e-mail ${width}px: conteúdo visível, link e largura sem overflow.`);
  }
  await evaluate('document.querySelector(".csr-disclosure").click()');
  await waitFor('!!document.querySelector("#csr-calculation-details")');
  await evaluate('document.querySelector("#csr-calculation-details button").click()');
  await waitFor('document.querySelector(".csr-comparison-dialog").open');
  await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor('!document.querySelector(".csr-comparison-dialog").open');
  await evaluate('document.querySelector("#csr-calculation-details button").click()');
  await waitFor('!!document.querySelector("#invoice-count")');
  const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100).replace(/\s+/g, ' ');
  const readCalculator = () => evaluate(`(() => {
    const text = el => el.textContent.replace(/\\s+/g,' ').trim();
    return { count:document.querySelector('#invoice-count').value, slider:document.querySelector('.ac-calc__range').value,
      result:text(document.querySelector('.ac-calc__hero-result > strong')), secondary:text(document.querySelector('.ac-calc__hero-result p')),
      truth:text(document.querySelector('.ac-calc__truth')),
      rows:[...document.querySelectorAll('.ac-rank-row')].map(row=>({name:row.dataset.plan,cost:text(row.querySelector('.ac-rank-row__cost')),difference:text(row.querySelector('.ac-rank-row__difference'))})) };
  })()`);
  const setNotes = async (count: number) => {
    await evaluate(`(() => { const input = document.querySelector('#invoice-count');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, '${count}');
      input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor(`document.querySelector('#invoice-count').value === '${count}' && document.querySelector('.ac-calc__range').value === '${count}'`);
  };
  let calculator = await readCalculator();
  assert.equal(calculator.count, '48');
  await setNotes(30);
  calculator = await readCalculator();
  assert.ok(calculator.truth.includes('R$ 1.992,00'), calculator.truth);
  assert.equal(await evaluate('document.querySelector(".ac-calc__hero-result").getAttribute("aria-live")'), 'polite');
  const names = ['Focus NFe Solo', 'Notazz Bronze', 'eNotas Basic', 'NFE.io Base'];
  const samples: [number, (number | null)[]][] = [
    [0, [9490, 13390, 13700, 19000]], [10, [9490, 13390, 13700, 19000]],
    [50, [9490, 13390, 13700, 19000]], [100, [9490, 13390, 16780, 19000]],
    [150, [10040, null, 20630, 19000]], [122, [9732, null, 18474, 19000]],
    [500, [13890, null, 47580, null]],
  ];
  for (const [count, costs] of samples) {
    await setNotes(count);
    for (const multiplier of [1, 12]) {
      await evaluate(`[...document.querySelectorAll('.ac-calc__period button')].find(b=>b.textContent==='${multiplier === 1 ? 'Por mês' : 'Por ano'}').click()`);
      calculator = await readCalculator();
      assert.ok(calculator.result.startsWith(money(count * 80 * multiplier)), JSON.stringify(calculator));
      for (const [i, cost] of costs.entries()) {
        const row = calculator.rows.find((row: any) => row.name === names[i]);
        assert.equal(row.cost, cost === null ? 'Acima do plano — consulte' : money(cost * multiplier));
        if (cost !== null && cost !== count * 80) {
          assert.ok(row.difference.includes(money(Math.abs(cost - count * 80) * multiplier)), JSON.stringify(row));
        }
      }
      const expectedOrder = names.map((name, i) => ({name,cost:costs[i]})).sort((a,b)=>(a.cost ?? Infinity)-(b.cost ?? Infinity)).map(row=>row.name);
      assert.deepEqual(calculator.rows.map((row: any) => row.name), expectedOrder);
      assert.ok(calculator.truth.includes(count >= 122 ? 'Focus NFe Solo sai mais barato' : 'açaínfe é a opção mais barata'), calculator.truth);
    }
    console.log(`PASS calculadora ${count} notas: valores, ordem, diferenças, mês/ano e mensagem honesta.`);
  }
  for (const value of [10, 50, 100, 200]) {
    await evaluate(`[...document.querySelectorAll('.ac-calc__presets button')].find(b=>b.textContent==='${value}').click()`);
    assert.equal((await readCalculator()).count, String(value));
    assert.equal((await readCalculator()).slider, String(value));
  }
  await evaluate('document.querySelector(".ac-calc__range").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await waitFor('document.querySelector("#invoice-count").value === "201"');
  for (const width of [1280, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await evaluate('document.querySelector("#comparador").scrollIntoView({behavior:"instant"})');
    const slider = await evaluate('(() => { const r=document.querySelector(".ac-calc__range").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}; })()');
    assert.ok(slider.height >= 40, JSON.stringify(slider));
    await send('Input.dispatchMouseEvent', { type:'mousePressed',x:slider.x+slider.width*.4,y:slider.y+slider.height/2,button:'left',clickCount:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseMoved',x:slider.x+slider.width*.8,y:slider.y+slider.height/2,button:'left',buttons:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseReleased',x:slider.x+slider.width*.8,y:slider.y+slider.height/2,button:'left',clickCount:1 });
    calculator = await readCalculator();
    assert.equal(calculator.count, calculator.slider);
    assert.ok(Number(calculator.count) > 300, JSON.stringify(calculator));
    await evaluate('document.querySelector(".ac-calc__details").open=true');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    if (width === 360) {
      assert.equal(await evaluate('document.querySelector(".ac-calc__details .ac-tablewrap").scrollWidth > document.querySelector(".ac-calc__details .ac-tablewrap").clientWidth'), true);
      assert.equal(await evaluate('document.querySelector(".csr-comparison-dialog").scrollWidth <= document.querySelector(".csr-comparison-dialog").clientWidth'), true);
    }
    const clip = await evaluate('(() => {const r=document.querySelector(".csr-comparison-dialog").getBoundingClientRect(); return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
    const shot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true,clip});
    await writeFile(join(tmpdir(), `acainfe-calculator-${width}.png`), Buffer.from(shot.data,'base64'));
    console.log(`PASS calculadora ${width}px: slider arrastável e teclado, controles sincronizados, tabela contida e sem overflow.`);
  }
  await evaluate('document.querySelector(".csr-comparison-dialog").close()');
  console.log('PASS landing: design graduado, preço da API, FAQ, links legais, navegação, simulador e comparação preservada.');
  for (const width of [1280, 402, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    if (width === 1280) {
      await send('Page.navigate', { url: appUrl });
      await waitFor('!!document.querySelector(".company-summary")');
      assert.equal(await evaluate('!!document.querySelector(".mcp-keys")'),false);
      await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b=>b.textContent.includes("Agentes de IA")).click()');
      await waitFor('!!document.querySelector(".mcp-key-row")');
    }
    await waitFor('!!document.querySelector(".ai-agents .mcp-key-row")');
    const layout = await evaluate(`(() => {
      const card = document.querySelector('.ai-agents');
      const keys = card.querySelector('.mcp-keys');
      const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width }; };
      return { card:rect(card), keys:rect(keys),
        viewport:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        generateButtons:[...keys.querySelectorAll('button')].filter(b => b.textContent.includes('Gerar nova chave')).length,
        title:keys.querySelector('h3').textContent, count:document.querySelectorAll('.mcp-keys').length };
    })()`);
    assert.equal(layout.count, 1);
    assert.equal(layout.title, 'Chaves ativas');
    assert.equal(layout.generateButtons, 0);
    assert.ok(layout.keys.left >= layout.card.left, JSON.stringify(layout));
    assert.ok(layout.keys.right <= layout.card.right, JSON.stringify(layout));
    assert.ok(layout.scrollWidth <= layout.viewport, JSON.stringify(layout));
    const metrics = await send('Page.getLayoutMetrics');
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { ...metrics.cssContentSize, scale: 1 },
    });
    const file = join(tmpdir(), `acainfe-ai-agents-${width}.png`);
    await writeFile(file, Buffer.from(screenshot.data, 'base64'));
    console.log(`PASS Agentes de IA ${width}px: instruções, lista e gerador separados, sem overflow. ${file}`);
  }
  items = [];
  await evaluate('[...document.querySelectorAll(".mcp-keys button")].find(b => b.textContent === "Atualizar").click()');
  await waitFor('!!document.querySelector(".mcp-keys-empty")');
  assert.equal(await evaluate('document.querySelector(".mcp-keys").textContent.includes("Gerar nova chave")'), false);
  assert.ok(await evaluate('document.querySelector(".mcp-keys-empty").textContent.includes("Gere uma chave abaixo para conectar o agente.")'));
  assert.deepEqual(errors, []);
  await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b=>b.textContent.includes("Início")).click()');
  await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Gerar minha chave"))');
  assert.equal(await evaluate('!!document.querySelector(".mcp-keys")'),false);
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Concluir").click()');
  await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b => b.textContent.includes("Minha empresa")).click()');
  await waitFor('!!document.querySelector(".company-summary .text-button")');
  assert.equal(await evaluate('!!document.querySelector(".mcp-keys")'),false);
  items = [{ id:'panel-key',label:'Assistente do painel',last4:'abcd',legacy:false,createdVia:'APP',createdAt:'2026-10-19T12:00:00Z' }];
  assert.equal(await evaluate('!!document.querySelector(".gateway-panel-summary")'),false);
  assert.equal(await evaluate('!!document.querySelector(".company-recommendations")'),false);
  await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b=>b.textContent.includes("Gateways de pagamento")).click()');
  await waitFor('!!document.querySelector(".ap-webhook-card")');
  await evaluate('[...document.querySelectorAll(".ap-webhook-card button")].find(b=>b.textContent==="Alterar").click()');
  await waitFor('!!document.querySelector(".default-product-choice")');
  for(const width of [1280,360]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('Promise.all(document.querySelector("[role=dialog]").getAnimations().map(a=>a.finished)).then(()=>true)');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(join(tmpdir(),`acainfe-default-product-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate('document.querySelector(".default-product-choice input[value=product-test]").click()');
  await evaluate('document.querySelector("form.default-product-choice").requestSubmit()');
  await waitFor('!document.querySelector("[role=dialog]") && document.querySelector(".ap-webhook-card").textContent.includes("Curso de teste")');
  assert.deepEqual(decisionCalls,[{productId:'product-test'}]);
  assert.equal(await evaluate('!!document.querySelector(".company-recommendations")'),false);
  await evaluate('[...document.querySelectorAll(".ap-webhook-card button")].find(b=>b.textContent==="Alterar").click()');
  await waitFor('!!document.querySelector(".default-product-choice")');
  await evaluate('document.querySelector(".default-product-choice input[value=__none__]").click();document.querySelector("form.default-product-choice").requestSubmit()');
  await waitFor('!document.querySelector("[role=dialog]") && document.querySelector(".ap-webhook-card").textContent.includes("Nenhum")');
  assert.deepEqual(decisionCalls.at(-1),{productId:null});
  console.log('PASS produto padrão: escolha exclusiva nos gateways, salva produto, atualiza nome e permite nenhum.');
  // O webhook usa respostas simuladas no navegador; nenhuma integração real é alterada.
  for (const width of [1280, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await waitFor('!!document.querySelector(".ap-webhook-warning")');
    await evaluate('document.querySelector(".ap-webhook-card").scrollIntoView({block:"center"})');
    const layout = await evaluate(`(() => {
      const card=document.querySelector('.ap-webhook-card'),r=card.getBoundingClientRect();
      return {text:card.textContent, width:r.width,left:r.left,right:r.right,scroll:document.documentElement.scrollWidth,viewport:innerWidth};
    })()`);
    assert.ok(layout.text.includes('Conectado desde 01/10/2026') && layout.text.includes('As vendas novas não estão virando nota.'));
    assert.ok(layout.scroll <= layout.viewport && layout.left >= 0 && layout.right <= width, JSON.stringify(layout));
    assert.equal(await evaluate('!!document.querySelector(".mcp-keys")'),false);
    const cardClip = await evaluate('(() => {const r=document.querySelector(".ap-webhook-card").getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
    let shot = await send('Page.captureScreenshot', { format:'png',captureBeyondViewport:true,clip:cardClip });
    await writeFile(join(tmpdir(),`acainfe-webhook-card-${width}.png`),Buffer.from(shot.data,'base64'));
    await evaluate('document.querySelector(".ap-webhook-warning button").click()');
    await waitFor('!!document.querySelector(".ap-webhook-dialog")');
    await evaluate('Promise.all(document.querySelector(".ap-webhook-dialog").getAnimations().map(animation=>animation.finished)).then(()=>true)');
    assert.equal(await evaluate('document.querySelector(".ap-webhook-dialog").scrollWidth <= document.querySelector(".ap-webhook-dialog").clientWidth'), true);
    assert.ok(await evaluate('document.querySelector(".ap-webhook-dialog").textContent.includes("O antigo deixa de funcionar.")'));
    const dialogLayout = await evaluate('(() => {const r=document.querySelector(".ap-webhook-dialog").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()');
    assert.ok(dialogLayout.left >= 0 && dialogLayout.right <= width && dialogLayout.top >= 0 && dialogLayout.bottom <= 901, JSON.stringify(dialogLayout));
    // O diálogo é fixo: capturar o viewport, não um recorte com scroll da página.
    shot = await send('Page.captureScreenshot', { format:'png',captureBeyondViewport:false });
    await writeFile(join(tmpdir(),`acainfe-webhook-dialog-${width}.png`),Buffer.from(shot.data,'base64'));
    await evaluate('[...document.querySelectorAll(".ap-webhook-dialog button")].find(b=>b.textContent==="Cancelar").click()');
    await waitFor('!document.querySelector(".ap-webhook-dialog")');
    console.log(`PASS webhook ${width}px: card e confirmação alinhados, sem overflow e cancelar sem POST.`);
  }
  assert.equal(webhookCalls.length, 0);
  await evaluate('document.querySelector(".ap-webhook-warning button").click()');
  await waitFor('!!document.querySelector(".ap-webhook-dialog")');
  await evaluate('document.querySelector(".ap-webhook-dialog form").requestSubmit()');
  await waitFor('!!document.querySelector("#abacatepay-webhook-api-key")');
  assert.equal(await evaluate('document.querySelector(".ap-webhook-dialog").scrollWidth <= document.querySelector(".ap-webhook-dialog").clientWidth'), true);
  await evaluate(`(() => {
    const input=document.querySelector('#abacatepay-webhook-api-key');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'test-browser-key');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await evaluate('document.querySelector(".ap-webhook-dialog form").requestSubmit()');
  await waitFor('!!document.querySelector(".ap-webhook-status-ok") && !!document.querySelector(".ap-webhook-created")');
  assert.deepEqual(webhookCalls, [{method:'POST',body:undefined},{method:'POST',body:{apiKey:'test-browser-key'}}]);
  assert.ok(await evaluate('document.querySelector(".ap-webhook-created").textContent.includes("https://old.example.test/hooks/abacatepay")'));
  console.log('PASS webhook: POST vazio, permissão, retry com API key, recarga da empresa, selo ativo e exclusão manual do antigo.');
  assert.ok(await evaluate('[...document.querySelectorAll(".ap-webhook-card button")].some(b=>b.textContent==="Recriar webhook")'));
  await evaluate('[...document.querySelectorAll(".ap-webhook-card button")].find(b=>b.textContent==="Atualizar API key").click()');
  await waitFor('!!document.querySelector(".pg-update input[type=password]")');
  for (const width of [1280,360]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    const clip=await evaluate('(() => {const r=document.querySelector(".pg-screen").getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
    const shot=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});
    await writeFile(join(tmpdir(),`acainfe-gateways-update-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate(`(() => {const input=document.querySelector('.pg-update input[type=password]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'fixture-updated-key');
    input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate('document.querySelector(".pg-update form").requestSubmit()');
  await waitFor('!!document.querySelector(".pg-result")');
  assert.deepEqual(gatewayCalls,[{apiKey:'fixture-updated-key',scanPastSales:true}]);
  assert.equal(await evaluate('document.querySelector(".pg-update input[type=password]").value'),'');
  assert.ok(await evaluate('document.querySelector(".pg-result").textContent.includes("1 produto importado")'));
  assert.equal(webhookCalls.length,2);
  await evaluate('document.querySelector(".pg-back").click()');
  await waitFor('!!document.querySelector(".ap-webhook-card")');
  await evaluate('[...document.querySelectorAll(".ap-webhook-card button")].find(b=>b.textContent==="Vendas sem nota").click()');
  await waitFor('!!document.querySelector(".past-sales")');
  assert.equal(await evaluate('!!document.querySelector(".wizard-layout")'),false);
  console.log('PASS gateways: atualizar key sem recriar webhook, resumo, limpeza do segredo e vendas antigas sem onboarding; desktop/celular sem overflow.');
  await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b=>b.textContent.includes("Minha empresa")).click()');
  await waitFor('!!document.querySelector(".company-summary")');
  for(const width of [1280,360]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('window.scrollTo({top:0,behavior:"instant"})');
    assert.equal(await evaluate('!!document.querySelector(".gateway-panel-summary") || !!document.querySelector(".ap-webhook-card")'),false);
    assert.equal(await evaluate('[...document.querySelectorAll(".app-tabs button")].some(b=>b.textContent.trim()==="Dados fiscais" || b.textContent.trim()==="Painel")'),false);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(join(tmpdir(),`acainfe-minha-empresa-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate('document.querySelector(".company-summary .text-button").click()');
  await waitFor('!!document.querySelector(".fs-card")');
  assert.ok(await evaluate('document.querySelector(".app-tabs .active").textContent.includes("Minha empresa") && !!document.querySelector(".company-fiscal-view")'));
  for (const width of [1280, 402, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const layout = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.fs-card')];
      const rects = cards.map(el => { const r=el.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; });
      return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        rects, headings:cards.map(el=>el.getAttribute('aria-label')), text:document.querySelector('.fs-wrap').textContent,
        emissionControls:document.querySelector('[aria-label="Emissão"]').querySelectorAll('input,select,button').length};
    })()`);
    assert.ok(layout.scrollWidth <= layout.viewport, JSON.stringify(layout));
    assert.ok(layout.rects.every((r: any) => r.left >= 0 && r.right <= width && r.width > 0));
    assert.equal(layout.emissionControls, 0);
    assert.ok(layout.text.includes('2,01%') && layout.text.includes('15,53%'));
    assert.equal(layout.text.includes('Modo teste'), false);
    for (const title of ['Empresa', 'Emissão', 'Tributação padrão dos produtos', 'ISS', 'Tributos aproximados', 'Certificado A1', 'Contador', 'Produtos', 'Pendências']) assert.ok(layout.headings.includes(title));
    if (width < 500) assert.ok(layout.rects.every((r: any) => Math.abs(r.left - layout.rects[0].left) < 1 && Math.abs(r.width - layout.rects[0].width) < 1));
    const metrics = await send('Page.getLayoutMetrics');
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...metrics.cssContentSize, scale: 1 } });
    const file = join(tmpdir(), `acainfe-fiscal-layout-${width}.png`);
    await writeFile(file, Buffer.from(screenshot.data, 'base64'));
    console.log(`PASS dados fiscais ${width}px: navegação pelo card, dados e tabela responsiva, ambiente somente leitura, sem overflow. ${file}`);
  }
  // Retomar a etapa 3 com os novos dados sem tocar na autenticação real.
  Object.assign(company, { emission: fiscal.emission, approximateTaxes: fiscal.approximateTaxes,
    readiness: { canIssue: false, missing: [{ field: 'municipalRegistration', message: 'A prefeitura exige seu CCM.' }], recommended: [{ field: 'approximateTaxes', message: 'Confirme o IBPT.' }] } });
  await send('Page.navigate', { url: appUrl });
  await waitFor('!!document.querySelector(".approximate-taxes-fields")');
  for (const width of [1280, 360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.equal(await evaluate('document.querySelector(".tax-preview").textContent.includes("R$ 15,53")'), true);
    const metrics = await send('Page.getLayoutMetrics');
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...metrics.cssContentSize, scale: 1 } });
    const file = join(tmpdir(), `acainfe-fiscal-onboarding-${width}.png`);
    await writeFile(file, Buffer.from(screenshot.data, 'base64'));
    console.log(`PASS etapa 3 ${width}px: campos fiscais e prévia sem overflow. ${file}`);
  }
  assert.deepEqual(errors, []);
  Object.assign(company,{readiness:{canIssue:true,missing:[],recommended:[]}});
  company.abacatepay.connected=false;
  await send('Page.navigate',{url:appUrl});
  await waitFor('!!document.querySelector(".app-tabs")');
  await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b=>b.textContent.includes("Minha empresa")).click()');
  await waitFor('!!document.querySelector(".company-summary")');
  assert.equal(await evaluate('!!document.querySelector(".ap-webhook-card")'), false);
  await evaluate('[...document.querySelectorAll(".app-tabs button")].find(b=>b.textContent.includes("Gateways de pagamento")).click()');
  await waitFor('!!document.querySelector(".ap-webhook-card")');
  await evaluate('[...document.querySelectorAll(".ap-webhook-card button")].find(b=>b.textContent==="Conectar AbacatePay").click()');
  await waitFor('!!document.querySelector(".abacatepay-step input[type=password]")');
  await evaluate(`(() => {const input=document.querySelector('.abacatepay-step input[type=password]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'test-key');
    input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate('document.querySelector(".abacatepay-step form").requestSubmit()');
  await waitFor('!!document.querySelector(".default-product-choice")');
  assert.equal(await evaluate('document.querySelector(".default-product-choice input[value=product-test]").checked'),true);
  assert.equal(await evaluate('!!document.querySelector(".past-sales")'),false);
  await evaluate('document.querySelector(".default-product-choice").requestSubmit()');
  await waitFor('!!document.querySelector(".past-sales-period")');
  await evaluate('[...document.querySelectorAll(".past-sales-period button")].find(b=>b.textContent==="Revisar vendas").click()');
  await waitFor('!!document.querySelector(".past-sales-review tbody tr")');
  await evaluate('document.querySelector(".past-sales-review button[aria-label^=\\"Ignorar venda\\"]").click()');
  await waitFor('!!document.querySelector(".ps-reason")');
  await evaluate(`(() => {const input=document.querySelector('.ps-reason');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'pagamento de teste');
    input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate('[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent==="Confirmar").click()');
  await waitFor('document.querySelector(".past-sales-review").textContent.includes("Ignorada: pagamento de teste")');
  for(const width of [1280,360]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    const overflow=await evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll("body *")].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0}).slice(0,12).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width}))})');
    assert.ok(overflow.scroll<=overflow.viewport,JSON.stringify(overflow));
    const clip=await evaluate('(() => {const r=document.querySelector(".past-sales-review").getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
    await writeFile(join(tmpdir(),`acainfe-ignored-sales-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate('[...document.querySelectorAll(".past-sales-review button")].find(b=>b.textContent==="Desfazer").click()');
  await waitFor('!document.querySelector(".past-sales-review").textContent.includes("Ignorada: pagamento de teste")');
  console.log('PASS onboarding produto sugerido e obrigatório; vendas ignoradas com motivo e desfazer em desktop/celular.');
} finally {
  socket?.close();
  await new Promise<void>(resolve => {
    if (chrome.exitCode !== null) resolve();
    else { chrome.once('exit', () => resolve()); chrome.kill('SIGTERM'); }
  });
  // Subprocessos do Chromium podem terminar de gravar após a saída do processo pai.
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
