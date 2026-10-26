import { api } from './api';

export type BillingPayment = {
  id?: string;
  paymentId: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  currency: 'BRL';
  amountCents: number;
  paidAmountCents?: number | null;
  paidAt?: string | null;
  pixCopyPaste: string;
  pixQrCodeImage: string;
  expiresAt: string;
};

export function parseBillingPayment(value: unknown, expectedId?: string): BillingPayment {
  const p = value as Partial<BillingPayment> | null;
  if (!p || typeof p.paymentId !== 'string' || !p.paymentId ||
      (expectedId !== undefined && p.paymentId !== expectedId) ||
      !['PENDING', 'PAID', 'EXPIRED'].includes(p.status ?? '') || p.currency !== 'BRL' ||
      !Number.isSafeInteger(p.amountCents) || p.amountCents! <= 0 ||
      typeof p.pixCopyPaste !== 'string' || typeof p.pixQrCodeImage !== 'string' ||
      typeof p.expiresAt !== 'string' || !Number.isFinite(Date.parse(p.expiresAt)) ||
      (p.status === 'PAID' && (!Number.isSafeInteger(p.paidAmountCents) || p.paidAmountCents! <= 0))) {
    throw new Error('A API não retornou os dados necessários para confirmar este Pix. Tente novamente em instantes.');
  }
  return p as BillingPayment;
}

export async function createBillingPayment(base: string) {
  return parseBillingPayment(await api(`${base}/billing/payments`, 'POST'));
}
export async function getBillingPayment(base: string, paymentId: string) {
  return parseBillingPayment(await api(`${base}/billing/payments/${encodeURIComponent(paymentId)}`), paymentId);
}

// Remember only a pointer, never a Pix code or QR image. The API rechecks ownership.
const pointerKey = (base: string) => `acainfe.billing.last-payment:${base}`;
export function rememberBillingPayment(base: string, paymentId: string) {
  try { window.sessionStorage.setItem(pointerKey(base), paymentId); } catch { /* Optional recovery. */ }
}
export function lastBillingPayment(base: string): string | null {
  try { return window.sessionStorage.getItem(pointerKey(base)); } catch { return null; }
}
