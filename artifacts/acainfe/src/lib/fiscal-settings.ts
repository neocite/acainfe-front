import { ApiError } from './api';
import { bpsToPercent, percentToBps } from './numbers';
import type { ReadinessItem } from './company-details';

export const DEFAULT_TAX_TEMPLATE = 'Valor aprox dos tributos: R$ [ValorTributos]. Fonte: IBPT';
export type ApproximateTaxes = { rateBps: number; descriptionTemplate: string };
export type Emission = {
  system?: 'NACIONAL' | 'GINFES'; systemLabel?: string; environment?: string;
  approvalRequired?: boolean; series?: string | number | null; nextNumber?: number | null;
};
export type Accountant = { name?: string | null; email?: string | null; whatsapp?: string | null };
export type FiscalSettings = {
  company: {
    cnpj?: string; legalName?: string; tradeName?: string; municipalRegistration?: string | null;
    city?: { code?: string; name?: string; uf?: string }; taxRegimeLabel?: string;
    simplesNacionalTaxRateBps?: number | null; simplesRateIsEstimate?: boolean;
    cnaes?: { code: string; description: string; primary: boolean }[];
  };
  emission: Emission;
  taxDefaults?: {
    profileLabel?: string; validated?: boolean; nationalServiceCode?: string | null;
    localServiceCode?: string | null; nbsCode?: string | null; issRetention?: boolean | string | null;
    ibsCbs?: { cst?: string; cClassTrib?: string; operationIndicator?: string };
  } | null;
  issRate?: { bps?: number | null; source: 'INFORMED' | 'SIMPLES_ESTIMATE' | 'NOT_SET' };
  approximateTaxes?: ApproximateTaxes | null;
  certificate?: { present: boolean; expiresAt?: string | null; expired?: boolean; daysUntilExpiry?: number | null };
  accountant?: Accountant | null;
  products?: { name: string; status: string; nationalServiceCode?: string | null; localServiceCode?: string | null; nbsCode?: string | null; warnings?: string[] }[];
  readiness?: { missing?: ReadinessItem[]; recommended?: ReadinessItem[] };
  text: string;
};

export function approximateTaxInputs(value?: ApproximateTaxes | null) {
  return { rate: bpsToPercent(value?.rateBps ?? 1553), template: value?.descriptionTemplate ?? DEFAULT_TAX_TEMPLATE };
}
export function approximateTaxPatch(rate: string, template: string): ApproximateTaxes {
  const rateBps = percentToBps(rate);
  if (rateBps === null || rateBps > 10000) {
    throw new ApiError(422, 'Informe o percentual de tributos aproximados entre 0 e 100%.', { 'approximateTaxes.rateBps': 'Informe um percentual entre 0 e 100%.' });
  }
  if (!template.trim()) throw new ApiError(422, 'Informe o texto dos tributos aproximados na nota.', { 'approximateTaxes.descriptionTemplate': 'Informe o texto na nota.' });
  return { rateBps, descriptionTemplate: template.trim() };
}
export function approximateTaxPreview(rate: string, template: string): string {
  const bps = percentToBps(rate);
  if (bps === null || bps > 10000) return 'Informe um percentual válido para ver a prévia.';
  // Em uma venda de R$ 100, o total em centavos corresponde aos pontos-base.
  const amount = (bps / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return template.replaceAll('[ValorTributos]', amount);
}
export const isTestEnvironment = (emission?: Emission | null, tenantEnvironment?: string) =>
  emission?.environment === 'HOMOLOGATION' || tenantEnvironment === 'HOMOLOGATION';
