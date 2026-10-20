export const PRICE_PER_INVOICE_CENTS = 80;
export const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export type Plan = { name: string; monthly: number; included: number; extra: number | null; setup?: number };
export const plans: Plan[] = [
  { name: 'Focus NFe Solo', monthly: 9490, included: 100, extra: 11 },
  { name: 'Notazz Bronze', monthly: 13390, included: 100, extra: null, setup: 13390 },
  { name: 'eNotas Basic', monthly: 13700, included: 60, extra: 77 },
  { name: 'NFE.io Base', monthly: 19000, included: 250, extra: null },
];
export function monthlyCost(plan: Plan, count: number): number | null {
  if (plan.extra === null && count > plan.included) return null;
  return plan.monthly + Math.max(0, count - plan.included) * (plan.extra ?? 0);
}
export const SOURCES = 'Preços de entrada publicados nos sites oficiais, consultados em 19/10/2026: focusnfe.com.br, notazz.com, enotas.com.br/precos e nfe.io/precos. Valores mensais; a taxa de adesão anunciada do Notazz Bronze não entra na conta. Os planos e recursos não são iguais. Preços podem mudar; confirme com cada fornecedor.';
