import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import { isAllowedAppRoute } from '../server/app-routes';
import { appJsonBody, appUpstreamPath } from '../server/app-proxy-request';

describe('AbacatePay: gestão do webhook', () => {
  let dom: JSDOM, root: Root, container: HTMLElement, modules: import('vite').ViteDevServer;
  let Component: typeof import('../src/components/AbacatePayWebhookCard').AbacatePayWebhookCard;
  let createRoot: typeof import('react-dom/client').createRoot;
  let calls: { path: string; method: string; body?: string; contentType?: string }[];
  let responseStatus: number, responseMessage: string, responseData: unknown;
  let refreshed: number, unauthorized: number, reconnects: number;
  const originalFetch = globalThis.fetch;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const base = '/app/companies/test-company';
  const oldEndpoint = 'https://old.example.test/hooks/abacatepay';

  before(async () => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test/app', pretendToBeVisual: true });
    const exposed: Record<string, unknown> = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      location: dom.window.location, history: dom.window.history, IS_REACT_ACT_ENVIRONMENT: true,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    };
    for (const name of ['Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'DocumentFragment', 'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'CustomEvent']) {
      exposed[name] = (dom.window as any)[name];
    }
    for (const [name, value] of Object.entries(exposed)) {
      descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    ({ createRoot } = await import('react-dom/client'));
    const { createServer } = await import('vite');
    modules = await createServer({
      configFile: false, envFile: false, root: process.cwd(), appType: 'custom',
      resolve: { alias: { '@': `${process.cwd()}/src` }, dedupe: ['react', 'react-dom'] },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true },
    });
    ({ AbacatePayWebhookCard: Component } = await modules.ssrLoadModule('/src/components/AbacatePayWebhookCard.tsx'));
  });

  after(async () => {
    await modules?.close();
    globalThis.fetch = originalFetch;
    dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as any)[name];
    }
  });

  beforeEach(() => {
    calls = []; responseStatus = 200; responseMessage = '';
    responseData = { webhookId: 'new-hook', endpoint: 'https://hooks.example.test/current', previous: { webhookId: 'old-hook', endpoint: oldEndpoint } };
    refreshed = 0; unauthorized = 0; reconnects = 0;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    globalThis.fetch = async (url, init) => {
      calls.push({
        path: String(url), method: init?.method || 'GET',
        body: init?.body === undefined ? undefined : String(init.body),
        contentType: (init?.headers as Record<string, string> | undefined)?.['Content-Type'],
      });
      const payload = responseStatus >= 400 ? { message: responseMessage } : responseData;
      return new Response(JSON.stringify(payload), { status: responseStatus, headers: { 'content-type': 'application/json' } });
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  });

  const connected = {
    connected: true,
    connectedAt: '2026-09-01T12:00:00Z',
    webhookEndpoint: 'https://hooks.example.test/current',
    webhookUpToDate: false as boolean | null,
  };
  async function mount(integration: typeof connected | { connected: boolean; connectedAt?: string | null; webhookEndpoint?: string | null; webhookUpToDate?: boolean | null } = connected) {
    await act(async () => root.render(createElement(Component, {
      base, integration, onReconnect: () => { reconnects++; },
      onUnauthorized: () => { unauthorized++; }, onRefresh: async () => { refreshed++; },
    })));
  }
  async function click(label: string, parent: ParentNode = document) {
    const button = [...parent.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label);
    assert.ok(button, `Botão não encontrado: ${label}`);
    await act(async () => button.click());
    return button;
  }
  function dialog() {
    const node = document.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(node, 'Confirmação não encontrada');
    return node;
  }
  async function fillApiKey(value: string) {
    const input = dialog().querySelector<HTMLInputElement>('#abacatepay-webhook-api-key');
    assert.ok(input, 'Campo da API key não encontrado');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }

  it('libera apenas POST para a nova rota do webhook no proxy', () => {
    assert.equal(isAllowedAppRoute('POST', '/companies/test-company/abacatepay/webhook'), true);
    assert.equal(isAllowedAppRoute('POST', '/companies/test-company/abacatepay'), true);
    assert.equal(isAllowedAppRoute('GET', '/companies/test-company/abacatepay/webhook'), false);
    assert.equal(isAllowedAppRoute('DELETE', '/companies/test-company/abacatepay/webhook'), false);
    assert.equal(isAllowedAppRoute('POST', '/companies/test-company/abacatepay/webhooks'), false);
    assert.equal(isAllowedAppRoute('POST', '/companies/../abacatepay/webhook'), false);
    assert.equal(appUpstreamPath('/api/app/companies/test-company/abacatepay/webhook'), '/v1/app/companies/test-company/abacatepay/webhook');
    assert.equal(appJsonBody('POST', undefined), undefined);
    assert.equal(appJsonBody('POST', { apiKey: 'test-key' }), '{"apiKey":"test-key"}');
  });

  it('mostra a conexão, a data, o endereço e o alerta para webhook antigo', async () => {
    await mount();
    assert.ok(container.textContent?.includes('Integração AbacatePay'));
    assert.ok(container.textContent?.includes('Conectado desde 01/09/2026'));
    assert.ok(container.textContent?.includes(connected.webhookEndpoint));
    assert.ok(container.textContent?.includes('O webhook do AbacatePay aponta para um endereço antigo. As vendas novas não estão virando nota. Recrie o webhook.'));
    assert.ok([...container.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Recriar webhook' && button.classList.contains('app-primary')));
  });

  it('mostra o selo ativo e o aviso neutro quando o estado ainda é desconhecido', async () => {
    await mount({ ...connected, webhookUpToDate: true });
    assert.ok(container.querySelector('.ap-webhook-status-ok')?.textContent?.includes('Webhook ativo'));
    assert.equal(container.textContent?.includes('Se as vendas pararam de virar nota'), false);
    await act(async () => root.render(createElement(Component, {
      base, integration: { connected: true, connectedAt: null, webhookUpToDate: null },
      onReconnect() {}, onUnauthorized() {}, onRefresh: async () => {},
    })));
    assert.ok(container.textContent?.includes('Se as vendas pararam de virar nota, recrie o webhook.'));
    const button = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Recriar webhook');
    assert.ok(button?.classList.contains('app-secondary'));
  });

  it('leva uma empresa sem conexão para a etapa de conectar', async () => {
    await mount({ connected: false, webhookUpToDate: null });
    assert.ok(container.textContent?.includes('AbacatePay não conectado'));
    await click('Conectar AbacatePay', container);
    assert.equal(reconnects, 1);
    assert.equal(calls.length, 0);
  });

  it('pede confirmação antes de enviar POST vazio e avisa qual webhook antigo apagar', async () => {
    await mount();
    await click('Recriar webhook', container);
    assert.ok(dialog().textContent?.includes('Vamos criar um webhook novo no AbacatePay apontando para o endereço atual do açaínfe. O antigo deixa de funcionar.'));
    await click('Cancelar', dialog());
    assert.equal(calls.length, 0);
    await click('Recriar webhook', container);
    await click('Confirmar e criar webhook', dialog());
    assert.deepEqual(calls, [{
      path: `/api${base}/abacatepay/webhook`, method: 'POST', body: undefined, contentType: undefined,
    }]);
    assert.equal(refreshed, 1);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.ok(container.textContent?.includes('Webhook novo criado.'));
    assert.ok(container.textContent?.includes(`Configurações → Webhooks), aquele que aponta para ${oldEndpoint}. Ele não recebe mais nada.`));
  });

  it('solicita permissão WEBHOOK:CREATE, reenvia somente a API key e limpa o campo no sucesso', async () => {
    responseStatus = 403;
    responseMessage = 'Permissão WEBHOOK:CREATE necessária.';
    await mount();
    await click('Recriar webhook', container);
    await click('Confirmar e criar webhook', dialog());
    assert.ok(dialog().textContent?.includes('API key do AbacatePay'));
    assert.ok(dialog().textContent?.includes('PRODUCT:READ'));
    assert.ok(dialog().textContent?.includes('WEBHOOK:CREATE'));
    assert.ok(dialog().textContent?.includes('CHECKOUT:READ'));
    assert.ok(dialog().textContent?.includes('TRANSPARENT:READ'));
    assert.ok(dialog().textContent?.includes('SUBSCRIPTION:READ'));
    assert.ok(dialog().textContent?.includes('CUSTOMER:READ'));
    await fillApiKey('test-key-do-not-store');
    responseStatus = 200; responseMessage = '';
    await click('Recriar webhook', dialog());
    assert.deepEqual(calls.map(call => call.body), [undefined, '{"apiKey":"test-key-do-not-store"}']);
    assert.ok(calls.every(call => call.path === `/api${base}/abacatepay/webhook` && call.method === 'POST'));
    assert.equal(container.querySelector('#abacatepay-webhook-api-key'), null);
    assert.equal(refreshed, 1);
    assert.ok(container.textContent?.includes('Webhook novo criado.'));
  });

  it('exibe erros da API e encaminha erros 401 para o fluxo de autenticação', async () => {
    responseStatus = 503; responseMessage = 'Serviço temporariamente indisponível.';
    await mount();
    await click('Recriar webhook', container);
    await click('Confirmar e criar webhook', dialog());
    assert.ok(dialog().textContent?.includes('Serviço temporariamente indisponível.'));
    assert.equal(refreshed, 0);
    responseStatus = 401; responseMessage = 'Sessão expirada.';
    await click('Confirmar e criar webhook', dialog());
    assert.equal(unauthorized, 1);
    assert.equal(refreshed, 0);
  });
});
