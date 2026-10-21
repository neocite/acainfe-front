import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { ViteDevServer } from 'vite';

describe('Cadastro completo: escolha de atividade até AbacatePay', () => {
  let dom: JSDOM, root: Root, container: HTMLElement;
  let Onboarding: typeof import('../src/pages/Onboarding').default;
  let createRoot: typeof import('react-dom/client').createRoot;
  let modules: ViteDevServer;
  let company: any, details: any, patches: any[], profilesRequested: number, detailRequests: number, mcpRequests: number, fiscalRequests: number;
  let keys: any[], keyGets: number, keyDeletes: string[], generatedLabels: any[], generationError: boolean;
  let gatewayCalls: any[], gatewayFailure: boolean;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const originalFetch = globalThis.fetch;
  before(async () => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test/app', pretendToBeVisual: true });
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
    patches = []; profilesRequested = 0; details = undefined; detailRequests = 0; mcpRequests = 0; fiscalRequests = 0;
    keys = []; keyGets = 0; keyDeletes = []; generatedLabels = []; generationError = false;
    gatewayCalls = []; gatewayFailure = false;
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
      if (path === '/api/app/me') data = { user: { name: 'Pessoa de teste', whatsapp: '' }, companies: [company] };
      else if (path === '/api/app/fiscal-profiles') {
        profilesRequested++;
        data = [
          { businessType: 'INFOPRODUCER', label: 'Infoprodutor', examples: 'Cursos, treinamentos, mentorias', validated: true },
          { businessType: 'MICROSAAS', label: 'MicroSaaS', examples: 'Assinaturas e licenças de software', validated: false },
        ];
      } else if (path.endsWith('/abacatepay') && method === 'POST') {
        gatewayCalls.push(JSON.parse(String(init?.body)));
        if (gatewayFailure) return new Response(JSON.stringify({ message: 'Permissão CUSTOMER:READ ausente.' }), { status: 422, headers: { 'content-type': 'application/json' } });
        company.abacatepay = { ...company.abacatepay, connected: true };
        data = { imported: 3, pendingTaxReview: [{ id: 'p1', name: 'Curso' }], skippedTestProducts: ['Teste'], mergedDuplicates: [{ name: 'Curso', externalId: 'duplicate', productId: 'p1' }], defaultProduct: { decided: true, productId: null } };
      } else if (path.endsWith('/products')) data = { items: [] };
      else if (path.endsWith('/past-sales')) data = { periods: [] };
      else if (path === '/api/public/pricing') data = { pricePerInvoiceCents: 80 };
      else if (path.endsWith('/billing')) data = { amountDueCents: 0 };
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
        data = { company: { legalName: 'DADOS FISCAIS COMPLETOS' }, emission: { systemLabel: 'Emissor Nacional', environment: 'PRODUCTION' }, text: 'Resumo de teste' };
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
  async function mount() { await act(async () => root.render(createElement(Onboarding))); }
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
