import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ApiError, api } from '../lib/api';
import { optionalCompanyLabels, optionalCompanyPatch, simplesRateInput, municipalRegistrationHelp, type OptionalCompanyField, type ReadinessItem } from '../lib/company-details';

export function CompanyRecommendationDialog<T>({
  base, item, onSaved, onClose, onUnauthorized,
}: {
  base: string;
  item: ReadinessItem & { field: OptionalCompanyField };
  onSaved: (status: T) => void;
  onClose: () => void;
  onUnauthorized: (error: ApiError) => void;
}) {
  const [value, setValue] = useState(item.field === 'simplesNacionalTaxRateBps' ? simplesRateInput(null, [item]) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) { setError('Preencha o campo para salvar. Você também pode deixar para depois.'); return; }
    setBusy(true); setError('');
    try {
      const patch = optionalCompanyPatch([item], {
        municipalRegistration: '', simplesNacionalTaxRateBps: '', [item.field]: value,
      });
      const status = await api<T>(base, 'PATCH', patch);
      onSaved(status);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.');
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
    } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="company-recommendation-dialog">
      <DialogTitle>{optionalCompanyLabels[item.field]}</DialogTitle>
      <DialogDescription>{item.field === 'municipalRegistration' ? municipalRegistrationHelp : item.message}</DialogDescription>
      <form onSubmit={save}>
        <label className="app-field" htmlFor="recommended-company-value">
          <span>{optionalCompanyLabels[item.field]}</span>
          <input id="recommended-company-value" value={value} onChange={e => setValue(e.target.value)}
            inputMode={item.field === 'simplesNacionalTaxRateBps' ? 'decimal' : 'text'}
            required disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'recommendation-error' : undefined} />
        </label>
        {error && <p id="recommendation-error" className="danger-text" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="app-secondary" type="button" disabled={busy} onClick={onClose}>Agora não</button>
          <button className="app-primary" type="submit" disabled={busy}>{busy && <Loader2 size={17} className="spin" />}{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
