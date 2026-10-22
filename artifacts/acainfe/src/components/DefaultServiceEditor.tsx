import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { bpsToPercent } from '../lib/numbers';
import type { FiscalSettings } from '../lib/fiscal-settings';
import { defaultServicePatch, optionCode, optionLabel, type ServiceCode, type DefaultServiceInputs } from '../lib/default-service';

type Props = {
  base: string; system?: string; initial?: FiscalSettings['taxDefaults'];
  onSaved: () => void; onSkip?: () => void; onUnauthorized: (error: unknown) => void;
  beforeSave?: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
};
export function DefaultServiceEditor({ base, system, initial, onSaved, onSkip, onUnauthorized, beforeSave, onBusyChange, disabled }: Props) {
  const [values, setValues] = useState<DefaultServiceInputs>(() => ({
    nationalServiceCode: initial?.nationalServiceCode ?? '', nbsCode: initial?.nbsCode ?? '',
    localServiceCode: initial?.localServiceCode ?? '',
    iss: typeof initial?.issRateBps === 'number' ? bpsToPercent(initial.issRateBps) : '',
    retention: typeof initial?.issRetention === 'string' ? initial.issRetention : 'NONE',
    cst: initial?.ibsCbs?.cst ?? '000', classification: initial?.ibsCbs?.cClassTrib ?? '000001',
    operation: initial?.ibsCbs?.operationIndicator ?? '100301',
    approximate: typeof initial?.approximateTaxRateBps === 'number' ? bpsToPercent(initial.approximateTaxRateBps) : '',
  }));
  const [query, setQuery] = useState(initial?.nationalServiceCode ?? '');
  const [results, setResults] = useState<ServiceCode[]>([]);
  const [selected, setSelected] = useState<ServiceCode>();
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const auth = useRef(onUnauthorized); auth.current = onUnauthorized;
  const change = (key: keyof DefaultServiceInputs, value: string) => setValues(v => ({ ...v, [key]: value }));
  useEffect(() => {
    let active = true;
    setSearchError(''); setResults([]); setSearching(!!query.trim());
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      api<ServiceCode[]>(`/app/service-codes?q=${encodeURIComponent(query.trim())}`).then(data => {
        if (!Array.isArray(data) || !data.every(item => typeof item.nationalServiceCode === 'string' && typeof item.description === 'string' &&
          [item.nbsOptions, item.operationIndicators].every(options => options === undefined || Array.isArray(options) && options.every(o => typeof optionCode(o) === 'string')))) {
          throw new Error('A API retornou uma lista de códigos de serviço em formato inesperado.');
        }
        if (!active) return;
        setResults(data);
        const existing = data.find(item => item.nationalServiceCode === values.nationalServiceCode);
        if (existing) setSelected(existing);
      }).catch(e => { if (active) { setSearchError(e.message); if (e instanceof ApiError && e.status === 401) auth.current(e); } })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, retry]);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); if (e instanceof ApiError && e.status === 401) auth.current(e); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  function choose(item: ServiceCode) {
    setSelected(item);
    setValues(v => ({ ...v, nationalServiceCode: item.nationalServiceCode, nbsCode: '',
      localServiceCode: '', iss: '', operation: item.operationIndicators?.length ? optionCode(item.operationIndicators[0]) : '100301' }));
  }
  return <section className="app-notice default-service-editor" aria-label="Tributação padrão da empresa">
    <h3>Tributação padrão da empresa</h3>
    <p>Opcional. Isso vira só uma sugestão: cada produto continua precisando da sua confirmação antes de vender.</p>
    <fieldset disabled={busy || disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
      <label className="app-field"><span>Código de serviço — buscar</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="design, UX, consultoria, SaaS" /></label>
      {searching && <p role="status">Buscando serviços…</p>}
      {searchError && <div role="alert">{searchError} <button type="button" className="text-button" onClick={() => setRetry(v => v + 1)}>Tentar novamente</button></div>}
      {!searching && !searchError && query.trim() && !results.length && <p>Nenhum serviço encontrado.</p>}
      <div>{results.map(item => <label className="app-field" key={item.nationalServiceCode}><span>
        <input type="radio" name="defaultServiceCode" checked={values.nationalServiceCode === item.nationalServiceCode} onChange={() => choose(item)} /> {item.lc116Item} — {item.description}
      </span></label>)}</div>
      {values.nationalServiceCode && <p>Serviço selecionado: {values.nationalServiceCode}</p>}
      <label className="app-field"><span>NBS{selected?.nbsOptions?.length ? ' (obrigatório)' : ''}</span>
        <select value={values.nbsCode} onChange={e => change('nbsCode', e.target.value)} disabled={!selected?.nbsOptions?.length}>
          <option value="">{selected?.nbsOptions?.length ? 'Escolha um NBS' : 'Sem opções informadas para este serviço'}</option>
          {values.nbsCode && !selected && <option value={values.nbsCode}>{values.nbsCode}</option>}
          {selected?.nbsOptions?.map(o => <option key={optionCode(o)} value={optionCode(o)}>{optionLabel(o)}</option>)}
        </select></label>
      {(system === 'PAULISTANA' || system === 'GINFES') && <label className="app-field"><span>Código municipal</span><input value={values.localServiceCode} onChange={e => change('localServiceCode', e.target.value)} /><small>{system === 'PAULISTANA' ? 'Código de serviço da prefeitura de São Paulo, 5 dígitos, ex.: 02501' : 'Código de tributação de São Bernardo, ex.: 8.02/103911/1551'}</small></label>}
      <label className="app-field"><span>Alíquota de ISS (%)</span><input inputMode="decimal" value={values.iss} onChange={e => change('iss', e.target.value)} /></label>
      <button className="text-button" type="button" disabled={!values.nationalServiceCode} onClick={() => void run(async () => {
        const result = await api<{ issRateBps?: number }>(`${base}/municipal-rate/${encodeURIComponent(values.nationalServiceCode)}`);
        if (Number.isInteger(result.issRateBps) && result.issRateBps! >= 0) { change('iss', bpsToPercent(result.issRateBps!)); setNotice('Alíquota preenchida com a consulta à prefeitura.'); }
        else setNotice('A prefeitura não informou uma alíquota. Confira com seu contador.');
      })}>Consultar na prefeitura</button>
      <label className="app-field"><span>Retenção de ISS</span><select value={values.retention} onChange={e => change('retention', e.target.value)}>
        <option value="NONE">Sem retenção</option><option value="TOMADOR">Tomador</option><option value="INTERMEDIARIO">Intermediário</option>
      </select></label>
      <details><summary>Avançado</summary>
        {([['cst', 'IBS/CBS — CST'], ['classification', 'IBS/CBS — cClassTrib'], ['operation', 'IBS/CBS — Indicador de operação'], ['approximate', 'Tributos aproximados (IBPT, %)']] as const).map(([key, label]) =>
          <label className="app-field" key={key}><span>{label}</span><input value={values[key]} onChange={e => change(key, e.target.value)} /></label>)}
      </details>
      {error && <div className="app-alert" role="alert">{error}</div>}
      {notice && <p role="status">{notice}</p>}
      <div className="form-actions" style={{ flexWrap: 'wrap' }}>
        {onSkip && <button className="text-button" type="button" onClick={onSkip}>Pular</button>}
        <button className="app-secondary" type="button" onClick={() => void run(async () => {
          await api(base, 'PATCH', { defaultService: null }); onSaved();
        })}>Remover tributação padrão</button>
        <button className="app-primary" type="button" onClick={() => void run(async () => {
          if (searching || searchError || !selected || selected.nationalServiceCode !== values.nationalServiceCode) throw new Error('Busque e escolha um serviço para conferir as opções de NBS antes de salvar.');
          const patch = defaultServicePatch(values, system, selected);
          await beforeSave?.();
          await api(base, 'PATCH', patch); onSaved();
        })}>{busy ? 'Salvando…' : 'Salvar tributação padrão'}</button>
      </div>
    </fieldset>
  </section>;
}
