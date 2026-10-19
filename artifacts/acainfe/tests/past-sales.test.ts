import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { isAllowedAppRoute } from '../server/app-routes';
import { ApiError } from '../src/lib/api';
import { issuePastSales, markPastSales, getPastSalesItems, periodLabel, pastPeriodWarning, sortedPeriods, type PastSalesPeriod } from '../src/lib/past-sales';
import { PastSalesPeriodCard } from '../src/components/PastSalesPeriodCard';

const current: PastSalesPeriod = {
  period: '2026-10', isCurrentMonth: true, requiresConfirmation: false,
  available: { count: 47, totalCents: 930000, withoutItems: 0 }, alreadyIssued: 12, imported: 2, refunded: 3,
};
const previous = { ...current, period: '2026-09', isCurrentMonth: false, requiresConfirmation: true };

describe('Vendas passadas: segurança e contrato', () => {
  it('libera somente os métodos e as rotas novos previstos no proxy', () => {
    for (const path of ['/past-sales', '/past-sales/items']) assert.equal(isAllowedAppRoute('GET', `/companies/test${path}`), true);
    for (const action of ['scan', 'mark', 'issue']) {
      assert.equal(isAllowedAppRoute('POST', `/companies/test/past-sales/${action}`), true);
      assert.equal(isAllowedAppRoute('GET', `/companies/test/past-sales/${action}`), false);
    }
    assert.equal(isAllowedAppRoute('DELETE', '/companies/test/past-sales'), false);
    assert.equal(isAllowedAppRoute('POST', '/companies/test/past-sales/delete'), false);
    assert.equal(isAllowedAppRoute('GET', '/companies/../past-sales'), false);
    assert.equal(isAllowedAppRoute('POST', '/companies/test/abacatepay'), true);
  });
  it('ordena os meses sem modificar a resposta e formata a competência', () => {
    const periods = [previous, current];
    assert.deepEqual(sortedPeriods({ periods }).map(p => p.period), ['2026-10', '2026-09']);
    assert.equal(periods[0].period, '2026-09');
    assert.equal(periodLabel('2026-09'), 'setembro/2026');
    assert.throws(() => periodLabel('2026-13'));
    assert.match(pastPeriodWarning('2026-09'), /DAS de setembro/);
    assert.match(pastPeriodWarning('2026-09'), /multa e juros/);
  });
  it('bloqueia emissão de meses anteriores sem consentimento, antes de chamar a API', () => {
    assert.throws(() => issuePastSales('/app/companies/test', previous, false), (e: unknown) => e instanceof ApiError && e.status === 422);
  });
  it('exige produto para Pix avulso sem itens', () => {
    assert.throws(() => issuePastSales('/app/companies/test', { ...current, available: { ...current.available, withoutItems: 2 } }, false), /Escolha um produto/);
  });
  it('envia confirmação apenas para mês anterior e preserva fallbackProductId', async () => {
    const original = globalThis.fetch;
    const calls: { url: string; body: unknown }[] = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ issued: 47, held: 0, skippedWithoutProduct: 0, failed: [] }), { headers: { 'content-type': 'application/json' } });
    };
    try {
      await issuePastSales('/app/companies/test', current, false);
      await issuePastSales('/app/companies/test', previous, true, 'product-test');
      assert.deepEqual(calls[0], { url: '/api/app/companies/test/past-sales/issue', body: { period: '2026-10' } });
      assert.deepEqual(calls[1].body, { period: '2026-09', confirmPastPeriod: true, fallbackProductId: 'product-test' });
    } finally { globalThis.fetch = original; }
  });
  it('marca e desmarca por IDs e aceita marcação do mês inteiro', async () => {
    const original = globalThis.fetch;
    const bodies: unknown[] = [];
    globalThis.fetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    };
    try {
      await markPastSales('/app/companies/test', { ids: ['sale-test'] }, true);
      await markPastSales('/app/companies/test', { ids: ['sale-test'] }, false);
      await markPastSales('/app/companies/test', { period: '2026-10' }, true);
      assert.deepEqual(bodies, [{ ids: ['sale-test'], alreadyIssued: true }, { ids: ['sale-test'], alreadyIssued: false }, { period: '2026-10', alreadyIssued: true }]);
    } finally { globalThis.fetch = original; }
  });
  it('pede somente disponíveis e já emitidas e nunca lista estornos ou contestações', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async url => {
      const parsed = new URL(String(url), 'https://example.test');
      assert.equal(parsed.searchParams.get('status'), 'AVAILABLE,ALREADY_ISSUED');
      return new Response(JSON.stringify({ items: [
        { id: 'available', status: 'AVAILABLE' }, { id: 'already', status: 'ALREADY_ISSUED' },
        { id: 'refunded', status: 'REFUNDED' }, { id: 'disputed', status: 'DISPUTED' }, { id: 'pending', status: 'PENDING' },
      ] }), { headers: { 'content-type': 'application/json' } });
    };
    try { assert.deepEqual((await getPastSalesItems('/app/companies/test', '2026-10')).map(item => item.id), ['available', 'already']); }
    finally { globalThis.fetch = original; }
  });
  it('renderiza quantidades, custo em centavos, exclusões e resultados sem esconder falhas', () => {
    const html = renderToStaticMarkup(createElement(PastSalesPeriodCard, {
      period: current, price: 80, products: [], fallback: '', busy: false,
      result: { issued: 45, held: 2, skippedWithoutProduct: 1, failed: [{ message: 'Falha de teste' }] },
      onFallback() {}, onReview() {}, onIssue() {},
    }));
    assert.match(html, /outubro\/2026/);
    assert.match(html, /37,60/);
    assert.match(html, /12 já emitidas/);
    assert.match(html, /3 estornadas \(não entram\)/);
    assert.match(html, /45 notas entrando na fila de emissão/);
    assert.match(html, /2 aguardam você definir a tributação/);
    assert.match(html, /Falha de teste/);
  });
});
