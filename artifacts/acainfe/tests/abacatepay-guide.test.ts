import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AbacatePayKeyGuide } from '../src/components/AbacatePayKeyGuide';

it('orienta a criação da chave com os nomes reais da tela do AbacatePay', () => {
  const html = renderToStaticMarkup(createElement(AbacatePayKeyGuide));
  for (const text of ['Nova chave de API', 'API v2', 'Personalizado', 'Ver produtos', 'Criar webhooks', 'acainfe', 'Continuar']) {
    assert.ok(html.includes(text), `Orientação ausente: ${text}`);
  }
  assert.equal((html.match(/<li>/g) || []).length, 5);
  for (const permission of ['PRODUCT:READ', 'WEBHOOK:CREATE', 'CHECKOUT:READ', 'TRANSPARENT:READ', 'SUBSCRIPTION:READ', 'CUSTOMER:READ']) assert.ok(html.includes(permission));
  assert.doesNotMatch(html, /Não é necessário liberar outras permissões/);
  assert.match(html, /Não envie por mensagem/);
});
