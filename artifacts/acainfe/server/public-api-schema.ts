/**
 * Reviewed subset of the public Swagger contract, retrieved on 2026-10-21.
 * Source: https://api.acainfe.com/docs (swagger-ui-init.js).
 * Do not copy the entire upstream document: it includes non-public operations.
 * Unknown response bodies deliberately remain unconstrained, not invented.
 */
const string = { type: 'string' } as const;
const cents = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
const bps = { type: 'integer', minimum: 0, maximum: 10000 } as const;
const retentions = { type: 'integer', minimum: 0, maximum: 3000 } as const;
const foreignIbsCbs = {
  type: 'object', properties: { cst: string, cClassTrib: string, operationIndicator: string },
  required: ['cst', 'cClassTrib', 'operationIndicator'],
};
const sale = {
  type: 'object',
  properties: {
    externalId: { ...string, minLength: 1, description: 'Identificador do pedido na origem; garante idempotência.' },
    customerId: { ...string, description: 'Identificador de um cliente já cadastrado.' },
    customer: {
      type: 'object', description: 'Dados do tomador. Novos clientes são cadastrados automaticamente.',
      properties: {
        externalId: string, taxId: string, name: string, email: string, phone: string,
        address: {
          type: 'object', properties: {
            street: { ...string, minLength: 1 }, number: { ...string, minLength: 1 },
            complement: string, district: { ...string, minLength: 1 },
            cityCode: { ...string, pattern: '^\\d{7}$' }, zipCode: { ...string, minLength: 8 },
          }, required: ['street', 'number', 'district', 'cityCode', 'zipCode'],
        },
        foreign: {
          type: 'object', properties: {
            countryCode: { ...string, minLength: 2, maxLength: 2 }, nif: string,
            noNifReason: { ...string, enum: ['0', '1', '2'] },
            address: {
              type: 'object', properties: {
                street: string, number: string, complement: string, district: string,
                city: string, region: string, postalCode: string,
              }, required: ['street', 'number', 'district', 'city', 'region', 'postalCode'],
            },
          }, required: ['countryCode'],
        },
      },
    },
    items: {
      type: 'array', minItems: 1, items: {
        type: 'object', properties: {
          productId: string, productExternalId: string,
          quantity: { type: 'integer', exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER },
          unitPriceCents: cents, totalCents: cents, description: { ...string, maxLength: 2000 },
        },
      },
    },
    totalCents: { type: 'integer', exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    competenceDate: { ...string, pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  }, required: ['externalId', 'items'],
};
const product = {
  type: 'object', properties: {
    name: { ...string, minLength: 1 }, externalId: string,
    serviceDescription: { ...string, maxLength: 2000 }, defaultPriceCents: cents,
    taxProfile: {
      type: 'object', description: 'Omita para aplicar o perfil fiscal padrão da empresa.',
      properties: {
        nationalServiceCode: { ...string, description: 'Código nacional de tributação, com 6 dígitos.' },
        municipalServiceCode: string, nbsCode: string, localServiceCode: string,
        issRateBps: { type: 'integer', minimum: 200, maximum: 500 },
        issTaxation: { ...string, enum: ['TAXABLE', 'IMMUNE', 'EXPORT', 'NOT_LEVIED'] },
        issRetention: { ...string, enum: ['NONE', 'TOMADOR', 'INTERMEDIARIO'] },
        approximateTaxRateBps: bps,
        federalRetentions: { type: 'object', properties: {
          irrfRateBps: retentions, csllRateBps: retentions, pisRateBps: retentions,
          cofinsRateBps: retentions, inssRateBps: retentions,
        } },
        ibsCbs: foreignIbsCbs,
        foreignTreatment: { ...string, enum: ['EXPORT', 'TAXABLE'] }, foreignIbsCbs,
      }, required: ['nationalServiceCode'],
    },
  }, required: ['name'],
};
const body = (schema: unknown) => ({ required: true, content: { 'application/json': { schema } } });
const response = (description: string, schema: unknown = {
  description: 'O Swagger de origem não especifica o corpo desta resposta. Não presuma campos nem tipos adicionais.',
}) => ({ description, content: { 'application/json': { schema } } });
const id = [{ name: 'id', in: 'path', required: true, description: 'Identificador da nota fiscal.', schema: string }];

export const publicOpenApi = {
  openapi: '3.1.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: {
    title: 'açaínfe — API pública de NFS-e',
    version: 'acainfe-0.1.0',
    description: 'açaínfe, produto da EXTRACTIFY TECNOLOGIA LTDA. Emissão de NFS-e e integração com agentes de IA. Dinheiro em centavos; percentuais em pontos-base. Este documento cobre as operações públicas apresentadas em /developers, não toda a API. Esquemas de resposta ausentes na origem permanecem explicitamente não especificados.',
    contact: { name: 'EXTRACTIFY TECNOLOGIA LTDA', email: 'contato@extractify.com.br', url: 'https://acainfe.com/contato' },
  },
  servers: [{ url: 'https://api.acainfe.com' }],
  security: [{ apiKey: [] }, { bearerAuth: [] }],
  components: { securitySchemes: {
    apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'Gere a chave no app, em Agentes de IA.' },
    bearerAuth: { type: 'http', scheme: 'bearer', description: 'A mesma chave gerada no app.' },
  } },
  paths: {
    '/v1/sales': { post: {
      operationId: 'SalesController_create', summary: 'Registrar venda e agendar emissão',
      description: 'Registra a venda e agenda a emissão assíncrona. Itens com tributações diferentes geram notas diferentes. Acompanhe as notas pelas operações de consulta.',
      requestBody: body(sale), responses: { '202': response('Venda recebida para processamento assíncrono.') },
    } },
    '/v1/invoices': { get: {
      operationId: 'InvoicesController_list', summary: 'Listar notas',
      description: 'Consulta as notas fiscais da empresa autenticada.',
      responses: { '200': response('Resultado da consulta de notas.') },
    } },
    '/v1/invoices/{id}': { get: {
      operationId: 'InvoicesController_get', summary: 'Consultar uma nota',
      description: 'Consulta uma nota pelo identificador e permite acompanhar a emissão assíncrona.',
      parameters: id, responses: { '200': response('Resultado da consulta da nota.') },
    } },
    '/v1/invoices/{id}/cancel': { post: {
      operationId: 'InvoicesController_cancel', summary: 'Cancelar nota',
      description: 'Solicita o cancelamento de uma nota. Confirme a intenção do usuário antes desta ação.',
      parameters: id,
      requestBody: body({ type: 'object', properties: {
        reasonCode: { ...string, enum: ['1', '2', '9'], description: '1: erro na emissão; 2: serviço não prestado; 9: outros.' },
        reason: { ...string, minLength: 15, maxLength: 255 },
      }, required: ['reasonCode', 'reason'] }),
      responses: { '201': response('Resposta da solicitação de cancelamento.') },
    } },
    '/v1/products': {
      get: {
        operationId: 'ProductsController_list', summary: 'Listar produtos',
        description: 'Consulta os produtos e serviços da empresa autenticada.',
        responses: { '200': response('Resultado da consulta de produtos.') },
      },
      post: {
        operationId: 'ProductsController_create', summary: 'Cadastrar produto ou serviço',
        description: 'Cadastra produto com tributação própria ou aplica o perfil fiscal padrão da empresa quando taxProfile é omitido. A decisão tributária é do usuário e do contador.',
        requestBody: body(product), responses: { '201': response('Resposta do cadastro do produto.') },
      },
    },
    '/v1/public/pricing': { get: {
      operationId: 'PublicPricingController_pricing', summary: 'Consultar preço vigente',
      description: 'Consulta o preço por nota e a mensalidade, em centavos. Não exige chave.',
      security: [], responses: { '200': response('Preço vigente.', {
        type: 'object', properties: {
          pricePerInvoiceCents: cents, monthlyFeeCents: cents,
          currency: { ...string, enum: ['BRL'] }, graceDays: { type: 'integer', minimum: 0 },
        },
        required: ['pricePerInvoiceCents', 'monthlyFeeCents'],
      }) },
    } },
    '/v1/public/coverage': { get: {
      operationId: 'PublicPricingController_coverage', summary: 'Consultar cidades atendidas',
      description: 'Consulta cidades e regimes atendidos. A liberação de uma empresa específica é verificada no onboarding. Não exige chave.',
      security: [], responses: { '200': response('Cidades atendidas.', {
        type: 'object', properties: { cities: { type: 'array', items: {
          type: 'object', properties: { cityCode: string, cityName: string, uf: string, regimes: { type: 'array', items: string } },
          required: ['cityCode', 'cityName', 'uf', 'regimes'],
        } } }, required: ['cities'],
      }) },
    } },
  },
};
