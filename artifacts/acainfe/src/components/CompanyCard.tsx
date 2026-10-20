import * as React from 'react';
import { Building2 } from 'lucide-react';
import { companyDisplayName, type CompanyProfile } from '../lib/company-profile';
import { bpsToPercent } from '../lib/numbers';

export function TestEnvironmentNotice({ environment }: { environment?: string }) {
  return environment === 'HOMOLOGATION' ? <div className="test-environment" role="status">Modo teste: as notas não têm valor fiscal e não são cobradas.</div> : null;
}

export function CompanyCard({ status, onFiscalSettings }: { status: CompanyProfile; onFiscalSettings?: () => void }) {
  const cnpj = status.tenant.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return <div className="company-summary"><Building2 size={24} /><div>
    <strong>{companyDisplayName(status)}</strong>
    <p>{cnpj} {status.company?.cityName && `· ${status.company.cityName}/${status.company.uf || ''}`}</p>
    <small>{status.tenant.taxRegime?.replaceAll('_', ' ')}</small>
    {status.tenant.effectiveIssRateBps !== undefined && <small> · ISS: {status.tenant.effectiveIssRateBps === null ? 'não informado' : `${bpsToPercent(status.tenant.effectiveIssRateBps)}%`}</small>}
    {onFiscalSettings && <button type="button" className="text-button" onClick={onFiscalSettings}>Ver dados fiscais</button>}
  </div></div>;
}
