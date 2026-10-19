import * as React from 'react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { FiscalProfile } from '../lib/fiscal-profiles';
import type { ReadinessItem } from '../lib/company-details';

type Props = {
  missing: ReadinessItem[]; businessType: string; issRate: string;
  onBusinessType: (value: string) => void; onIssRate: (value: string) => void;
  errors: Record<string, string>; disabled: boolean; onUnauthorized: (error: ApiError) => void;
};
export function FiscalCompanyFields({ missing, businessType, issRate, onBusinessType, onIssRate, errors, disabled, onUnauthorized }: Props) {
  const needsBusiness = missing.some(item => item.field === 'businessType');
  const iss = missing.find(item => item.field === 'issRateBps');
  const [profiles, setProfiles] = useState<FiscalProfile[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!needsBusiness) return;
    let active = true;
    setLoading(true); setError('');
    api<unknown>('/app/fiscal-profiles').then(data => {
      if (!Array.isArray(data) || data.length === 0 || !data.every(p =>
        p && typeof p.businessType === 'string' && typeof p.label === 'string' && typeof p.examples === 'string'
      )) throw new Error('Não foi possível carregar os tipos de negócio.');
      if (active) setProfiles(data);
    }).catch(e => {
      if (!active) return;
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os tipos de negócio.');
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [needsBusiness, attempt]);
  return <>
    {needsBusiness && <fieldset className="fiscal-business" disabled={disabled}>
      <legend>O que você vende?</legend>
      {loading && <p role="status">Carregando opções…</p>}
      {error && <div className="app-alert" role="alert">{error}<button type="button" className="text-button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
      <div className="fiscal-business-options">{profiles.map(profile =>
        <label className={businessType === profile.businessType ? 'selected' : ''} key={profile.businessType}>
          <input type="radio" name="businessType" value={profile.businessType} checked={businessType === profile.businessType} required onChange={() => onBusinessType(profile.businessType)} />
          <span><strong>{profile.label}</strong><small>{profile.examples}</small></span>
        </label>)}</div>
      <p className="app-muted">Usamos isso para preencher a tributação dos seus produtos. Você pode revisar depois.</p>
      {errors.businessType && <p className="danger-text" role="alert">{errors.businessType}</p>}
    </fieldset>}
    {iss && <label className="app-field"><span>Alíquota de ISS do seu município (%)</span>
      <input value={issRate} inputMode="decimal" required disabled={disabled} onChange={event => onIssRate(event.target.value)} aria-invalid={!!errors.issRateBps} />
      <small>{iss.message}</small>{errors.issRateBps && <small className="danger-text" role="alert">{errors.issRateBps}</small>}
    </label>}
  </>;
}
