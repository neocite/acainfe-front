import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { McpKeyItem } from '../src/lib/mcp-keys';

describe('Chaves MCP: confirmações e estados da interface', () => {
  let dom: JSDOM, root: Root, container: HTMLElement;
  let Section: typeof import('../src/components/McpKeysSection').McpKeysSection;
  let createRoot: typeof import('react-dom/client').createRoot;
  let keys: McpKeyItem[], calls: { path: string; method: string; body: unknown }[];
  let loadStatus: number, deleteStatus: number, failAfterDelete: boolean;
  let generated: number, unauthorized: number, revoked: (string[] | undefined)[];
  let pendingDelete: (() => void) | undefined;
  let holdDelete: boolean;
  const originalFetch = globalThis.fetch;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const base = '/app/companies/test-company';
  const modern: McpKeyItem = {
    id: 'new-key', label: 'Claude Code do notebook', last4: 'abcd',
    createdAt: '2026-10-19T12:30:00', createdVia: 'APP', lastUsedAt: null, legacy: false,
  };
  before(async () => {
    dom = new JSDOM('<html><body></body></html>', { url: 'https://example.test/app', pretendToBeVisual: true });
    const exposed: Record<string, unknown> = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
    };
    for (const name of ['Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'DocumentFragment', 'NodeFilter', 'MutationObserver', 'Event', 'MouseEvent', 'CustomEvent']) exposed[name] = (dom.window as any)[name];
    for (const [name, value] of Object.entries(exposed)) {
      descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    ({ createRoot } = await import('react-dom/client'));
    ({ McpKeysSection: Section } = await import('../src/components/McpKeysSection'));
  });
  after(() => {
    globalThis.fetch = originalFetch; dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as any)[name];
    }
  });
  beforeEach(() => {
    keys = [{ ...modern }]; calls = []; loadStatus = 200; deleteStatus = 200; failAfterDelete = false;
    generated = 0; unauthorized = 0; revoked = []; pendingDelete = undefined; holdDelete = false;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    globalThis.fetch = async (url, init) => {
      const path = String(url), method = init?.method || 'GET';
      calls.push({ path, method, body: init?.body });
      let data: unknown, status = 200;
      if (method === 'GET') {
        status = failAfterDelete && calls.some(call => call.method === 'DELETE') ? 503 : loadStatus;
        data = status === 200 ? { items: keys } : { message: 'Falha ao carregar chaves' };
      } else if (method === 'DELETE') {
        assert.equal(init?.body, undefined);
        assert.equal((init?.headers as Record<string, string>)?.['Content-Type'], undefined);
        if (holdDelete) await new Promise<void>(resolve => { pendingDelete = resolve; });
        status = deleteStatus;
        if (status !== 200) data = { message: 'Falha ao revogar' };
        else if (path.endsWith('/mcp-keys')) { data = { revoked: keys.length }; keys = []; }
        else { keys = keys.filter(key => !path.endsWith(`/${key.id}`)); data = { revoked: true, remaining: keys.length }; }
      } else throw new Error(`Método inesperado ${method}`);
      return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    };
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = originalFetch; });
  async function mount(refreshToken = 0, companyBase = base, variant: 'panel' | 'onboarding' = 'panel') {
    await act(async () => root.render(createElement(Section, {
      base: companyBase, refreshToken, variant, onGenerate: () => { generated++; },
      onUnauthorized: () => { unauthorized++; }, onRevoked: (ids?: string[]) => { revoked.push(ids); },
    })));
  }
  async function click(node: HTMLElement) { await act(async () => node.click()); }
  function button(text: string, parent: ParentNode = container) {
    const found = [...parent.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text);
    assert.ok(found, `Botão ausente: ${text}`); return found;
  }
  function dialog() { const result = document.querySelector<HTMLElement>('[role="dialog"]'); assert.ok(result); return result; }
  async function typeConfirm(text: string) {
    const input = dialog().querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  const deletions = () => calls.filter(call => call.method === 'DELETE');

  it('mostra ordem, nome/final, datas, nunca usada e chaves antigas sem detalhes inventados', async () => {
    keys = [modern,
      { ...modern, id: 'used-key', label: '', last4: '1234', lastUsedAt: '2026-10-19T14:05:00' },
      { id: 'legacy-key', legacy: true },
    ];
    await mount();
    const rows = [...container.querySelectorAll('.mcp-key-row')];
    assert.ok(rows[0].textContent?.includes('Claude Code do notebook'));
    assert.ok(rows[0].textContent?.includes('…abcd'));
    assert.ok(rows[0].textContent?.includes('19/10/2026'));
    assert.ok(rows[0].textContent?.includes('Nunca usada'));
    assert.ok(rows[1].textContent?.includes('Sem nome'));
    assert.ok(rows[1].textContent?.includes('19/10/2026 14:05'));
    assert.ok(rows[2].textContent?.includes('Chave antiga (sem detalhes)'));
    assert.ok(rows[2].textContent?.includes('Ainda não foi usada desde o registro de chaves. Se nenhum agente de IA estiver usando, pode revogar.'));
    assert.equal(rows[2].querySelector('dl'), null);
    assert.equal(rows[2].querySelector('code'), null);
    assert.equal(deletions().length, 0);
  });
  it('chaves antigas mostram final e/ou último uso sem inventar nome nem data de criação', async () => {
    keys = [
      { id: 'legacy-both', legacy: true, last4: 'abcd', lastUsedAt: '2026-10-19T14:05:00' },
      { id: 'legacy-final', legacy: true, last4: '1234' },
      { id: 'legacy-use', legacy: true, lastUsedAt: '2026-10-19T15:30:00' },
    ];
    await mount();
    const rows = [...container.querySelectorAll('.mcp-key-row')];
    assert.ok(rows[0].textContent?.includes('Chave antiga'));
    assert.ok(rows[0].textContent?.includes('…abcd'));
    assert.ok(rows[0].textContent?.includes('Último uso'));
    assert.ok(rows[0].textContent?.includes('19/10/2026 14:05'));
    assert.ok(rows[1].textContent?.includes('…1234'));
    assert.equal(rows[1].querySelector('dl'), null);
    assert.equal(rows[2].querySelector('code'), null);
    assert.ok(rows[2].textContent?.includes('19/10/2026 15:30'));
    for (const row of rows) {
      assert.equal(row.textContent?.includes('Criada em'), false);
      assert.equal(row.textContent?.includes('Sem nome'), false);
      assert.equal(row.textContent?.includes('sem detalhes'), false);
      assert.equal(row.textContent?.includes('Ainda não foi usada'), false);
    }
    assert.ok(container.textContent?.includes('Para descobrir qual chave antiga está em uso, use o MCP uma vez e clique em Atualizar status: a chave usada passa a mostrar o final e o último uso.'));
    await click(rows[0].querySelector('button')!);
    assert.ok(dialog().textContent?.includes('Revogar a chave …abcd?'));
    await click(button('Cancelar', dialog()));
  });
  it('Atualizar faz apenas GET e revela os dados registrados após uso de uma chave antiga', async () => {
    keys = [{ id: 'legacy-key', legacy: true }];
    await mount(0, base, 'onboarding');
    assert.ok(container.textContent?.includes('Chave antiga (sem detalhes)'));
    keys = [{ id: 'legacy-key', legacy: true, last4: '5678', lastUsedAt: '2026-10-19T16:40:00' }];
    await click(button('Atualizar'));
    assert.equal(calls.filter(call => call.method === 'GET').length, 2);
    assert.equal(calls.every(call => call.path === '/api/app/companies/test-company/mcp-keys'), true);
    assert.equal(calls.some(call => call.method !== 'GET'), false);
    assert.ok(container.textContent?.includes('…5678'));
    assert.ok(container.textContent?.includes('19/10/2026 16:40'));
    assert.equal(container.textContent?.includes('Chave antiga (sem detalhes)'), false);
    assert.equal(container.textContent?.includes('Ainda não foi usada'), false);
    assert.equal(generated, 0);
  });
  it('painel tem rótulo e geração no cabeçalho, sem Atualizar separado', async () => {
    await mount();
    assert.ok(container.textContent?.includes('ASSISTENTE DE IA'));
    assert.ok(container.querySelector('.mcp-keys-head')?.textContent?.includes('Gerar nova chave'));
    assert.equal([...container.querySelectorAll('button')].some(node => node.textContent?.trim() === 'Atualizar'), false);
  });
  it('cancelar a revogação não envia DELETE', async () => {
    await mount(); await click(button('Revogar'));
    assert.ok(dialog().textContent?.includes('Qualquer agente de IA ou integração usando essa chave para de funcionar na hora. Não dá para desfazer.'));
    assert.ok(dialog().textContent?.includes('Revogar a chave Claude Code do notebook?'));
    await click(button('Cancelar', dialog()));
    assert.equal(deletions().length, 0);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(container.querySelectorAll('.mcp-key-row').length, 1);
  });
  it('revoga uma chave antiga pelo id e atualiza sem exibir segredo', async () => {
    keys = [{ id: 'legacy-key', legacy: true }];
    await mount(); await click(button('Revogar'));
    assert.ok(dialog().textContent?.includes('Revogar a chave Chave antiga?'));
    await click(button('Revogar chave', dialog()));
    assert.equal(deletions()[0].path, '/api/app/companies/test-company/mcp-keys/legacy-key');
    assert.deepEqual(revoked, [['legacy-key']]);
    assert.ok(container.textContent?.includes('Chave revogada'));
    assert.ok(container.textContent?.includes('Nenhuma chave ativa'));
    assert.equal(calls.filter(call => call.method === 'GET').length, 2);
  });
  it('confirmação sem nome usa …last4 e cancelar todas não altera nada', async () => {
    keys = [{ ...modern, label: null }];
    await mount(); await click(button('Revogar'));
    assert.ok(dialog().textContent?.includes('Revogar a chave …abcd?'));
    await click(button('Cancelar', dialog()));
    await click(button('Revogar todas as chaves'));
    await typeConfirm('REVOGAR'); await click(button('Cancelar', dialog()));
    assert.equal(deletions().length, 0);
    assert.equal(keys.length, 1);
  });
  it('revogar todas exige exatamente REVOGAR, usa DELETE sem corpo e oferece nova chave sem criá-la', async () => {
    await mount(); await click(button('Revogar todas as chaves'));
    assert.ok(dialog().textContent?.includes('O MCP para de funcionar em todos os agentes e integrações'));
    const confirm = button('Revogar todas', dialog());
    assert.equal(confirm.disabled, true);
    for (const value of ['revogar', 'REVOGAR ', 'REVOGA']) {
      await typeConfirm(value); assert.equal(confirm.disabled, true); await click(confirm);
    }
    assert.equal(deletions().length, 0);
    await typeConfirm('REVOGAR'); assert.equal(confirm.disabled, false); await click(confirm);
    assert.equal(deletions()[0].path, '/api/app/companies/test-company/mcp-keys');
    assert.deepEqual(revoked, [undefined]);
    assert.ok(container.textContent?.includes('Todas as chaves foram revogadas'));
    assert.ok(container.textContent?.includes('Nenhuma chave ativa'));
    assert.equal(generated, 0);
    await click(button('Gerar nova chave')); assert.equal(generated, 1);
    assert.equal(calls.some(call => call.method === 'POST'), false);
  });
  it('bloqueia envio duplicado, cancelar e fechar enquanto a revogação está pendente', async () => {
    await mount(); holdDelete = true;
    await click(button('Revogar'));
    const confirm = button('Revogar chave', dialog());
    await click(confirm); await click(confirm);
    assert.equal(deletions().length, 1);
    assert.equal(button('Cancelar', dialog()).disabled, true);
    await click(button('Cancelar', dialog()));
    assert.ok(document.querySelector('[role="dialog"]'));
    await act(async () => { pendingDelete!(); });
    assert.equal(deletions().length, 1);
    assert.ok(container.textContent?.includes('Chave revogada'));
  });
  it('erro de revogação mantém chave e confirmação abertas para tentar novamente', async () => {
    await mount(); deleteStatus = 503;
    await click(button('Revogar')); await click(button('Revogar chave', dialog()));
    assert.ok(dialog().textContent?.includes('Falha ao revogar'));
    assert.equal(keys.length, 1); assert.equal(revoked.length, 0);
    assert.equal(container.textContent?.includes('Chave revogada'), false);
    deleteStatus = 200; await click(button('Revogar chave', dialog()));
    assert.ok(container.textContent?.includes('Chave revogada'));
  });
  it('falha ao recarregar não esconde o sucesso da revogação', async () => {
    await mount(); failAfterDelete = true;
    await click(button('Revogar')); await click(button('Revogar chave', dialog()));
    assert.ok(container.textContent?.includes('Chave revogada'));
    assert.ok(container.textContent?.includes('Não foi possível atualizar a lista agora'));
    failAfterDelete = false; await click(button('Tentar novamente'));
    assert.ok(container.textContent?.includes('Nenhuma chave ativa'));
  });
  it('erro de listagem tem retry e refreshToken recarrega as chaves', async () => {
    loadStatus = 503; await mount();
    assert.ok(container.textContent?.includes('Falha ao carregar chaves'));
    assert.equal(container.textContent?.includes('Nenhuma chave ativa'), false);
    loadStatus = 200; await click(button('Tentar novamente'));
    assert.equal(container.querySelectorAll('.mcp-key-row').length, 1);
    keys = [modern, { id: 'legacy-key', legacy: true }]; await mount(1);
    assert.equal(container.querySelectorAll('.mcp-key-row').length, 2);
  });
  it('401 em listagem ou revogação exige nova autenticação', async () => {
    loadStatus = 401; await mount(); assert.equal(unauthorized, 1);
    loadStatus = 200; await click(button('Tentar novamente'));
    deleteStatus = 401; await click(button('Revogar')); await click(button('Revogar chave', dialog()));
    assert.equal(unauthorized, 2); assert.equal(revoked.length, 0);
  });
});
