import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { optionalCompanyPatch, isOptionalCompanyField, type ReadinessItem } from '../src/lib/company-details';
import { onboardingEntry } from '../src/lib/onboarding-entry';
import { ApiError } from '../src/lib/api';

const recommended: ReadinessItem[] = [
  { field: 'municipalRegistration', message: 'CCM opcional. Avisamos se a prefeitura exigir.' },
  { field: 'simplesNacionalTaxRateBps', message: 'Usando 6% como estimativa. Ajuste quando souber.' },
];
const blank = { municipalRegistration: '', simplesNacionalTaxRateBps: '' };

describe('CCM e alíquota opcionais', () => {
  it('envia somente a resposta da numeração quando os opcionais estão vazios', () => {
    const patch = { ...optionalCompanyPatch(recommended, blank), issuesElsewhere: false };
    assert.deepEqual(patch, { issuesElsewhere: false });
    assert.equal(Object.hasOwn(patch, 'simplesNacionalTaxRateBps'), false);
    assert.equal(Object.hasOwn(patch, 'municipalRegistration'), false);
  });
  it('não envia espaços em branco nem grava a estimativa de 6% pelo usuário', () => {
    assert.deepEqual(optionalCompanyPatch(recommended, { municipalRegistration: '  ', simplesNacionalTaxRateBps: '  ' }), {});
  });
  it('envia CCM sem exigir alíquota', () => {
    assert.deepEqual(optionalCompanyPatch(recommended, { ...blank, municipalRegistration: ' 123456 ' }), { municipalRegistration: '123456' });
  });
  it('converte a alíquota preenchida para pontos-base sem exigir CCM', () => {
    assert.deepEqual(optionalCompanyPatch(recommended, { ...blank, simplesNacionalTaxRateBps: '6,25' }), { simplesNacionalTaxRateBps: 625 });
  });
  it('preserva zero e os limites permitidos', () => {
    for (const [input, bps] of [['0', 0], ['33', 3300], ['0,01', 1]] as const) {
      assert.deepEqual(optionalCompanyPatch(recommended, { ...blank, simplesNacionalTaxRateBps: input }), { simplesNacionalTaxRateBps: bps });
    }
  });
  it('valida alíquota somente quando preenchida e recomendada', () => {
    for (const input of ['abc', '-1', '33,01', '6,255']) {
      assert.throws(() => optionalCompanyPatch(recommended, { ...blank, simplesNacionalTaxRateBps: input }),
        (error: unknown) => error instanceof ApiError && error.status === 422);
    }
    assert.deepEqual(optionalCompanyPatch([], { municipalRegistration: '123', simplesNacionalTaxRateBps: 'abc' }), {});
  });
  it('salvar um item do modal não envia o outro campo', () => {
    assert.deepEqual(optionalCompanyPatch([recommended[0]], { municipalRegistration: '123', simplesNacionalTaxRateBps: '6,25' }), { municipalRegistration: '123' });
    assert.deepEqual(optionalCompanyPatch([recommended[1]], { municipalRegistration: '123', simplesNacionalTaxRateBps: '6,25' }), { simplesNacionalTaxRateBps: 625 });
  });
  it('recommended não impede o avanço ao AbacatePay ou ao painel', () => {
    const company = { readiness: { canIssue: true, missing: [], recommended }, availability: { status: 'READY' }, tenant: { integrations: { abacatepay: false } } };
    assert.deepEqual(onboardingEntry(company), { step: 4, view: 'wizard' });
    company.tenant.integrations.abacatepay = true;
    assert.deepEqual(onboardingEntry(company), { step: 5, view: 'panel' });
  });
  it('pendências reais continuam bloqueando a emissão', () => {
    for (const field of ['numbering', 'certificate', 'status']) {
      const company = { readiness: { canIssue: false, missing: [{ field, message: 'Pendência obrigatória' }], recommended }, availability: { status: 'READY' }, tenant: {} };
      assert.deepEqual(onboardingEntry(company), { step: 3, view: 'wizard' });
    }
  });
  it('reconhece apenas os campos opcionais suportados', () => {
    assert.equal(isOptionalCompanyField('municipalRegistration'), true);
    assert.equal(isOptionalCompanyField('simplesNacionalTaxRateBps'), true);
    assert.equal(isOptionalCompanyField('numbering'), false);
    assert.equal(isOptionalCompanyField('toString'), false);
  });
});
