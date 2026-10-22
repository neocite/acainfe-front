import { ApiError } from './api';
import { percentToBps } from './numbers';
import type { ReadinessItem } from './company-details';

export type FiscalProfile = { businessType: string; label: string; examples: string; validated: boolean; validationNote?: string };
export function fiscalCompanyPatch(missing: ReadinessItem[], values: { businessType: string; issRate: string }) {
  const patch: { businessType?: string; issRateBps?: number } = {};
  if (missing.some(item => item.field === 'businessType')) {
    if (!values.businessType.trim()) {
      const message = 'Escolha o que você vende para continuar.';
      throw new ApiError(422, message, { businessType: message });
    }
    patch.businessType = values.businessType;
  }
  if (missing.some(item => item.field === 'issRateBps')) {
    const bps = percentToBps(values.issRate);
    if (bps === null || bps < 200 || bps > 500) {
      const message = 'Informe entre 2% e 5%, ex.: 2 ou 2,5';
      throw new ApiError(422, message, { issRateBps: message });
    }
    patch.issRateBps = bps;
  }
  return patch;
}
