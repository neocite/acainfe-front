import * as React from 'react';
import { AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { ApiError, api } from '../lib/api';
import { getProducts, parseProducts, type TaxProduct } from '../lib/products';
import { formatCents } from '../lib/numbers';

type Props = { base: string; onUnauthorized: (e: ApiError) => void; onChanged?: () => void };

/** Converte "97,50" em centavos inteiros, sem multiplicar decimais. */
export function priceToCents(input: string): number | null {
  const m = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function Products({ base, onUnauthorized, onChanged }: Props) {
  const [items, setItems] = React.useState<TaxProduct[] | null>(null);
  const [loadError, setLoadError] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [formError, setFormError] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const onUnauthRef = React.useRef(onUnauthorized);
  onUnauthRef.current = onUnauthorized;

  const fail = (e: unknown, set: (m: string) => void) => {
    if (e instanceof ApiError && e.status === 401) { onUnauthRef.current(e); return; }
    set(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.');
  };

  const load = React.useCallback(async () => {
    setLoadError('');
    try { setItems(await getProducts<TaxProduct>(`${base}/products`)); }
    catch (e) { setItems(null); fail(e, setLoadError); }
  }, [base]);
  React.useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating || confirming) return;
    const cents = priceToCents(price);
    if (!name.trim()) return setFormError('Informe o nome do produto.');
    if (cents === null) return setFormError('Informe um preço válido, com até 2 casas decimais. Ex.: 97 ou 97,50.');
    setFormError(''); setCreating(true);
    try {
      await api(`${base}/products`, 'POST', { name: name.trim(), serviceDescription: description.trim(), defaultPriceCents: cents });
      setName(''); setDescription(''); setPrice(''); setOpen(false);
      await load(); onChanged?.();
    } catch (err) { fail(err, setFormError); }
    finally { setCreating(false); }
  }

  async function confirm(p: TaxProduct) {
    if (confirming || creating) return;
    setConfirming(p.id); setActionError(''); setNotice('');
    try {
      const res = await api<{ product: TaxProduct; releasedHeldSales?: number }>(
        `${base}/products/${encodeURIComponent(p.id)}/confirm-tax`, 'POST', { userConfirmed: true });
      const product = parseProducts<TaxProduct>([res.product])[0];
      setItems(cur => cur && cur.map(i => i.id === p.id ? product : i));
      const n = Number(res.releasedHeldSales ?? 0);
      if (n > 0) setNotice(`${n} ${n === 1 ? 'venda retida virou nota.' : 'vendas retidas viraram nota.'}`);
      onChanged?.();
    } catch (err) { fail(err, setActionError); }
    finally { setConfirming(null); }
  }

  return <section className="products-panel" aria-label="Produtos">
    <div className="products-head">
      <h2>Produtos</h2>
      <button type="button" className="app-secondary" aria-expanded={open} disabled={creating || confirming !== null} onClick={() => setOpen(o => !o)}>
        <Plus size={15} /> Novo produto</button>
    </div>
    {open && <form className="product-form" onSubmit={create}>
      <label className="app-field">Nome
        <input value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="off" required /></label>
      <label className="app-field">Descrição
        <input value={description} onChange={e => setDescription(e.target.value)} maxLength={300} autoComplete="off" /></label>
      <label className="app-field">Preço (R$)
        <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="97,00" autoComplete="off" required /></label>
      {formError && <div className="app-alert" role="alert"><AlertCircle size={15} /><span>{formError}</span></div>}
      <div className="form-actions">
        <button type="button" className="app-secondary" onClick={() => setOpen(false)} disabled={creating}>Cancelar</button>
        <button type="submit" className="app-primary" disabled={creating || confirming !== null}>
          {creating ? 'Salvando...' : 'Criar produto'}</button>
      </div>
    </form>}
    {notice && <div className="app-success" role="status"><CheckCircle2 size={16} /><span>{notice}</span></div>}
    {actionError && <div className="app-alert" role="alert"><AlertCircle size={15} /><span>{actionError}</span></div>}
    {loadError && <div className="app-alert" role="alert"><AlertCircle size={15} />
      <div>{loadError}<button type="button" onClick={() => void load()}>Tentar novamente</button></div></div>}
    {!items && !loadError && <><div className="products-skel" /><div className="products-skel" /></>}
    {items && items.length === 0 && <div className="products-empty">Você ainda não tem produtos. Crie o primeiro em "Novo produto".</div>}
    {items?.map(p => <article className="product-card" key={p.id}>
      <div className="product-card__top">
        <strong>{p.name}</strong>
        {typeof p.defaultPriceCents === 'number' && <span>{formatCents(p.defaultPriceCents)}</span>}
      </div>
      {p.serviceDescription && <p className="app-muted">{p.serviceDescription}</p>}
      {p.warnings?.map((w, i) => <div className="product-warning" key={i}>{w}</div>)}
      {p.taxStatus === 'PENDING_REVIEW' && !!p.suggestedTaxProfile && <div className="product-suggest">
        <span className="product-badge">Tributação sugerida</span>
        <button type="button" className="app-primary" disabled={confirming !== null || creating} onClick={() => void confirm(p)}>
          {confirming === p.id ? 'Confirmando...' : 'Confirmar'}</button>
      </div>}
    </article>)}
  </section>;
}
