import { brl } from '../config/pricing';
import { coverageFaq, type PublicCoverage } from './coverage';

export type PublicPricing = { pricePerInvoiceCents: number; monthlyFeeCents: number };
export type PublicSiteData = { pricing: PublicPricing; coverage: PublicCoverage };
export const HOME_TITLE = 'açaínfe: emissor de NFS-e automático para AbacatePay, com agentes de IA (MCP)';
export const AGENT_DESCRIPTION = 'Emissor de NFS-e (nota fiscal de serviço eletrônica) automático e operável por agentes de IA via MCP. Cada pagamento aprovado no AbacatePay vira nota fiscal, com a tributação de cada produto. Atende MEI e Simples Nacional em São Paulo e São Bernardo do Campo.';
export const AGENT_COPY = 'O açaínfe pode ser operado por agentes de IA via MCP (Model Context Protocol). Configure sua empresa e conecte seu assistente para trabalhar com suas notas fiscais.';
export function homeDescription(pricing: PublicPricing) {
  return `Nota fiscal de serviço (NFS-e) automática para cada venda no AbacatePay, operável por agentes de IA via MCP. ${brl(pricing.pricePerInvoiceCents).replace(/\u00a0/g, ' ')} por nota, sem mensalidade. São Paulo e São Bernardo do Campo. Produto da EXTRACTIFY TECNOLOGIA LTDA.`;
}
export const LANDING_STEPS = [
  { number: '01', title: 'Conecte sua plataforma', copy: 'Vincule AbacatePay ou Hotmart uma única vez.' },
  { number: '02', title: 'Configure seus serviços', copy: 'Mapeie cada produto com ajuda do assistente.' },
  { number: '03', title: 'Venda. A nota vai.', copy: 'Cada pagamento aprovado dispara a emissão.' },
];
export function landingFaq(price: number, coverage: PublicCoverage) {
  return [
    { q: 'Preciso de certificado digital?', a: 'Sim, o A1 (arquivo .pfx), o mesmo usado no e-CAC. Ele fica criptografado e só serve para assinar suas notas.' },
    { q: 'Minha cidade já é atendida?', a: coverageFaq(coverage) },
    { q: 'Preciso entender de imposto?', a: 'Não. O assistente explica cada escolha em português claro e você só confirma. Na dúvida, mostre ao seu contador: tudo fica registrado.' },
    { q: 'E se a prefeitura sair do ar?', a: 'A nota entra na fila e sai sozinha quando o sistema voltar.' },
    { q: 'Posso cancelar uma nota?', a: 'Pode, pelo assistente. Reembolsos no AbacatePay cancelam a nota automaticamente.' },
    { q: 'E se eu não vender nada no mês?', a: 'Você não paga nada. Não existe mensalidade, adesão nem plano: a cobrança é só por nota emitida.' },
    { q: 'Como sou cobrado?', a: `${brl(price)} por nota emitida com sucesso. Notas rejeitadas pela prefeitura não são cobradas.` },
    { q: 'Vocês são do AbacatePay ou da Hotmart?', a: 'Não. O açaínfe é um produto independente, feito para quem vende pelo AbacatePay e pela Hotmart.' },
  ];
}
