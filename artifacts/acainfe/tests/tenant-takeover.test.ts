import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import multer from 'multer';
import type { Server } from 'node:http';
import { createAppApi } from '../server/app-api';

// Local HTTP harness only: no real API, accounts, companies, or certificates.
describe('Envio de certificado após correção da API externa', () => {
  let server: Server;
  let base: string;
  let forwarded: string[];
  let upstreamStatus: number;
  let upstreamBody: Record<string, unknown>;
  before(async () => {
    const app = express();
    app.use('/api/app', (req, res, next) => {
      if (!req.get('x-test-user')) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
      next();
    });
    app.use('/api/app', createAppApi((req, res) => {
      forwarded.push(`${req.method} ${req.originalUrl}`);
      if (req.path === '/onboarding/certificate') {
        assert.equal(req.file?.originalname, '99000001000101.pfx');
        assert.equal(req.body.password, 'test-only');
      }
      res.status(upstreamStatus).json(upstreamBody);
      req.file?.buffer.fill(0);
      if (req.body?.password) delete req.body.password;
    }));
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err instanceof multer.MulterError ? 422 : 500).json({ error: 'VALIDATION' });
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
  });
  beforeEach(() => { forwarded = []; upstreamStatus = 201; upstreamBody = { tenant: { id: 'test-tenant', cnpj: '99000001000101' } }; });
  after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
  function upload(filename = '99000001000101.pfx', password: string | null = 'test-only', size = 20) {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(size)]), filename);
    if (password !== null) form.append('password', password);
    return fetch(`${base}/api/app/onboarding/certificate`, { method: 'POST', headers: { 'x-test-user': 'synthetic-owner' }, body: form });
  }
  it('reabre o multipart para o proxy, inclusive para renovação pelo dono', async () => {
    const response = await upload();
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), upstreamBody);
    assert.deepEqual(forwarded, ['POST /api/app/onboarding/certificate']);
  });
  for (const [status, code] of [[409, 'CONFLICT'], [422, 'CERTIFICATE_INVALID']] as const) {
    it(`preserva ${status}, código e mensagem da API`, async () => {
      upstreamStatus = status;
      upstreamBody = { code, message: `Mensagem original ${code}` };
      const response = await upload();
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), upstreamBody);
      assert.equal(forwarded.length, 1);
    });
  }
  for (const [name, password] of [['invalid.txt', 'test-only'], ['99000001000101.pfx', ''], ['99000001000101.pfx', null]] as const) {
    it(`rejeita arquivo/senha inválidos sem encaminhar: ${name}, senha ${password === null ? 'ausente' : password ? 'preenchida' : 'vazia'}`, async () => {
      assert.equal((await upload(name, password)).status, 422);
      assert.deepEqual(forwarded, []);
    });
  }
  it('mantém limite de tamanho do arquivo', async () => {
    assert.equal((await upload('99000001000101.pfx', 'test-only', 10 * 1024 * 1024 + 1)).status, 422);
    assert.deepEqual(forwarded, []);
  });
  it('mantém autenticação e allowlist', async () => {
    assert.equal((await fetch(`${base}/api/app/onboarding/certificate`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${base}/api/app/unknown`, { headers: { 'x-test-user': 'synthetic-owner' } })).status, 404);
    assert.deepEqual(forwarded, []);
  });
});
