import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { annualCost, monthlyCost, plans, profiles, PRICE_PER_INVOICE_CENTS } from '../src/config/pricing';
describe('Comparativo honesto de preços', () => {
  it('confere o cenário de lançamento e os valores do briefing', () => {
    const months = profiles['Faço lançamentos'];
    assert.equal(months.reduce((a,b) => a+b, 0), 350);
    assert.equal(months.reduce((a,b) => a+b, 0) * PRICE_PER_INVOICE_CENTS, 28000);
    assert.deepEqual(plans.map(p => annualCost(p, months)), [89000, 114980, null, 178260, 228000]);
  });
  it('confere os outros perfis', () => {
    assert.equal(profiles['Estou começando'].reduce((a,b) => a+b, 0), 90);
    assert.equal(profiles['Vendo todo mês'].reduce((a,b) => a+b, 0), 480);
  });
  it('não inventa preço extra não publicado', () => {
    assert.equal(monthlyCost(plans[2], 101), null);
    assert.equal(monthlyCost(plans[4], 251), null);
    assert.equal(annualCost(plans[4], Array(12).fill(251)), null);
  });
  it('usa a franquia anual e extra anual da Spedy', () => {
    assert.equal(annualCost(plans[0], Array(12).fill(200)), 89000 + 600 * 62);
    assert.equal(annualCost(plans[0], Array(12).fill(0)), 89000);
  });
  it('mostra a Spedy mais barata em 100 notas por mês', () => {
    assert.equal(monthlyCost(plans[0], 100), 7400);
    assert.ok(monthlyCost(plans[0], 100)! < 100 * PRICE_PER_INVOICE_CENTS);
  });
  it('cobra extras mensais sem compensar meses sem vendas', () => {
    assert.equal(monthlyCost(plans[3], 100), 16780);
    assert.equal(monthlyCost(plans[1], 150), 10040);
    assert.equal(monthlyCost(plans[1], 0), 9490);
  });
});
