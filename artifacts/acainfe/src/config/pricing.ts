export const PRICE_PER_INVOICE_CENTS = 80;
export const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const profiles: Record<string, number[]> = {
  'Faço lançamentos': [5, 5, 150, 5, 5, 5, 5, 5, 150, 5, 5, 5],
  'Estou começando': [0, 0, 0, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  'Vendo todo mês': Array(12).fill(40),
};
export type Plan = { name: string; monthly: number; included: number; extra: number | null; annual?: number; annualIncluded?: number; setup?: number };
export const plans: Plan[] = [
  { name: 'Spedy Essencial', monthly: 7400, included: 150, extra: 62, annual: 89000, annualIncluded: 1800 },
  { name: 'Focus NFe Solo', monthly: 9490, included: 100, extra: 11 },
  { name: 'Notazz Bronze', monthly: 13390, included: 100, extra: null, setup: 13390 },
  { name: 'eNotas Basic', monthly: 13700, included: 60, extra: 77 },
  { name: 'NFE.io Base', monthly: 19000, included: 250, extra: null },
];
export function monthlyCost(plan: Plan, count: number): number | null {
  if (plan.extra === null && count > plan.included) return null;
  return plan.monthly + Math.max(0, count - plan.included) * (plan.extra ?? 0);
}
export function annualCost(plan: Plan, months: number[]): number | null {
  if (plan.annual) return plan.annual + Math.max(0, months.reduce((a,b) => a+b, 0) - (plan.annualIncluded ?? 0)) * (plan.extra ?? 0);
  const costs = months.map(n => monthlyCost(plan, n));
  return costs.some(n => n === null) ? null : costs.reduce<number>((a,b) => a + (b ?? 0), 0);
}
export const SOURCES = 'Preços de entrada publicados nos sites oficiais de cada empresa, consultados em 19/10/2026: enotas.com.br/precos, nfe.io/precos, focusnfe.com.br/precos, spedy.com.br/precos e notazz.com. Valores sem impostos adicionais, cobrança mensal (Spedy: plano anual pago antecipadamente). Os planos têm recursos diferentes; compare antes de decidir. Para volumes acima de ~100 notas por mês, fale com a gente.';
