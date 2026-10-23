import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { ViteDevServer } from 'vite';
import { FALLBACK_COVERAGE } from '../src/lib/coverage';

describe('Landing inglesa: simulador, comparação e termos', () => {
  let dom: JSDOM, root: Root, container: HTMLElement, vite: ViteDevServer, client: QueryClient;
  let Page: typeof import('../src/pages/EnglishLanding').default;
  let createRoot: typeof import('react-dom/client').createRoot;
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const originalFetch = globalThis.fetch;
  before(async () => {
    dom = new JSDOM('<html><head></head><body></body></html>', { url: 'https://example.test/en', pretendToBeVisual: true });
    const globals: Record<string, unknown> = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      location: dom.window.location, history: dom.window.history, IS_REACT_ACT_ENVIRONMENT: true,
      addEventListener: dom.window.addEventListener.bind(dom.window),
      removeEventListener: dom.window.removeEventListener.bind(dom.window),
      dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
    };
    for (const name of ['Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'Event', 'MouseEvent']) globals[name] = (dom.window as any)[name];
    for (const [name, value] of Object.entries(globals)) {
      originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new dom.window.Event('close')); };
    ({ createRoot } = await import('react-dom/client'));
    const { createServer } = await import('vite');
    vite = await createServer({ configFile: false, envFile: false, root: process.cwd(), appType: 'custom',
      esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': `${process.cwd()}/src` }, dedupe: ['react', 'react-dom'] },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
    ({ default: Page } = await vite.ssrLoadModule('/src/pages/EnglishLanding.tsx'));
  });
  after(async () => {
    await vite?.close(); dom.window.close(); globalThis.fetch = originalFetch;
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as any)[name];
    }
  });
  beforeEach(async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 60000 } } });
    client.setQueryData(['public-pricing'], { pricePerInvoiceCents: 80, monthlyFeeCents: 0 });
    client.setQueryData(['public-coverage'], FALLBACK_COVERAGE);
    globalThis.fetch = async url => {
      if (String(url) === '/api/public/pricing') return Response.json({ pricePerInvoiceCents: 80, monthlyFeeCents: 0 });
      if (String(url) === '/api/public/coverage') return Response.json(FALLBACK_COVERAGE);
      throw new Error(`Unexpected request: ${url}`);
    };
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(Page))));
  });
  afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
  async function click(label: string) {
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
    const button = buttons.find(node => node.textContent?.trim() === label)
      ?? buttons.find(node => node.textContent?.trim().startsWith(label));
    assert.ok(button, label); await act(async () => button.click());
  }
  it('traduz detalhes e comparação interativos e preserva cálculo em reais', async () => {
    assert.equal(document.documentElement.lang, 'en');
    assert.ok(document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.endsWith('/api/og-en.png?v=2'));
    await click('Launch month');
    assert.ok(container.querySelector('.csr-result-main')?.textContent?.includes('R$100.80'));
    await click('How we calculate your cost');
    assert.ok(container.textContent?.includes('Invoices rejected by the municipality are not charged.'));
    await click('Compare plans and sources ↗');
    assert.equal(container.querySelector('dialog')?.open, true);
    assert.ok(container.textContent?.includes('How much would you pay per month?'));
    await click('Per year');
    assert.ok(container.querySelector('.ac-calc__hero-result')?.textContent?.includes('R$1,209.60'));
    await click('Close comparison ×');
    assert.equal(container.querySelector('dialog')?.open, false);
  });
  it('abre os termos em inglês e mostra a tradução das fontes na comparação', async () => {
    await click('Terms of use');
    assert.ok(container.textContent?.includes('No legally binding terms have been published'));
    await click('Close');
    assert.equal(container.querySelector('.ac-modal'), null);
    await click('How we calculate your cost'); await click('Compare plans and sources ↗');
    assert.ok(container.textContent?.includes('Entry-level prices published on official websites'));
    assert.ok(container.textContent?.includes('Extra invoice'));
    assert.equal(container.textContent?.includes('Planos de entrada'), false);
    assert.equal(container.textContent?.includes('Notas emitidas'), false);
  });
  it('usa preço e cobertura atualizados sem trocar idioma ou ampliar a disponibilidade', async () => {
    await act(async () => {
      client.setQueryData(['public-pricing'], { pricePerInvoiceCents: 95, monthlyFeeCents: 0 });
      client.setQueryData(['public-coverage'], { cities: [{ cityCode: '1234567', cityName: 'Cidade de teste', uf: 'SP', regimes: ['MEI'] }] });
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    assert.ok(container.textContent?.includes('R$0.95'));
    assert.ok(container.textContent?.includes('Cidade de teste'));
    assert.equal(container.querySelector('.csr-city-list')?.textContent?.includes('São Paulo'), false);
    assert.ok(document.querySelector('meta[name="description"]')?.getAttribute('content')?.includes('Cidade de teste/SP'));
    assert.equal(document.documentElement.lang, 'en');
  });
});
