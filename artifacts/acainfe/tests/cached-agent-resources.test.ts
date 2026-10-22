import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { createAgentResourcesRouter, publicMcpServerCard } from '../server/agent-resources';
import { cachedPublicDocument, PUBLIC_DOCUMENT_TTL_MS } from '../server/cached-public-document';
import { publicOpenApi } from '../server/public-api-schema';

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
// Synthetic contract fixture only; never a request to the real API.
const completeSpec = {
  ...structuredClone(publicOpenApi),
  paths: {
    ...structuredClone(publicOpenApi.paths),
    '/v1/mock-only': { get: {
      operationId: 'mockOnlyOperation', summary: 'Synthetic fixture',
      responses: { '200': { description: 'Mock response' } },
    } },
  },
};

async function withRouter(fetcher: typeof fetch, check: (base: string) => Promise<void>, now = () => 0) {
  const app = express();
  app.use(await createAgentResourcesRouter({ fetcher, now, warn: () => {} }));
  const server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address() as { port: number };
  try { await check(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

describe('Documentos públicos da API — transporte e relógio simulados', () => {
  it('repassa o contrato completo, sem restringir às oito operações da reserva', async () => {
    await withRouter(async (url, init) => {
      assert.equal(String(url), 'https://api.acainfe.com/openapi.json');
      assert.deepEqual(init?.headers, { Accept: 'application/json' });
      assert.equal(init?.redirect, 'error');
      assert.ok(init?.signal instanceof AbortSignal);
      return json(completeSpec);
    }, async base => {
      const result = await fetch(base + '/openapi.json');
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.equal(result.headers.get('cache-control'), 'public, max-age=3600');
      assert.deepEqual(await result.json(), completeSpec);
    });
  });

  it('repassa o cartão completo da API, inclusive descrição e outros metadados públicos', async () => {
    const card = { ...publicMcpServerCard, description: 'Mock upstream description', metadata: { mock: true } };
    await withRouter(async url => {
      assert.equal(String(url), 'https://api.acainfe.com/.well-known/mcp.json');
      return json(card);
    }, async base => {
      const result = await fetch(base + '/.well-known/mcp.json');
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.deepEqual(await result.json(), card);
    });
  });

  it('cada documento tem cache independente de exatamente uma hora e informa a idade ao cliente', async () => {
    let time = 0, calls = 0, revision = 1;
    await withRouter(async url => {
      calls++;
      return json({ ...(String(url).endsWith('/openapi.json') ? completeSpec : publicMcpServerCard), revision });
    }, async base => {
      for (const path of ['/openapi.json', '/.well-known/mcp.json']) {
        assert.equal((await (await fetch(base + path)).json()).revision, 1);
      }
      assert.equal(calls, 2);
      revision = 2;
      time = PUBLIC_DOCUMENT_TTL_MS - 1;
      for (const path of ['/openapi.json', '/.well-known/mcp.json']) {
        const result = await fetch(base + path);
        assert.equal(result.headers.get('age'), '3599');
        assert.equal((await result.json()).revision, 1);
      }
      assert.equal(calls, 2);
      time = PUBLIC_DOCUMENT_TTL_MS;
      for (const path of ['/openapi.json', '/.well-known/mcp.json']) {
        const result = await fetch(base + path);
        assert.equal(result.headers.get('age'), '0');
        assert.equal((await result.json()).revision, 2);
      }
      assert.equal(calls, 4);
    }, () => time);
  });

  it('404, erro 500, timeout, falha de rede, JSON inválido e documento incorreto usam reservas com 200', async () => {
    const failures: (typeof fetch)[] = [
      async () => new Response('', { status: 404 }),
      async () => new Response('', { status: 500 }),
      async () => { throw new DOMException('Mock timeout', 'TimeoutError'); },
      async () => { throw new TypeError('Mock network error'); },
      async () => new Response('{invalid-json'),
      async () => json({ message: 'Not a public contract or card' }),
    ];
    for (const fetcher of failures) await withRouter(fetcher, async base => {
      for (const [path, expected] of [
        ['/openapi.json', publicOpenApi], ['/.well-known/mcp.json', publicMcpServerCard],
      ] as const) {
        const response = await fetch(base + path);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
        assert.deepEqual(await response.json(), expected);
      }
    });
  });

  it('uma falha também fica em cache e a API volta a ser buscada após uma hora', async () => {
    let time = 0, calls = 0;
    await withRouter(async () => {
      calls++;
      return calls === 1 ? new Response('', { status: 404 }) : json(completeSpec);
    }, async base => {
      assert.deepEqual(await (await fetch(base + '/openapi.json')).json(), publicOpenApi);
      time = PUBLIC_DOCUMENT_TTL_MS - 1;
      assert.deepEqual(await (await fetch(base + '/openapi.json')).json(), publicOpenApi);
      assert.equal(calls, 1);
      time++;
      assert.deepEqual(await (await fetch(base + '/openapi.json')).json(), completeSpec);
      assert.equal(calls, 2);
    }, () => time);
  });

  it('pedidos simultâneos compartilham uma única busca no servidor', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const get = cachedPublicDocument('https://api.acainfe.com/openapi.json', publicOpenApi, () => true, {
      fetcher: async () => { calls++; await gate; return json(completeSpec); },
    });
    const requests = Array.from({ length: 20 }, () => get());
    assert.equal(calls, 1);
    release();
    const values = await Promise.all(requests);
    for (const value of values) assert.deepEqual(JSON.parse(value.content), completeSpec);
    assert.equal(calls, 1);
  });

  it('não publica rotas internas se houver regressão no contrato upstream', async () => {
    for (const path of ['/v1/admin/fixture', '/v1/app/fixture', '/webhooks/fixture']) {
      await withRouter(async () => json({
        ...completeSpec, paths: { ...completeSpec.paths, [path]: { get: {} } },
      }), async base => {
        const result = await fetch(base + '/openapi.json');
        assert.equal(result.status, 200);
        assert.deepEqual(await result.json(), publicOpenApi);
      });
    }
  });
});
