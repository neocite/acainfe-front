import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultServicePatch, type DefaultServiceInputs, type ServiceCode } from '../src/lib/default-service';
import { isAllowedAppRoute } from '../server/app-routes';

const service: ServiceCode = { nationalServiceCode: '010601', lc116Item: '1.06', description: 'Consultoria', nbsOptions: ['115010000'] };
const values: DefaultServiceInputs = {
  nationalServiceCode: '010601', nbsCode: '115010000', localServiceCode: '02501',
  iss: '2,01', retention: 'NONE', cst: '000', classification: '000001', operation: '100301', approximate: '15,53',
};
describe('Tributação padrão personalizada', () => {
  it('constrói o corpo exato com percentuais inteiros e preserva códigos com zeros', () => {
    assert.deepEqual(defaultServicePatch(values, 'PAULISTANA', service), { defaultService: { taxProfile: {
      nationalServiceCode: '010601', nbsCode: '115010000', localServiceCode: '02501',
      issRateBps: 201, issRetention: 'NONE', ibsCbs: { cst: '000', cClassTrib: '000001', operationIndicator: '100301' },
      approximateTaxRateBps: 1553,
    } } });
  });
  it('não envia código municipal no Nacional e permite percentuais opcionais ausentes ou zero', () => {
    const patch = defaultServicePatch({ ...values, iss: '', approximate: '0' }, 'NACIONAL', service);
    assert.equal('localServiceCode' in patch.defaultService.taxProfile, false);
    assert.equal('issRateBps' in patch.defaultService.taxProfile, false);
    assert.equal(patch.defaultService.taxProfile.approximateTaxRateBps, 0);
  });
  it('restringe NBS às opções e rejeita percentuais inválidos sem arredondar', () => {
    for (const nbsCode of ['', 'outro']) assert.throws(() => defaultServicePatch({ ...values, nbsCode }, 'GINFES', service), /NBS/);
    for (const iss of ['2,001', '-2', '100,01', 'abc']) assert.throws(() => defaultServicePatch({ ...values, iss }, 'NACIONAL', service), /percentual/);
    assert.throws(() => defaultServicePatch({ ...values, localServiceCode: '2501' }, 'PAULISTANA', service), /5 dígitos/);
    assert.equal(defaultServicePatch({ ...values, localServiceCode: '8.02/103911/1551' }, 'GINFES', service).defaultService.taxProfile.localServiceCode, '8.02/103911/1551');
  });
  it('limita o proxy às rotas e aos métodos solicitados', () => {
    assert.equal(isAllowedAppRoute('GET', '/service-codes'), true);
    assert.equal(isAllowedAppRoute('GET', '/companies/test-company/municipal-rate/010601'), true);
    for (const [method, path] of [
      ['POST', '/service-codes'], ['PATCH', '/service-codes'], ['POST', '/companies/test-company/municipal-rate/010601'],
      ['GET', '/companies/test-company/municipal-rate/010601/extra'], ['GET', '/service-codes/extra'],
    ]) assert.equal(isAllowedAppRoute(method, path), false);
  });
});
