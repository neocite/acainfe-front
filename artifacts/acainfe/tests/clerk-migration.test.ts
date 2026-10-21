import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromClaims } from '../server/user-identity';
import { getClerkProxyHost } from '../server/middlewares/clerkProxyMiddleware';
import { apiRequest, ApiError } from '../src/lib/queryClient';

describe('Ponte de identidade Clerk', () => {
  it('mantém o ID original para contas migradas', () => {
    assert.deepEqual(identityFromClaims({
      sub: 'user_clerk_native', userId: 'original-subject',
      email: 'user@example.test', firstName: 'Pessoa', lastName: 'Teste',
    }), { id: 'original-subject', email: 'user@example.test', name: 'Pessoa Teste' });
  });
  it('usa o ID Clerk disponibilizado no claim para contas novas', () => {
    assert.equal(identityFromClaims({ userId: 'user_new', email: 'new@example.test' })?.id, 'user_new');
  });
  it('não usa sub como fallback quando falta o vínculo e recusa identidades incompletas', () => {
    for (const claims of [null, {}, { sub: 'user_native', email: 'user@example.test' },
      { userId: '', email: 'user@example.test' }, { userId: 'id', email: '' }, { userId: 'id', email: 'invalid' }]) {
      assert.equal(identityFromClaims(claims), null);
    }
  });
  it('resolução de domínio usa o primeiro host encaminhado', () => {
    assert.equal(getClerkProxyHost({ headers: { 'x-forwarded-host': 'app.example.test, internal', host: 'internal' } }), 'app.example.test');
    assert.equal(getClerkProxyHost({ headers: { host: 'app.example.test' } }), 'app.example.test');
  });
});

describe('API web com cookies', () => {
  it('inclui cookies sem inserir Authorization e preserva erros 401/403', async () => {
    const original = globalThis.fetch;
    try {
      for (const status of [200, 401, 403]) {
        globalThis.fetch = async (url, init) => {
          assert.equal(url, '/api/app/me');
          assert.equal(init?.credentials, 'same-origin');
          assert.equal(new Headers(init?.headers).has('authorization'), false);
          return new Response(JSON.stringify({ message: 'Acesso negado' }), { status, headers: { 'content-type': 'application/json' } });
        };
        if (status === 200) await apiRequest('/app/me');
        else await assert.rejects(apiRequest('/app/me'), error => error instanceof ApiError && error.status === status);
      }
    } finally { globalThis.fetch = original; }
  });
  it('envia arquivos sem forçar Content-Type e mantém cookies', async () => {
    const original = globalThis.fetch;
    const form = new FormData();
    form.append('password', 'test-only');
    try {
      globalThis.fetch = async (_url, init) => {
        assert.equal(init?.credentials, 'same-origin');
        assert.equal(init?.body, form);
        assert.equal(new Headers(init?.headers).has('content-type'), false);
        return Response.json({ ok: true });
      };
      await apiRequest('/app/onboarding/certificate', 'POST', form);
    } finally { globalThis.fetch = original; }
  });
});
