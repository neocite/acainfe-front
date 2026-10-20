import assert from 'node:assert/strict';
import { it } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudioCalculator } from '../src/components/landing/StudioCalculator';
import { Calculator } from '../src/components/landing/Calculator';

// O runner tsx usa JSX clássico; o app servido pelo Vite usa JSX automático.
Object.assign(globalThis, { React });
const { createElement } = React;

function render(price = 80, invoices = 48, monthlyFee = 0) {
  return renderToStaticMarkup(createElement(StudioCalculator, {
    price, invoices, monthlyFee, onInvoicesChange: () => {}, onCompare: () => {},
  })).replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ');
}

it('o simulador aprovado começa em 48 notas e mostra custo, faturamento e percentual corretos', () => {
  const html = render();
  assert.match(html, /R\$ 38,40/);
  assert.match(html, /R\$ 9\.456,00/);
  assert.match(html, /0,41%/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

it('usa o preço em centavos recebido da API, sem manter o valor estático do protótipo', () => {
  const html = render(123);
  assert.match(html, /R\$ 59,04/);
  assert.match(html, /R\$ 1,23/);
  assert.match(html, /0,62%/);
  assert.doesNotMatch(html, /R\$ 0,80/);
});

it('inclui a mensalidade se a resposta da API trouxer uma', () => {
  const html = render(123, 48, 499);
  assert.match(html, /R\$ 64,03/);
  assert.match(html, /R\$ 4,99 de mensalidade/);
  assert.doesNotMatch(html, /Sem mensalidade/);
});

it('um mês sem notas fica zerado e não divide o faturamento por zero', () => {
  const html = render(80, 0);
  assert.match(html, /R\$ 0,00/);
  assert.match(html, /0,00%/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, /min="0"/);
});

it('a comparação preservada pode iniciar com a quantidade escolhida no simulador', () => {
  const html = renderToStaticMarkup(createElement(Calculator, { price: 80, initialNotes: 122 }))
    .replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ');
  assert.match(html, /value="122"/);
  assert.match(html, /R\$ 97,60/);
  assert.match(html, /Focus NFe Solo sai mais barato/);
});
