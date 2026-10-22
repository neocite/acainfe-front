import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { run } from '../cli/acainfe.mjs';

const FAKE_KEY = 'synthetic-cli-test-key-not-valid';
function harness(options: { status?: number; data?: unknown; file?: string; key?: string; reject?: string } = {}) {
  const calls: { url: string; init: RequestInit }[] = [], stdout: string[] = [], stderr: string[] = [];
  const files: string[] = [];
  const io = {
    env: { ACAINFE_API_KEY: options.key ?? FAKE_KEY },
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (options.reject) throw new Error(options.reject);
      return new Response(JSON.stringify(options.data ?? { ok: true }), { status: options.status ?? 200 });
    },
    readFile: async (path: string) => { files.push(path); return options.file ?? '{"externalId":"mock-order","items":[{"productExternalId":"mock-product","totalCents":100}]}'; },
    out: (text: string) => { stdout.push(text); }, err: (text: string) => { stderr.push(text); },
  };
  return { io, calls, stdout, stderr, files };
}

describe('CLI açaínfe — transporte simulado; sem vendas ou empresas reais', () => {
  it('ajuda, versão e comando executável funcionam sem rede nem credenciais', async () => {
    const h = harness({ key: '' });
    for (const args of [[], ['--help'], ['help'], ['-h'], ['--version']]) assert.equal(await run(args, h.io), 0);
    assert.equal(h.calls.length, 0);
    assert.match(h.stdout[0], /ACAINFE_API_KEY/);
    const result = spawnSync(process.execPath, ['cli/acainfe.mjs', '--help'], { encoding: 'utf8', env: {} });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /açaínfe CLI/);
  });

  it('consultas públicas não enviam a chave, mesmo quando configurada', async () => {
    for (const [command, url] of [
      ['pricing', 'https://api.acainfe.com/v1/public/pricing'],
      ['coverage', 'https://api.acainfe.com/v1/public/coverage'],
      ['openapi', 'https://acainfe.com/openapi.json'],
      ['mcp-config', 'https://acainfe.com/mcp.json'],
    ]) {
      const h = harness();
      assert.equal(await run([command], h.io), 0);
      assert.equal(h.calls[0].url, url);
      assert.equal(h.calls[0].init.method, 'GET');
      assert.equal((h.calls[0].init.headers as Record<string, string>)['x-api-key'], undefined);
      assert.deepEqual(JSON.parse(h.stdout[0]), { ok: true });
    }
  });

  it('consultas privadas usam só a origem fixa, chave no cabeçalho e sem seguir redirecionamentos', async () => {
    for (const [args, suffix] of [
      [['products', 'list'], '/v1/products'],
      [['invoices', 'list'], '/v1/invoices'],
      [['invoices', 'get', 'invoice-mock'], '/v1/invoices/invoice-mock'],
    ] as const) {
      const h = harness();
      assert.equal(await run([...args], h.io), 0);
      const { url, init } = h.calls[0];
      assert.equal(url, 'https://api.acainfe.com' + suffix);
      assert.ok(!url.includes(FAKE_KEY));
      assert.equal((init.headers as Record<string, string>)['x-api-key'], FAKE_KEY);
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal);
      assert.ok(!h.stdout.join('').includes(FAKE_KEY));
    }
  });

  it('codifica identificadores sem permitir troca de host ou inserção de query', async () => {
    const h = harness();
    assert.equal(await run(['invoices', 'get', 'mock?host=https://evil.example'], h.io), 0);
    assert.equal(h.calls[0].url, 'https://api.acainfe.com/v1/invoices/mock%3Fhost%3Dhttps%3A%2F%2Fevil.example');
  });

  it('escritas exigem confirmação explícita e arquivo, sem ler arquivo nem enviar nada antes', async () => {
    for (const args of [
      ['sales', 'create'], ['sales', 'create', '--file', 'mock.json'],
      ['sales', 'create', '--confirm'], ['products', 'create', '--file', 'mock.json'],
      ['invoices', 'cancel', 'mock', '--file', 'mock.json'],
    ]) {
      const h = harness();
      assert.equal(await run(args, h.io), 1);
      assert.equal(h.calls.length, 0);
      assert.equal(h.files.length, 0);
      assert.match(h.stderr[0], /--confirm/);
    }
  });

  it('envia POST com JSON para as três ações autorizadas, uma única vez', async () => {
    for (const [args, path, payload] of [
      [['sales', 'create'], '/v1/sales', { externalId: 'mock', items: [{ productExternalId: 'mock', totalCents: 100 }] }],
      [['products', 'create'], '/v1/products', { name: 'Mock' }],
      [['invoices', 'cancel', 'mock'], '/v1/invoices/mock/cancel', { reasonCode: '1', reason: 'Motivo sintético de teste' }],
    ] as const) {
      const h = harness({ status: path === '/v1/sales' ? 202 : 201, file: JSON.stringify(payload) });
      assert.equal(await run([...args, '--file', 'mock.json', '--confirm'], h.io), 0);
      assert.equal(h.calls.length, 1);
      assert.equal(h.calls[0].url, 'https://api.acainfe.com' + path);
      assert.equal(h.calls[0].init.method, 'POST');
      assert.deepEqual(JSON.parse(h.calls[0].init.body as string), payload);
      assert.equal((h.calls[0].init.headers as Record<string, string>)['Content-Type'], 'application/json');
    }
  });

  it('recusa credencial ausente, argumentos de chave, opções desconhecidas e identificador ausente', async () => {
    for (const args of [
      ['invoices', 'get'], ['invoices', 'get', '..'], ['invoices', 'get', '--file', 'x'],
      ['unknown'], ['pricing', '--api-key', FAKE_KEY], ['pricing', '--base-url', 'https://evil.example'],
      ['pricing', '--confirm'], ['pricing', '--file', 'x'],
      ['sales', 'create', '--file', '--confirm'], ['sales', 'create', '--confirm', '--confirm'],
    ]) {
      const h = harness();
      assert.equal(await run(args, h.io), 1);
      assert.equal(h.calls.length, 0);
      assert.ok(!h.stderr.join('').includes(FAKE_KEY));
    }
    const h = harness({ key: '' });
    assert.equal(await run(['invoices', 'list'], h.io), 1);
    assert.match(h.stderr[0], /Defina ACAINFE_API_KEY/);
    assert.equal(h.calls.length, 0);
  });

  it('recusa JSON inválido, arrays, credenciais no corpo e arquivos maiores que 1 MB', async () => {
    for (const file of ['{', 'null', '[]', '{"apiKey":"mock"}', '{"authorization":"mock"}', ' '.repeat(1024 * 1024 + 1)]) {
      const h = harness({ file });
      assert.equal(await run(['sales', 'create', '--file', 'mock.json', '--confirm'], h.io), 1);
      assert.equal(h.calls.length, 0);
    }
  });

  it('erros HTTP, falhas de rede e ecos de chave não vazam credenciais nem repetem pedido', async () => {
    for (const options of [
      { status: 409, data: { message: `Conflito ${FAKE_KEY}` } },
      { status: 422, data: { message: 'Dados inválidos' } },
      { reject: `Falha de rede ${FAKE_KEY}` },
    ]) {
      const h = harness(options);
      assert.equal(await run(['invoices', 'list'], h.io), 1);
      assert.equal(h.calls.length, 1);
      assert.equal(h.stdout.length, 0);
      assert.ok(!h.stderr.join('').includes(FAKE_KEY));
    }
    const h = harness({ data: { echo: FAKE_KEY } });
    assert.equal(await run(['invoices', 'list'], h.io), 0);
    assert.ok(!h.stdout[0].includes(FAKE_KEY));
    assert.equal(JSON.parse(h.stdout[0]).echo, '[REDACTED]');
  });

  it('pacote tem binário, não tem dependências e bloqueia publicação npm acidental', async () => {
    const pkg = JSON.parse(await readFile('cli/package.json', 'utf8'));
    assert.equal(pkg.bin.acainfe, './acainfe.mjs');
    assert.equal(pkg.private, true);
    assert.equal(pkg.dependencies, undefined);
  });
});
