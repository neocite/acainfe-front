import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { DefaultProductDecision, SaleProduct } from '../lib/past-sales';

type Props = {
  base: string;
  options: SaleProduct[];
  suggestedProductId?: string | null;
  decidedProductId?: string | null;
  decided?: boolean;
  submitLabel?: string;
  onSaved: (decision: DefaultProductDecision) => void | Promise<void>;
  onCancel?: () => void;
  onUnauthorized: (error: ApiError) => void;
};

const NONE = '__none__';

export function DefaultProductChoice({ base, options, suggestedProductId, decidedProductId, decided, submitLabel = 'Salvar', onSaved, onCancel, onUnauthorized }: Props) {
  const initial = decided ? (decidedProductId ?? NONE) : options.some(option => option.id === suggestedProductId) ? suggestedProductId! : '';
  const [choice, setChoice] = React.useState<string>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const name = React.useId();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !choice) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const productId = choice === NONE ? null : choice;
      const res = await api<{ defaultProduct?: DefaultProductDecision }>(`${base}/abacatepay/default-product`, 'PUT', { productId });
      if (!res?.defaultProduct || res.defaultProduct.decided !== true || res.defaultProduct.productId !== productId) throw new Error('A API não confirmou a escolha do produto padrão. Tente novamente.');
      await onSaved(res.defaultProduct);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o produto padrão.');
    } finally { lock.current = false; setBusy(false); }
  }

  return <form className="default-product-choice" onSubmit={event => { void save(event); }}>
    <fieldset disabled={busy}>
      <legend>Quando um pagamento chegar sem produto, qual produto vai na nota?</legend>
      <p className="as-note">Pix transparente do AbacatePay não informa o produto. Se você vende só um produto, escolha-o. Se vende vários, escolha ‘Nenhum’ e peça ao seu sistema para enviar o produto no Pix, em metadata.productExternalId.</p>
      <p className="as-note"><strong>Atenção:</strong> com um produto padrão, todo Pix sem produto vira nota, inclusive pagamentos de teste.</p>
      {options.map(option => <label key={option.id} className="dpc-option">
        <input type="radio" name={name} value={option.id} checked={choice === option.id} onChange={() => setChoice(option.id)} /><span>{option.name}</span>
      </label>)}
      <label className="dpc-option">
        <input type="radio" name={name} value={NONE} checked={choice === NONE} onChange={() => setChoice(NONE)} /><span>Nenhum: esses pagamentos não geram nota.</span>
      </label>
    </fieldset>
    {error && <div className="app-alert" role="alert"><AlertCircle size={15} /><span>{error}</span></div>}
    <div className="as-actions form-actions">
      {onCancel && <button type="button" className="app-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>}
      <button type="submit" className="app-primary" disabled={busy || !choice}>{busy ? 'Salvando...' : submitLabel}</button>
    </div>
  </form>;
}
