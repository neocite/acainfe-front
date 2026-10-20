import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { brl, monthlyCost, plans, PRICE_PER_INVOICE_CENTS } from '../src/config/pricing';

describe('Comparação mensal de preços', () => {
  it('preserva o preço base e formatação monetária brasileira', () => {
    assert.equal(PRICE_PER_INVOICE_CENTS, 80);
    assert.equal(brl(123456), 'R$ 1.234,56');
  });

  it('confere os preços publicados nos volumes de referência', () => {
    const expected = [
      [0, 0, 9490, 13390, 13700, 19000],
      [10, 800, 9490, 13390, 13700, 19000],
      [50, 4000, 9490, 13390, 13700, 19000],
      [100, 8000, 9490, 13390, 16780, 19000],
      [150, 12000, 10040, null, 20630, 19000],
    ];
    assert.deepEqual(plans.map((plan) => plan.name), ['Focus NFe Solo', 'Notazz Bronze', 'eNotas Basic', 'NFE.io Base']);
    for (const [count, acai, ...competitorValues] of expected) {
      assert.equal(count! * PRICE_PER_INVOICE_CENTS, acai);
      assert.deepEqual(plans.map((plan) => monthlyCost(plan, count!)), competitorValues);
    }
  });

  it('não cobra mensalidade do produto e mantém zero notas em zero', () => {
    assert.equal(0 * PRICE_PER_INVOICE_CENTS, 0);
    assert.equal(monthlyCost(plans[0], 0), 9490);
  });

  it('aplica extras apenas acima da franquia incluída', () => {
    assert.equal(monthlyCost(plans[0], 100), 9490);
    assert.equal(monthlyCost(plans[0], 101), 9501);
    assert.equal(monthlyCost(plans[0], 150), 10040);
    assert.equal(monthlyCost(plans[2], 60), 13700);
    assert.equal(monthlyCost(plans[2], 61), 13777);
  });

  it('exclui da conta qualquer excedente sem preço divulgado', () => {
    assert.equal(monthlyCost(plans[1], 100), 13390);
    assert.equal(monthlyCost(plans[1], 101), null);
    assert.equal(monthlyCost(plans[3], 250), 19000);
    assert.equal(monthlyCost(plans[3], 251), null);
  });

  it('identifica corretamente a virada de preço do Focus em 122 notas', () => {
    const acaiAt121 = 121 * PRICE_PER_INVOICE_CENTS;
    const acaiAt122 = 122 * PRICE_PER_INVOICE_CENTS;
    assert.ok(acaiAt121 < monthlyCost(plans[0], 121)!);
    assert.ok(monthlyCost(plans[0], 122)! < acaiAt122);
    assert.equal(acaiAt122 - monthlyCost(plans[0], 122)!, 28);
  });

  it('calcula economia anual a partir da diferença mensal em centavos', () => {
    const monthlyDelta = monthlyCost(plans[3], 30)! - (30 * PRICE_PER_INVOICE_CENTS);
    assert.equal(monthlyDelta * 12, 199200);
  });
});
