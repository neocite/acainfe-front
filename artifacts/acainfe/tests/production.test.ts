import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';

describe('Servidor e login na publicação', () => {
  let server: ChildProcess;
  const base = 'http://127.0.0.1:3001';
  before(async () => {
    server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production', PORT: '3001' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('O servidor de produção não iniciou.')), 20000);
      server.stdout?.on('data', chunk => {
        if (chunk.toString().includes('açaínfe ready')) { clearTimeout(timeout); resolve(); }
      });
      server.once('error', () => { clearTimeout(timeout); reject(new Error('Falha ao iniciar o processo de produção.')); });
      server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor encerrou antes de iniciar (${code}).`)); });
    });
  });
  after(async () => {
    if (server && server.exitCode === null) {
      await new Promise<void>(resolve => {
        server.once('exit', () => resolve());
        server.kill('SIGTERM');
      });
    }
  });

  it('publica um processo Express, não apenas arquivos estáticos', async () => {
    const manifest = await readFile('.replit-artifact/artifact.toml', 'utf8');
    assert.match(manifest, /\[services\.production\][\s\S]*run\s*=\s*\[/);
    assert.doesNotMatch(manifest, /serve\s*=\s*"static"/);
    assert.doesNotMatch(manifest, /\[\[services\.production\.rewrites\]\]/);
  });
  it('serve a landing e a rota do app em modo produção', async () => {
    for (const route of ['/', '/app', '/app/conta', '/sign-in', '/sign-up', '/sign-in/sso-callback', '/sign-up/verify-email-address']) {
      const response = await fetch(`${base}${route}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      const html = await response.text();
      assert.match(html, /id="root"/);
      assert.doesNotMatch(html, /__SEO_DESCRIPTION__|__APP_ORIGIN__/);
    }
  });
  it('não libera usuário ou empresas sem sessão', async () => {
    for (const route of ['/api/app/me', '/api/app/fiscal-profiles', '/api/app/companies/company/products', '/api/app/companies/company/mcp-keys', '/api/app/companies/company/past-sales/reconcile?period=2026-10', '/api/app/companies/company/fiscal-settings']) {
      const response = await fetch(`${base}${route}`);
      assert.equal(response.status, 401);
      assert.match(response.headers.get('content-type') || '', /application\/json/);
      const data = await response.json();
      assert.equal(data.error, 'UNAUTHORIZED');
      assert.equal(data.id, undefined);
      assert.equal(data.email, undefined);
    }
  });
  it('não cria nem confirma produtos sem sessão', async () => {
    for (const route of ['/api/app/companies/company/products', '/api/app/companies/company/products/p-1/confirm-tax']) {
      const response = await fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: '{}' });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, 'UNAUTHORIZED');
    }
  });
  it('não permite revogar chaves ou aplicar conciliação sem sessão', async () => {
    for (const [method, route] of [
      ['DELETE', '/api/app/companies/company/mcp-keys/key-1'],
      ['DELETE', '/api/app/companies/company/mcp-keys'],
      ['POST', '/api/app/companies/company/past-sales/reconcile/apply'],
      ['POST', '/api/app/companies/company/fiscal-settings/send'],
    ]) {
      const response = await fetch(`${base}${route}`, { method, headers: { origin: base } });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, 'UNAUTHORIZED');
    }
  });
  it('remove as rotas de sessão legadas; login e logout pertencem ao Clerk', async () => {
    for (const route of ['/api/login', '/api/callback', '/api/logout', '/api/auth/user']) {
      const response = await fetch(`${base}${route}`, { redirect: 'manual' });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get('set-cookie'), null);
    }
  });
  it('não aceita cabeçalhos de identidade nem cookie legado como autenticação', async () => {
    const response = await fetch(`${base}/api/app/me`, { headers: {
      'x-user-id': 'forged-user', 'x-user-email': 'forged@example.test',
      cookie: 'connect.sid=forged',
    } });
    assert.equal(response.status, 401);
  });
  it('preserva a proteção de origem nas alterações de dados', async () => {
    const response = await fetch(`${base}/api/app/me`, {
      method: 'PUT', headers: { origin: 'https://other.example.test', 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, 403);
  });
  it('não autoriza leitura credenciada das APIs privadas por outra origem', async () => {
    for (const route of ['/api/app/me', '/api/app/companies/company/mcp-keys']) {
      const response = await fetch(`${base}${route}`, { headers: {
        origin: 'https://malicious.example.test',
        cookie: '__session=invalid-test-session',
      } });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.equal(response.headers.get('access-control-allow-credentials'), null);
    }
    const preflight = await fetch(`${base}/api/app/me`, { method: 'OPTIONS', headers: {
      origin: 'https://malicious.example.test',
      'access-control-request-method': 'GET',
    } });
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
  });
  it('retorna JSON 404 para API inexistente, nunca o HTML do app', async () => {
    const response = await fetch(`${base}/api/rota-inexistente`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'NOT_FOUND');
  });
});
