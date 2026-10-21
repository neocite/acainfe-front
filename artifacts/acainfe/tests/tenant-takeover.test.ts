import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { createAppApi } from '../server/app-api';

describe('Contenção de tomada de empresa por certificado', () => {
  let server: Server;
  let base: string;
  let forwarded: string[];
  // This is an isolated authenticated-router harness, not an auth bypass in the
  // application. No real upstream, users, certificates, or tenant data are used.
  const tenant = { ownerUserIds: ['original-owner'], certificate: 'original-certificate' };
  before(async () => {
    const app = express();
    app.use('/api/app', (req, res, next) => {
      if (!req.get('x-test-user')) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }
      next();
    });
    app.use('/api/app', createAppApi((req, res) => {
      forwarded.push(`${req.method} ${req.originalUrl}`);
      // Model the unsafe external service. Any certificate request reaching
      // this handler would mutate state, even if its response were discarded.
      if (req.originalUrl.includes('/onboarding/certificate')) {
        tenant.ownerUserIds.push(req.get('x-test-user')!);
        tenant.certificate = 'attacker-certificate';
      }
      res.json({ ok: true });
    }));
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
  });
  beforeEach(() => { forwarded = []; });
  after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('bloqueia multipart antes de ler ou encaminhar certificado e senha, inclusive de um proprietário', async () => {
    for (const user of ['unrelated-user', 'original-owner']) {
      const form = new FormData();
      form.append('file', new Blob(['self-signed-pkcs12-test']), 'attacker.pfx');
      form.append('password', 'test-only');
      const response = await fetch(`${base}/api/app/onboarding/certificate`, {
        method: 'POST', headers: { 'x-test-user': user }, body: form,
      });
      assert.equal(response.status, 503);
      const data = await response.json();
      assert.equal(data.error, 'CERTIFICATE_ONBOARDING_UNAVAILABLE');
      assert.match(data.message, /Nenhuma empresa ou certificado foi alterado/);
      assert.doesNotMatch(JSON.stringify(data), /test-only|self-signed-pkcs12-test/);
    }
    assert.deepEqual(forwarded, []);
    assert.deepEqual(tenant, { ownerUserIds: ['original-owner'], certificate: 'original-certificate' });
  });

  it('não permite contornar o bloqueio usando JSON, query, barra, caixa ou caminhos codificados', async () => {
    for (const route of [
      '/onboarding/certificate', '/onboarding/certificate?replace=true',
      '/onboarding/certificate/', '/onboarding/Certificate',
      '/onboarding/%63ertificate', '/onboarding//certificate',
      '/companies/victim/certificate', '/onboarding/certificate/extra',
    ]) {
      const response = await fetch(`${base}/api/app${route}`, {
        method: 'POST', headers: { 'x-test-user': 'unrelated-user', 'content-type': 'application/json' },
        body: JSON.stringify({ pfxBase64: 'test-only', password: 'test-only' }),
      });
      assert.ok([404, 503].includes(response.status), `${route}: ${response.status}`);
    }
    assert.deepEqual(forwarded, []);
  });

  it('continua exigindo autenticação antes do bloqueio', async () => {
    const response = await fetch(`${base}/api/app/onboarding/certificate`, { method: 'POST' });
    assert.equal(response.status, 401);
    assert.deepEqual(forwarded, []);
  });

  it('rejeita reivindicações simultâneas sem criar vínculo nem trocar o certificado', async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, (_, index) =>
      fetch(`${base}/api/app/onboarding/certificate`, {
        method: 'POST',
        headers: { 'x-test-user': `unrelated-user-${index}`, 'content-type': 'application/json' },
        body: JSON.stringify({ pfxBase64: 'test-only', password: 'test-only' }),
      }),
    ));
    for (const response of responses) {
      assert.equal(response.status, 503);
      await response.arrayBuffer();
    }
    assert.deepEqual(forwarded, []);
    assert.deepEqual(tenant, { ownerUserIds: ['original-owner'], certificate: 'original-certificate' });
  });

  it('mantém as rotas existentes e suas queries sem encaminhar verbos não permitidos', async () => {
    for (const [method, route] of [
      ['GET', '/me'], ['PUT', '/me'],
      ['GET', '/companies/original-company/fiscal-settings'],
      ['GET', '/companies/original-company/products?pendingTaxReview=true'],
      ['PATCH', '/companies/original-company'],
    ]) {
      const response = await fetch(`${base}/api/app${route}`, { method, headers: { 'x-test-user': 'original-owner' } });
      assert.equal(response.status, 200);
    }
    assert.equal(forwarded.length, 5);
    assert.ok(forwarded.includes('GET /api/app/companies/original-company/products?pendingTaxReview=true'));
    for (const method of ['PUT', 'PATCH', 'DELETE', 'GET', 'HEAD']) {
      const response = await fetch(`${base}/api/app/onboarding/certificate`, { method, headers: { 'x-test-user': 'unrelated-user' } });
      assert.equal(response.status, 404);
    }
    assert.equal(forwarded.length, 5);
  });
});
