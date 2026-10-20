import * as React from 'react';
import { approximateTaxPreview } from '../lib/fiscal-settings';

export function ApproximateTaxesFields({ rate, template, onRate, onTemplate, recommended = false, disabled = false, errors = {} }: {
  rate: string; template: string; onRate: (value: string) => void; onTemplate: (value: string) => void;
  recommended?: boolean; disabled?: boolean; errors?: Record<string, string>;
}) {
  return <section className={`approximate-taxes-fields${recommended ? ' app-notice' : ''}`} aria-label="Tributos aproximados (Lei 12.741)">
    <h3>Tributos aproximados (Lei 12.741)</h3>
    <p>Toda nota precisa informar o valor aproximado dos tributos. O percentual vem da tabela do IBPT; confirme com seu contador.</p>
    {recommended && <p className="app-muted">A prefeitura recomenda completar esta informação.</p>}
    <label className="app-field"><span>Percentual (%)</span><input inputMode="decimal" value={rate} onChange={e => onRate(e.target.value)} required disabled={disabled} aria-invalid={!!errors['approximateTaxes.rateBps']} />
      {errors['approximateTaxes.rateBps'] && <small className="danger-text" role="alert">{errors['approximateTaxes.rateBps']}</small>}</label>
    <label className="app-field"><span>Texto na nota</span><textarea rows={3} value={template} onChange={e => onTemplate(e.target.value)} required disabled={disabled} aria-invalid={!!errors['approximateTaxes.descriptionTemplate']} />
      {errors['approximateTaxes.descriptionTemplate'] && <small className="danger-text" role="alert">{errors['approximateTaxes.descriptionTemplate']}</small>}</label>
    <div className="tax-preview"><small>Prévia para uma venda de R$ 100,00</small><p>{approximateTaxPreview(rate, template)}</p></div>
  </section>;
}
