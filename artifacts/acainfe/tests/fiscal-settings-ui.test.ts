import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { ViteDevServer } from 'vite';
import { DEFAULT_TAX_TEMPLATE, type FiscalSettings as Settings } from '../src/lib/fiscal-settings';

describe('Dados fiscais: consulta, edição e envio reais da interface', () => {
  let dom: JSDOM, root: Root, container: HTMLElement, modules: ViteDevServer;
  let Component: typeof import('../src/components/FiscalSettings').FiscalSettings;
  let createRoot: typeof import('react-dom/client').createRoot;
  let data: Settings, calls: { path: string; method: string; body?: any }[];
  let copied: string[], unauthorized: number, changed: number, loadFailure: boolean, sendFailure: string, saveFailure: boolean;
  const originalFetch = globalThis.fetch;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const base = '/app/companies/fiscal-test';
  before(async () => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test/app', pretendToBeVisual: true });
    const exposed: Record<string, unknown> = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      location: dom.window.location, history: dom.window.history, IS_REACT_ACT_ENVIRONMENT: true,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    };
    for (const name of ['Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'HTMLSelectElement', 'DocumentFragment', 'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'CustomEvent']) exposed[name] = (dom.window as any)[name];
    for (const [name, value] of Object.entries(exposed)) {
      descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text); } } });
    ({ createRoot } = await import('react-dom/client'));
    const { createServer } = await import('vite');
    modules = await createServer({ configFile: false, envFile: false, root: process.cwd(), appType: 'custom',
      resolve: { alias: { '@': `${process.cwd()}/src` }, dedupe: ['react', 'react-dom'] },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
    ({ FiscalSettings: Component } = await modules.ssrLoadModule('/src/components/FiscalSettings.tsx'));
  });
  after(async () => {
    await modules?.close(); globalThis.fetch = originalFetch; dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as any)[name];
    }
  });
  beforeEach(() => {
    calls = []; copied = []; unauthorized = 0; changed = 0; loadFailure = false; sendFailure = ''; saveFailure = false;
    data = {
      company: { cnpj: '12345678000195', legalName: 'EMPRESA FISCAL DE TESTE', tradeName: 'Loja de teste',
        municipalRegistration: 'CCM-123', city: { code: '3548708', name: 'São Bernardo do Campo', uf: 'SP' },
        taxRegimeLabel: 'Simples Nacional', simplesNacionalTaxRateBps: 600, simplesRateIsEstimate: true,
        cnaes: [{ code: '6201-5/01', description: 'Desenvolvimento de software', primary: true }] },
      emission: { systemLabel: 'GINFES', environment: 'PRODUCTION', approvalRequired: false, series: '900', nextNumber: 10 },
      taxDefaults: { profileLabel: 'MicroSaaS', validated: false, nationalServiceCode: '010701', localServiceCode: '0107', nbsCode: '115022000',
        issRetention: false, ibsCbs: { cst: '000', cClassTrib: '000001', operationIndicator: '100301' } },
      issRate: { bps: 201, source: 'SIMPLES_ESTIMATE' },
      approximateTaxes: { rateBps: 1553, descriptionTemplate: DEFAULT_TAX_TEMPLATE },
      certificate: { present: true, expiresAt: '2027-12-31T00:00:00Z', expired: false, daysUntilExpiry: 437 },
      accountant: { name: 'Escritório de teste', email: 'contabilidade@example.test', whatsapp: '+5511912345678' },
      products: [{ name: 'Assinatura de teste', status: 'PENDING', nationalServiceCode: '010701', localServiceCode: '0107', nbsCode: '115022000', warnings: ['Confirme a sugestão com seu contador.'] }],
      readiness: { missing: [], recommended: [{ field: 'approximateTaxes', message: 'Confirme os tributos com o contador.' }] },
      text: 'Resumo fiscal completo\nEmpresa de teste\nISS: 2,01%\nTributos: 15,53%',
    };
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    globalThis.fetch = async (url, init) => {
      const path = String(url), method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path, method, body });
      let response: unknown;
      let status = 200;
      if (path === `/api${base}/fiscal-settings` && method === 'GET') {
        if (loadFailure) { status = 503; response = { message: 'Consulta temporariamente indisponível.' }; } else response = data;
      } else if (path === `/api${base}/fiscal-settings/send` && method === 'POST') {
        if (sendFailure) { status = sendFailure === 'UNAUTHORIZED' ? 401 : 422; response = { message: sendFailure }; }
        else response = { sentTo: { email: data.accountant?.email, whatsapp: data.accountant?.whatsapp } };
      } else if (path === `/api${base}` && method === 'PATCH') {
        if (saveFailure) { status = 422; response = { message: 'Dados fiscais recusados.', details: { 'approximateTaxes.rateBps': 'Percentual não aceito.' } }; }
        else {
          if (body.approximateTaxes) data.approximateTaxes = body.approximateTaxes;
          if (body.municipalRegistration !== undefined) data.company.municipalRegistration = body.municipalRegistration;
          if (body.simplesNacionalTaxRateBps !== undefined) data.company.simplesNacionalTaxRateBps = body.simplesNacionalTaxRateBps;
          response = {};
        }
      } else if (path === `/api${base}/accountant` && method === 'PUT') { data.accountant = body; response = {}; }
      else throw new Error(`Rota não prevista: ${method} ${path}`);
      return new Response(JSON.stringify(response), { status, headers: { 'content-type': 'application/json' } });
    };
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch; });
  async function mount() { await act(async () => root.render(createElement(Component, { base, onUnauthorized() { unauthorized++; }, onChanged() { changed++; } }))); }
  function button(label: string) {
    const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label || node.getAttribute('aria-label') === label);
    assert.ok(found, `Botão não encontrado: ${label}`); return found;
  }
  async function click(label: string) { await act(async () => button(label).click()); }
  async function fill(label: string, value: string) {
    const field = [...document.querySelectorAll('label')].find(node => node.textContent?.startsWith(label))?.querySelector('input,textarea') as HTMLInputElement | HTMLTextAreaElement;
    assert.ok(field, `Campo não encontrado: ${label}`);
    await act(async () => {
      const proto = field.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  const patches = () => calls.filter(call => call.method === 'PATCH');

  it('mostra todos os cards, percentuais, origem do ISS, CNAEs, certificado e avisos', async () => {
    await mount();
    for (const name of ['Empresa', 'Emissão', 'Tributação padrão dos produtos', 'ISS', 'Tributos aproximados', 'Certificado A1', 'Contador', 'Produtos', 'Pendências']) assert.ok(container.querySelector(`section[aria-label="${name}"]`), name);
    for (const text of ['EMPRESA FISCAL DE TESTE', 'São Bernardo do Campo', 'Principal', '2,01%', '15,53%', '6,00%', 'estimativa', 'estimado pela parcela do ISS no Simples', '31/12/2027', '000001', '100301', 'Pendente', '(11) 91234-5678']) assert.ok(container.textContent?.includes(text), text);
    assert.ok(container.querySelector('.fs-warn')?.textContent?.includes('Confirme a sugestão'));
    assert.equal(container.textContent?.includes('Modo teste'), false);
    assert.equal(container.querySelector('section[aria-label="Emissão"] button'), null);
  });
  it('copia exatamente text carregado, sem outro GET ou envio', async () => {
    await mount(); await click('Copiar resumo');
    assert.deepEqual(copied, [data.text]);
    assert.equal(calls.length, 1);
    assert.ok(container.textContent?.includes('Resumo copiado.'));
  });
  it('envia uma vez e informa os dois destinos devolvidos pela API', async () => {
    await mount();
    await act(async () => { button('Enviar ao contador').click(); button('Enviar ao contador').click(); });
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
    assert.ok(container.textContent?.includes('contabilidade@example.test e WhatsApp +5511912345678'));
  });
  it('falta de contador abre cadastro, salva e permite novo envio sem reenviar automaticamente', async () => {
    data.accountant = null; sendFailure = 'Cadastre o contato do contador antes de enviar.';
    await mount(); await click('Enviar ao contador');
    assert.ok(document.querySelector('[role="dialog"]'));
    await fill('Nome (opcional)', 'Meu contador'); await fill('E-mail', 'novo@example.test'); await click('Salvar');
    assert.deepEqual(calls.find(call => call.method === 'PUT')?.body, { name: 'Meu contador', email: 'novo@example.test' });
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.ok(container.textContent?.includes('novo@example.test'));
    sendFailure = ''; await click('Enviar ao contador');
    assert.equal(calls.filter(call => call.method === 'POST').length, 2);
    assert.ok(container.textContent?.includes('Enviado para e-mail novo@example.test.'));
  });
  for (const message of ['Contador não encontrado.', 'Não há contador na empresa.']) it(`abre cadastro quando a API responde "${message}"`, async () => {
    data.accountant = null; sendFailure = message;
    await mount(); await click('Enviar ao contador');
    assert.ok(document.querySelector('[role="dialog"]'));
    await click('Cancelar');
    assert.equal(calls.some(call => call.method === 'PUT'), false);
  });
  it('edita CCM e alíquota, preserva zero e atualiza a consulta sem enviar ambiente', async () => {
    await mount(); await click('Editar inscrição municipal e alíquota do Simples');
    await fill('Inscrição municipal', 'CCM-NOVO'); await fill('Alíquota do Simples', '0'); await click('Salvar');
    assert.deepEqual(patches()[0].body, { municipalRegistration: 'CCM-NOVO', simplesNacionalTaxRateBps: 0 });
    assert.equal(changed, 1);
    assert.equal(calls.filter(call => call.method === 'GET').length, 2);
    assert.ok(container.textContent?.includes('0,00%'));
    assert.ok(container.textContent?.includes('CCM-NOVO'));
  });
  it('não salva CCM obrigatório vazio nem alíquota acima do limite', async () => {
    data.readiness!.missing = [{ field: 'municipalRegistration', message: 'Preencha o CCM.' }];
    await mount(); await click('Editar inscrição municipal e alíquota do Simples');
    await fill('Inscrição municipal', '   '); await click('Salvar');
    assert.equal(patches().length, 0);
    await fill('Inscrição municipal', '123'); await fill('Alíquota do Simples', '33,01'); await click('Salvar');
    assert.equal(patches().length, 0);
    assert.ok(document.body.textContent?.includes('entre 0 e 33%'));
  });
  it('edita tributos, calcula prévia e envia apenas os campos permitidos', async () => {
    await mount(); await click('Editar tributos aproximados');
    await fill('Percentual (%)', '2,01'); await fill('Texto na nota', 'Tributos: R$ [ValorTributos]');
    assert.ok(document.querySelector('.tax-preview')?.textContent?.includes('Tributos: R$ 2,01'));
    await click('Salvar');
    assert.deepEqual(patches()[0].body, { approximateTaxes: { rateBps: 201, descriptionTemplate: 'Tributos: R$ [ValorTributos]' } });
    assert.ok(container.textContent?.includes('Tributos aproximados atualizados.'));
  });
  it('validação da API mantém o formulário e exibe o erro no percentual', async () => {
    saveFailure = true; await mount(); await click('Editar tributos aproximados'); await click('Salvar');
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.ok(document.body.textContent?.includes('Percentual não aceito.'));
    assert.equal(changed, 0);
  });
  it('aceita contador somente com WhatsApp e recusa e-mail/DDD inválidos', async () => {
    data.accountant = null; await mount(); await click('Editar contador');
    await click('Salvar');
    assert.equal(calls.some(call => call.method === 'PUT'), false);
    await fill('E-mail', 'invalido'); await click('Salvar');
    assert.equal(calls.some(call => call.method === 'PUT'), false);
    await fill('E-mail', ''); await fill('WhatsApp com DDD', '123'); await click('Salvar');
    assert.equal(calls.some(call => call.method === 'PUT'), false);
    await fill('WhatsApp com DDD', '(11) 91234-5678'); await click('Salvar');
    assert.deepEqual(calls.find(call => call.method === 'PUT')?.body, { whatsapp: '11912345678' });
  });
  it('não inventa dados ausentes, não mostra pendências vazias e só sinaliza teste quando explícito', async () => {
    delete data.taxDefaults; data.certificate = { present: false }; data.products = []; data.readiness = { missing: [], recommended: [] };
    data.emission.environment = 'HOMOLOGATION';
    await mount();
    assert.ok(container.textContent?.includes('Modo teste'));
    assert.ok(container.textContent?.includes('Nenhuma tributação padrão'));
    assert.ok(container.textContent?.includes('Nenhum certificado A1'));
    assert.equal(container.querySelector('section[aria-label="Pendências"]'), null);
  });
  it('falha de consulta permite repetir e falha de envio não mostra sucesso', async () => {
    loadFailure = true; await mount();
    assert.ok(container.textContent?.includes('Consulta temporariamente indisponível.'));
    loadFailure = false; await click('Tentar novamente');
    assert.ok(container.textContent?.includes('EMPRESA FISCAL DE TESTE'));
    sendFailure = 'Entrega indisponível no momento.'; await click('Enviar ao contador');
    assert.ok(container.textContent?.includes(sendFailure));
    assert.equal(document.querySelector('[role="dialog"]'), null);
  });
  it('401 é encaminhado à autenticação, sem cadastrar contador', async () => {
    await mount(); sendFailure = 'UNAUTHORIZED'; await click('Enviar ao contador');
    assert.equal(unauthorized, 1);
    assert.equal(document.querySelector('[role="dialog"]'), null);
  });
});
