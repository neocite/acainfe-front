import { api } from './api';

export type Product = { id: string; name: string };
export type TaxProduct = Product & {
  serviceDescription?: string; defaultPriceCents?: number;
  taxStatus?: string; suggestedTaxProfile?: unknown; warnings?: string[];
};

export function parseProducts<T extends Product = Product>(data: unknown): T[] {
  const envelope = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const list = Array.isArray(data) ? data : envelope.products ?? envelope.items ?? envelope.data;
  if (!Array.isArray(list) || !list.every(item =>
    item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string'
  )) throw new Error('A API retornou uma lista de produtos inválida.');
  return list;
}

export async function getProducts<T extends Product = Product>(path: string): Promise<T[]> {
  return parseProducts<T>(await api<unknown>(path));
}
