import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthUser } from '../src/lib/auth';
import { api, ApiError } from '../src/lib/api';
import { onboardingEntry } from '../src/lib/onboarding-entry';

describe('Login antes do onboarding', () => {
  it('recusa respostas vazias, incompletas e e-mails em branco', () => {
    for (const user of [
      null, undefined, {}, '', '<html>landing</html>', [],
      { id: 'test', email: '', name: 'Teste' },
      { id: 'test', email: '   ', name: 'Teste' },
      { id: 'test', email: 'email-invalido', name: 'Teste' },
      { id: '', email: 'teste@example.com', name: 'Teste' },
      { email: 'teste@example.com', name: 'Teste' },
    ]) assert.equal(isAuthUser(user), false);
  });
  it('aceita somente identidade com id e e-mail válidos', () => {
    assert.equal(isAuthUser({ id: 'test', email: 'teste@example.com', name: 'Teste' }), true);
    assert.equal(isAuthUser({ id: 'test', email: 'teste@example.com', name: '' }), true);
  });
  it('não transforma HTML de uma publicação estática em usuário logado', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response('<html>landing</html>', { headers: { 'Content-Type': 'text/html' } });
    try { await assert.rejects(api('/auth/user'), (error: unknown) => error instanceof ApiError && error.status === 502); }
    finally { globalThis.fetch = original; }
  });
  it('recusa JSON inválido ou nulo', async () => {
    const original = globalThis.fetch;
    try {
      for (const body of ['{', 'null', '"not-a-user"']) {
        globalThis.fetch = async () => new Response(body, { headers: { 'Content-Type': 'application/json' } });
        await assert.rejects(api('/auth/user'), (error: unknown) => error instanceof ApiError && error.status === 502);
      }
    } finally { globalThis.fetch = original; }
  });
  it('preserva o 401 de uma sessão ausente ou expirada', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Entre novamente.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    try { await assert.rejects(api('/auth/user'), (error: unknown) => error instanceof ApiError && error.status === 401 && error.message === 'Entre novamente.'); }
    finally { globalThis.fetch = original; }
  });
  it('inicia ou retoma as etapas somente após autenticação', () => {
    assert.deepEqual(onboardingEntry(), { step: 1, view: 'wizard' });
    const tenant = { integrations: { abacatepay: false } };
    assert.deepEqual(onboardingEntry({ tenant, availability: { status: 'READY' }, readiness: { canIssue: false } }), { step: 3, view: 'wizard' });
    assert.deepEqual(onboardingEntry({ tenant, availability: { status: 'READY' }, readiness: { canIssue: true } }), { step: 4, view: 'wizard' });
    assert.deepEqual(onboardingEntry({ tenant, availability: { status: 'WAITLIST' }, readiness: { canIssue: false } }), { step: 1, view: 'wizard' });
  });
  it('abre o painel para empresas prontas, mantendo a configuração MCP acessível', () => {
    assert.deepEqual(onboardingEntry({ tenant: { integrations: { abacatepay: true } }, availability: { status: 'READY' }, readiness: { canIssue: true } }), { step: 5, view: 'panel' });
  });
  it('não considera uma integração ausente como concluída', () => {
    assert.deepEqual(onboardingEntry({ tenant: {}, availability: { status: 'READY' }, readiness: { canIssue: true } }), { step: 4, view: 'wizard' });
  });
});
