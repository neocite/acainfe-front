import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { companyDisplayName, mergeCompanyProfile, companyStatusLabel, certificateExpiryLabel, type CompanyProfile } from '../src/lib/company-profile';
import { CompanyCard } from '../src/components/CompanyCard';

const certificate: CompanyProfile = {
  tenant: { id: 'test-company', cnpj: '11222333000181', taxRegime: 'SIMPLES_NACIONAL' },
  company: { legalName: 'EMPRESA DE TESTE LTDA', tradeName: 'Teste', cityName: 'São Bernardo do Campo', uf: 'SP' },
};

it('mostra a razão social, CNPJ e cidade no cartão', () => {
  const html = renderToStaticMarkup(createElement(CompanyCard, { status: certificate }));
  for (const text of ['EMPRESA DE TESTE LTDA', '11.222.333/0001-81', 'São Bernardo do Campo/SP']) assert.ok(html.includes(text));
  assert.doesNotMatch(html, />Sua empresa</);
});
it('preserva o nome ao receber um status resumido sem company', () => {
  const summary = { tenant: { id: 'test-company' } };
  const merged = mergeCompanyProfile(certificate, summary);
  assert.equal(companyDisplayName(merged), 'EMPRESA DE TESTE LTDA');
  assert.equal(merged.company?.cityName, 'São Bernardo do Campo');
});
it('lê nomes do cadastro da empresa em tenant quando company não vem na resposta', () => {
  assert.equal(companyDisplayName({ tenant: { id: 'test-company', legalName: 'RAZÃO SOCIAL DO CADASTRO' } }), 'RAZÃO SOCIAL DO CADASTRO');
  assert.equal(companyDisplayName({ tenant: { id: 'test-company', tradeName: 'Nome fantasia' } }), 'Nome fantasia');
  assert.equal(companyDisplayName({ tenant: { id: 'test-company', name: 'Nome da empresa' } }), 'Nome da empresa');
});
it('prefere a razão social ao nome fantasia e ignora nomes em branco', () => {
  assert.equal(companyDisplayName({ tenant: { id: 'test-company', legalName: 'Razão social' }, company: { legalName: ' ', tradeName: 'Fantasia' } }), 'Razão social');
});
it('hidrata o resumo com o cadastro completo e aceita atualizações de nome', () => {
  const hydrated = mergeCompanyProfile({ tenant: { id: 'test-company' } }, certificate);
  assert.equal(companyDisplayName(hydrated), 'EMPRESA DE TESTE LTDA');
  const updated = mergeCompanyProfile(hydrated, { tenant: { id: 'test-company' }, company: { legalName: 'NOVO NOME LTDA' } });
  assert.equal(companyDisplayName(updated), 'NOVO NOME LTDA');
  const updatedTenant = mergeCompanyProfile(hydrated, { tenant: { id: 'test-company', legalName: 'RAZÃO SOCIAL ATUALIZADA' } });
  assert.equal(companyDisplayName(updatedTenant), 'RAZÃO SOCIAL ATUALIZADA');
});
it('não mistura dados de empresas diferentes', () => {
  const other = mergeCompanyProfile(certificate, { tenant: { id: 'other-company' } });
  assert.equal(other.company, undefined);
  assert.doesNotMatch(companyDisplayName(other), /EMPRESA DE TESTE/);
});
it('informa explicitamente quando a API não retornou nenhum nome', () => {
  assert.equal(companyDisplayName({ tenant: { id: 'test-company' } }), 'Nome da empresa não informado pela API');
});
it('traduz status e não mostra códigos desconhecidos em inglês', () => {
  assert.equal(companyStatusLabel('ACTIVE'), 'Ativa');
  assert.equal(companyStatusLabel('INACTIVE'), 'Inativa');
  assert.equal(companyStatusLabel('SUSPENDED'), 'Suspensa');
  assert.equal(companyStatusLabel('FUTURE_STATUS'), 'Status não reconhecido');
  assert.equal(companyStatusLabel(), 'Não informado');
});
it('lê datas suportadas e mantém o dia sem deslocamento de fuso', () => {
  for (const data of [
    { certificate: { expiresAt: '2027-05-20T00:00:00Z' } },
    { certificate: { validUntil: '2027-05-20' } },
    { tenant: { id: 'test-company', certificateExpiresAt: '2027-05-20' } },
  ]) assert.equal(certificateExpiryLabel({ tenant: { id: 'test-company' }, ...data }), '20/05/2027');
  assert.equal(certificateExpiryLabel({ tenant: { id: 'test-company' }, certificate: { expiresAt: 'invalid' } }), 'Validade inválida');
  assert.equal(certificateExpiryLabel({ tenant: { id: 'test-company' } }), 'Validade não informada');
});
it('preserva validade de respostas resumidas sem misturar empresas nem ignorar remoção explícita', () => {
  const full = { ...certificate, certificate: { expiresAt: '2027-05-20' } };
  assert.equal(certificateExpiryLabel(mergeCompanyProfile<CompanyProfile>(full, { tenant: { id: 'test-company' } })), '20/05/2027');
  assert.equal(certificateExpiryLabel(mergeCompanyProfile<CompanyProfile>(full, { tenant: { id: 'test-company' }, certificate: null })), 'Validade não informada');
  assert.equal(certificateExpiryLabel(mergeCompanyProfile<CompanyProfile>(full, { tenant: { id: 'other' } })), 'Validade não informada');
  const inTenant = { tenant: { id: 'test-company', certificateExpiresAt: '2027-05-20' } };
  assert.equal(certificateExpiryLabel(mergeCompanyProfile<CompanyProfile>(inTenant, { tenant: { id: 'test-company' } })), '20/05/2027');
  assert.equal(certificateExpiryLabel(mergeCompanyProfile<CompanyProfile>(inTenant, { tenant: { id: 'test-company', certificateExpiresAt: null } })), 'Validade não informada');
});
