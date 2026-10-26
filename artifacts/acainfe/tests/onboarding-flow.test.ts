import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Root } from 'react-dom/client';
import type { ViteDevServer } from 'vite';
import { webcrypto } from 'node:crypto';

describe('Cadastro completo: escolha de atividade até AbacatePay', () => {
  let dom: JSDOM, root: Root, container: HTMLElement;
  let Onboarding: typeof import('../src/pages/Onboarding').default;
  let createRoot: typeof import('react-dom/client').createRoot;
  let modules: ViteDevServer;
  let coverageClient: QueryClient;
  let analytics: ReturnType<typeof import('../src/lib/analytics').createAnalytics>;
  let billingDue: number;
  let paymentData: any, paymentQueries: number, paymentError: number | undefined;
  let paymentSequence = 0;
  let company: any, details: any, patches: any[], profilesRequested: number, detailRequests: number, mcpRequests: number, fiscalRequests: number;
  let keys: any[], keyGets: number, keyDeletes: string[], generatedLabels: any[], generationError: boolean;
  let gatewayCalls: any[], gatewayFailure: boolean;
  let certificateResponse: { status: number; code: string; message: string } | null;
  let certificateUploads: number;
  let profileWarning: string | undefined;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const originalFetch = globalThis.fetch;
  before(async () => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://acainfe.com/app', pretendToBeVisual: true });
    Object.defineProperty(dom.window, 'crypto', { value: webcrypto });
    const exposed: Record<string, unknown> = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      location: dom.window.location, history: dom.window.history,
      addEventListener: dom.window.addEventListener.bind(dom.window),
      removeEventListener: dom.window.removeEventListener.bind(dom.window),
      dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      IS_REACT_ACT_ENVIRONMENT: true,
    };
    for (const name of ['Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLSelectElement', 'DocumentFragment', 'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'CustomEvent']) exposed[name] = (dom.window as any)[name];
    for (const [name, value] of Object.entries(exposed)) {
      descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    ({ createRoot } = await import('react-dom/client'));
    // Vite loads the real page and its styles; middleware mode opens no HTTP port.
    const { createServer } = await import('vite');
    modules = await createServer({ configFile: false, envFile: false, root: process.cwd(), appType: 'custom',
      resolve: { alias: { '@': `${process.cwd()}/src`, '@clerk/react': `${process.cwd()}/tests/fixtures/clerk.ts` }, dedupe: ['react', 'react-dom'] },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
    ({ default: Onboarding } = await modules.ssrLoadModule('/src/pages/Onboarding.tsx'));
    analytics = (await modules.ssrLoadModule('/src/lib/analytics.ts')).getAnalytics();
  });
  after(async () => {
    if (modules) await modules.close();
    globalThis.fetch = originalFetch; dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as any)[name];
    }
  });
  beforeEach(() => {
    analytics.setConsent('denied');
    dom.window.localStorage.clear();
    dom.window.sessionStorage.clear();
    (dom.window as any).dataLayer = [];
    billingDue = 0;
    paymentData = null; paymentQueries = 0; paymentError = undefined;
    paymentSequence++;
    Object.defineProperty(dom.window.document, 'hidden', { configurable: true, value: false });
    patches = []; profilesRequested = 0; details = undefined; detailRequests = 0; mcpRequests = 0; fiscalRequests = 0;
    keys = []; keyGets = 0; keyDeletes = []; generatedLabels = []; generationError = false;
    gatewayCalls = []; gatewayFailure = false;
    certificateResponse = null; certificateUploads = 0;
    profileWarning = undefined;
    company = {
      tenant: { id: 'test-company', taxRegime: 'SIMPLES_NACIONAL', municipalRegistration: '123', integrations: {} },
      company: { legalName: 'EMPRESA DE TESTE' }, availability: { status: 'AVAILABLE' },
      readiness: { canIssue: false, missing: [
        { field: 'businessType', message: 'O que você vende?' },
        { field: 'numbering', message: 'Informe a numeração' },
      ], recommended: [] }, pendingTaxReview: 0,
    };
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    globalThis.fetch = async (url, init) => {
      const path = String(url), method = init?.method || 'GET';
      let data: unknown;
      if (path === '/api/app/onboarding/certificate') {
        certificateUploads++;
        assert.equal(method, 'POST');
        assert.ok(init?.body instanceof FormData);
        assert.equal((init.body as FormData).get('password'), 'fixture-password');
        if (certificateResponse) return new Response(JSON.stringify(certificateResponse), {
          status: certificateResponse.status, headers: { 'content-type': 'application/json' },
        });
        data = company;
      }
      else if (path === '/api/app/me') data = { user: { name: 'Pessoa de teste', whatsapp: '' }, companies: [company] };
      else if (path === '/api/app/fiscal-profiles') {
        profilesRequested++;
        data = [
          { businessType: 'INFOPRODUCER', label: 'Infoprodutor', examples: 'Cursos, treinamentos, mentorias', validated: true },
          { businessType: 'MICROSAAS', label: 'MicroSaaS', examples: 'Assinaturas e licenças de software', validated: false },
          { businessType: 'CUSTOM', label: 'Outro serviço (configuro eu mesmo)', examples: 'Design e consultoria', validated: false, validationNote: 'Confira os códigos com seu contador.' },
        ];
      } else if (path.startsWith('/api/app/service-codes?q=')) data = [
        { nationalServiceCode: '010601', lc116Item: '1.06', description: 'Consultoria', nbsOptions: ['115010000'], operationIndicators: ['100302'] },
      ];
      else if (path.endsWith('/municipal-rate/010601')) data = { issRateBps: 201 };
      else if (path.endsWith('/abacatepay') && method === 'POST') {
        gatewayCalls.push(JSON.parse(String(init?.body)));
        if (gatewayFailure) return new Response(JSON.stringify({ message: 'Permissão CUSTOMER:READ ausente.' }), { status: 422, headers: { 'content-type': 'application/json' } });
        company.abacatepay = { ...company.abacatepay, connected: true };
        data = { imported: 3, pendingTaxReview: [{ id: 'p1', name: 'Curso' }], skippedTestProducts: ['Teste'], mergedDuplicates: [{ name: 'Curso', externalId: 'duplicate', productId: 'p1' }], defaultProduct: { decided: true, productId: null } };
      } else if (path.endsWith('/products')) data = { items: [] };
      else if (path.endsWith('/past-sales')) data = { periods: [] };
      else if (path === '/api/public/pricing') data = { pricePerInvoiceCents: 80 };
      else if (path === '/api/public/coverage') data = { cities: [
        { cityCode: '3550308', cityName: 'São Paulo', uf: 'SP', regimes: ['MEI', 'SIMPLES_NACIONAL'] },
        { cityCode: '3548708', cityName: 'São Bernardo do Campo', uf: 'SP', regimes: ['MEI', 'SIMPLES_NACIONAL'] },
      ] };
      else if (path.endsWith('/billing')) data = { amountDueCents: billingDue };
      else if (path.endsWith('/billing/payments')) {
        assert.equal(method, 'POST');
        paymentData = { id: `pix-fixture-${paymentSequence}`, paymentId: `pix-fixture-${paymentSequence}`, status: 'PENDING', currency: 'BRL', amountCents: billingDue, pixCopyPaste: 'fixture-pix-only', pixQrCodeImage: '', expiresAt: '2030-01-01T12:00:00Z' };
        data = paymentData;
      }
      else if (path.includes('/billing/payments/')) {
        assert.equal(method, 'GET');
        assert.equal(path, `/api/app/companies/test-company/billing/payments/${paymentData.paymentId}`);
        paymentQueries++;
        if (paymentError) return new Response(JSON.stringify({ message: 'Pagamento não encontrado' }), { status: paymentError, headers: { 'Content-Type': 'application/json' } });
        data = paymentData;
      }
      else if (path.endsWith('/products?pendingTaxReview=true')) data = [];
      else if (path.endsWith('/mcp-connection')) data = {
        mcpUrl: 'https://example.test/mcp', keyPlaceholder: '<SUA_CHAVE>',
        authorizationHeader: 'Authorization: Bearer <SUA_CHAVE>',
        claudeCodeCommand: 'claude mcp add acainfe -H "Authorization: Bearer <SUA_CHAVE>"',
        jsonConfig: { mcpServers: { acainfe: { url: 'https://example.test/mcp', headers: { Authorization: 'Bearer <SUA_CHAVE>' } } } },
      };
      else if (path === '/api/app/companies/test-company/mcp-keys' && method === 'GET') {
        keyGets++; data = { items: keys };
      }
      else if (path.startsWith('/api/app/companies/test-company/mcp-keys') && method === 'DELETE') {
        assert.equal(init?.body, undefined);
        keyDeletes.push(path);
        if (path.endsWith('/mcp-keys')) { data = { revoked: keys.length }; keys = []; }
        else { keys = keys.filter(item => !path.endsWith(`/${item.id}`)); data = { revoked: true, remaining: keys.length }; }
      }
      else if (path === '/api/app/companies/test-company/mcp-key' && method === 'POST') {
        mcpRequests++;
        const body = JSON.parse(String(init?.body));
        generatedLabels.push(body);
        if (generationError) return new Response(JSON.stringify({ message: 'Limite de 10 chaves ativas.' }), { status: 409, headers: { 'content-type': 'application/json' } });
        const key = { id: `key-${mcpRequests}`, label: body.label, last4: 'abcd', createdAt: '2026-10-19T12:00:00Z', createdVia: 'APP', legacy: false };
        keys = [key, ...keys];
        data = { apiKey: 'test-only-mcp-key', mcpUrl: 'https://example.test/mcp',
          claudeCodeCommand: 'claude mcp add acainfe --transport http https://example.test/mcp',
          jsonConfig: {mcpServers:{acainfe:{url:'https://example.test/mcp',headers:{Authorization:'Bearer test-only-mcp-key'}}}}, key };
      }
      else if (path === '/api/app/companies/test-company/fiscal-settings' && method === 'GET') {
        fiscalRequests++;
        data = { company: { legalName: 'DADOS FISCAIS COMPLETOS' }, emission: { systemLabel: 'Emissor Nacional', environment: 'PRODUCTION' },
          taxDefaults: { warning: company.tenant.businessType === 'INFOPRODUCER' ? profileWarning : undefined, autoConfirm: company.tenant.businessType !== 'CUSTOM' }, text: 'Resumo de teste' };
      }
      else if (path === '/api/app/companies/test-company' && method === 'GET') {
        detailRequests++;
        data = details || company;
      }
      else if (path === '/api/app/companies/test-company' && method === 'PATCH') {
        const body = JSON.parse(String(init?.body)); patches.push(body);
        company = { ...company, tenant: { ...company.tenant, ...body }, readiness: { ...company.readiness,
          missing: company.readiness.missing.filter((item: any) =>
            !(item.field === 'businessType' && body.businessType) &&
            !(item.field === 'numbering' && typeof body.issuesElsewhere === 'boolean') &&
            !(item.field === 'issRateBps' && typeof body.issRateBps === 'number')),
        } };
        company.readiness.canIssue = company.readiness.missing.length === 0;
        data = company;
      } else throw new Error(`Rota inesperada no teste: ${method} ${path}`);
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    };
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch; });
  function gaEvents() {
    return ((dom.window as any).dataLayer ?? []).map((args: ArrayLike<unknown>) => Array.from(args)).filter((args: unknown[]) => args[0] === 'event');
  }
  it('mede a etapa real depois de carregar o cadastro e não conta visita ao painel como onboarding', async () => {
    analytics.setConsent('granted');
    await mount();
    assert.equal(gaEvents().filter((event: any[]) => event[1] === 'onboarding_start').length, 1);
    const views = gaEvents().filter((event: any[]) => event[1] === 'onboarding_step_view');
    assert.equal(views.length, 1);
    assert.equal(views[0][2].step_name, 'company');
    assert.equal(gaEvents().filter((event: any[]) => event[1] === 'onboarding_step_complete').length, 0);
  });
  it('registra Pix gerado na tela de saldo mas não inventa purchase quando o saldo zera', async () => {
    readyPanel(); billingDue = 12345;
    analytics.setConsent('granted');
    await mount();
    await click(button('Saldo'));
    await click(button('Pagar com Pix'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    assert.ok(container.textContent?.includes('fixture-pix-only'));
    const events = gaEvents();
    assert.equal(events.filter((event: any[]) => event[1] === 'onboarding_start').length, 0);
    assert.equal(events.filter((event: any[]) => event[1] === 'pix_generated').length, 1);
    assert.equal(events.find((event: any[]) => event[1] === 'begin_checkout')[2].value, 123.45);
    billingDue = 0;
    await click(button('Verificar pagamento'));
    assert.ok(container.querySelector('.pix-section'));
    assert.equal(gaEvents().some((event: any[]) => event[1] === 'purchase'), false);
  });
  it('confirma PAID com valor efetivamente pago, atualiza saldo e recupera sem duplicar após recarga', async () => {
    readyPanel(); billingDue = 12345;
    analytics.setConsent('granted');
    await mount(); await click(button('Saldo')); await click(button('Pagar com Pix'));
    paymentData.status = 'PAID'; paymentData.paidAmountCents = 13000; paymentData.paidAt = '2026-10-26T18:00:00Z';
    billingDue = 0;
    await click(button('Verificar pagamento'));
    assert.ok(container.textContent?.includes('Pagamento confirmado'));
    assert.ok(container.textContent?.includes('R$ 130,00'));
    assert.ok(button('Tudo em dia').hasAttribute('disabled'));
    assert.equal(container.querySelector('.copy-field'), null);
    const purchases = () => gaEvents().filter((event: any[]) => event[1] === 'purchase');
    assert.equal(purchases().length, 1);
    assert.equal(purchases()[0][2].value, 130);
    assert.equal(purchases()[0][2].transaction_id, paymentData.paymentId);
    await act(async () => root.unmount()); root = createRoot(container);
    await mount(); await click(button('Saldo'));
    assert.ok(container.textContent?.includes('Pagamento confirmado'));
    assert.equal(purchases().length, 1);
    assert.doesNotMatch(JSON.stringify(gaEvents()), /fixture-pix-only/);
  });
  it('consulta automaticamente em 7,5s, pausa oculta, para ao expirar e permite gerar outro Pix', async t => {
    readyPanel(); billingDue = 12345;
    await mount(); await click(button('Saldo')); await click(button('Pagar com Pix'));
    t.mock.timers.enable({ apis: ['setTimeout'] });
    // Re-enter the tab so its polling timer is created under the controlled clock.
    await click(button('Minha empresa')); await click(button('Saldo'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
    await act(async () => t.mock.timers.tick(15000));
    assert.equal(paymentQueries, 0);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
    assert.equal(paymentQueries, 1);
    paymentData.status = 'EXPIRED';
    await act(async () => t.mock.timers.tick(7500));
    assert.equal(paymentQueries, 2);
    assert.ok(container.textContent?.includes('Este Pix expirou'));
    await act(async () => t.mock.timers.tick(30000));
    assert.equal(paymentQueries, 2);
    assert.equal(gaEvents().some((event: any[]) => event[1] === 'purchase'), false);
    await click(button('Gerar outro Pix'));
    assert.ok(button('Verificar pagamento'));
  });
  it('para as consultas após confirmação automática ou saída da aba', async t => {
    readyPanel(); billingDue = 12345;
    analytics.setConsent('granted');
    await mount(); await click(button('Saldo'));
    t.mock.timers.enable({ apis: ['setTimeout'] });
    await click(button('Pagar com Pix'));
    paymentData.status = 'PAID'; paymentData.paidAmountCents = 12345;
    await act(async () => t.mock.timers.tick(7500));
    assert.ok(container.textContent?.includes('Pagamento confirmado'));
    await act(async () => t.mock.timers.tick(30000));
    assert.equal(paymentQueries, 1);
    assert.equal(gaEvents().filter((event: any[]) => event[1] === 'purchase').length, 1);
    await click(button('Minha empresa'));
    await act(async () => t.mock.timers.tick(30000));
    assert.equal(paymentQueries, 1);
  });
  it('erro 404 na consulta mostra a mensagem e nunca confirma nem envia purchase', async () => {
    readyPanel(); billingDue = 12345;
    analytics.setConsent('granted');
    await mount(); await click(button('Saldo')); await click(button('Pagar com Pix'));
    paymentError = 404;
    await click(button('Verificar pagamento'));
    assert.ok(container.textContent?.includes('Pagamento não encontrado'));
    assert.ok(button('Verificar pagamento'));
    assert.equal(gaEvents().some((event: any[]) => event[1] === 'purchase'), false);
  });
  it('confirma o pagamento sem consentimento, mas só mede após autorização explícita', async () => {
    readyPanel(); billingDue = 12345;
    await mount(); await click(button('Saldo')); await click(button('Pagar com Pix'));
    paymentData.status = 'PAID'; paymentData.paidAmountCents = 12345;
    await click(button('Verificar pagamento'));
    assert.ok(container.textContent?.includes('Pagamento confirmado'));
    assert.equal(gaEvents().some((event: any[]) => event[1] === 'purchase'), false);
    await act(async () => analytics.setConsent('granted'));
    assert.equal(gaEvents().filter((event: any[]) => event[1] === 'purchase').length, 1);
    await act(async () => analytics.setConsent('granted'));
    assert.equal(gaEvents().filter((event: any[]) => event[1] === 'purchase').length, 1);
  });
  it('descarta resposta de outro pagamento e mantém pendente sem conversão', async () => {
    readyPanel(); billingDue = 12345;
    analytics.setConsent('granted');
    await mount(); await click(button('Saldo')); await click(button('Pagar com Pix'));
    const originalId = paymentData.paymentId;
    // The server returns an unexpected payment even though the requested URL is unchanged.
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => String(url).endsWith(`/billing/payments/${originalId}`)
      ? new Response(JSON.stringify({ ...paymentData, paymentId: 'other', status: 'PAID', paidAmountCents: 12345 }), { headers: { 'Content-Type': 'application/json' } })
      : previousFetch(url, init);
    await click(button('Verificar pagamento'));
    assert.ok(container.textContent?.includes('A API não retornou os dados necessários'));
    assert.ok(button('Verificar pagamento'));
    assert.equal(gaEvents().some((event: any[]) => event[1] === 'purchase'), false);
  });
  async function mount() {
    coverageClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    await act(async () => root.render(createElement(QueryClientProvider, { client: coverageClient }, createElement(Onboarding))));
  }
  async function click(node: HTMLElement) { await act(async () => node.click()); }
  function button(text: string) {
    const node = [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim().startsWith(text));
    assert.ok(node, `Botão ausente: ${text}`); return node;
  }
  async function submit() {
    await act(async () => container.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  }
  async function selectBusiness(businessType: string) {
    const radio = container.querySelector<HTMLInputElement>(`input[name="businessType"][value="${businessType}"]`);
    assert.ok(radio, 'A tela real precisa conter o seletor de atividade'); await click(radio);
  }
  async function openCertificate() {
    company.readiness = { canIssue: true, missing: [], recommended: [] };
    company.tenant.integrations = { abacatepay: true };
    company.tenant.cnpj = '99000001000101';
    await mount();
    await click(button('Início'));
    const select = container.querySelector<HTMLSelectElement>('.configuration-review select')!;
    await act(async () => {
      select.value = '2';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.ok(container.textContent?.includes('Seu certificado A1.'));
  }
  async function fillCertificate(filename = '99000001000101.pfx', password = 'fixture-password') {
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    await act(async () => {
      Object.defineProperty(input, 'files', { configurable: true, value: [new File(['fixture-only'], filename)] });
      input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      const secret = container.querySelector<HTMLInputElement>('input[type=password]')!;
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(secret, password);
      secret.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  it('certificado 409 mantém mensagem da API, orienta pedir acesso e não oferece nova tentativa', async () => {
    await openCertificate();
    certificateResponse = { status: 409, code: 'CONFLICT', message: 'Esta empresa já está cadastrada no açaínfe por outra pessoa. Peça a quem administra a empresa para liberar o seu acesso.' };
    await fillCertificate();
    await submit();
    const alert = container.querySelector('[role=alert]')!;
    assert.ok(alert.textContent?.includes(certificateResponse.message));
    assert.ok(alert.textContent?.includes('Se você faz parte da empresa, peça a quem administra o açaínfe para liberar seu acesso.'));
    assert.equal(alert.querySelector('button'), null);
    assert.equal([...container.querySelectorAll('button')].some(node => node.textContent?.includes('Enviar certificado')), false);
    assert.equal(certificateUploads, 1);
    await fillCertificate('99000001000101.p12');
    assert.ok(button('Enviar certificado'));
  });
  it('certificado 422 mostra mensagem original e orientação sobre e-CNPJ credenciado', async () => {
    await openCertificate();
    certificateResponse = { status: 422, code: 'CERTIFICATE_INVALID', message: 'Este certificado não é um e-CNPJ válido da ICP-Brasil. Cadeia inválida.' };
    await fillCertificate();
    await submit();
    const alert = container.querySelector('[role=alert]')!;
    assert.ok(alert.textContent?.includes(certificateResponse.message));
    assert.ok(alert.textContent?.includes('Use o certificado A1 (e-CNPJ) emitido por uma autoridade certificadora credenciada (ex.: Soluti, Certisign, Serasa, Valid).'));
    assert.ok(button('Enviar certificado'));
    assert.equal(certificateUploads, 1);
  });
  it('certificado mantém arquivo/senha obrigatórios e extensão validada antes do envio', async () => {
    await openCertificate();
    assert.equal(container.querySelector<HTMLInputElement>('input[type=file]')?.required, true);
    assert.equal(container.querySelector<HTMLInputElement>('input[type=password]')?.required, true);
    await fillCertificate('invalid.txt');
    await submit();
    assert.equal(certificateUploads, 0);
    await fillCertificate('99000001000101.pfx', '');
    await submit();
    assert.ok(container.textContent?.includes('Informe a senha do certificado.'));
    assert.equal(certificateUploads, 0);
  });
  it('certificado aceito avança e remove a senha da tela', async () => {
    await openCertificate();
    await fillCertificate();
    await submit();
    assert.equal(certificateUploads, 1);
    assert.ok(container.textContent?.includes('Só mais alguns detalhes.'));
    assert.equal(container.querySelector('input[type=password]'), null);
  });
  for (const businessType of ['INFOPRODUCER', 'MICROSAAS']) it(`salva ${businessType} com numeração e mantém a nova etapa 4`, async () => {
    await mount();
    assert.ok(container.textContent?.includes('Infoprodutor'));
    assert.ok(container.textContent?.includes('MicroSaaS'));
    assert.equal(profilesRequested, 1);
    const legends = [...container.querySelectorAll('legend')].map(node => node.textContent);
    assert.ok(legends.indexOf('O que você vende?') < legends.indexOf('Você já emite nota fiscal de serviço por outro sistema?'));
    await selectBusiness(businessType);
    await click(container.querySelector('input[name="numbering"][value="no"]')!);
    await submit();
    assert.deepEqual(patches, [{ businessType, issuesElsewhere: false, municipalRegistration: '123', simplesNacionalTaxRateBps: 600, approximateTaxes: { rateBps: 1553, descriptionTemplate: 'Valor aprox dos tributos: R$ [ValorTributos]. Fonte: IBPT' } }]);
    assert.ok(container.textContent?.includes('Quem é seu contador?'));
    await click(button('Não tenho contador agora'));
    assert.ok(container.textContent?.includes('Conecte seu AbacatePay'));
    assert.equal(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked, true);
    for (const permission of ['CHECKOUT:READ', 'TRANSPARENT:READ', 'SUBSCRIPTION:READ', 'CUSTOMER:READ']) assert.ok(container.textContent?.includes(permission));
  });
  async function customInput(label: string, value: string) {
    const editor = container.querySelector('.default-service-editor')!;
    const field = [...editor.querySelectorAll('label')].find(node => node.textContent?.startsWith(label))?.querySelector('input')!;
    assert.ok(field, label);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(field, value);
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  it('CUSTOM pode pular sem enviar defaultService e avança até AbacatePay', async () => {
    await mount(); await selectBusiness('CUSTOM');
    assert.ok(container.textContent?.includes('Confira os códigos com seu contador.'));
    assert.ok(container.textContent?.includes('Opcional. Isso vira só uma sugestão'));
    await click(button('Pular'));
    await click(container.querySelector('input[name="numbering"][value="no"]')!);
    await submit();
    assert.equal(patches[0].businessType, 'CUSTOM');
    assert.equal(patches.some(p => 'defaultService' in p), false);
    await click(button('Não tenho contador agora'));
    assert.ok(container.textContent?.includes('Conecte seu AbacatePay'));
  });
  it('CUSTOM busca serviço, exige o NBS permitido e salva a sugestão com ISS e IBPT inteiros', async () => {
    company.emission = { system: 'PAULISTANA' };
    await mount(); await selectBusiness('CUSTOM');
    await customInput('Código de serviço', 'consultoria');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    await click(container.querySelector('input[name="defaultServiceCode"]')!);
    assert.ok(container.textContent?.includes('1.06 — Consultoria'));
    assert.ok(container.textContent?.includes('5 dígitos'));
    await click(button('Salvar tributação padrão'));
    assert.ok(container.textContent?.includes('Escolha um NBS'));
    assert.equal(patches.length, 0);
    const select = container.querySelector<HTMLSelectElement>('.default-service-editor select')!;
    await act(async () => { select.value = '115010000'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await customInput('Código municipal', '02501');
    await click(button('Consultar na prefeitura'));
    await customInput('Tributos aproximados (IBPT', '15,53');
    await click(button('Salvar tributação padrão'));
    assert.deepEqual(patches[0], { businessType: 'CUSTOM' });
    assert.deepEqual(patches[1], { defaultService: { taxProfile: {
      nationalServiceCode: '010601', nbsCode: '115010000', localServiceCode: '02501', issRateBps: 201,
      issRetention: 'NONE', ibsCbs: { cst: '000', cClassTrib: '000001', operationIndicator: '100302' }, approximateTaxRateBps: 1553,
    } } });
    assert.ok(container.textContent?.includes('Cada produto ainda precisa de confirmação.'));
    await click(container.querySelector('input[name="numbering"][value="no"]')!);
    await submit();
    assert.ok(container.textContent?.includes('Quem é seu contador?'));
  });
  it('perfil incompatível mostra aviso após salvar e permite mudar para CUSTOM sem avançar', async () => {
    profileWarning = 'Sua empresa não tem CNAE de ensino. Os produtos serão apenas sugestões.';
    await mount(); await selectBusiness('INFOPRODUCER');
    await click(container.querySelector('input[name="numbering"][value="no"]')!);
    await submit();
    assert.ok(container.textContent?.includes(profileWarning));
    assert.ok(container.textContent?.includes('Só mais alguns detalhes.'));
    await click(button('Mudar para Outro serviço'));
    assert.deepEqual(patches.at(-1), { businessType: 'CUSTOM' });
    assert.equal(container.querySelector<HTMLInputElement>('input[name="businessType"][value="CUSTOM"]')?.checked, true);
    assert.ok(container.querySelector('.default-service-editor'));
    assert.equal(container.textContent?.includes(profileWarning), false);
  });
  it('não envia PATCH sem escolha e mantém as opções para corrigir', async () => {
    await mount(); await click(container.querySelector('input[name="numbering"][value="no"]')!);
    await submit();
    assert.equal(patches.length, 0);
    assert.ok(container.textContent?.includes('Escolha o que você vende para continuar.'));
    assert.ok(container.querySelector('input[value="INFOPRODUCER"]'));
    await selectBusiness('INFOPRODUCER'); await submit();
    assert.equal(patches[0].businessType, 'INFOPRODUCER');
    assert.ok(container.textContent?.includes('Quem é seu contador?'));
  });
  it('ISS aparece e é enviado apenas se a API solicitar', async () => {
    company.readiness.missing.push({ field: 'issRateBps', message: 'Consulte a alíquota na prefeitura.' });
    await mount(); await selectBusiness('MICROSAAS');
    await click(container.querySelector('input[name="numbering"][value="no"]')!);
    const label = [...container.querySelectorAll('label')].find(node => node.textContent?.includes('Alíquota de ISS do seu município'));
    assert.ok(label);
    const input = label.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, '2,5');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await submit();
    assert.deepEqual(patches[0], { businessType: 'MICROSAAS', issRateBps: 250, issuesElsewhere: false, municipalRegistration: '123', simplesNacionalTaxRateBps: 600, approximateTaxes: { rateBps: 1553, descriptionTemplate: 'Valor aprox dos tributos: R$ [ValorTributos]. Fonte: IBPT' } });
    assert.ok(container.textContent?.includes('Quem é seu contador?'));
  });
  it('não mostra ISS em empresa que não precisa informá-lo', async () => {
    await mount();
    assert.equal(container.textContent?.includes('Alíquota de ISS do seu município'), false);
  });
  it('CCM ausente e obrigatório aparece com a mensagem da API e bloqueia o PATCH', async () => {
    company.tenant.municipalRegistration = '';
    company.readiness.missing.push({ field: 'municipalRegistration', message: 'A prefeitura de São Bernardo exige seu CCM.' });
    await mount(); await selectBusiness('INFOPRODUCER');
    await click(container.querySelector('input[name="numbering"][value="no"]')!);
    const field = [...container.querySelectorAll('label')].find(node => node.textContent?.startsWith('Inscrição municipal'))!;
    assert.equal(field.querySelector('input')!.required, true);
    assert.ok(field.textContent?.includes('A prefeitura de São Bernardo exige seu CCM.'));
    await submit();
    assert.equal(patches.length, 0);
    assert.ok(container.textContent?.includes('A prefeitura de São Bernardo exige seu CCM.'));
  });
  it('CCM apenas recomendado não bloqueia e tributos sugeridos são enviados sem ambiente', async () => {
    company.tenant.municipalRegistration = '';
    company.readiness.recommended = [
      { field: 'municipalRegistration', message: 'CCM recomendado pela prefeitura.' },
      { field: 'approximateTaxes', message: 'Confirme o IBPT.' },
    ];
    company.emission = { system: 'GINFES', systemLabel: 'GINFES de São Bernardo', environment: 'PRODUCTION' };
    await mount(); await selectBusiness('INFOPRODUCER');
    await click(container.querySelector('input[name="numbering"][value="no"]')!);
    const input = [...container.querySelectorAll('label')].find(node => node.textContent?.startsWith('Inscrição municipal'))!.querySelector('input')!;
    assert.equal(input.required, false);
    assert.ok(container.querySelector('.approximate-taxes-fields.app-notice'));
    assert.ok(container.textContent?.includes('Valor aprox dos tributos: R$ 15,53. Fonte: IBPT'));
    assert.ok(container.textContent?.includes('Suas notas serão emitidas pelo: GINFES de São Bernardo'));
    assert.equal(container.textContent?.includes('Modo teste'), false);
    await submit();
    assert.equal(patches.length, 1);
    assert.equal(patches[0].municipalRegistration, undefined);
    assert.equal(patches[0].environment, undefined);
    assert.equal(patches[0].emission, undefined);
    assert.equal(patches[0].approximateTaxes.rateBps, 1553);
    assert.ok(container.textContent?.includes('Quem é seu contador?'));
  });
  it('preserva tributos já cadastrados e o modo teste só aparece se informado pela API', async () => {
    company.tenant.approximateTaxes = { rateBps: 201, descriptionTemplate: 'Total R$ [ValorTributos]' };
    company.emission = { system: 'NACIONAL', systemLabel: 'Emissor Nacional', environment: 'HOMOLOGATION' };
    await mount();
    assert.ok(container.textContent?.includes('Modo teste'));
    assert.ok(container.textContent?.includes('Total R$ 2,01'));
    const percent = [...container.querySelectorAll('label')].find(node => node.textContent?.startsWith('Percentual (%)'))!.querySelector('input')!;
    assert.equal(percent.value, '2,01');
    await selectBusiness('MICROSAAS'); await click(container.querySelector('input[name="numbering"][value="no"]')!);
    await submit();
    assert.deepEqual(patches[0].approximateTaxes, company.tenant.approximateTaxes);
  });
  function readyPanel() {
    company.tenant.integrations.abacatepay = true;
    company.tenant.status = 'ACTIVE';
    company.readiness = { canIssue: true, missing: [], recommended: [] };
    delete company.company;
  }
  it('Dados fiscais fica dentro de Minha empresa, sem aba principal e sem gerar chaves', async () => {
    readyPanel(); await mount();
    const link = container.querySelector<HTMLButtonElement>('.company-summary .text-button');
    assert.ok(link); assert.equal(link.textContent, 'Ver dados fiscais');
    await click(link);
    assert.equal(fiscalRequests, 1);
    assert.ok(container.textContent?.includes('DADOS FISCAIS COMPLETOS'));
    assert.equal(button('Minha empresa').className, 'active');
    assert.equal([...container.querySelectorAll('.app-tabs button')].some(b => b.textContent?.trim() === 'Dados fiscais'), false);
    assert.ok(container.querySelector('.company-fiscal-view'));
    assert.equal(container.querySelector('.mcp-keys'), null);
    await click(button('Voltar para Minha empresa'));
    assert.ok(container.querySelector('.company-summary'));
    await click(container.querySelector<HTMLButtonElement>('.company-summary .text-button')!);
    assert.equal(fiscalRequests, 2);
    assert.equal(mcpRequests, 0);
  });
  it('painel consulta detalhes, exibe nome, data e status em português e preserva ao atualizar', async () => {
    readyPanel();
    details = { ...company, tenant: { ...company.tenant, legalName: 'RAZÃO SOCIAL COMPLETA' },
      certificate: { expiresAt: '2027-05-20T00:00:00.000Z' } };
    await mount();
    assert.equal(detailRequests, 1);
    assert.ok(container.textContent?.includes('RAZÃO SOCIAL COMPLETA'));
    assert.ok(container.textContent?.includes('20/05/2027'));
    assert.ok(container.textContent?.includes('Ativa'));
    assert.equal(container.textContent?.includes('ACTIVE'), false);
    details = { ...company, tenant: { ...company.tenant, status: 'SUSPENDED' } };
    await click(button('Atualizar status'));
    assert.equal(detailRequests, 2);
    assert.ok(container.textContent?.includes('RAZÃO SOCIAL COMPLETA'));
    assert.ok(container.textContent?.includes('20/05/2027'));
    assert.ok(container.textContent?.includes('Suspensa'));
  });
  it('painel aceita validade em tenant e usa nome do certificado quando detalhes são resumidos', async () => {
    readyPanel();
    company.company = { legalName: 'NOME DO CERTIFICADO' };
    details = { ...company, company: undefined,
      tenant: { ...company.tenant, certificateExpiresAt: '2027-12-31' } };
    await mount();
    assert.ok(container.textContent?.includes('NOME DO CERTIFICADO'));
    assert.ok(container.textContent?.includes('31/12/2027'));
  });
  it('painel não inventa nome ou vencimento quando a API não fornece', async () => {
    readyPanel(); await mount();
    assert.ok(container.textContent?.includes('Nome da empresa não informado pela API'));
    assert.ok(container.textContent?.includes('Validade não informada'));
    assert.equal(container.textContent?.includes('Invalid Date'), false);
  });
  it('abre Hermes na etapa MCP, copia comandos e mantém as outras instruções sem gerar nova chave', async () => {
    readyPanel();
    const copied: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { copied.push(text); },
    } });
    try {
      await mount();
      await click(button('Início'));
      assert.equal(container.textContent?.includes('Hermes (CLI)'), false);
      await click(button('Gerar minha chave'));
      assert.equal(mcpRequests, 1);
      const hermes = button('Hermes (CLI)');
      await click(hermes);
      assert.equal(hermes.getAttribute('aria-pressed'), 'true');
      const section = container.querySelector('section[aria-label="Conectar ao Hermes via CLI"]');
      assert.ok(section);
      assert.ok(section.textContent?.includes('API key / Bearer token'));
      assert.ok(section.textContent?.includes('histórico do terminal'));
      assert.ok(section.querySelector('a[target="_blank"][rel="noopener noreferrer"]'));
      assert.equal(section.textContent?.includes('test-only-mcp-key'), false);
      const commands = [...section.querySelectorAll('.copy-field')];
      assert.equal(commands[0].querySelector('code')?.textContent,
        "hermes mcp add acainfe --url 'https://example.test/mcp' --auth header");
      for (const command of commands) await click(command.querySelector('button')!);
      assert.deepEqual(copied, [
        "hermes mcp add acainfe --url 'https://example.test/mcp' --auth header",
        'hermes mcp test acainfe',
      ]);
      await click(button('Claude Code'));
      assert.ok(container.textContent?.includes('claude mcp add acainfe'));
      assert.equal(container.querySelector('section[aria-label="Conectar ao Hermes via CLI"]'), null);
      await click(button('Outro cliente MCP'));
      assert.ok(container.textContent?.includes('Authorization: Bearer test-only-mcp-key'));
      assert.equal(mcpRequests, 1);
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else delete (navigator as any).clipboard;
    }
  });
  it('gerencia chaves a partir do painel sem exigir gerar outra e atualiza a lista após criar com nome', async () => {
    readyPanel();
    keys = [{ id: 'existing-key', label: 'Integração existente', last4: '1234', createdAt: '2026-10-19T12:00:00Z', createdVia: 'APP', legacy: false }];
    await mount();
    assert.equal(container.querySelector('.mcp-keys'), null);
    await click(button('Agentes de IA'));
    assert.ok(container.textContent?.includes('Chaves ativas'));
    assert.ok(container.textContent?.includes('Integração existente'));
    assert.equal(mcpRequests, 0);
    const label = [...container.querySelectorAll('label')].find(node => node.textContent?.includes('Nome da chave (opcional)'))!;
    const input = label.querySelector('input')!;
    assert.equal(input.maxLength, 60);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Claude Code do notebook');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    const beforeGets = keyGets;
    await click(button('Gerar chave'));
    assert.deepEqual(generatedLabels, [{ label: 'Claude Code do notebook' }]);
    assert.ok(keyGets > beforeGets);
    const list = container.querySelector('.mcp-keys')!;
    assert.ok(list.classList.contains('mcp-keys--agents'));
    assert.ok(container.querySelector('.ai-agents')?.contains(list));
    assert.equal(container.querySelector('.wizard-layout'), null);
    assert.equal(list.querySelector('h3')?.textContent, 'Chaves ativas');
    assert.equal(list.textContent?.includes('Gerar nova chave'), false);
    assert.equal(list.closest('form'), null);
    assert.ok(list.textContent?.includes('Claude Code do notebook'));
    assert.ok(list.textContent?.includes('Integração existente'));
    assert.equal(list.textContent?.includes('test-only-mcp-key'), false);
    assert.ok(container.textContent?.includes('Guarde agora: ela não aparece de novo'));
    assert.equal(keyDeletes.length, 0);
    await click(button('Minha empresa'));
    await click(button('Início'));
    assert.equal(container.textContent?.includes('test-only-mcp-key'), false);
    assert.equal(mcpRequests, 1);
  });
  it('409 mantém a lista disponível e orienta revogar uma chave antiga', async () => {
    readyPanel(); generationError = true;
    await mount(); await click(button('Agentes de IA')); await click(button('Gerar chave'));
    assert.ok(container.textContent?.includes('Limite de 10 chaves ativas.'));
    assert.ok(container.textContent?.includes('Revogue uma chave antiga'));
    assert.ok(container.querySelector('.mcp-keys'));
    assert.equal(container.textContent?.includes('test-only-mcp-key'), false);
  });
  it('etapa 5 vazia mostra só o gerador da primeira chave e Concluir abre o painel', async () => {
    readyPanel(); await mount();
    assert.equal(container.querySelector('.mcp-keys'), null);
    await click(button('Início'));
    const card = container.querySelector('.wizard-card')!;
    assert.equal(container.querySelector('.mcp-keys'), null);
    assert.ok(card.querySelector('form'));
    assert.ok(container.textContent?.includes('Gerar minha chave'));
    assert.ok(container.querySelector('.wizard-aside'));
    assert.equal(container.textContent?.includes('Revogar todas'), false);
    await click(button('Concluir'));
    assert.ok(container.textContent?.includes('Seu negócio, por aqui.'));
    assert.equal(container.querySelector('.mcp-keys-generate'), null);
    assert.equal(container.querySelector('.mcp-keys--onboarding'), null);
    assert.equal(mcpRequests, 0);
  });
  it('Minha empresa não mostra gateway nem sua pendência; os controles ficam no menu próprio', async () => {
    readyPanel(); company.abacatepay = { connected: true, webhookUpToDate: true, defaultProduct: { decided: true, productId: null } };
    company.readiness.recommended = [{ field: 'defaultProduct', message: 'Escolha o produto padrão para o Pix.' }];
    await mount();
    const tabs = [...container.querySelectorAll('.app-tabs button')].map(b => b.textContent?.trim());
    assert.deepEqual(tabs, ['Início', 'Minha empresa', 'Gateways de pagamento', 'Agentes de IA', 'Saldo']);
    assert.equal(tabs[tabs.indexOf('Minha empresa') + 1], 'Gateways de pagamento');
    assert.equal(tabs.includes('Dados fiscais'), false);
    assert.equal(tabs.includes('Painel'), false);
    assert.equal(container.querySelector('.ap-webhook-card'), null);
    assert.equal(container.querySelector('.gateway-panel-summary'), null);
    assert.equal(container.querySelector('.company-recommendations'), null);
    assert.equal(container.textContent?.includes('AbacatePay conectado'), false);
    assert.equal(container.textContent?.includes('Escolha o produto padrão para o Pix.'), false);
    await click(button('Gateways de pagamento'));
    assert.ok(container.querySelector('.pg-screen .ap-webhook-card'));
    assert.ok(container.textContent?.includes('Outros gateways'));
    assert.ok(container.textContent?.includes('Nenhum (esses pagamentos não geram nota)'));
    assert.ok(button('Atualizar API key'));
    assert.ok(button('Recriar webhook'));
    await click(button('Início'));
    assert.ok(container.textContent?.includes('envio do certificado'));
    assert.equal(gatewayCalls.length, 0);
  });
  it('atualiza key pelo proxy com o contrato exato, limpa o segredo e mostra o resumo sem recriar webhook', async () => {
    readyPanel(); company.abacatepay = { connected: true, webhookUpToDate: true, defaultProduct: { decided: true, productId: null } };
    await mount(); await click(button('Gateways de pagamento')); await click(button('Atualizar API key'));
    const input = container.querySelector<HTMLInputElement>('.pg-update input[type=password]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'fixture-new-key');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await submit();
    assert.deepEqual(gatewayCalls, [{ apiKey: 'fixture-new-key', scanPastSales: true }]);
    assert.equal(input.value, '');
    assert.ok(container.textContent?.includes('3 produtos importados'));
    assert.ok(container.textContent?.includes('1 produto de teste ignorado'));
    assert.ok(container.textContent?.includes('1 duplicado unificado'));
    assert.ok(container.textContent?.includes('1 produto aguarda'));
    assert.equal(container.textContent?.includes('fixture-new-key'), false);
    assert.equal(dom.window.localStorage.length, 0);
    await click(button('Voltar aos gateways'));
    assert.ok(container.querySelector('.ap-webhook-status-ok'));
    await click(button('Vendas sem nota'));
    assert.ok(container.querySelector('.past-sales'));
    assert.equal(container.querySelector('.wizard-layout'), null);
  });
  it('mostra erro da API na atualização e apaga a key mesmo quando falha', async () => {
    readyPanel(); gatewayFailure = true; company.abacatepay = { connected: true, webhookUpToDate: null };
    await mount(); await click(button('Gateways de pagamento'));
    assert.equal(container.querySelector('.ap-webhook-status'), null);
    await click(button('Atualizar API key'));
    const input = container.querySelector<HTMLInputElement>('.pg-update input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'fixture-denied');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await submit();
    assert.ok(container.textContent?.includes('Permissão CUSTOMER:READ ausente.'));
    assert.equal(input.value, '');
  });
  it('abre conexão não conectada no menu de gateways, sem depender do onboarding', async () => {
    readyPanel(); company.abacatepay = { connected: false };
    await mount(); await click(button('Gateways de pagamento')); await click(button('Conectar AbacatePay'));
    assert.ok(container.querySelector('.pg-screen .abacatepay-step'));
    assert.equal(container.querySelector('.wizard-layout'), null);
    for (const permission of ['PRODUCT:READ','WEBHOOK:CREATE','CHECKOUT:READ','TRANSPARENT:READ','SUBSCRIPTION:READ','CUSTOMER:READ']) assert.ok(container.textContent?.includes(permission));
    assert.equal(gatewayCalls.length,0);
  });
  it('etapa 5 com chave existente não oferece gerar e leva ao gerenciamento', async () => {
    readyPanel(); keys = [{id:'legacy-key',legacy:true}];
    await mount(); await click(button('Início'));
    assert.ok(container.textContent?.includes('Você já tem uma chave.'));
    assert.equal(container.textContent?.includes('Gerar minha chave'),false);
    assert.equal(container.querySelector('.mcp-keys'),null);
    await click(button('Agentes de IA'));
    assert.ok(container.querySelector('.ai-agents .mcp-keys'));
    assert.equal(mcpRequests,0);
  });
  it('preenche e copia comandos localmente, sem gerar ou enviar a chave colada e sem guardá-la ao sair', async () => {
    readyPanel(); await mount(); await click(button('Agentes de IA'));
    assert.equal(mcpRequests,0);
    const input = container.querySelector<HTMLInputElement>('.mcp-guide-paste input')!;
    const secret = 'private-"key\\\\value';
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,secret);
      input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    });
    assert.ok(container.querySelector('.mcp-guide code')?.textContent?.includes(secret));
    await click(button('Arquivo de configuração (JSON)'));
    const json = JSON.parse(container.querySelector('.mcp-guide pre')!.textContent!);
    assert.equal(json.mcpServers.acainfe.headers.Authorization,`Bearer ${secret}`);
    assert.equal(dom.window.localStorage.length,0);
    assert.equal(dom.window.sessionStorage.length,0);
    assert.equal(mcpRequests,0);
    await click(button('Minha empresa')); await click(button('Agentes de IA'));
    assert.equal(container.querySelector<HTMLInputElement>('.mcp-guide-paste input')!.value,'');
    assert.equal(container.textContent?.includes(secret),false);
    assert.equal(mcpRequests,0);
  });
  it('revogar a chave recém-gerada remove também seu segredo e as instruções da tela', async () => {
    readyPanel(); await mount(); await click(button('Agentes de IA')); await click(button('Gerar chave'));
    assert.ok(container.textContent?.includes('test-only-mcp-key'));
    await click(container.querySelector('.mcp-key-revoke')!);
    const dialog = document.querySelector('[role="dialog"]')!;
    const confirm = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === 'Revogar chave')!;
    await click(confirm);
    assert.equal(container.textContent?.includes('test-only-mcp-key'), false);
    assert.equal(container.textContent?.includes('URL do servidor MCP'), false);
    assert.ok(container.textContent?.includes('Chave revogada'));
    assert.ok(container.textContent?.includes('Gerar chave'));
  });
});
