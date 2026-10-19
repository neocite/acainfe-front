import { after, before, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { PastSalesPeriod, PastSale, PastSalesPreview } from '../src/lib/past-sales';

describe('Vendas sem nota: interações reais dos componentes', () => {
  let dom: JSDOM;
  let root: Root;
  let container: HTMLElement;
  let Component: typeof import('../src/components/PastSales').PastSales;
  let createRoot: typeof import('react-dom/client').createRoot;
  let periods: PastSalesPeriod[];
  let items: PastSale[];
  let warning: string | undefined;
  let productResponse: unknown;
  let calls: { url: string; method: string; body: any }[];
  let updatedKey: number;
  let skipped: number;
  const originalFetch = globalThis.fetch;
  const globals = new Map<string, PropertyDescriptor | undefined>();
  before(async () => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/app', pretendToBeVisual: true });
    const exposed: Record<string, unknown> = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
      cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
      IS_REACT_ACT_ENVIRONMENT: true,
    };
    for (const name of ['Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLSelectElement', 'DocumentFragment', 'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'CustomEvent']) exposed[name] = (dom.window as any)[name];
    for (const [name, value] of Object.entries(exposed)) {
      globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    ({ createRoot } = await import('react-dom/client'));
    ({ PastSales: Component } = await import('../src/components/PastSales'));
  });
  after(() => {
    globalThis.fetch = originalFetch;
    dom.window.close();
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as any)[name];
    }
  });
  beforeEach(() => {
    periods = [
      { period: '2026-09', isCurrentMonth: false, requiresConfirmation: true, available: { count: 2, totalCents: 30000, withoutItems: 0 }, alreadyIssued: 0, imported: 0, refunded: 1 },
      { period: '2026-10', isCurrentMonth: true, requiresConfirmation: false, available: { count: 2, totalCents: 30000, withoutItems: 0 }, alreadyIssued: 0, imported: 0, refunded: 0 },
    ];
    items = [
      { id: 'sale-1', paidAt: '2026-10-10T15:00:00Z', amountCents: 10000, status: 'AVAILABLE', customer: { name: 'Cliente de teste' } },
      { id: 'sale-2', paidAt: '2026-10-11T15:00:00Z', amountCents: 20000, status: 'AVAILABLE', customer: null },
    ];
    warning = undefined; productResponse = { products: [{ id: 'product-1', name: 'Serviço de teste' }] }; calls = []; updatedKey = 0; skipped = 0;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    dom.window.confirm = () => true;
    globalThis.fetch = async (url, init) => {
      const path = new URL(String(url), 'https://example.test');
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: `${path.pathname}${path.search}`, method, body });
      let data: unknown;
      if (path.pathname.endsWith('/public/pricing')) data = { pricePerInvoiceCents: 80 };
      else if (path.pathname.endsWith('/abacatepay')) data = { imported: 3, pendingTaxReview: [], pastSales: { periods } };
      else if (path.pathname.endsWith('/products')) data = productResponse;
      else if (path.pathname.endsWith('/past-sales/items')) data = { items };
      else if (path.pathname.endsWith('/past-sales/mark')) {
        for (const item of items) if (body.period || body.ids.includes(item.id)) item.status = body.alreadyIssued ? 'ALREADY_ISSUED' : 'AVAILABLE';
        const current = periods.find(period => period.period === '2026-10')!;
        current.available.count = items.filter(item => item.status === 'AVAILABLE').length;
        current.alreadyIssued = items.filter(item => item.status === 'ALREADY_ISSUED').length;
        data = {};
      } else if (path.pathname.endsWith('/past-sales/issue')) {
        const period = periods.find(period => period.period === body.period)!;
        const count = period.available.count;
        period.imported += count; period.available.count = 0; period.available.totalCents = 0; period.available.withoutItems = 0;
        data = { issued: count, held: 1, skippedWithoutProduct: 0, failed: [{ message: 'Aviso de teste da API' }] };
      } else if (path.pathname.endsWith('/past-sales/scan')) data = {};
      else if (path.pathname.endsWith('/past-sales')) data = warning ? { warning } : { periods };
      else throw new Error(`Rota inesperada no teste: ${path.pathname}`);
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    };
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  });
  async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); }
  async function mount(initial?: PastSalesPreview) {
    await act(async () => root.render(createElement(Component, {
      base: '/app/companies/test', initial, onUpdateKey: () => { updatedKey++; },
      onSkip: () => { skipped++; }, onUnauthorized: () => { throw new Error('Sessão não deveria expirar no teste.'); },
    })));
    await flush();
  }
  function card(month: string) {
    const element = [...container.querySelectorAll('article')].find(article => article.textContent?.includes(month));
    assert.ok(element, `Card de ${month} ausente`);
    return element;
  }
  function button(text: string, scope: ParentNode = document) {
    const element = [...scope.querySelectorAll('button')].find(element => element.textContent?.trim() === text);
    assert.ok(element, `Botão ${text} ausente`);
    return element;
  }
  async function click(element: HTMLElement) {
    await act(async () => { element.click(); });
    await flush();
  }
  it('ordena os meses, calcula o custo e emite o mês atual sem confirmação', async () => {
    await mount();
    assert.ok(container.querySelector('article')?.textContent?.includes('outubro/2026'));
    assert.ok(card('outubro/2026').textContent?.includes('1,60'));
    await click(button('Emitir 2 notas', card('outubro/2026')));
    const issued = calls.filter(call => call.url.endsWith('/issue'));
    assert.equal(issued.length, 1);
    assert.deepEqual(issued[0].body, { period: '2026-10' });
    assert.ok(container.textContent?.includes('2 notas entrando na fila de emissão'));
    assert.ok(container.textContent?.includes('1 aguardam você definir a tributação'));
    assert.ok(container.textContent?.includes('Aviso de teste da API'));
    assert.equal(button('Emitir 0 notas', card('outubro/2026')).disabled, true);
  });
  it('obriga o checkbox de competência antes de emitir mês anterior', async () => {
    await mount();
    await click(button('Emitir 2 notas', card('setembro/2026')));
    const dialog = document.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.match(dialog.textContent || '', /DAS de setembro/);
    assert.equal(button('Emitir', dialog).disabled, true);
    await click(button('Emitir', dialog));
    assert.equal(calls.filter(call => call.url.endsWith('/issue')).length, 0);
    const checkbox = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await click(checkbox);
    assert.equal(button('Emitir', dialog).disabled, false);
    await click(button('Emitir', dialog));
    assert.deepEqual(calls.find(call => call.url.endsWith('/issue'))?.body, { period: '2026-09', confirmPastPeriod: true });
  });
  it('marca e desmarca uma venda e atualiza o total do mês', async () => {
    await mount();
    await click(button('Revisar vendas', card('outubro/2026')));
    const review = container.querySelector('.past-sales-review')!;
    assert.ok(review.textContent?.includes('Cliente não identificado'));
    await click(review.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!);
    assert.deepEqual(calls.find(call => call.url.endsWith('/mark'))?.body, { ids: ['sale-1'], alreadyIssued: true });
    assert.ok(card('outubro/2026').textContent?.includes('1 vendas'));
    await click(review.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!);
    assert.equal(calls.filter(call => call.url.endsWith('/mark')).at(-1)?.body.alreadyIssued, false);
    assert.ok(card('outubro/2026').textContent?.includes('2 vendas'));
    await click(button('Marcar o mês inteiro como já emitido', review));
    assert.deepEqual(calls.filter(call => call.url.endsWith('/mark')).at(-1)?.body, { period: '2026-10', alreadyIssued: true });
    assert.ok(card('outubro/2026').textContent?.includes('0 vendas'));
  });
  it('exige um produto para Pix avulso e envia fallbackProductId', async () => {
    periods.find(period => period.period === '2026-10')!.available.withoutItems = 1;
    await mount(); await flush();
    const current = card('outubro/2026');
    assert.equal(button('Emitir 2 notas', current).disabled, true);
    const select = current.querySelector('select')!;
    await act(async () => { select.value = 'product-1'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await click(button('Emitir 2 notas', current));
    assert.deepEqual(calls.find(call => call.url.endsWith('/issue'))?.body, { period: '2026-10', fallbackProductId: 'product-1' });
  });
  it('carrega produtos no envelope items para escolher o produto do Pix', async () => {
    productResponse = { items: [{ id: 'product-1', name: 'Serviço importado' }], total: 1 };
    periods.find(period => period.period === '2026-10')!.available.withoutItems = 1;
    await mount(); await flush();
    assert.ok(card('outubro/2026').querySelector('select')!.textContent?.includes('Serviço importado'));
    assert.equal(container.querySelectorAll('[role="alert"]').length, 0);
  });
  it('mantém um único erro ao repetir consulta de produtos e o limpa após recuperação', async () => {
    productResponse = { unexpected: [] };
    periods.find(period => period.period === '2026-10')!.available.withoutItems = 1;
    await mount(); await flush();
    assert.equal(container.querySelectorAll('[role="alert"]').length, 1);
    assert.ok(container.textContent?.includes('A importação foi concluída'));
    await click(button('Carregar produtos novamente'));
    assert.equal(container.querySelectorAll('[role="alert"]').length, 1);
    assert.equal(container.textContent?.includes('Tentar novamente'), false);
    productResponse = { items: [{ id: 'product-1', name: 'Serviço recuperado' }] };
    await click(button('Carregar produtos novamente'));
    assert.equal(container.querySelectorAll('[role="alert"]').length, 0);
    assert.ok(card('outubro/2026').querySelector('select')!.textContent?.includes('Serviço recuperado'));
  });
  it('trata falta de permissão como aviso e permite atualizar key ou pular', async () => {
    warning = 'A API key precisa da permissão CHECKOUT:READ';
    await mount({ warning });
    assert.ok(container.textContent?.includes('A conexão funcionou'));
    await click(button('Atualizar key'));
    assert.equal(updatedKey, 1);
    const skip = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Agora não'))!;
    await click(skip);
    assert.equal(skipped, 1);
  });
  it('atualiza a lista usando monthsBack 3 e consulta novamente a prévia', async () => {
    await mount();
    const before = calls.filter(call => call.url.endsWith('/past-sales')).length;
    await click(button('Atualizar lista'));
    assert.deepEqual(calls.find(call => call.url.endsWith('/scan'))?.body, { monthsBack: 3 });
    assert.ok(calls.filter(call => call.url.endsWith('/past-sales')).length > before);
  });
  it('atualiza a key pelo mesmo endpoint sem apagar a conexão e entrega a prévia', async () => {
    const { AbacatePayConnectionDialog } = await import('../src/components/AbacatePayConnectionDialog');
    let connected: any;
    let closed = false;
    await act(async () => root.render(createElement(AbacatePayConnectionDialog, {
      base: '/app/companies/test',
      onClose: () => { closed = true; },
      onConnected: connection => { connected = connection; },
      onUnauthorized: () => { throw new Error('Sessão inesperadamente inválida.'); },
    })));
    const dialog = document.querySelector('[role="dialog"]')!;
    assert.match(dialog.textContent || '', /não cria outro webhook/);
    for (const permission of ['CHECKOUT:READ', 'TRANSPARENT:READ', 'SUBSCRIPTION:READ', 'CUSTOMER:READ']) assert.ok(dialog.textContent?.includes(permission));
    const input = dialog.querySelector<HTMLInputElement>('input[type="password"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'fake-key-for-unit-test');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => {
      dialog.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
    assert.deepEqual(calls.find(call => call.url.endsWith('/abacatepay')), { url: '/api/app/companies/test/abacatepay', method: 'POST', body: { apiKey: 'fake-key-for-unit-test' } });
    assert.equal(connected.imported, 3);
    assert.equal(connected.pastSales.periods.length, 2);
    assert.equal(closed, true);
    assert.equal(input.value, '');
  });
});
