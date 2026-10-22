import { percentToBps } from './numbers';

export type CodeOption = string | { code: string; description?: string };
export type ServiceCode = {
  nationalServiceCode: string; lc116Item: string; description: string;
  nbsOptions?: CodeOption[]; operationIndicators?: CodeOption[];
};
export const optionCode = (option: CodeOption) => typeof option === 'string' ? option : option.code;
export const optionLabel = (option: CodeOption) => typeof option === 'string' ? option : `${option.code}${option.description ? ' — ' + option.description : ''}`;
export type TaxProfile = {
  nationalServiceCode: string; nbsCode: string; localServiceCode?: string;
  issRateBps?: number; issRetention: string;
  ibsCbs: { cst: string; cClassTrib: string; operationIndicator: string };
  approximateTaxRateBps?: number;
};
export type DefaultServiceInputs = {
  nationalServiceCode: string; nbsCode: string; localServiceCode: string;
  iss: string; retention: string; cst: string; classification: string; operation: string; approximate: string;
};
export function defaultServicePatch(values: DefaultServiceInputs, system?: string, selected?: ServiceCode) {
  if (!values.nationalServiceCode.trim()) throw new Error('Escolha um código de serviço.');
  const options = selected?.nbsOptions ?? [];
  if (options.length && !options.some(o => optionCode(o) === values.nbsCode)) throw new Error('Escolha um NBS entre as opções deste serviço.');
  if (!['NONE', 'TOMADOR', 'INTERMEDIARIO'].includes(values.retention)) throw new Error('Escolha a retenção de ISS.');
  const taxProfile: TaxProfile = {
    nationalServiceCode: values.nationalServiceCode, nbsCode: values.nbsCode.trim(),
    issRetention: values.retention,
    ibsCbs: { cst: values.cst.trim(), cClassTrib: values.classification.trim(), operationIndicator: values.operation.trim() },
  };
  if (!taxProfile.ibsCbs.cst || !taxProfile.ibsCbs.cClassTrib || !taxProfile.ibsCbs.operationIndicator) throw new Error('Preencha os campos de IBS/CBS.');
  if (system === 'PAULISTANA' && values.localServiceCode.trim() && !/^\d{5}$/.test(values.localServiceCode.trim())) throw new Error('O código municipal de São Paulo deve ter 5 dígitos.');
  if ((system === 'PAULISTANA' || system === 'GINFES') && values.localServiceCode.trim()) taxProfile.localServiceCode = values.localServiceCode.trim();
  for (const [input, field, label] of [[values.iss, 'issRateBps', 'ISS'], [values.approximate, 'approximateTaxRateBps', 'tributos aproximados']] as const) {
    if (!input.trim()) continue;
    const bps = percentToBps(input);
    if (bps === null || bps > 10000) throw new Error(`Informe o percentual de ${label} entre 0 e 100%, com até duas casas decimais.`);
    taxProfile[field] = bps;
  }
  return { defaultService: { taxProfile } };
}
