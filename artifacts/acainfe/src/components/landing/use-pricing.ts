import { useQuery } from '@tanstack/react-query';
import { PRICE_PER_INVOICE_CENTS } from '@/config/pricing';

export type PublicPricing = { pricePerInvoiceCents: number; monthlyFeeCents: number };
const FALLBACK: PublicPricing = { pricePerInvoiceCents: PRICE_PER_INVOICE_CENTS, monthlyFeeCents: 0 };

export function usePricing(): PublicPricing {
  const { data } = useQuery({
    queryKey: ['public-pricing'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<PublicPricing> => {
      const r = await fetch('/api/public/pricing', { credentials: 'include' });
      if (!r.ok) throw new Error('pricing');
      const j = await r.json();
      const p = Number(j.pricePerInvoiceCents);
      const m = Number(j.monthlyFeeCents);
      if (!Number.isFinite(p) || p < 0) throw new Error('pricing');
      return { pricePerInvoiceCents: p, monthlyFeeCents: Number.isFinite(m) && m >= 0 ? m : 0 };
    },
  });
  return data ?? FALLBACK;
}
