import { api, ApiError } from './api';

export type PastSalesPeriod = {
  period: string; isCurrentMonth: boolean; requiresConfirmation: boolean;
  available: { count: number; totalCents: number; withoutItems: number };
  alreadyIssued: number; imported: number; refunded: number;
};
export type PastSalesPreview = { periods?: PastSalesPeriod[]; warning?: string };
export type PastSale = {
  id: string; paidAt: string; amountCents: number;
  customer?: { name?: string } | null; status: 'AVAILABLE' | 'ALREADY_ISSUED';
};
export type PastSalesResult = {
  issued: number; held: number; skippedWithoutProduct: number; failed: { message: string }[];
};
export type SaleProduct = { id: string; name: string };
export type AbacatePayConnection = {
  imported: number; pendingTaxReview?: SaleProduct[]; pastSales?: PastSalesPreview;
  confirmedByProfile?: SaleProduct[]; skippedTestProducts?: string[];
  mergedDuplicates?: { name: string; externalId: string; productId: string }[];
};

export function periodLabel(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Período inválido.');
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1))).replace(' de ', '/');
}
export function pastPeriodWarning(period: string): string {
  const label = periodLabel(period);
  const month = label.split('/')[0];
  return `Essas vendas são de ${label}. A nota sai com a competência de ${month}. Se você é do Simples Nacional e essa receita não entrou no DAS de ${month}, seu contador vai precisar retificar a declaração (pode haver multa e juros). Recomendamos confirmar com seu contador antes.`;
}
export function sortedPeriods(preview: PastSalesPreview): PastSalesPeriod[] {
  return [...(preview.periods || [])].sort((a, b) => b.period.localeCompare(a.period));
}
export async function getPastSales(base: string): Promise<PastSalesPreview> {
  const data = await api<PastSalesPreview>(`${base}/past-sales`);
  if (!Array.isArray(data.periods) && typeof data.warning !== 'string') throw new Error('A API não retornou a lista de vendas passadas.');
  return data;
}
export async function getPastSalesItems(base: string, period: string): Promise<PastSale[]> {
  periodLabel(period);
  const data = await api<PastSale[] | { items: PastSale[] }>(`${base}/past-sales/items?${new URLSearchParams({ period, status: 'AVAILABLE,ALREADY_ISSUED' })}`);
  const items = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(items)) throw new Error('A API não retornou os itens de vendas.');
  return items.filter(item => item.status === 'AVAILABLE' || item.status === 'ALREADY_ISSUED');
}
export function markPastSales(base: string, target: { ids: string[] } | { period: string }, alreadyIssued: boolean) {
  return api(`${base}/past-sales/mark`, 'POST', { ...target, alreadyIssued });
}
export function issuePastSales(base: string, period: PastSalesPeriod, confirmed: boolean, fallbackProductId?: string) {
  periodLabel(period.period);
  if (period.requiresConfirmation && !confirmed) throw new ApiError(422, pastPeriodWarning(period.period));
  if (period.available.withoutItems > 0 && !fallbackProductId) throw new ApiError(422, 'Escolha um produto para as vendas por Pix avulso sem produto.');
  return api<PastSalesResult>(`${base}/past-sales/issue`, 'POST', {
    period: period.period,
    ...(period.requiresConfirmation ? { confirmPastPeriod: true } : {}),
    ...(fallbackProductId ? { fallbackProductId } : {}),
  });
}
