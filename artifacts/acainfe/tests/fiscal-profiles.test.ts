import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fiscalCompanyPatch } from '../src/lib/fiscal-profiles';
import { isAllowedAppRoute } from '../server/app-routes';
import { CompanyCard, TestEnvironmentNotice } from '../src/components/CompanyCard';
import { AbacatePayImportSummary } from '../src/components/AbacatePayImportSummary';
import { priceToCents } from '../src/components/Products';

describe('Perfis fiscais e ISS', () => {
  it('exige a escolha e só envia campos pedidos pela API', () => {
    const missing = [{ field: 'businessType', message: 'Escolha o perfil' }];
    assert.throws(() => fiscalCompanyPatch(missing, { businessType: '', issRate: '' }), /Escolha/);
    assert.deepEqual(fiscalCompanyPatch(missing, { businessType: 'INFOPRODUCER', issRate: '6' }), { businessType: 'INFOPRODUCER' });
    assert.deepEqual(fiscalCompanyPatch([], { businessType: 'MICROSAAS', issRate: '6' }), {});
  });
  it('converte ISS em inteiros, respeitando limites de 2% a 5%', () => {
    const missing = [{ field: 'issRateBps', message: 'Consulte a prefeitura' }];
    for (const [input, bps] of [['2', 200], ['2,01', 201], ['2.5', 250], ['5', 500]] as const) {
      assert.deepEqual(fiscalCompanyPatch(missing, { businessType: '', issRate: input }), { issRateBps: bps });
    }
    for (const input of ['', '1,99', '5,01', '6', '-2', '2,001', 'abc']) {
      assert.throws(() => fiscalCompanyPatch(missing, { businessType: '', issRate: input }), /Informe entre 2% e 5%/);
    }
  });
  it('libera apenas métodos e rotas exatos dos novos recursos', () => {
    assert.ok(isAllowedAppRoute('GET', '/fiscal-profiles'));
    assert.ok(isAllowedAppRoute('POST', '/companies/c-1/products'));
    assert.ok(isAllowedAppRoute('POST', '/companies/c-1/products/p_1/confirm-tax'));
    for (const [method, path] of [['POST', '/fiscal-profiles'], ['DELETE', '/companies/c-1/products/p_1/confirm-tax'], ['POST', '/companies/c-1/products/p_1'], ['POST', '/companies/c-1/products/p_1/confirm-tax/extra']]) {
      assert.equal(isAllowedAppRoute(method, path), false);
    }
  });
  it('exibe ISS efetivo e trata nulo sem inventar valor', () => {
    const render = (rate: number | null) => renderToStaticMarkup(createElement(CompanyCard, { status: { tenant: { id: 't', effectiveIssRateBps: rate } } }));
    assert.match(render(201), /ISS: 2,01%/);
    assert.match(render(null), /ISS: não informado/);
  });
  it('selo de teste aparece somente em homologação', () => {
    assert.match(renderToStaticMarkup(createElement(TestEnvironmentNotice, { environment: 'HOMOLOGATION' })), /Modo teste: as notas não têm valor fiscal e não são cobradas/);
    for (const environment of ['PRODUCTION', undefined]) {
      assert.equal(renderToStaticMarkup(createElement(TestEnvironmentNotice, { environment })), '');
    }
  });
  it('resumo separa produtos prontos, pendentes, teste e duplicados', () => {
    const html = renderToStaticMarkup(createElement(AbacatePayImportSummary, { connection: {
      imported: 3, confirmedByProfile: [{ id: '1', name: 'Curso' }], pendingTaxReview: [{ id: '2', name: 'Software' }],
      skippedTestProducts: ['Produto Teste'], mergedDuplicates: [{ name: 'Kero Avaliar', externalId: 'ext', productId: '1' }],
    }, onOpenProducts() {} }));
    for (const text of ['1 produto importado e pronto para vender', '1 produto aguarda', 'sua confirmação', 'Ignoramos produtos de teste: Produto Teste', 'juntamos em um só produto']) assert.ok(html.includes(text));
  });
  it('preço permanece em centavos e rejeita frações extras e valores negativos', () => {
    assert.equal(priceToCents('97'), 9700);
    assert.equal(priceToCents('97,25'), 9725);
    assert.equal(priceToCents('0'), 0);
    for (const input of ['-1', '1,234', 'abc', '', '99999999999999999']) assert.equal(priceToCents(input), null);
  });
  it('não envia parâmetros de origem ou perfis fiscais fixos na confirmação/criação', () => {
    const source = readFileSync(new URL('../src/components/Products.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bvia\b|\btaxProfile\s*:/);
    assert.match(source, /userConfirmed: true/);
  });
});
