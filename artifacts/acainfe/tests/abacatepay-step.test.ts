import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { AbacatePayConnection, PastSalesPeriod } from '../src/lib/past-sales';

describe('Etapa 4: conexão e busca opcional de vendas', () => {
  let dom: JSDOM, root: Root, container: HTMLElement;
  let createRoot: typeof import('react-dom/client').createRoot;
  let Step: typeof import('../src/components/AbacatePayStep').AbacatePayStep;
  let response: AbacatePayConnection, status: number, connected: number, continued: number, unauthorized: number;
  let calls: { path: string; method: string; body: any }[];
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const originalFetch = globalThis.fetch;
  const period: PastSalesPeriod = {
    period: '2026-10', isCurrentMonth: true, requiresConfirmation: false,
    available: { count: 2, totalCents: 19400, withoutItems: 0 }, alreadyIssued: 0, imported: 0, refunded: 0,
  };
  before(async () => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test/app', pretendToBeVisual: true });
    const exposed: Record<string, unknown> = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
    };
    for (const name of ['Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLSelectElement', 'DocumentFragment', 'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'CustomEvent']) exposed[name] = (dom.window as any)[name];
    for (const [name, value] of Object.entries(exposed)) {
      descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    ({ createRoot } = await import('react-dom/client'));
    ({ AbacatePayStep: Step } = await import('../src/components/AbacatePayStep'));
  });
  after(() => {
    globalThis.fetch = originalFetch; dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as any)[name];
    }
  });
  beforeEach(() => {
    response = { imported: 2, confirmedByProfile: [{ id: 'p-1', name: 'Curso' }], pendingTaxReview: [{ id: 'p-2', name: 'Software' }],
      skippedTestProducts: ['Produto Teste'], mergedDuplicates: [{ name: 'Kero Avaliar', externalId: 'ext', productId: 'p-1' }], pastSales: { periods: [] } };
    status = 200; connected = 0; continued = 0; unauthorized = 0; calls = [];
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    globalThis.fetch = async (url, init) => {
      const path = String(url), method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path, method, body });
      let data: unknown;
      const resultStatus = path.endsWith('/abacatepay') ? status : 200;
      if (path.endsWith('/abacatepay')) data = status === 200 ? response : { message: 'API key do AbacatePay inválida' };
      else if (path.endsWith('/past-sales')) data = response.pastSales;
      else if (path.endsWith('/public/pricing')) data = { pricePerInvoiceCents: 80 };
      else if (path.endsWith('/products')) data = { items: [{ id: 'p-2', name: 'Software', taxStatus: 'PENDING_REVIEW', suggestedTaxProfile: {} }] };
      else throw new Error(`Rota inesperada: ${path}`);
      return new Response(JSON.stringify(data), { status: resultStatus, headers: { 'content-type': 'application/json' } });
    };
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch; });
  async function mount() {
    await act(async () => root.render(createElement(Step, { base: '/app/companies/company', onConnected() { connected++; }, onContinue() { continued++; }, onUnauthorized() { unauthorized++; } })));
  }
  function button(text: string) {
    const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim().startsWith(text));
    assert.ok(found, `Botão ausente: ${text}`); return found;
  }
  async function click(node: HTMLElement) { await act(async () => node.click()); }
  async function enterKey(value = '  chave-ficticia  ') {
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  it('mostra título de ação, seis permissões, ajuda e busca de 3 meses marcada por padrão', async () => {
    await mount();
    assert.equal(container.querySelector('h2')?.textContent, 'Conecte seu AbacatePay');
    for (const scope of ['PRODUCT:READ', 'WEBHOOK:CREATE', 'CHECKOUT:READ', 'TRANSPARENT:READ', 'SUBSCRIPTION:READ', 'CUSTOMER:READ']) {
      assert.ok([...container.querySelectorAll('strong')].some(node => node.textContent === scope));
    }
    assert.equal(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked, true);
    assert.equal(container.querySelector('select')!.value, '3');
    assert.deepEqual([...container.querySelectorAll('option')].map(node => node.value), ['0', '3', '6', '12']);
    assert.ok(container.textContent?.includes('Fica guardada criptografada.'));
    assert.ok(container.textContent?.includes('Só mostramos uma prévia. Nada é emitido sem você confirmar.'));
    assert.equal(container.querySelector('a')?.getAttribute('href'), 'https://app.abacatepay.com');
  });
  it('envia busca padrão e mostra todos os resultados da importação antes de continuar', async () => {
    await mount(); await enterKey(); await click(button('Conectar AbacatePay'));
    assert.deepEqual(calls[0].body, { apiKey: 'chave-ficticia', scanPastSales: true, monthsBack: 3 });
    for (const text of ['pronto para vender', 'aguarda sua confirmação', 'Ignoramos produtos de teste: Produto Teste', 'juntamos em um só produto']) assert.ok(container.textContent?.includes(text));
    assert.equal(container.querySelector('input[type="password"]'), null);
    assert.equal(dom.window.localStorage.length, 0);
    assert.equal(dom.window.sessionStorage.length, 0);
    assert.equal(connected, 1);
    await click(button('Continuar')); assert.equal(continued, 1);
    assert.equal(calls.some(call => call.path.endsWith('/issue')), false);
  });
  for (const monthsBack of [0, 6, 12]) it(`envia exatamente monthsBack=${monthsBack}`, async () => {
    await mount(); await enterKey();
    const select = container.querySelector('select')!;
    await act(async () => { select.value = String(monthsBack); select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await click(button('Conectar AbacatePay'));
    assert.equal(calls[0].body.monthsBack, monthsBack);
  });
  it('desmarcado omite monthsBack e não abre prévia mesmo se vier dado antigo', async () => {
    response.pastSales = { periods: [period] };
    await mount(); await enterKey(); await click(container.querySelector('input[type="checkbox"]')!);
    assert.equal(container.querySelector('select'), null);
    await click(button('Conectar AbacatePay'));
    assert.deepEqual(calls[0].body, { apiKey: 'chave-ficticia', scanPastSales: false });
    assert.equal(container.textContent?.includes('Encontramos vendas sem nota fiscal'), false);
    assert.equal(calls.length, 1);
    await click(button('Continuar')); assert.equal(continued, 1);
  });
  it('422 fica abaixo da key, preserva o valor e permite corrigir', async () => {
    status = 422; await mount(); await enterKey(); await click(button('Conectar AbacatePay'));
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    const error = document.getElementById(input.getAttribute('aria-describedby')!);
    assert.ok(error?.textContent?.includes('API key do AbacatePay inválida'));
    assert.equal(input.value, '  chave-ficticia  ');
    assert.equal(connected, 0);
    status = 200; await enterKey('nova-key-ficticia'); await click(button('Conectar AbacatePay'));
    assert.equal(calls.at(-1)?.body.apiKey, 'nova-key-ficticia');
    assert.equal(connected, 1);
  });
  it('aviso é sucesso parcial; atualizar key usa a mesma rota e abre 4.1 quando há vendas', async () => {
    response.pastSales = { warning: 'Faltam permissões CHECKOUT:READ e CUSTOMER:READ.' };
    await mount(); await enterKey(); await click(button('Conectar AbacatePay'));
    assert.ok(container.querySelector('.as-warning')?.textContent?.includes('A conexão funcionou'));
    assert.equal(connected, 1);
    await click(button('Atualizar key'));
    assert.ok(container.textContent?.includes('não criamos outro webhook'));
    assert.equal(container.querySelector<HTMLInputElement>('input[type="password"]')!.value, '');
    response.pastSales = { periods: [period] };
    await enterKey('chave-nova-ficticia'); await click(button('Conectar AbacatePay'));
    assert.ok(container.textContent?.includes('Encontramos vendas sem nota fiscal'));
    assert.equal(container.querySelector('.as-warning'), null);
    assert.equal(calls.filter(call => call.method === 'POST').length, 2);
    assert.ok(calls.filter(call => call.method === 'POST').every(call => call.path === '/api/app/companies/company/abacatepay'));
    assert.equal(calls.some(call => /\/issue|\/scan/.test(call.path)), false);
  });
  it('prévia abre automaticamente ao encontrar vendas sem emitir nada', async () => {
    response.pastSales = { periods: [period] };
    await mount(); await enterKey(); await click(button('Conectar AbacatePay'));
    assert.ok(container.textContent?.includes('Encontramos vendas sem nota fiscal'));
    assert.ok(container.textContent?.includes('outubro/2026'));
    assert.equal(container.querySelector('form form'), null);
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
    await click(button('Agora não')); assert.equal(continued, 1);
  });
  it('permite revisar produtos pendentes dentro da etapa 4 sem forms aninhados', async () => {
    await mount(); await enterKey(); await click(button('Conectar AbacatePay'));
    await click(button('Ir para a tela de produtos'));
    assert.ok(container.textContent?.includes('Tributação sugerida'));
    await click(button('Novo produto'));
    assert.equal(container.querySelectorAll('form').length, 1);
    assert.equal(container.querySelector('form form'), null);
  });
  it('401 volta ao fluxo autenticado sem concluir a conexão', async () => {
    status = 401; await mount(); await enterKey(); await click(button('Conectar AbacatePay'));
    assert.equal(unauthorized, 1); assert.equal(connected, 0);
  });
});
