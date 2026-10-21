import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_COVERAGE, coverageFaq, coverageWaitlist, coverageDescription, parseCoverage, regimeLabels } from '../src/lib/coverage';
import { createCoverageLoader } from '../server/public-coverage';

describe('Cobertura pública', () => {
  it('mantém capital primeiro e gera os textos solicitados', () => {
    const coverage = parseCoverage({ cities: [...FALLBACK_COVERAGE.cities].reverse() });
    assert.equal(coverage.cities[0].cityCode, '3550308');
    assert.equal(coverageFaq(coverage), 'Sim, se a sua empresa for de São Paulo (capital) ou de São Bernardo do Campo (SP), para MEI e Simples Nacional. Em outras cidades, cadastre-se para entrar na lista de espera: avisamos por e-mail e WhatsApp quando a sua cidade for liberada.');
    assert.equal(coverageWaitlist(coverage), 'Por enquanto, atendemos São Paulo (capital) e São Bernardo do Campo/SP, para Simples Nacional e MEI.');
    assert.equal(coverageDescription(coverage), 'Disponível em São Paulo e São Bernardo do Campo (SP).');
    assert.equal(regimeLabels(coverage.cities[0].regimes), 'MEI e Simples Nacional');
  });

  it('inclui novas cidades sem alterar a lista de reserva', () => {
    const coverage = parseCoverage({ cities: [...FALLBACK_COVERAGE.cities, { cityCode: '4106902', cityName: 'Curitiba', uf: 'PR', regimes: ['MEI'] }] });
    assert.ok(coverageFaq(coverage).includes('Curitiba (PR)'));
    assert.ok(coverageWaitlist(coverage).includes('Curitiba/PR'));
    assert.ok(coverageDescription(coverage).includes('Curitiba (PR)'));
    assert.equal(FALLBACK_COVERAGE.cities.length, 2);
  });

  it('valida o contrato e respeita lista vazia recebida da API', () => {
    for (const input of [null, {}, { cities: [{}] }, { cities: [{ cityCode: '1', cityName: 'Cidade', uf: 'SP', regimes: null }] }]) {
      assert.throws(() => parseCoverage(input));
    }
    assert.deepEqual(parseCoverage({ cities: [] }), { cities: [] });
    assert.equal(coverageDescription({ cities: [] }), '');
  });

  it('consulta somente a rota pública, sem autenticação, e usa cache', async () => {
    let calls = 0;
    const loader = createCoverageLoader(() => 'https://api.example.test', async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.example.test/v1/public/coverage');
      assert.equal(options?.method, undefined);
      assert.deepEqual(options?.headers, { 'ngrok-skip-browser-warning': '1' });
      return Response.json(FALLBACK_COVERAGE);
    });
    assert.deepEqual(await loader(), FALLBACK_COVERAGE);
    await loader();
    assert.equal(calls, 1);
  });

  it('oferece as duas cidades se API estiver fora, retornar 404 ou JSON inválido', async () => {
    for (const request of [
      async () => { throw new Error('timeout'); },
      async () => new Response('', { status: 404 }),
      async () => new Response('invalid json'),
      async () => Response.json({ cities: [{}] }),
    ]) {
      const loader = createCoverageLoader(() => 'https://api.example.test', request);
      assert.deepEqual(await loader(), FALLBACK_COVERAGE);
    }
    assert.deepEqual(await createCoverageLoader(() => '')(), FALLBACK_COVERAGE);
  });
});
