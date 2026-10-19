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
  let company: any, details: any, patches: any[], profilesRequested: number, detailRequests: number;
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
      resolve: { alias: { '@': `${process.cwd()}/src` }, dedupe: ['react', 'react-dom'] },
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
    patches = []; profilesRequested = 0; details = undefined; detailRequests = 0;
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
      if (path === '/api/auth/user') data = { id: 'test-user', email: 'user@example.test', name: 'Pessoa de teste' };
      else if (path === '/api/app/me') data = { user: { name: 'Pessoa de teste', whatsapp: '' }, companies: [company] };
      else if (path === '/api/app/fiscal-profiles') {
        profilesRequested++;
        data = [
          { businessType: 'INFOPRODUCER', label: 'Infoprodutor', examples: 'Cursos, treinamentos, mentorias', validated: true },
          { businessType: 'MICROSAAS', label: 'MicroSaaS', examples: 'Assinaturas e licenças de software', validated: false },
        ];
      } else if (path.endsWith('/billing')) data = { amountDueCents: 0 };
      else if (path.endsWith('/products?pendingTaxReview=true')) data = [];
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
    assert.deepEqual(patches, [{ businessType, issuesElsewhere: false }]);
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
    assert.deepEqual(patches[0], { businessType: 'MICROSAAS', issRateBps: 250, issuesElsewhere: false });
    assert.ok(container.textContent?.includes('Quem é seu contador?'));
  });
  it('não mostra ISS em empresa que não precisa informá-lo', async () => {
    await mount();
    assert.equal(container.textContent?.includes('Alíquota de ISS do seu município'), false);
  });
  function readyPanel() {
    company.tenant.integrations.abacatepay = true;
    company.tenant.status = 'ACTIVE';
    company.readiness = { canIssue: true, missing: [], recommended: [] };
    delete company.company;
  }
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
});
