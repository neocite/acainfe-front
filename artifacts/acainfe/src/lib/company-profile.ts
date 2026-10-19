export type CompanyProfile = {
  tenant: { id: string; cnpj?: string; taxRegime?: string; legalName?: string; tradeName?: string; name?: string };
  company?: { legalName?: string; tradeName?: string; cityName?: string; uf?: string };
};

function nonEmpty(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function companyDisplayName(profile: CompanyProfile): string {
  return nonEmpty(profile.company?.legalName)
    || nonEmpty(profile.tenant.legalName)
    || nonEmpty(profile.company?.tradeName)
    || nonEmpty(profile.tenant.tradeName)
    || nonEmpty(profile.tenant.name)
    || 'Nome da empresa não informado pela API';
}

/** Respostas resumidas não apagam o perfil recebido no certificado ou cadastro completo. */
export function mergeCompanyProfile<T extends CompanyProfile>(previous: T | null | undefined, next: T): T {
  if (!previous || previous.tenant.id !== next.tenant.id) return next;
  const company = { ...previous.company, ...next.company };
  for (const field of ['legalName', 'tradeName', 'cityName', 'uf'] as const) {
    const tenantValue = field === 'legalName' || field === 'tradeName' ? nonEmpty(next.tenant[field]) : undefined;
    const value = nonEmpty(next.company?.[field]) || tenantValue || nonEmpty(previous.company?.[field]);
    if (value) company[field] = value;
  }
  return {
    ...next,
    tenant: {
      ...next.tenant,
      ...Object.fromEntries(['legalName', 'tradeName', 'name'].flatMap(field => {
        const key = field as 'legalName' | 'tradeName' | 'name';
        const value = nonEmpty(next.tenant[key]) || nonEmpty(previous.tenant[key]);
        return value ? [[key, value]] : [];
      })),
    },
    ...(Object.keys(company).length ? { company } : {}),
  };
}
