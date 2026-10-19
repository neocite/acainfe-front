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
  assert.doesNotMatch(html, /PRODUCT:READ|WEBHOOK:CREATE/);
  assert.match(html, /Não é necessário liberar outras permissões/);
  assert.match(html, /Não envie por mensagem/);
});
