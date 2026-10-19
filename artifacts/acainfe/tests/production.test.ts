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
    for (const route of ['/', '/app']) {
      const response = await fetch(`${base}${route}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      const html = await response.text();
      assert.match(html, /id="root"/);
      assert.doesNotMatch(html, /__SEO_DESCRIPTION__|__APP_ORIGIN__/);
    }
  });
  it('não libera usuário ou empresas sem sessão', async () => {
    for (const route of ['/api/auth/user', '/api/app/me', '/api/app/fiscal-profiles', '/api/app/companies/company/products']) {
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
  it('encaminha o login ao provedor com e-mail, PKCE e solicitação de login', async () => {
    const response = await fetch(`${base}/api/login`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const location = new URL(response.headers.get('location')!);
    assert.equal(location.protocol, 'https:');
    assert.equal(location.hostname, 'replit.com');
    assert.match(location.searchParams.get('scope') || '', /\bemail\b/);
    assert.equal(location.searchParams.get('prompt'), 'login');
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(location.searchParams.get('state'));
    assert.ok(location.searchParams.get('nonce'));
    assert.ok(response.headers.get('set-cookie'));
  });
  it('retorna JSON 404 para API inexistente, nunca o HTML do app', async () => {
    const response = await fetch(`${base}/api/rota-inexistente`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'NOT_FOUND');
  });
});
