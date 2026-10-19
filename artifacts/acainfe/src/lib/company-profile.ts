export type CompanyProfile = {
  tenant: { id: string; cnpj?: string; taxRegime?: string; legalName?: string; tradeName?: string; name?: string; effectiveIssRateBps?: number | null; environment?: string; certificateExpiresAt?: string | null };
  company?: { legalName?: string; tradeName?: string; cityName?: string; uf?: string };
  certificate?: { expiresAt?: string | null; validUntil?: string | null } | null;
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
      ...(!Object.hasOwn(next.tenant, 'certificateExpiresAt') && previous.tenant.certificateExpiresAt !== undefined
        ? { certificateExpiresAt: previous.tenant.certificateExpiresAt } : {}),
      ...Object.fromEntries(['legalName', 'tradeName', 'name'].flatMap(field => {
        const key = field as 'legalName' | 'tradeName' | 'name';
        const value = nonEmpty(next.tenant[key]) || nonEmpty(previous.tenant[key]);
        return value ? [[key, value]] : [];
      })),
    },
    ...(next.certificate === undefined
      ? (previous.certificate !== undefined ? { certificate: previous.certificate } : {})
      : { certificate: next.certificate === null ? null : { ...previous.certificate, ...next.certificate } }),
    ...(Object.keys(company).length ? { company } : {}),
  };
}

export function companyStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Ativa', INACTIVE: 'Inativa', PENDING: 'Pendente',
    SUSPENDED: 'Suspensa', BLOCKED: 'Bloqueada', DISABLED: 'Desativada',
    WAITLIST: 'Na lista de espera', REJECTED: 'Rejeitada',
  };
  return status ? labels[status.toUpperCase()] || 'Status não reconhecido' : 'Não informado';
}

export function certificateExpiryLabel(profile: CompanyProfile): string {
  const value = profile.certificate?.expiresAt || profile.certificate?.validUntil || profile.tenant.certificateExpiresAt;
  if (!value) return 'Validade não informada';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Validade inválida';
  // A data fiscal não deve recuar um dia por causa do fuso do navegador.
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}
