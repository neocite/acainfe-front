type CompanyEntry = {
  availability: { status: string };
  readiness: { canIssue: boolean; recommended?: { field: string }[] };
  tenant: { integrations?: { abacatepay?: boolean } };
};

/** Só empresas prontas e conectadas entram no painel; as outras retomam o cadastro. */
export function onboardingEntry(company?: CompanyEntry): { step: number; view: 'wizard' | 'panel' } {
  if (!company || company.availability.status === 'WAITLIST') return { step: 1, view: 'wizard' };
  if (!company.readiness.canIssue || company.readiness.recommended?.some(item => item.field === 'municipalRegistration')) return { step: 3, view: 'wizard' };
  if (company.tenant.integrations?.abacatepay !== true) return { step: 4, view: 'wizard' };
  return { step: 5, view: 'panel' };
}
