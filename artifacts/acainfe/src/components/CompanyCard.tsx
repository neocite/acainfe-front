import * as React from 'react';
import { Building2 } from 'lucide-react';
import { companyDisplayName, type CompanyProfile } from '../lib/company-profile';

export function CompanyCard({ status }: { status: CompanyProfile }) {
  const cnpj = status.tenant.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return <div className="company-summary"><Building2 size={24} /><div>
    <strong>{companyDisplayName(status)}</strong>
    <p>{cnpj} {status.company?.cityName && `· ${status.company.cityName}/${status.company.uf || ''}`}</p>
    <small>{status.tenant.taxRegime?.replaceAll('_', ' ')}</small>
  </div></div>;
}
