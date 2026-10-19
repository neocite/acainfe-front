import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { percentToBps, bpsToPercent, formatCents } from '../src/lib/numbers';

describe('Percentuais inteiros em pontos-base', () => {
  for (const [input, bps, formatted] of [
    ['6', 600, '6,00'],
    ['6,25', 625, '6,25'],
    ['6,5', 650, '6,50'],
    ['6.5', 650, '6,50'],
    ['0,29', 29, '0,29'],
    ['2,01', 201, '2,01'],
    ['15,53', 1553, '15,53'],
    ['0', 0, '0,00'],
    ['33', 3300, '33,00'],
    [' 6,25% ', 625, '6,25'],
  ] as const) {
    it(`${input} → ${bps} → ${formatted}%`, () => {
      assert.equal(percentToBps(input), bps);
      assert.ok(Number.isInteger(percentToBps(input)));
      assert.equal(bpsToPercent(bps), formatted);
    });
  }

  it('rejeita entradas inválidas sem arredondar casas excedentes', () => {
    for (const input of ['6,255', '6.255', 'abc', '', ' ', '-1', '6,', '1e2', '6,2.5', '6%%', 'NaN', 'Infinity', '1000']) {
      assert.equal(percentToBps(input), null, input);
    }
  });

  it('preserva a conversão em todas as alíquotas permitidas', () => {
    for (let bps = 0; bps <= 3300; bps++) {
      assert.equal(percentToBps(bpsToPercent(bps)), bps);
    }
  });

  it('mantém dinheiro em centavos', () => {
    assert.equal(formatCents(8220), 'R$\u00a082,20');
  });
});
