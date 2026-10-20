import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { approximateTaxInputs, approximateTaxPatch, approximateTaxPreview, DEFAULT_TAX_TEMPLATE, isTestEnvironment } from '../src/lib/fiscal-settings';
import { isAllowedAppRoute } from '../server/app-routes';
import { appUpstreamPath } from '../server/app-proxy-request';

describe('Contrato dos dados fiscais', () => {
  it('libera somente os métodos e caminhos fiscais solicitados', () => {
    assert.equal(isAllowedAppRoute('GET', '/companies/c-1/fiscal-settings'), true);
    assert.equal(isAllowedAppRoute('POST', '/companies/c-1/fiscal-settings/send'), true);
    for (const [method, path] of [['POST', '/companies/c-1/fiscal-settings'], ['GET', '/companies/c-1/fiscal-settings/send'], ['DELETE', '/companies/c-1/fiscal-settings'], ['GET', '/companies/../fiscal-settings']]) {
      assert.equal(isAllowedAppRoute(method, path), false);
    }
    assert.equal(appUpstreamPath('/api/app/companies/c-1/fiscal-settings'), '/v1/app/companies/c-1/fiscal-settings');
    assert.equal(appUpstreamPath('/api/app/companies/c-1/fiscal-settings/send'), '/v1/app/companies/c-1/fiscal-settings/send');
  });
  it('sugere 15,53% e preserva valores salvos, incluindo zero', () => {
    assert.deepEqual(approximateTaxInputs(), { rate: '15,53', template: DEFAULT_TAX_TEMPLATE });
    assert.deepEqual(approximateTaxInputs({ rateBps: 0, descriptionTemplate: 'Sem valor' }), { rate: '0,00', template: 'Sem valor' });
    assert.equal(approximateTaxInputs({ rateBps: 201, descriptionTemplate: 'Texto' }).rate, '2,01');
  });
  it('converte o percentual e calcula a prévia sem confundir reais com centavos', () => {
    assert.deepEqual(approximateTaxPatch('15,53', DEFAULT_TAX_TEMPLATE), { rateBps: 1553, descriptionTemplate: DEFAULT_TAX_TEMPLATE });
    assert.equal(approximateTaxPreview('15,53', DEFAULT_TAX_TEMPLATE), 'Valor aprox dos tributos: R$ 15,53. Fonte: IBPT');
    assert.equal(approximateTaxPreview('2,01', DEFAULT_TAX_TEMPLATE), 'Valor aprox dos tributos: R$ 2,01. Fonte: IBPT');
    assert.equal(approximateTaxPatch('0', 'Texto').rateBps, 0);
    assert.equal(approximateTaxPatch('100', 'Texto').rateBps, 10000);
  });
  it('recusa taxas inválidas e texto vazio sem enviar valores inválidos', () => {
    for (const rate of ['', '-1', 'abc', '100,01', '15,533']) assert.throws(() => approximateTaxPatch(rate, 'Texto'));
    assert.throws(() => approximateTaxPatch('15,53', '  '));
    assert.ok(approximateTaxPreview('abc', DEFAULT_TAX_TEMPLATE).includes('percentual válido'));
  });
  it('modo teste só existe com HOMOLOGATION explicitamente informado', () => {
    assert.equal(isTestEnvironment(), false);
    assert.equal(isTestEnvironment({ environment: 'PRODUCTION' }), false);
    assert.equal(isTestEnvironment({ environment: 'HOMOLOGATION' }), true);
    assert.equal(isTestEnvironment(undefined, 'HOMOLOGATION'), true);
    assert.equal(isTestEnvironment({ environment: 'PRODUCTION' }, 'HOMOLOGATION'), true);
  });
});
