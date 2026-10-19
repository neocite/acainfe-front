import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { TaxProduct } from '../src/lib/products';
import type { ReadinessItem } from '../src/lib/company-details';

describe('Perfis e produtos: interações', () => {
  let dom: JSDOM, root: Root, container: HTMLElement;
  let createRoot: typeof import('react-dom/client').createRoot;
  let Products: typeof import('../src/components/Products').Products;
  let Fields: typeof import('../src/components/FiscalCompanyFields').FiscalCompanyFields;
  let Summary: typeof import('../src/components/AbacatePayImportSummary').AbacatePayImportSummary;
  let products: TaxProduct[], calls: { path: string; method: string; body: any }[];
  let status: number, changed: number, unauthorized: number;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const originalFetch = globalThis.fetch;
  before(async () => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test' });
    const exposed: Record<string, unknown> = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
    for (const name of ['HTMLElement', 'HTMLInputElement', 'Node', 'Element', 'Event', 'MouseEvent']) exposed[name] = (dom.window as any)[name];
    for (const [key, value] of Object.entries(exposed)) {
      descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    ({ createRoot } = await import('react-dom/client'));
    ({ Products } = await import('../src/components/Products'));
    ({ FiscalCompanyFields: Fields } = await import('../src/components/FiscalCompanyFields'));
    ({ AbacatePayImportSummary: Summary } = await import('../src/components/AbacatePayImportSummary'));
  });
  after(() => {
    globalThis.fetch = originalFetch; dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  });
  beforeEach(() => {
    products = [{ id: 'p-1', name: 'Assinatura', taxStatus: 'PENDING_REVIEW', suggestedTaxProfile: { source: 'API' }, warnings: ['Informe o NBS antes de vender.'] }];
    calls = []; status = 200; changed = 0; unauthorized = 0;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    globalThis.fetch = async (url, init) => {
      const path = String(url); const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path, method, body });
      let data: unknown;
      if (status !== 200) data = { message: 'Erro controlado' };
      else if (path.endsWith('/fiscal-profiles')) data = [
        { businessType: 'INFOPRODUCER', label: 'Infoprodutor', examples: 'Cursos, treinamentos, mentorias', validated: true },
        { businessType: 'MICROSAAS', label: 'MicroSaaS', examples: 'Assinaturas e licenças de software', validated: false },
      ];
      else if (path.endsWith('/confirm-tax')) {
        products = [{ ...products[0], taxStatus: 'CONFIRMED', warnings: [], suggestedTaxProfile: null }];
        data = { product: products[0], releasedHeldSales: 2 };
      } else if (path.endsWith('/products') && method === 'POST') {
        const product = { id: 'p-2', ...body, taxStatus: 'CONFIRMED', warnings: ['Confira os dados retornados pela API.'] };
        products.push(product); data = product;
      } else if (path.endsWith('/products')) data = { items: products };
      else throw new Error(`Rota inesperada: ${path}`);
      return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    };
  });
  afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch;
  });
  async function render(node: React.ReactNode) { await act(async () => root.render(node)); }
  async function click(node: HTMLElement) { await act(async () => node.click()); }
  function button(text: string) {
    const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text);
    assert.ok(found, `Botão não encontrado: ${text}`); return found;
  }
  async function fill(label: string, value: string) {
    const input = [...container.querySelectorAll('label')].find(node => node.textContent?.startsWith(label))?.querySelector('input');
    assert.ok(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  async function mountProducts() {
    await render(createElement(Products, { base: '/app/companies/company', onUnauthorized() { unauthorized++; }, onChanged() { changed++; } }));
  }
  it('exibe avisos e confirma somente a sugestão real, liberando vendas retidas', async () => {
    await mountProducts();
    assert.ok(container.textContent?.includes('Informe o NBS antes de vender.'));
    assert.ok(container.textContent?.includes('Tributação sugerida'));
    await click(button('Confirmar'));
    assert.deepEqual(calls.find(call => call.path.endsWith('/confirm-tax'))?.body, { userConfirmed: true });
    assert.ok(container.textContent?.includes('2 vendas retidas viraram nota.'));
    assert.equal(container.textContent?.includes('Tributação sugerida'), false);
    assert.equal(container.textContent?.includes('Informe o NBS'), false);
    assert.equal(changed, 1);
  });
  it('não mostra Confirmar para produtos sem sugestão ou já confirmados', async () => {
    products = [
      { id: 'p1', name: 'Curso pronto', taxStatus: 'CONFIRMED', suggestedTaxProfile: {} },
      { id: 'p2', name: 'Sem sugestão', taxStatus: 'PENDING_REVIEW', suggestedTaxProfile: null },
    ];
    await mountProducts();
    assert.equal([...container.querySelectorAll('button')].some(node => node.textContent === 'Confirmar'), false);
  });
  it('cria produto com preço em centavos sem enviar perfil fiscal', async () => {
    await mountProducts(); await click(button('Novo produto'));
    await fill('Nome', 'Curso novo'); await fill('Descrição', 'Treinamento online'); await fill('Preço', '97,25');
    await click(button('Criar produto'));
    assert.deepEqual(calls.find(call => call.method === 'POST')?.body, { name: 'Curso novo', serviceDescription: 'Treinamento online', defaultPriceCents: 9725 });
    assert.ok(container.textContent?.includes('Curso novo'));
    assert.ok(container.textContent?.includes('Confira os dados retornados pela API.'));
    assert.equal(changed, 1);
  });
  it('não envia criação com preço inválido e mantém o erro visível', async () => {
    await mountProducts(); await click(button('Novo produto'));
    await fill('Nome', 'Curso'); await fill('Preço', '2,001');
    await click(button('Criar produto'));
    assert.equal(calls.some(call => call.method === 'POST'), false);
    assert.ok(container.querySelector('[role="alert"]'));
  });
  it('falha de confirmação não remove a sugestão e permite tentar novamente', async () => {
    await mountProducts(); status = 422;
    await click(button('Confirmar'));
    assert.ok(container.textContent?.includes('Erro controlado'));
    assert.ok(container.textContent?.includes('Tributação sugerida'));
    status = 200; await click(button('Confirmar'));
    assert.ok(container.textContent?.includes('2 vendas retidas viraram nota.'));
  });
  it('encaminha 401 ao fluxo de login', async () => {
    status = 401; await mountProducts();
    assert.equal(unauthorized, 1);
  });
  it('busca opções reais e só exibe ISS quando solicitado', async () => {
    let selected = '';
    let rate = '';
    const props = {
      businessType: '', issRate: '', errors: {}, disabled: false,
      onBusinessType(value: string) { selected = value; }, onIssRate(value: string) { rate = value; },
      onUnauthorized() { unauthorized++; },
    };
    const missing: ReadinessItem[] = [{ field: 'businessType', message: 'Selecione o tipo' }];
    await render(createElement(Fields, { ...props, missing }));
    assert.ok(container.textContent?.includes('Cursos, treinamentos, mentorias'));
    assert.ok(container.textContent?.includes('Assinaturas e licenças de software'));
    assert.equal(container.textContent?.includes('Alíquota de ISS'), false);
    const micro = container.querySelector<HTMLInputElement>('input[value="MICROSAAS"]')!;
    await click(micro); assert.equal(selected, 'MICROSAAS');
    await render(createElement(Fields, { ...props, missing: [{ field: 'issRateBps', message: 'Consulte a prefeitura da sua cidade.' }] }));
    assert.ok(container.textContent?.includes('Alíquota de ISS do seu município (%)'));
    assert.ok(container.textContent?.includes('Consulte a prefeitura da sua cidade.'));
    await fill('Alíquota de ISS', '2,5'); assert.equal(rate, '2,5');
    await render(createElement(Fields, { ...props, missing: [] }));
    assert.equal(container.querySelector('input'), null);
  });
  it('o link do resumo abre a tela de produtos', async () => {
    let opened = false;
    await render(createElement(Summary, { connection: { imported: 1, pendingTaxReview: [{ id: 'p', name: 'Software' }] }, onOpenProducts() { opened = true; } }));
    await click(button('Ir para a tela de produtos')); assert.equal(opened, true);
  });
});
