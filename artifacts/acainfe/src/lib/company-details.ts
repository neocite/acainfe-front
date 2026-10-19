import { ApiError } from './api';
import { percentToBps } from './numbers';

export type ReadinessItem = { field: string; message: string };
export type OptionalCompanyField = 'municipalRegistration' | 'simplesNacionalTaxRateBps';
export const optionalCompanyLabels: Record<OptionalCompanyField, string> = {
  municipalRegistration: 'Inscrição municipal (CCM)',
  simplesNacionalTaxRateBps: 'Alíquota efetiva do Simples (%)',
};
export function isOptionalCompanyField(field: string): field is OptionalCompanyField {
  return Object.hasOwn(optionalCompanyLabels, field);
}

/** Campos recomendados vazios ficam ausentes: a estimativa é responsabilidade da API. */
export function optionalCompanyPatch(
  recommended: ReadinessItem[],
  values: { municipalRegistration: string; simplesNacionalTaxRateBps: string },
): { municipalRegistration?: string; simplesNacionalTaxRateBps?: number } {
  const patch: { municipalRegistration?: string; simplesNacionalTaxRateBps?: number } = {};
  for (const item of recommended) {
    if (!isOptionalCompanyField(item.field)) continue;
    const value = values[item.field].trim();
    if (!value) continue;
    if (item.field === 'municipalRegistration') patch.municipalRegistration = value;
    else {
      const bps = percentToBps(value);
      if (bps === null || bps > 3300) {
        const message = 'Informe um percentual válido entre 0 e 33%, ex.: 6 ou 6,25.';
        throw new ApiError(422, message, { simplesNacionalTaxRateBps: message });
      }
      patch.simplesNacionalTaxRateBps = bps;
    }
  }
  return patch;
}
