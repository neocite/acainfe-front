import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseProducts } from '../src/lib/products';

describe('Lista de produtos importados', () => {
  const products = [{ id: 'p-1', name: 'Serviço', pendingTaxReview: true }];
  it('aceita lista direta e envelopes products, items e data preservando os campos', () => {
    for (const response of [products, { products }, { items: products, total: 1 }, { data: products }]) {
      assert.deepEqual(parseProducts(response), products);
    }
  });
  it('aceita listas vazias sem confundir com falha da importação', () => {
    assert.deepEqual(parseProducts({ items: [] }), []);
  });
  it('rejeita respostas inválidas em vez de ocultar a falha com uma lista vazia', () => {
    for (const response of [null, {}, { items: 'invalid' }, { items: [null] }, { items: [{ name: 'Sem ID' }] }]) {
      assert.throws(() => parseProducts(response), /lista de produtos inválida/);
    }
  });
});
