import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedAppRoute } from '../server/app-routes';
import { appUpstreamPath, appJsonBody } from '../server/app-proxy-request';
import { getMcpConnection, listMcpKeys, createMcpKey, revokeMcpKey, revokeAllMcpKeys } from '../src/lib/mcp-keys';

describe('Chaves MCP: contrato e proxy', () => {
  it('libera apenas os métodos e caminhos previstos para chaves e conciliação', () => {
    const prefix = '/companies/test-company';
    for (const [method, path] of [
      ['GET', '/mcp-keys'], ['GET', '/mcp-connection'], ['DELETE', '/mcp-keys/key-1'], ['DELETE', '/mcp-keys'],
      ['GET', '/past-sales/reconcile'], ['POST', '/past-sales/reconcile/apply'],
    ]) assert.equal(isAllowedAppRoute(method, prefix + path), true, `${method} ${path}`);
    for (const [method, path] of [
      ['POST', '/mcp-keys'], ['POST', '/mcp-connection'], ['GET', '/mcp-connection/extra'], ['PATCH', '/mcp-keys/key-1'], ['GET', '/mcp-keys/key-1'],
      ['DELETE', '/mcp-key'], ['DELETE', '/mcp-keys/key-1/extra'],
      ['POST', '/past-sales/reconcile'], ['DELETE', '/past-sales/reconcile'],
      ['GET', '/past-sales/reconcile/apply'], ['DELETE', '/products'],
    ]) assert.equal(isAllowedAppRoute(method, prefix + path), false, `${method} ${path}`);
    assert.equal(isAllowedAppRoute('DELETE', '/companies/../mcp-keys/key-1'), false);
  });
  it('preserva query de conciliação e monta o destino /v1/app', () => {
    assert.equal(appUpstreamPath('/api/app/companies/test/past-sales/reconcile?period=2026-10'),
      '/v1/app/companies/test/past-sales/reconcile?period=2026-10');
    assert.equal(appUpstreamPath('/api/app/companies/test/mcp-keys/key-1'), '/v1/app/companies/test/mcp-keys/key-1');
    assert.equal(appUpstreamPath('/api/application'), '/api/application');
  });
  it('DELETE nunca encaminha corpo JSON, mas POST de aplicação preserva o payload', () => {
    assert.equal(appJsonBody('DELETE', {}), undefined);
    assert.equal(appJsonBody('DELETE', { unexpected: true }), undefined);
    assert.equal(appJsonBody('GET', {}), undefined);
    assert.equal(appJsonBody('HEAD', {}), undefined);
    assert.equal(appJsonBody('POST', { period: '2026-10' }), '{"period":"2026-10"}');
  });
  it('lista, cria com nome opcional e revoga usando caminhos relativos pelo proxy', async () => {
    const original = globalThis.fetch;
    const calls: { path: string; method: string; body: any; headers: any }[] = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ path: String(url), method: init?.method || 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: init?.headers });
      const data = init?.method === 'GET' ? { items: [{ id: 'legacy', legacy: true }] }
        : init?.method === 'DELETE' ? { revoked: 1, remaining: 0 }
        : { apiKey: 'test-only-secret', mcpUrl: 'https://example.test/mcp', claudeCodeCommand: 'test' };
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    };
    try {
      assert.deepEqual(await listMcpKeys('/app/companies/test'), [{ id: 'legacy', legacy: true }]);
      await createMcpKey('/app/companies/test', ' Claude Code do notebook ');
      await createMcpKey('/app/companies/test', '   ');
      await revokeMcpKey('/app/companies/test', 'key-1');
      await revokeAllMcpKeys('/app/companies/test');
      assert.deepEqual(calls.map(({ path, method, body }) => ({ path, method, body })), [
        { path: '/api/app/companies/test/mcp-keys', method: 'GET', body: undefined },
        { path: '/api/app/companies/test/mcp-key', method: 'POST', body: { label: 'Claude Code do notebook' } },
        { path: '/api/app/companies/test/mcp-key', method: 'POST', body: {} },
        { path: '/api/app/companies/test/mcp-keys/key-1', method: 'DELETE', body: undefined },
        { path: '/api/app/companies/test/mcp-keys', method: 'DELETE', body: undefined },
      ]);
      assert.deepEqual(calls[3].headers, {});
      const before = calls.length;
      await assert.rejects(createMcpKey('/app/companies/test', 'x'.repeat(61)), /60 caracteres/);
      assert.equal(calls.length, before);
    } finally { globalThis.fetch = original; }
  });
  it('lista malformada dá erro explícito em vez de parecer vazia', async () => {
    const original = globalThis.fetch;
    try {
      for (const invalid of [{}, { items: null }, { items: [{ legacy: true }] }, { items: [{ id: 'key', legacy: false, label: 2 }] }]) {
        globalThis.fetch = async () => new Response(JSON.stringify(invalid), { headers: { 'content-type': 'application/json' } });
        await assert.rejects(listMcpKeys('/app/companies/test'), /lista de chaves/);
      }
    } finally { globalThis.fetch = original; }
  });
  it('carrega instruções pelo proxy sem gerar chave, sem corpo e sem inventar campos ausentes', async () => {
    const original = globalThis.fetch;
    const connection = { mcpUrl: 'https://example.test/mcp', keyPlaceholder: '<SUA_CHAVE>',
      authorizationHeader: 'Authorization: Bearer <SUA_CHAVE>', claudeCodeCommand: 'connect <SUA_CHAVE>',
      jsonConfig: { mcpServers: { acainfe: { url: 'https://example.test/mcp', headers: { Authorization: 'Bearer <SUA_CHAVE>' } } } } };
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), '/api/app/companies/test/mcp-connection');
      assert.equal(init?.method, 'GET'); assert.equal(init?.body, undefined);
      return new Response(JSON.stringify(connection), { headers: { 'content-type': 'application/json' } });
    };
    try {
      assert.deepEqual(await getMcpConnection('/app/companies/test'), connection);
      assert.equal(appUpstreamPath('/api/app/companies/test/mcp-connection'), '/v1/app/companies/test/mcp-connection');
      globalThis.fetch = async () => new Response('{}', { headers: { 'content-type': 'application/json' } });
      await assert.rejects(getMcpConnection('/app/companies/test'), /instruções de conexão MCP completas/);
    } finally { globalThis.fetch = original; }
  });
});
